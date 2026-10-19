import assert from "node:assert/strict";
import test from "node:test";
import { configureStagingTelegramBot } from "../src/telegram-setup.js";
import type { ApiConfig } from "../src/config.js";

const config: ApiConfig = {
  port: 3001,
  origin: "https://luemi-stage01.onrender.com",
  botToken: "123456:fake-testing-secret",
  healthKey: "h".repeat(32),
  webhookSecret: "s".repeat(32),
  stagingOnly: false,
  expectedBotUsername: "LuemiAppBot",
  logger: false
};

function fakeTelegram(
  botUsername = "LuemiAppBot",
  webhookUrl = "",
  menuUrl = ""
): { calls: string[]; fetcher: typeof fetch } {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const method = String(input).split("/").at(-1) ?? "";
    calls.push(method);
    const result = method === "getMe"
      ? { id: 123456, is_bot: true, username: botUsername }
      : method === "getWebhookInfo"
        ? { url: webhookUrl }
        : method === "getChatMenuButton"
          ? menuUrl ? { type: "web_app", web_app: { url: menuUrl } } : { type: "commands" }
          : true;
    if (method === "setWebhook") {
      const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.equal(payload.url, "https://luemi-stage01.onrender.com/api/telegram/webhook");
      assert.equal(payload.secret_token, "s".repeat(32));
      assert.equal(payload.drop_pending_updates, false);
    }
    if (method === "setChatMenuButton") {
      const payload = JSON.parse(String(init?.body)) as {
        menu_button: { type: string; web_app: { url: string } };
      };
      assert.equal(payload.menu_button.type, "web_app");
      assert.equal(payload.menu_button.web_app.url, "https://luemi-stage01.onrender.com");
    }
    return new Response(JSON.stringify({ ok: true, result }), { status: 200 });
  };
  return { calls, fetcher };
}
test("sets web app menu and webhook for verified LUEMI test bot", async () => {
  const fake = fakeTelegram();
  const result = await configureStagingTelegramBot(config, fake.fetcher);
  assert.equal(result.botUsername, "LuemiAppBot");
  assert.deepEqual(fake.calls, ["getMe", "getWebhookInfo", "getChatMenuButton", "setChatMenuButton", "setWebhook"]);
});
test("does not alter another bot", async () => {
  const fake = fakeTelegram("AnotherBot");
  await assert.rejects(configureStagingTelegramBot(config, fake.fetcher));
  assert.deepEqual(fake.calls, ["getMe"]);
});
test("does not overwrite another webhook", async () => {
  const fake = fakeTelegram("LuemiAppBot", "https://other-app.invalid/hook");
  await assert.rejects(configureStagingTelegramBot(config, fake.fetcher));
  assert.deepEqual(fake.calls, ["getMe", "getWebhookInfo"]);
});
test("does not overwrite a foreign menu app", async () => {
  const fake = fakeTelegram("LuemiAppBot", "", "https://another-app.invalid");
  await assert.rejects(configureStagingTelegramBot(config, fake.fetcher));
  assert.deepEqual(fake.calls, ["getMe", "getWebhookInfo", "getChatMenuButton"]);
});
test("refuses setup without bot credentials", async () => {
  const fake = fakeTelegram();
  await assert.rejects(configureStagingTelegramBot({ ...config, stagingOnly: true }, fake.fetcher));
  assert.equal(fake.calls.length, 0);
});
