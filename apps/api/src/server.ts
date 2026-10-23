import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import fastifyStatic from "@fastify/static";
import { readConfig } from "./config.js";
import { buildApp } from "./app.js";
import { configureStagingTelegramBot } from "./telegram-setup.js";

const config = readConfig();
const app = buildApp(config);
const staticRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../web/dist");

async function start(): Promise<void> {
  try {
    if (config.serveWeb) {
      await app.register(fastifyStatic, { root: staticRoot, prefix: "/", wildcard: false });
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
