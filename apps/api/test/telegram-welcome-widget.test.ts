import assert from "node:assert/strict";
import test from "node:test";
import { deflateSync } from "node:zlib";
import Fastify from "fastify";
import type { ApiConfig } from "../src/config.js";
import { registerTelegramWebhook, versionedWebAppUrl } from "../src/telegram-webhook.js";
import { sendTelegramWelcomeWidget, welcomeWidgetHtml } from "../src/telegram-welcome-widget.js";
import type { WelcomeWidgetMessage } from "../src/telegram-welcome-widget.js";

const config: ApiConfig = {
  port: 3001, origin: "https://luemi.onrender.com",
  botToken: "123456:fake-credential",
  webhookSecret: "s".repeat(32),
  healthKey: "h".repeat(32), logger: false
};
const headers = { "x-telegram-bot-api-secret-token": config.webhookSecret };

test("widget HTML fits Telegram 10.4 limits, has inline branding and real buttons", () => {
  const html = welcomeWidgetHtml();
  assert.ok(html);
  assert.ok(Buffer.byteLength(html) <= 32768);
  assert.ok(deflateSync(Buffer.from(html), { level: 9 }).byteLength <= 4096);
  assert.match(html, /<svg[^>]+class="brand"/);
  assert.match(html, /openTelegramLink/);
  assert.match(html, /data-tab="1"/);
  assert.match(html, /https:\/\/t\.me\/LuemiAppBot\?startapp=welcome/);
  assert.doesNotMatch(html, /https?:\/\/[^"']+\.(?:jpg|png|webp)|<script[^>]+src=/);
});

test("signed /start sends one interactive widget to owner's private chat", async () => {
  const app = Fastify({ logger: false });
  let payload: WelcomeWidgetMessage | undefined;
  registerTelegramWebhook(app, config, async () => "registered", async (_token, message) => {
    payload = message;
    return true;
  });
  try {
    const res = await app.inject({ method:"POST",url:"/api/telegram/webhook",headers,
      payload:{message:{text:"/start",from:{id:42},chat:{id:42,type:"private"}}}});
    assert.deepEqual(res.json(), { ok: true });
    assert.equal(payload?.chat_id,42);
    assert.equal(payload?.height,440);
    assert.equal(payload?.allow_queries,false);
    assert.equal(payload?.is_shared,false);
    assert.equal(JSON.parse(payload?.chat_data ?? "{}").state,"registered");
    assert.equal(payload?.html,welcomeWidgetHtml());
  } finally { await app.close(); }
});

test("sendWidget rejection falls back to text with native Mini App button", async () => {
  const app = Fastify({ logger: false });
  registerTelegramWebhook(app,config,async () => "new",async () => false);
  try {
    const res = await app.inject({method:"POST",url:"/api/telegram/webhook",headers,
      payload:{message:{text:"/start",from:{id:42},chat:{id:42,type:"private"}}}});
    const msg=res.json();
    assert.equal(msg.method,"sendMessage");
    assert.match(msg.text,/Знакомства начинаются здесь/);
    assert.equal(msg.reply_markup.inline_keyboard[0][0].web_app.url,
      versionedWebAppUrl(config.origin,process.env.RENDER_GIT_COMMIT));
  } finally { await app.close(); }
});

test("sender calls real sendWidget and requires an acknowledged response",async()=>{
  const html=welcomeWidgetHtml();
  assert.ok(html);
  const payload: WelcomeWidgetMessage = { chat_id:42,html,height:440,
    chat_data:JSON.stringify({state:"new"}),allow_queries:false,is_shared:false };
  let actualUrl="";
  const ok=(async (url:string|URL|Request,init?:RequestInit)=>{
    actualUrl=String(url);
    assert.equal(init?.method,"POST");
    assert.deepEqual(JSON.parse(String(init?.body)),payload);
    return {ok:true,json:async()=>({ok:true})} as Response;
  }) as typeof fetch;
  assert.equal(await sendTelegramWelcomeWidget(config.botToken,payload,ok),true);
  assert.match(actualUrl,/\/sendWidget$/);
  assert.equal(await sendTelegramWelcomeWidget(config.botToken,payload,
    (async()=>({ok:false})) as typeof fetch),false);
  assert.equal(await sendTelegramWelcomeWidget(config.botToken,payload,
    (async()=>{throw Error("network")}) as typeof fetch),false);
});
