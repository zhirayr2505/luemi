import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import fastifyStatic from "@fastify/static";
import { readConfig } from "./config.js";
import {describeRealBetaPrerequisites} from "./beta-preflight.js";
import { buildApp } from "./app.js";
import { configureStagingTelegramBot } from "./telegram-setup.js";

if(process.env.LUEMI_BETA_PREFLIGHT==="1"){
  // Never log env values or credentials. This only describes missing field
  // names for the owner before applying high-risk admission switches.
  process.stdout.write(JSON.stringify(describeRealBetaPrerequisites(process.env))+"\n");
}
const config = readConfig();
const app = buildApp(config);
const staticRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../web/dist");

async function start(): Promise<void> {
  try {
    if (config.serveWeb) {
      await app.register(fastifyStatic, { root: staticRoot, prefix: "/", wildcard: false });
      // Public, authentication-free privacy information. The legal notice stays
      // explicitly review-only until the owner approves its live policy version.
      app.get("/privacy", async (_request,reply) =>
        reply.header("Cache-Control","no-store")
         .header("X-Robots-Tag","noindex, nofollow")
         .header("X-Content-Type-Options","nosniff")
         .type("text/html; charset=utf-8").sendFile("privacy.html")
      );
      app.setNotFoundHandler((request, reply) => {
        if (request.method === "GET" &&
          !request.url.startsWith("/api/") &&
          !request.url.startsWith("/assets/") &&
          request.headers.accept?.includes("text/html")) {
          return reply.sendFile("index.html");
        }
        return reply.code(404).send({ error: "not_found" });
      });
    }
    await app.listen({ port: config.port, host: "0.0.0.0" });
    app.log.info({ telegramSetupEnabled: Boolean(config.setupOnStart), originMatchesMain: config.origin === "https://luemi.onrender.com", webhookSecretPresent: Boolean(config.webhookSecret), botTokenPresent: Boolean(config.botToken) }, "LUEMI bot setup diagnostic");
    if (config.setupOnStart) {
      try {
        const setup = await configureStagingTelegramBot(config);
        app.log.info({ botUsername: setup.botUsername }, "LUEMI staging Telegram bot configured");
      } catch (error) {
        // Only errors with explicitly-authored static messages may be logged.
        // Never print fetched request URLs or Bot API data (token in URL).
        const reason = error instanceof Error &&
          /^(Telegram|Bot |Another|Invalid|staging|LUEMI)/.test(error.message)
            ? error.message
            : "Telegram setup request failed";
        app.log.error({ reason }, "LUEMI staging bot setup requires attention. No token details logged.");
      }
    }
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
}
void start();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { void app.close(); });
}
