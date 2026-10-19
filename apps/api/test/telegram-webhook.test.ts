import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import type { ApiConfig } from "../src/config.js";

function config(): ApiConfig {
  return {
    port: 3001,
    origin: "https://luemi-stage01.onrender.com",
    botToken: "123456:test-credential",
    healthKey: "h".repeat(32),
    webhookSecret: "s".repeat(32),
    logger: false
  };
}
test("webhook rejects unsigned requests, then generates genuine Telegram Web App button", async () => {
  const app = buildApp(config());
  try {
    const payload = { message: { text: "/start", chat: { id: 12345, type: "private" } } };
    const unsigned = await app.inject({ method: "POST", url: "/api/telegram/webhook", payload });
    assert.equal(unsigned.statusCode, 404);
    const signed = await app.inject({ method: "POST", url: "/api/telegram/webhook", headers: {
      "x-telegram-bot-api-secret-token": "s".repeat(32)
    }, payload });
    assert.equal(signed.statusCode, 200);
    assert.equal(signed.json().reply_markup.inline_keyboard[0][0].web_app.url, "https://luemi-stage01.onrender.com");
  } finally { await app.close(); }
});
test("staging without credentials refuses Telegram auth", async () => {
  const app = buildApp({ ...config(), botToken: "", webhookSecret: "", stagingOnly: true });
  try {
    const r = await app.inject({ method: "POST", url: "/api/auth/telegram", payload: { initData: "untrusted" } });
    assert.equal(r.statusCode, 503);
  } finally { await app.close(); }
});
