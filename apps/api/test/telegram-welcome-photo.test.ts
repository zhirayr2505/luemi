import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { ApiConfig } from "../src/config.js";
import { registerTelegramWebhook, versionedWebAppUrl } from "../src/telegram-webhook.js";
import { sendTelegramWelcomePhoto, welcomePhotoUrl } from "../src/telegram-welcome-photo.js";
import type { WelcomePhotoMessage } from "../src/telegram-welcome-photo.js";

const config: ApiConfig = {
  port: 3001, origin: "https://luemi.onrender.com",
  botToken: "123456:fake-credential",
  webhookSecret: "s".repeat(32),
  healthKey: "h".repeat(32), logger: false
};

test("composed welcome banner is converted to a JPEG; no user data in URL", () => {
  const url = new URL(welcomePhotoUrl(config.origin));
  assert.equal(url.origin, "https://wsrv.nl");
  assert.equal(url.searchParams.get("output"), "jpg");
  assert.equal(url.searchParams.get("fit"), "cover");
  assert.equal(url.searchParams.get("url"), config.origin + "/assets/telegram/luemi-welcome-banner.svg");
  assert.doesNotMatch(url.toString(), /fake-credential|telegram_id|chat_id/);
});

test("signed /start sends a single branded photo with native Mini App button", async () => {
  const app = Fastify({ logger: false });
  let photo: WelcomePhotoMessage | undefined;
  registerTelegramWebhook(app, config, async () => "new", async (_token, payload) => {
    photo = payload;
    return true;
  });
  try {
    const res = await app.inject({ method: "POST", url: "/api/telegram/webhook",
      headers: { "x-telegram-bot-api-secret-token": config.webhookSecret },
      payload: { message: { text: "/start", from: { id: 42 }, chat: { id: 42, type: "private" } } } });
    assert.deepEqual(res.json(), { ok: true });
    assert.equal(photo?.chat_id, 42);
    assert.match(photo?.caption ?? "", /Знакомства начинаются здесь/);
    assert.equal(photo?.parse_mode, "HTML");
    assert.equal(photo?.reply_markup.inline_keyboard[0][0].text, "Начать знакомство 💜");
    assert.equal(photo?.reply_markup.inline_keyboard[0][0].web_app.url,
      versionedWebAppUrl(config.origin, process.env.RENDER_GIT_COMMIT));
  } finally { await app.close(); }
});

test("photo rejection falls back to a text message with the same working CTA", async () => {
  const app = Fastify({ logger: false });
  registerTelegramWebhook(app, config, async () => "new", async () => false);
  try {
    const res = await app.inject({ method: "POST", url: "/api/telegram/webhook",
      headers: { "x-telegram-bot-api-secret-token": config.webhookSecret },
      payload: { message: { text: "/start", from: { id: 42 }, chat: { id: 42, type: "private" } } } });
    assert.equal(res.json().method, "sendMessage");
    assert.match(res.json().text, /Знакомства начинаются здесь/);
    assert.equal(res.json().reply_markup.inline_keyboard[0][0].web_app.url,
      versionedWebAppUrl(config.origin, process.env.RENDER_GIT_COMMIT));
  } finally { await app.close(); }
});

test("sender requires Telegram ok acknowledgement and handles failure without throwing", async () => {
  const payload = {
    chat_id: 42, photo: welcomePhotoUrl(config.origin), caption: "hello", parse_mode: "HTML" as const,
    reply_markup: { inline_keyboard: [[{ text: "Начать знакомство", web_app: { url: config.origin } }]] }
  };
  let capturedUrl = "";
  const successfulFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(url);
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), payload);
    return { ok: true, json: async () => ({ ok: true }) } as Response;
  }) as typeof fetch;
  assert.equal(await sendTelegramWelcomePhoto(config.botToken, payload, successfulFetch), true);
  assert.match(capturedUrl, /\/sendPhoto$/);
  assert.equal(await sendTelegramWelcomePhoto(config.botToken, payload,
    (async () => ({ ok: false })) as typeof fetch), false);
  assert.equal(await sendTelegramWelcomePhoto(config.botToken, payload,
    (async () => { throw new Error("network"); }) as typeof fetch), false);
});
