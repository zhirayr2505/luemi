import assert from "node:assert/strict";
import test from "node:test";
import { Writable } from "node:stream";
import { buildApp } from "../src/app.js";

test("suppresses Fastify request lifecycle logs through LogController", async () => {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    }
  });
  const app = buildApp({
    port: 3001,
    origin: "http://localhost:5173",
    botToken: "",
    healthKey: "h".repeat(32),
    webhookSecret: "",
    logger: { level: "info", stream }
  });

  try {
    await app.ready();
    app.log.info("LUEMI_LOG_STREAM_PROBE");
    const response = await app.inject({ method: "GET", url: "/api/health/live" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok" });
  } finally {
    await app.close();
  }

  const output = lines.join("");
  assert.match(output, /LUEMI_LOG_STREAM_PROBE/, "test logger stream must capture an explicit log line");
  assert.doesNotMatch(output, /incoming request|request completed/, "Fastify request lifecycle logs must remain disabled");
});
