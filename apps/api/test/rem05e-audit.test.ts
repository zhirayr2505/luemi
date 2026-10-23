import assert from "node:assert/strict";
import test from "node:test";
import { configureStagingTelegramBot } from "../src/telegram-setup.js";
import { executeSyntheticWebhookRotation, type RotationRequest,
  type MockBotTransport } from "../src/rem05e-telegram-rotation.js";
import type { ApiConfig } from "../src/config.js";

const ORIGIN="https://luemi-stage01.onrender.com";
const HOOK=ORIGIN+"/api/telegram/webhook";
const OLD="o".repeat(32), NEXT="n".repeat(32);
function cfg():ApiConfig {
  return {port:3001,origin:ORIGIN,botToken:"123456:fake-testing-secret",
    healthKey:"h".repeat(32),webhookSecret:OLD,
    expectedBotUsername:"LuemiAppBot",logger:false,stagingOnly:false};
}
function req():RotationRequest {
  return {mode:"isolated-mock-only",explicitOwnerApproval:true,
    environment:"staging",previousGeneration:"old-generation",
    candidateGeneration:"new-generation",candidateSecret:NEXT};
}
function telegram(results:Record<string,unknown>={}) {
  const calls:string[]=[];
  const fetcher:typeof fetch=async(input)=>{
    const method=String(input).split("/").at(-1)??"";
    calls.push(method);
    const result=method in results?results[method]:
      method==="getMe"?{id:123456,is_bot:true,username:"LuemiAppBot"}:
      method==="getWebhookInfo"?{url:""}:
      method==="getChatMenuButton"?{type:"commands"}:true;
    return new Response(JSON.stringify({ok:true,result}),{status:200});
  };
  return {fetcher,calls};
}
function mock() {
  const calls:string[]=[];
  const api:MockBotTransport={async request(method){
    calls.push(method);
    return {ok:true,result:
      method==="getMe"?{is_bot:true,username:"LuemiAppBot"}:
      method==="getWebhookInfo"?{url:HOOK}:
      method==="getChatMenuButton"?{type:"web_app",web_app:{url:ORIGIN}}:true};
  }};
  return {api,calls};
}

test("E-A1 RED menu ok:true result:false never proceeds to setWebhook",async()=>{
  const f=telegram({setChatMenuButton:false});
  await assert.rejects(configureStagingTelegramBot(cfg(),f.fetcher),(err:unknown)=>{
    assert.ok(err instanceof Error);
    assert.equal(err.message.includes(cfg().botToken),false);
    assert.equal(err.message.includes("api.telegram.org/bot"),false);
    return true;
  });
  assert.deepEqual(f.calls,["getMe","getWebhookInfo","getChatMenuButton","setChatMenuButton"]);
});
test("E-A1 RED webhook ok:true result:false never claims setup success",async()=>{
  const f=telegram({setWebhook:false});
  await assert.rejects(configureStagingTelegramBot(cfg(),f.fetcher),(err:unknown)=>{
    assert.ok(err instanceof Error);
    assert.equal(err.message.includes(cfg().botToken),false);
    return true;
  });
  assert.deepEqual(f.calls,["getMe","getWebhookInfo","getChatMenuButton","setChatMenuButton","setWebhook"]);
});
test("E-A2 RED callback booleans cannot mint attestation without 4 trusted Fastify HTTP checks",async()=>{
  const f=mock();
  let callbackCalls=0;
  const result=await executeSyntheticWebhookRotation(cfg(),{
    ...req(),syntheticReceiverProof:async()=>{callbackCalls++;return {
      candidateAccepted:true,previousRejected:true};}
  },f.api);
  assert.equal(callbackCalls,1);
  assert.equal(result.liveTelegramVerified,false);
  assert.equal((result as typeof result & {receiverChecks?:number}).receiverChecks,4,
    "four real HTTP probes, not caller booleans, must justify synthetic attestation");
  assert.equal(result.state,"end_to_end_synthetic_proof");
});
test("E-A3 RED never-settling proof is bounded and classified as delivery failure",async()=>{
  const f=mock();
  const pending=executeSyntheticWebhookRotation(cfg(),{
    ...req(),proofTimeoutMs:25,
    syntheticReceiverProof:()=>new Promise<never>(()=>{})
  } as RotationRequest & {proofTimeoutMs:number},f.api);
  const result=await Promise.race([
    pending,new Promise<"unbounded">(resolve=>setTimeout(()=>resolve("unbounded"),180))
  ]);
  assert.notEqual(result,"unbounded");
  if(result==="unbounded")return;
  assert.equal(result.state,"synthetic_delivery_failed");
  assert.equal(result.reason,"delivery_unconfirmed");
  assert.equal(result.secretGeneration,"telegram_ack_unverified");
  assert.equal(result.liveTelegramVerified,false);
  assert.equal(f.calls.filter(x=>x==="setWebhook").length,1);
});
test("E-A3 RED rejected proof after ACK must not become Bot API unavailable",async()=>{
  const f=mock();
  const result=await executeSyntheticWebhookRotation(cfg(),{
    ...req(),syntheticReceiverProof:async()=>{throw new Error("private mock exception");}
  },f.api);
  assert.equal(result.state,"synthetic_delivery_failed");
  assert.equal(result.reason,"delivery_unconfirmed");
  assert.equal(result.secretGeneration,"telegram_ack_unverified");
  assert.equal(result.liveTelegramVerified,false);
  assert.equal(JSON.stringify(result).includes("private mock exception"),false);
  assert.equal(f.calls.filter(x=>x==="setWebhook").length,1);
});
