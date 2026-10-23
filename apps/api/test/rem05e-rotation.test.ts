import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { configureStagingTelegramBot } from "../src/telegram-setup.js";
import { executeSyntheticWebhookRotation, type MockBotTransport,
  type RotationRequest } from "../src/rem05e-telegram-rotation.js";
import type { ApiConfig } from "../src/config.js";

const HOOK = "https://luemi-stage01.onrender.com/api/telegram/webhook";
const ORIGIN = "https://luemi-stage01.onrender.com";
const OLD = "o".repeat(32);
const NEXT = "n".repeat(32);
function config(): ApiConfig {
  return {
    port: 3001, origin: ORIGIN, expectedBotUsername: "LuemiAppBot",
    botToken: "123456:fake-testing-secret", webhookSecret: OLD,
    healthKey: "h".repeat(32), logger: false, stagingOnly: false
  };
}
function request(): RotationRequest {
  return {
    mode: "isolated-mock-only", explicitOwnerApproval: true,
    environment: "staging", previousGeneration: "gen-old",
    candidateGeneration: "gen-new", candidateSecret: NEXT
  };
}
type Method = Parameters<MockBotTransport["request"]>[0];
function fake(overrides?: {
  username?: string;
  url?: string;
  menu?: unknown;
  methodFailure?: Method;
  failureStyle?: "http" | "false" | "no-result" | "throw" | "malformed";
}) {
  const calls: Array<{ method: Method; payload?: Record<string, unknown> }> = [];
  const api: MockBotTransport = {
    async request(method, payload) {
      calls.push({method, payload});
      if (method === overrides?.methodFailure) {
        switch (overrides.failureStyle) {
          case "throw": throw new Error("SYNTHETIC_SECRET_NEVER_SHOW_OR_LOG");
          case "malformed": return "<bad-json>";
          case "no-result": return {ok: true};
          case "false": return {ok: true, result: false};
          default: return {ok: false, status: 500, description: "SYNTHETIC_SECRET_NEVER_SHOW_OR_LOG"};
        }
      }
      const data = method === "getMe"
        ? {id: 123456, is_bot: true, username: overrides?.username ?? "LuemiAppBot"}
        : method === "getWebhookInfo" ? {url: overrides?.url ?? HOOK}
        : method === "getChatMenuButton"
          ? (overrides?.menu ?? {type: "web_app", web_app: {url: ORIGIN + "/"}})
          : true;
      return {ok: true, result: data};
    }
  };
  return {api, calls, methods: () => calls.map(x => x.method)};
}
const mutations = ["setChatMenuButton", "setWebhook"];
function noMutation(calls: {method: Method}[]) {
  assert.equal(calls.some(x => mutations.includes(x.method)), false);
}

