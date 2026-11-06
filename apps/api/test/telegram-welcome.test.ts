import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import Fastify from "fastify";
import type { ApiConfig } from "../src/config.js";
import { registerTelegramWebhook, versionedWebAppUrl } from "../src/telegram-webhook.js";
import type { WelcomeState } from "../src/telegram-welcome-status.js";

const config: ApiConfig = {
  port: 3001, origin: "https://luemi.onrender.com",
  botToken: "123456:fake-credential", healthKey: "h".repeat(32),
  webhookSecret: "s".repeat(32), logger: false
};
const headers = { "x-telegram-bot-api-secret-token": "s".repeat(32) };

async function greeting(state: WelcomeState, from = 42, chat = 42) {
  const app = Fastify({ logger: false });
  let lookups = 0;
  registerTelegramWebhook(app, config, async id => {
    lookups++;
    assert.equal(id, 42);
    return state;
  });
  try {
    const res = await app.inject({
      method: "POST", url: "/api/telegram/webhook", headers,
      payload: { message: { text: "/start", from: { id: from },
        chat: { id: chat, type: "private" } } }
    });
    return { response: res.json(), lookups };
  } finally { await app.close(); }
}

test("new users see registration CTA, never an untrusted prefilled account", async () => {
  const {response,lookups}=await greeting("new");
  assert.equal(lookups,1);
  assert.equal(response.method,"sendMessage");
  assert.equal(response.parse_mode,"HTML");
  assert.match(response.text,/Люди ближе/);
  assert.match(response.reply_markup.inline_keyboard[0][0].text,/Зарегистрироваться/);
  assert.equal(response.reply_markup.inline_keyboard[0][0].web_app.url,
    versionedWebAppUrl(config.origin, process.env.RENDER_GIT_COMMIT));
});
test("registered users see resume CTA", async () => {
  const {response}=await greeting("registered");
  assert.match(response.text,/Твоя анкета уже здесь/);
  assert.match(response.reply_markup.inline_keyboard[0][0].text,/Продолжить знакомство/);
});
test("unavailable status uses neutral CTA; app owns final authentication", async () => {
  const {response}=await greeting("unknown");
  assert.match(response.reply_markup.inline_keyboard[0][0].text,/Начать знакомство/);
  assert.doesNotMatch(response.text,/Твоя анкета уже здесь/);
});
test("identity mismatch never performs profile lookup", async () => {
  const {response,lookups}=await greeting("registered",77,42);
  assert.equal(lookups,0);
  assert.match(response.reply_markup.inline_keyboard[0][0].text,/Начать знакомство/);
});
test("HTML widget is self-contained, zlib-ready and contains a working Mini App deep link", () => {
  const html = readFileSync(new URL("../../web/public/widgets/luemi-welcome.html", import.meta.url), "utf8");
  assert.ok(Buffer.byteLength(html) < 32768);
  assert.ok(deflateSync(Buffer.from(html), { level: 9 }).byteLength <= 4096);
  assert.match(html,/TelegramWidget/);
  assert.match(html,/openTelegramLink/);
  assert.match(html,/https:\/\/t\.me\/LuemiAppBot\?startapp=welcome/);
  assert.match(html,/chatData/);
  assert.ok(!/<script[^>]*src=|<link[^>]*href=|https?:\/\/[^"']*\.(?:png|webp|woff)/i.test(html));
});
