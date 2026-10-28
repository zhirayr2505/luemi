import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import type { ApiConfig } from "../src/config.js";
import {versionedWebAppUrl} from "../src/telegram-webhook.js";

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
    assert.equal(signed.json().reply_markup.inline_keyboard[0][0].web_app.url,
      versionedWebAppUrl(config().origin,process.env.RENDER_GIT_COMMIT));
  } finally { await app.close(); }
});
test("staging without credentials refuses Telegram auth", async () => {
  const app = buildApp({ ...config(), botToken: "", webhookSecret: "", stagingOnly: true });
  try {
    const r = await app.inject({ method: "POST", url: "/api/auth/telegram", payload: { initData: "untrusted" } });
    assert.equal(r.statusCode, 503);
  } finally { await app.close(); }
});

test("per-deploy versioned URL forces fresh Telegram document while preserving origin",()=>{
  const commit="a5b0ce72e52ee7b4f282fe3cfbaa5bec4ef6e2a2";
  const origin="https://luemi-stage01.onrender.com";
  const versioned=versionedWebAppUrl(origin,commit);
  const parsed=new URL(versioned);
  assert.equal(parsed.origin,origin);
  assert.equal(parsed.pathname,"/");
  assert.equal(parsed.searchParams.get("luemiRelease"),commit.slice(0,12));
  assert.equal(versionedWebAppUrl(origin,undefined),origin);
  assert.equal(versionedWebAppUrl(origin,"not-a-sha"),origin);
  assert.equal(versionedWebAppUrl("https://luemi.onrender.com",commit),"https://luemi.onrender.com/?luemiRelease="+commit.slice(0,12));
  assert.equal(versionedWebAppUrl("https://luemi.onrender.com",undefined),"https://luemi.onrender.com");
  assert.equal(versionedWebAppUrl("https://luemi.onrender.com", "bad"),"https://luemi.onrender.com");
  assert.equal(versionedWebAppUrl("https://attacker.example",commit),"https://attacker.example");
});
test("signed /start supplies a fresh versioned Web App button using the Render commit",async()=>{
  const previous=process.env.RENDER_GIT_COMMIT;
  const commit="a5b0ce72e52ee7b4f282fe3cfbaa5bec4ef6e2a2";
  process.env.RENDER_GIT_COMMIT=commit;
  const app=buildApp(config());
  try{
    const r=await app.inject({method:"POST",url:"/api/telegram/webhook",
      headers:{"x-telegram-bot-api-secret-token":"s".repeat(32)},
      payload:{message:{text:"/start",chat:{id:12345,type:"private"}}}});
    assert.equal(r.statusCode,200);
    const url=r.json().reply_markup.inline_keyboard[0][0].web_app.url as string;
    assert.equal(url,"https://luemi-stage01.onrender.com/?luemiRelease="+commit.slice(0,12));
    assert.ok(!url.includes("123456:test-credential"));
    const denied=await app.inject({method:"POST",url:"/api/telegram/webhook",
      payload:{message:{text:"/start",chat:{id:12345,type:"private"}}}});
    assert.equal(denied.statusCode,404);
  }finally{
    await app.close();
    if(previous===undefined)delete process.env.RENDER_GIT_COMMIT;
    else process.env.RENDER_GIT_COMMIT=previous;
  }
});


test("signed /myid never instructs public users to seek invitations",async()=>{
  const app=buildApp(config());
  try{
    const response=await app.inject({method:"POST",url:"/api/telegram/webhook",
      headers:{"x-telegram-bot-api-secret-token":"s".repeat(32)},
      payload:{message:{text:"/myid",chat:{id:12345,type:"private"},from:{id:12345}}}});
    assert.equal(response.statusCode,200);
    const message=response.json();
    assert.equal(message.chat_id,12345);
    assert.match(message.text,/Твой Telegram ID: 12345/);
    assert.match(message.text,/\/start/);
    assert.doesNotMatch(message.text,/для приглашения/i);
  }finally{await app.close();}
});

test("private invited friends see accurate enrollment instructions and only their own Telegram ID",async()=>{
 const betaConfig=config();
 betaConfig.rem05b={enabled:false,inviteOnly:true} as NonNullable<ApiConfig["rem05b"]>;
 const app=buildApp(betaConfig);
 try{
  const headers={"x-telegram-bot-api-secret-token":"s".repeat(32)};
  const own=await app.inject({method:"POST",url:"/api/telegram/webhook",headers,
   payload:{message:{text:"/myid",chat:{id:12345,type:"private"},from:{id:12345}}}});
  assert.equal(own.statusCode,200);
  assert.match(own.json().text,/Твой Telegram ID: 12345/);
  assert.match(own.json().text,/закрытый тест/i);
  assert.match(own.json().text,/@zhiiirro/);
  const notOwn=await app.inject({method:"POST",url:"/api/telegram/webhook",headers,
   payload:{message:{text:"/myid",chat:{id:12345,type:"private"},from:{id:67890}}}});
  assert.equal(notOwn.statusCode,200);
  assert.equal(notOwn.json().ok,true);
  assert.equal(notOwn.json().text,undefined);
  const start=await app.inject({method:"POST",url:"/api/telegram/webhook",headers,
   payload:{message:{text:"/start",chat:{id:12345,type:"private"},from:{id:12345}}}});
  assert.equal(start.statusCode,200);
  assert.match(start.json().text,/закрытый тест/i);
  assert.equal(start.json().reply_markup.inline_keyboard[0][0].web_app.url,
   versionedWebAppUrl(betaConfig.origin,process.env.RENDER_GIT_COMMIT));
 }finally{await app.close();}
});
