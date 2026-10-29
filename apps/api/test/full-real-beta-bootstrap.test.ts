import test from "node:test";
import assert from "node:assert/strict";
import {readConfig} from "../src/config.js";
import {buildApp} from "../src/app.js";

test("all real beta modules register together without duplicate route or content parser errors",async()=>{
 const env={
  NODE_ENV:"production",PORT:"3001",
  APP_ORIGIN:"https://luemi.onrender.com",
  TELEGRAM_BOT_TOKEN:"123456:synthetic_bot_token",
  HEALTH_CHECK_KEY:"x".repeat(32),
  REM05B_SESSIONS_ENABLED:"1",REM05B_BOT_NAMESPACE:"luemi-beta-20261027",
  REM05B_AUTH_DATABASE_URL:"postgres://auth.invalid/postgres",
  REM05B_REQUEST_DATABASE_URL:"postgres://request.invalid/postgres",
  REM05B_SESSION_PEPPER:"x".repeat(64),
  REM06_EARLY_BETA_ENABLED:"1",REM06_EARLY_BETA_MAX_ACCOUNTS:"10",
  REM06_OPEN_SIGNUPS_ENABLED:"1",REM06_OPEN_SIGNUPS_APPROVED:"1",
  REM06_PRIVACY_APPROVED:"1",REM06_CONSENT_VERSION:"luemi-beta-v1",
  REM06_PRIVATE_DRAFT_ENABLED:"1",
  REM06_MEDIA_ENABLED:"1",REM06_MEDIA_BUCKET:"luemi-profile-private",
  REM06_MEDIA_WORKER_DATABASE_URL:"postgres://media.invalid/postgres",
  REM06_SUPABASE_PROJECT_REF:"abcdefghijklmnopqrst",
  REM06_SUPABASE_STORAGE_SECRET:"sb_secret_"+"x".repeat(32),
  REM06_PUBLICATION_ENABLED:"1",
  REM06_INSTANT_PUBLICATION_ENABLED:"1",
  REM06_INSTANT_PUBLICATION_OWNER_ACCEPTED:"1",
  REM06_PUBLISHER_DATABASE_URL:"postgres://publisher.invalid/postgres",
  REM06_DISCOVERY_DATABASE_URL:"postgres://discovery.invalid/postgres",
  REM06_ERASURE_REQUEST_ENABLED:"1",REM06_ERASURE_POLICY_APPROVED:"1",
  REM06_ERASURE_REQUEST_DATABASE_URL:"postgres://erase.invalid/postgres",
  REM06_ERASURE_WORKER_ENABLED:"0",
  REG01H_SAFETY_OPERATOR_ENABLED:"1",REG01H_SAFETY_POLICY_APPROVED:"1",
  REG01H_OPERATOR_LABEL:"luemi_owner",
  REG01H_SAFETY_OPERATOR_DATABASE_URL:"postgres://safety.invalid/postgres",
  LUEMI_CHATS_V1_ENABLED:"1",LUEMI_CHATS_POLICY_APPROVED:"1",
  LUEMI_CHATS_DATABASE_URL:"postgres://chats.invalid/postgres",
  LUEMI_CHATS_MEDIA_ENABLED:"1",LUEMI_CHATS_MEDIA_BUCKET:"luemi-chat-private",
  LUEMI_MATCHES_V1_ENABLED:"1",LUEMI_MATCHES_POLICY_APPROVED:"1",
  LUEMI_MATCHES_DATABASE_URL:"postgres://matches.invalid/postgres",
  REM05C_ENABLED:"1",REM05C_LOCAL_REVERSE_ENABLED:"1"
 };
 const cfg=readConfig(env);
 assert.equal(cfg.rem05b?.maxNewActors,10);
 assert.equal(cfg.rem05d?.instantAcceptance,true);
 assert.equal(cfg.realErasure?.enabled,true);
 assert.equal(cfg.chats?.enabled,true);
 assert.equal(cfg.matches?.enabled,true);
 assert.equal(cfg.releaseOperations?.erasureWorkerCliConfigured,false);
 const app=buildApp({...cfg,logger:false,serveWeb:false,setupOnStart:false});
 try{
  await app.ready();
  for(const mime of ["image/png","image/jpeg","image/webp"])
   assert.equal(app.hasContentTypeParser(mime),true);
  const health=await app.inject({method:"GET",url:"/api/health/live"});
  assert.equal(health.statusCode,200,health.body);
  const invalid=await app.inject({method:"POST",url:"/api/v2/auth/telegram",
   payload:{initData:"invalid"}});
  assert.equal(invalid.statusCode,401,"unverified Telegram identity rejected");
 }finally{await app.close();}
});