test("E01 same URL/menu, explicitly approved generation performs mock setWebhook", async () => {
  const f = fake();
  const r = await executeSyntheticWebhookRotation(config(), request(), f.api);
  assert.equal(r.state, "telegram_update_acknowledged_synthetic");
  assert.equal(r.destination, "expected");
  assert.equal(r.liveTelegramVerified, false);
  assert.deepEqual(f.methods(), ["getMe", "getWebhookInfo", "getChatMenuButton", "setWebhook"]);
  const payload = f.calls.at(-1)?.payload;
  assert.ok(payload?.secret_token === NEXT, "candidate secret is passed only inside mock request");
  assert.equal(payload?.url, HOOK);
  assert.deepEqual(payload?.allowed_updates, ["message"]);
  assert.equal(payload?.drop_pending_updates, false);
  assert.equal(JSON.stringify(r).includes(NEXT), false);
  assert.equal(JSON.stringify(r).includes(OLD), false);
});
test("E02 normal startup same destination is a no-op, no generation attestation", async () => {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (url) => {
    const method = String(url).split("/").at(-1) ?? "";
    calls.push(method);
    const result = method === "getMe" ? {id: 123456,is_bot:true,username:"LuemiAppBot"}
      : method === "getWebhookInfo" ? {url: HOOK}
      : {type:"web_app",web_app:{url:ORIGIN + "/"}};
    return new Response(JSON.stringify({ok:true,result}),{status:200});
  };
  const result = await configureStagingTelegramBot(config(),fetcher);
  assert.deepEqual(calls,["getMe","getWebhookInfo","getChatMenuButton"]);
  assert.equal(result.menuConfigured,true);
  assert.equal(result.secretGenerationStatus,"unknown_not_attested");
});
test("E03 duplicate generation only skips with clearly SYNTHETIC proof metadata", async () => {
  const f = fake();
  const req = {...request(),previousGeneration:"gen-new",verifiedSyntheticGeneration:"gen-new"};
  const r = await executeSyntheticWebhookRotation(config(),req,f.api);
  assert.equal(r.state,"duplicate_synthetic_proof");
  assert.equal(r.secretGeneration,"synthetic_metadata_only");
  assert.equal(r.liveTelegramVerified,false);
  assert.equal(f.calls.length,0);
});
test("E04 same generation without synthetic attestation cannot silently skip",async()=>{
  const f=fake();const r=await executeSyntheticWebhookRotation(config(),
    {...request(),previousGeneration:"gen-new"},f.api);
  assert.equal(r.state,"refused");noMutation(f.calls);
});
test("E05 foreign webhook URL fails before mutation",async()=>{
  const f=fake({url:"https://foreign.invalid/foreign"});
  const r=await executeSyntheticWebhookRotation(config(),request(),f.api);
  assert.equal(r.reason,"foreign_webhook");assert.equal(r.destination,"foreign");noMutation(f.calls);
});
test("E06 foreign menu origin/path/query all denied",async()=>{
  for(const url of ["https://foreign.invalid/","https://luemi-stage01.onrender.com/bad",
    "https://luemi-stage01.onrender.com/?unsafe=1"]) {
    const f=fake({menu:{type:"web_app",web_app:{url}}});
    const r=await executeSyntheticWebhookRotation(config(),request(),f.api);
    assert.equal(r.reason,"foreign_menu");noMutation(f.calls);
  }
});
test("E06 unexpected menu type is foreign rather than an implicit overwrite",async()=>{
  const f=fake({menu:{type:"unexpected_future_menu"}});
  const r=await executeSyntheticWebhookRotation(config(),request(),f.api);
  assert.equal(r.reason,"foreign_menu");
  noMutation(f.calls);
});
test("E07 missing approval fails before reading credentials",async()=>{
  for(const item of [{explicitOwnerApproval:false},{mode:"production" as never}]) {
    const f=fake();const r=await executeSyntheticWebhookRotation(config(),{...request(),...item},f.api);
    assert.equal(r.reason,"invalid_authorization");assert.equal(f.calls.length,0);
  }
});
test("E07 wrong environment, auto-setup, real bot credentials denied before request",async()=>{
  for(const patch of [{origin:"https://another.invalid"},{setupOnStart:true},
    {expectedBotUsername:"SomeoneElse"},{botToken:"123456:real-token-nonmock"}]) {
    const f=fake();const r=await executeSyntheticWebhookRotation({...config(),...patch},request(),f.api);
    assert.equal(r.state,"refused");assert.equal(f.calls.length,0);
  }
});
test("E07 missing or invalid candidate/current credentials denied",async()=>{
  for(const candidateSecret of ["", "too-short", "x".repeat(257),"space ".repeat(6),OLD]) {
    const f=fake();const r=await executeSyntheticWebhookRotation(config(),{...request(),candidateSecret},f.api);
    assert.equal(r.reason,"invalid_credentials");assert.equal(f.calls.length,0);
  }
  const f=fake();const r=await executeSyntheticWebhookRotation({...config(),botToken:""},request(),f.api);
  assert.equal(r.reason,"invalid_credentials");assert.equal(f.calls.length,0);
});
test("E07/E17 exposed generation cannot be reused",async()=>{
  const f=fake();const r=await executeSyntheticWebhookRotation(config(),{
    ...request(),knownExposedGenerations:["gen-new"]
  },f.api);
  assert.equal(r.reason,"compromised_generation_forbidden");assert.equal(f.calls.length,0);
});
test("E08 HTTP 200 ok:true result:false is not rotation confirmation",async()=>{
  const f=fake({methodFailure:"setWebhook",failureStyle:"false"});
  const r=await executeSyntheticWebhookRotation(config(),request(),f.api);
  assert.equal(r.state,"telegram_state_unknown");assert.equal(r.secretGeneration,"unknown");
});
test("E09 HTTP failure, malformed, missing result or exception never proves rotation",async()=>{
  for (const failureStyle of ["http","malformed","no-result","throw"] as const) {
    const f=fake({methodFailure:"setWebhook",failureStyle});
    const r=await executeSyntheticWebhookRotation(config(),request(),f.api);
    assert.equal(r.state,"telegram_state_unknown");
    assert.equal(r.liveTelegramVerified,false);
    assert.equal(JSON.stringify(r).includes("SYNTHETIC_SECRET_NEVER_SHOW_OR_LOG"),false);
    assert.equal(f.methods().filter(x=>x==="setWebhook").length,1);
  }
});
test("E09 malformed preflight response cannot mutate",async()=>{
  for(const method of ["getMe","getWebhookInfo","getChatMenuButton"] as const) {
    const f=fake({methodFailure:method,failureStyle:"malformed"});
    const r=await executeSyntheticWebhookRotation(config(),request(),f.api);
    assert.equal(r.state,"refused");noMutation(f.calls);
  }
});
test("E10 failure after menu change is PARTIAL without webhook or hidden retry",async()=>{
  const f=fake({menu:{type:"commands"},methodFailure:"setWebhook",failureStyle:"throw"});
  const r=await executeSyntheticWebhookRotation(config(),request(),f.api);
  assert.equal(r.state,"telegram_state_unknown");
  assert.deepEqual(f.methods(),["getMe","getWebhookInfo","getChatMenuButton","setChatMenuButton","setWebhook"]);
  assert.equal(f.calls.filter(x=>x.method==="setWebhook").length,1);
});
test("E10 menu ACK false is partial, does not proceed to webhook",async()=>{
  const f=fake({menu:{type:"commands"},methodFailure:"setChatMenuButton",failureStyle:"false"});
  const r=await executeSyntheticWebhookRotation(config(),request(),f.api);
  assert.equal(r.state,"partial_menu_applied");
  assert.equal(f.calls.some(x=>x.method==="setWebhook"),false);
});
test("E10 lost menu acknowledgement is conservatively PARTIAL",async()=>{
  const f=fake({menu:{type:"commands"},methodFailure:"setChatMenuButton",failureStyle:"throw"});
  const r=await executeSyntheticWebhookRotation(config(),request(),f.api);
  assert.equal(r.state,"partial_menu_applied");
  assert.equal(r.reason,"bot_api_unavailable");
  assert.equal(f.calls.some(x=>x.method==="setWebhook"),false);
});
test("E11/E12/E13 real Fastify verifier: absent/wrong/old header 404; candidate ONLY",async()=>{
  const app=buildApp({...config(),webhookSecret:NEXT});
  try {
    const payload={message:{text:"/start",chat:{type:"private",id:8675309}}};
    for(const hdr of [undefined,"wrong",OLD]) {
      const response=await app.inject({method:"POST",url:"/api/telegram/webhook",
        headers:hdr?{"x-telegram-bot-api-secret-token":hdr}:{},payload});
      assert.equal(response.statusCode,404);
      assert.equal(response.json().method,undefined);
    }
    const ok=await app.inject({method:"POST",url:"/api/telegram/webhook",
      headers:{"x-telegram-bot-api-secret-token":NEXT},payload});
    assert.equal(ok.statusCode,200);
    assert.equal(ok.json().method,"sendMessage");
  }finally{await app.close();}
});
test("E12 real isolated Fastify injection proves synthetic candidate and old rejection",async()=>{
  const f=fake();const app=buildApp({...config(),webhookSecret:NEXT});
  try {
    const payload={message:{text:"/start",chat:{type:"private",id:13579}}};
    const req={...request(),syntheticReceiverProof:async()=>{
      const good=await app.inject({method:"POST",url:"/api/telegram/webhook",
        headers:{"x-telegram-bot-api-secret-token":NEXT},payload});
      const old=await app.inject({method:"POST",url:"/api/telegram/webhook",
        headers:{"x-telegram-bot-api-secret-token":OLD},payload});
      return {candidateAccepted:good.statusCode===200&&good.json().method==="sendMessage",
        previousRejected:old.statusCode===404&&old.json().method===undefined};
    }};
    const r=await executeSyntheticWebhookRotation(config(),req,f.api);
    assert.equal(r.state,"end_to_end_synthetic_proof");
    assert.equal(r.secretGeneration,"end_to_end_synthetic_only");
    assert.equal(r.liveTelegramVerified,false);
  }finally{await app.close();}
});
test("E12 end-to-end partial proof cannot mark success",async()=>{
  const f=fake();
  const r=await executeSyntheticWebhookRotation(config(),{
    ...request(),syntheticReceiverProof:async()=>({candidateAccepted:true,previousRejected:false})
  },f.api);
  assert.equal(r.state,"synthetic_delivery_failed");
  assert.equal(r.reason,"delivery_unconfirmed");
});
test("E14 getWebhookInfo URL alone never marks generation verified",async()=>{
  const f=fake();const r=await executeSyntheticWebhookRotation(config(),request(),f.api);
  assert.notEqual(r.secretGeneration,"end_to_end_synthetic_only");
  assert.equal(r.liveTelegramVerified,false);
});
test("E15/E16 transport only uses synthetic mock method names, no token URLs in errors",async()=>{
  const f=fake({methodFailure:"getMe",failureStyle:"throw"});
  const r=await executeSyntheticWebhookRotation(config(),request(),f.api);
  assert.equal(r.reason,"bot_api_unavailable");
  assert.equal(JSON.stringify(r).includes(config().botToken),false);
  assert.equal(JSON.stringify(r).includes(NEXT),false);
  assert.equal(f.methods().includes("getMe"),true);
});
test("E17 no retries on ambiguous acknowledgment",async()=>{
  const f=fake({methodFailure:"setWebhook",failureStyle:"throw"});
  await executeSyntheticWebhookRotation(config(),request(),f.api);
  assert.equal(f.methods().filter(x=>x==="setWebhook").length,1);
});
test("E18/E19 empty menu configures menu then webhook, existing normal tests remain",async()=>{
  const f=fake({menu:{type:"commands"},url:""});
  const r=await executeSyntheticWebhookRotation(config(),request(),f.api);
  assert.equal(r.state,"telegram_update_acknowledged_synthetic");
  assert.deepEqual(f.methods(),["getMe","getWebhookInfo","getChatMenuButton","setChatMenuButton","setWebhook"]);
  assert.equal((f.calls.find(x=>x.method==="setWebhook")?.payload)?.drop_pending_updates,false);
});
test("E19 foreign bot identity denied before reading or mutating foreign settings",async()=>{
  const f=fake({username:"WrongBot"});
  const r=await executeSyntheticWebhookRotation(config(),request(),f.api);
  assert.equal(r.reason,"bot_identity_mismatch");
  assert.deepEqual(f.methods(),["getMe"]);
});
