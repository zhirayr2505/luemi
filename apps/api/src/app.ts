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
import {registerChats} from "./chats-api.js";
import {registerMatches} from "./matches-api.js";
import {registerSafetyAppeals} from "./safety-appeal-api.js";
import {describeReleaseConfig} from "./release-readiness.js";
import {registerFaceTrustCapabilities} from "./facetrust-status.js";

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
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "X-Health-Key", "X-Luemi-CSRF", "X-Luemi-Client-Id"]
  });
  // One untrusted network peer must not consume static/health/geo actor quotas.
  // trustProxy stays FALSE until the real Render hop chain is independently proven.
  installNetworkLimits(hook=>app.addHook("onRequest",hook));
  installHttpPolicy(app,config.rem05c?.embedding);

  app.get("/api/health/live", async (): Promise<HealthResponse> => ({ status: "ok" }));
  const hasHealthAuthorization=(header:unknown):boolean=>
    typeof header==="string"&&!!config.healthKey&&equalSecret(header,config.healthKey);
  app.get("/api/health/ready", async (request, reply) => {
    if(!hasHealthAuthorization(request.headers["x-health-key"]))
      return reply.code(404).send({error:"not_found"});
    // HTTP readiness is NOT a successful DB/policy/E2E probe.
    const gate=describeReleaseConfig(config);
    return {status:"ready",database:"not_probed",stage:gate.state};
  });
  app.get("/api/health/release", async (request, reply) => {
    if(!hasHealthAuthorization(request.headers["x-health-key"]))
      return reply.code(404).send({error:"not_found"});
    reply.header("Cache-Control","no-store");
    return describeReleaseConfig(config);
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
  registerFaceTrustCapabilities(app,guards);
  registerPublishedProfiles(app,guards,config.realPublication);
  registerAccountErasure(app,guards,config.realErasure);
  registerSafetyAppeals(app,config.safetyAppeal);
  registerChats(app,guards,config.chats);
  registerMatches(app,guards,config.matches);
  return app;
}
