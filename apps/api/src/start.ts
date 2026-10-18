import Fastify from "fastify";
import staticPlugin from "@fastify/static";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const app = Fastify({ logger: true, bodyLimit: 1024 * 1024 });
app.get("/api/health", async () => ({ service: "luemi", status: "ok", stage: "demo" }));
app.get("/api/readiness", async (_request, reply) => reply.code(503).send({ status: "not_ready", reason: "Database and Telegram auth are not configured" }));

const dist = resolve(process.cwd(), "dist");
if (existsSync(dist)) {
  await app.register(staticPlugin, { root: dist, prefix: "/", wildcard: false });
  app.get("/*", async (request, reply) => {
    const pathname = request.url.split("?")[0];
    if (pathname.startsWith("/api/")) return reply.code(404).send({error:"Not found"});
    return reply.sendFile("index.html");
  });
}
const port = Number(process.env.PORT || 3001);
await app.listen({ host: "0.0.0.0", port });
