import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { timingSafeEqual } from "node:crypto";
import type { BootstrapResponse, HealthResponse } from "@luemi/contracts";
import type { ApiConfig } from "./config.js";
import { validateTelegramInitData } from "./telegram-auth.js";
import { registerTelegramWebhook } from "./telegram-webhook.js";
import { registerGeography } from "./geo-routes.js";
import { registerRem05b } from "./rem05b-session.js";

function equalSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function buildApp(config: ApiConfig) {
  const app = Fastify({
    logger: config.logger,
    bodyLimit: 10240,
    trustProxy: false,
    disableRequestLogging: true
  });
  app.register(cors, {
    origin: config.origin,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "X-Health-Key", "X-Luemi-CSRF"]
  });
  app.register(rateLimit, { max: 60, timeWindow: "1 minute" });
  app.addHook("onSend", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Frame-Options", "DENY");
  });

  app.get("/api/health/live", async (): Promise<HealthResponse> => ({ status: "ok" }));
  app.get("/api/health/ready", async (request, reply) => {
    const secret = request.headers["x-health-key"];
    if (!config.healthKey || typeof secret !== "string" || !equalSecret(secret, config.healthKey))
      return reply.code(404).send({ error: "not_found" });
    return { status: "ready", database: "not_connected", stage: "01" };
  });
  app.post<{ Body: { initData?: unknown } }>("/api/auth/telegram", async (request, reply) => {
    if (!config.botToken) return reply.code(503).send({ error: "service_unavailable" });
    const raw = request.body?.initData;
    if (typeof raw !== "string") return reply.code(401).send({ error: "invalid_init_data" });
    const identity = validateTelegramInitData(raw, config.botToken);
    if (!identity) return reply.code(401).send({ error: "invalid_init_data" });
    const response: BootstrapResponse = {
      mode: "bootstrap",
      user: { id: identity.user.id, firstName: identity.user.first_name }
    };
    return response;
  });
  if (config.rem05b?.enabled) registerRem05b(app, config.rem05b);
  registerTelegramWebhook(app, config);
  registerGeography(app);
  return app;
}
