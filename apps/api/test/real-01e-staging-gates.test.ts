import assert from "node:assert/strict";
import {test} from "node:test";
import {buildApp} from "../src/app.js";
import {readConfig} from "../src/config.js";

// Entire suite is isolated/offline; it never connects to Render, Telegram,
// Supabase or a public database. No real credentials are read.
const origin="https://luemi-rc01-ui-only.onrender.com";
const base={
 NODE_ENV:"test",
 APP_ORIGIN:origin,
 STAGING_BOOTSTRAP_ONLY:"1",
 TELEGRAM_SETUP_ON_START:"0"
};
test("01E: the existing UI-only RC cannot accept registration or media",async()=>{
 const cfg=readConfig({...base});
 assert.equal(cfg.stagingOnly,true);
 assert.equal(cfg.setupOnStart,false);
 assert.equal(cfg.rem05b,undefined);
 assert.equal(cfg.realRegistration,undefined);
 assert.equal(cfg.rem05d,undefined);
 assert.equal(cfg.realPublication,undefined);
 assert.equal(cfg.botToken,"");
 const app=buildApp({...cfg,logger:false});
 try{
  const live=await app.inject({method:"GET",url:"/api/health/live"});
  assert.equal(live.statusCode,200,live.body);
  assert.deepEqual(live.json(),{status:"ok"});
  const auth=await app.inject({method:"POST",url:"/api/auth/telegram",
   payload:{initData:"synthetic-not-valid"}});
  assert.equal(auth.statusCode,503,auth.body);
  for(const [method,url] of [
   ["GET","/api/v3/discovery/feed"],
   ["GET","/api/v3/profile/status"],
   ["GET","/api/v3/registration/draft"],
   ["POST","/api/v3/profile/publish"],
   ["POST","/api/v3/profile/unpublish"],
   ["POST","/api/v3/profile/withdraw-consent"],
   ["POST","/api/v2/media/intents"]
  ] as const){
   const response=await app.inject({method,url});
   assert.equal(response.statusCode,404,method+" "+url);
  }
 }finally{await app.close();}
});
test("01E: staging bootstrap refuses private, publication and charged activation",()=>{
 for(const flags of [
  {REM06_PRIVATE_DRAFT_ENABLED:"1"},
  {REM06_MEDIA_ENABLED:"1"},
  {REM06_PUBLICATION_ENABLED:"1"},
  {REM05D_PRIVATE_ENABLED:"1"},
  {REM05C_ENABLED:"1",REM05C_GEO_PROVIDER_ENABLED:"1"}
 ]){
  const env={...base,...flags};
  if(flags.REM05C_ENABLED==="1"){
   assert.throws(()=>readConfig(env),/budget/);
  }else{
   assert.throws(()=>readConfig(env),/requires|unavailable|HARD DISABLED/);
  }
 }
});
test("01E: stored private credentials or incomplete approval cannot enable publication",()=>{
 const cfg=readConfig({...base,
  REM06_SUPABASE_STORAGE_SECRET:"sb_secret_reality_must_not_be_read_by_test_aaaaaaaa",
  REM06_SUPABASE_PROJECT_REF:"abcdefghijklmnopqrst",
  REM06_PUBLISHER_DATABASE_URL:"postgres://fake-publisher",
  REM06_DISCOVERY_DATABASE_URL:"postgres://fake-reader"});
 assert.equal(cfg.realPublication,undefined);
 assert.equal(cfg.rem05d,undefined);
});
test("01E: reject deceptive CORS origins before registering routes",()=>{
 for(const url of [
  "*","https://evil.example/", "https://evil.example/a",
  "https://user@evil.example","https://evil.example?origin=luemi",
  "https://evil.example#hash","https://evil.example:443",
  "javascript:alert(1)","file:///private","https://evil.example@luemi-rc01-ui-only.onrender.com"
 ]){
  assert.throws(()=>readConfig({...base,APP_ORIGIN:url}),/APP_ORIGIN/,url);
 }
 assert.equal(readConfig(base).origin,origin);
});
test("01E: missing privacy, moderator or media approval remains fail-closed",()=>{
 const env={...base,STAGING_BOOTSTRAP_ONLY:"0",
  TELEGRAM_BOT_TOKEN:"123456:synthetic-test-token",
  HEALTH_CHECK_KEY:"synthetic-ready-key-123456789012345",
  REM05B_SESSIONS_ENABLED:"1",
  REM05B_AUTH_DATABASE_URL:"postgres://issuer.invalid/db",
  REM05B_REQUEST_DATABASE_URL:"postgres://request.invalid/db",
  REM05B_SESSION_PEPPER:"synthetic-secret-pepper-1234567890-123",
  REM05B_BOT_NAMESPACE:"ci_reg01",
  REM06_CONSENT_VERSION:"beta-v1",
  REM06_PRIVATE_DRAFT_ENABLED:"1"};
 assert.throws(()=>readConfig(env),/privacy/);
 assert.throws(()=>readConfig({...env,REM06_PRIVACY_APPROVED:"1",
  REM06_PUBLICATION_ENABLED:"1"}),/moderation|requires|REG01D/);
 assert.throws(()=>readConfig({...env,REM06_PRIVACY_APPROVED:"1",
  REM06_MEDIA_ENABLED:"1"}),/storage|requires|01C/);
});
