import Fastify from "fastify";
import cors from "@fastify/cors";
import { timingSafeEqual } from "node:crypto";
import type { BootstrapResponse, HealthResponse } from "@luemi/contracts";
import type { ApiConfig } from "./config.js";
import { validateTelegramInitData } from "./telegram-auth.js";
import { registerTelegramWebhook } from "./telegram-webhook.js";
import { registerGeography } from "./geo-routes.js";
import { registerRem05b } from "./rem05b-session.js";
import { installHttpPolicy } from "./rem05c-headers.js";
import { installNetworkLimits } from "./rem05c-rate.js";
import { registerRem05d } from "./rem05d-private.js";
import { registerRealRegistrationDrafts } from "./real-registration-drafts.js";
import {registerPublishedProfiles} from "./real-publication.js";
import {registerAccountErasure} from "./real-erasure.js";
import {registerSafetyAppeals} from "./safety-appeal-api.js";
import { registerBlikiApi } from "./bliki/bliki-api.js";
import { registerBlikiPublicationApi } from "./bliki/bliki-publication-api.js";

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
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "X-Health-Key", "X-Luemi-CSRF"]
  });
  // One untrusted network peer must not consume static/health/geo actor quotas.
  // trustProxy stays FALSE until the real Render hop chain is independently proven.
  installNetworkLimits(hook=>app.addHook("onRequest",hook));
  installHttpPolicy(app,config.rem05c?.embedding);

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
  const guards=config.rem05b?.enabled?registerRem05b(app,config.rem05b):undefined;
  registerTelegramWebhook(app,config);
  registerGeography(app,config.rem05c?.geo,guards);
  registerRem05d(app,guards,config.rem05d);
  registerRealRegistrationDrafts(app,guards,config.realRegistration);
  registerPublishedProfiles(app,guards,config.realPublication);
  registerAccountErasure(app,guards,config.realErasure);
  registerSafetyAppeals(app,config.safetyAppeal);
  // Separate feature gates and DB principals; no routes without explicitly approved opt-in.
  registerBlikiPublicationApi(app, guards, config.blikiPublication);
  registerBlikiApi(app, guards, config.bliki);
  return app;
}
