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
import { installHttpPolicy } from "./rem05c-headers.js";

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
  // One untrusted network peer must not consume static/health/geo actor quotas.
  // trustProxy stays FALSE until the real Render hop chain is independently proven.
  app.register(rateLimit,{global:false,skipOnError:false});
  installHttpPolicy(app,config.rem05c?.embedding);

  app.get("/api/health/live", async (): Promise<HealthResponse> => ({ status: "ok" }));
  app.get("/api/health/ready", {config:{rateLimit:{max:30,timeWindow:"1 minute"}}}, async (request, reply) => {
    const secret = request.headers["x-health-key"];
    if (!config.healthKey || typeof secret !== "string" || !equalSecret(secret, config.healthKey))
      return reply.code(404).send({ error: "not_found" });
    return { status: "ready", database: "not_connected", stage: "01" };
  });
  app.post<{ Body: { initData?: unknown } }>("/api/auth/telegram", {config:{rateLimit:{max:10,timeWindow:"1 minute"}}}, async (request, reply) => {
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
  const guards=config.rem05b?.enabled?registerRem05b(app,config.rem05b):undefined;
  registerTelegramWebhook(app,config);
  registerGeography(app,config.rem05c?.geo,guards);
  return app;
}
