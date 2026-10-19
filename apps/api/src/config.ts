import type { FastifyServerOptions } from "fastify";
export interface ApiConfig {
  port: number;
  origin: string;
  botToken: string;
  healthKey: string;
  webhookSecret: string;
  stagingOnly?: boolean;
  serveWeb?: boolean;
  logger: FastifyServerOptions["logger"];
}
export function readConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const port = Number(env.PORT ?? "3001");
  const origin = env.APP_ORIGIN ?? "";
  const stagingOnly = env.STAGING_BOOTSTRAP_ONLY === "1";
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  if (!origin || origin === "*" || !/^https?:\/\//.test(origin))
    throw new Error("APP_ORIGIN must be an explicit origin");
  if (env.NODE_ENV === "production" && !origin.startsWith("https://"))
    throw new Error("Production APP_ORIGIN must use HTTPS");
  if (!stagingOnly && (!env.TELEGRAM_BOT_TOKEN || !/^\d+:[\w-]+$/.test(env.TELEGRAM_BOT_TOKEN)))
    throw new Error("TELEGRAM_BOT_TOKEN required");
  if (!stagingOnly && (!env.HEALTH_CHECK_KEY || env.HEALTH_CHECK_KEY.length < 24))
    throw new Error("HEALTH_CHECK_KEY must contain at least 24 characters");
  return {
    port,
    origin,
    stagingOnly,
    serveWeb: env.NODE_ENV === "production",
    botToken: stagingOnly ? "" : (env.TELEGRAM_BOT_TOKEN ?? ""),
    healthKey: env.HEALTH_CHECK_KEY ?? "",
    webhookSecret: stagingOnly ? "" : (env.TELEGRAM_WEBHOOK_SECRET ?? ""),
    logger: env.NODE_ENV !== "test"
  };
}
