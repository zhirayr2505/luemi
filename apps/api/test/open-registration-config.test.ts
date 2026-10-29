import test from "node:test";
import assert from "node:assert/strict";
import {readConfig} from "../src/config.js";

const base={
 NODE_ENV:"production",
 PORT:"3001",
 APP_ORIGIN:"https://luemi.onrender.com",
 TELEGRAM_BOT_TOKEN:"123456:unit_testing_bot_token",
 HEALTH_CHECK_KEY:"a".repeat(32),
 REM05B_SESSIONS_ENABLED:"1",
 REM05B_BOT_NAMESPACE:"luemi-live",
 REM05B_AUTH_DATABASE_URL:"postgres://issuer.example.invalid/postgres",
 REM05B_REQUEST_DATABASE_URL:"postgres://request.example.invalid/postgres",
 REM05B_SESSION_PEPPER:"p".repeat(64),
 REM06_PRIVACY_APPROVED:"1",
 REM06_CONSENT_VERSION:"luemi-v1",
 REM06_PRIVATE_DRAFT_ENABLED:"1",
 REM06_MEDIA_ENABLED:"1",
 REM06_MEDIA_WORKER_DATABASE_URL:"postgres://worker.example.invalid/postgres",
 REM06_MEDIA_BUCKET:"luemi-profile-private",
 REM06_SUPABASE_PROJECT_REF:"abcdefghijklmnopqrst",
 REM06_SUPABASE_STORAGE_SECRET:"sb_secret_"+"x".repeat(32),
 REM06_PUBLICATION_ENABLED:"1",
 REM06_MODERATION_OPERATIONAL_APPROVED:"1",
 REM06_PUBLISHER_DATABASE_URL:"postgres://publisher.example.invalid/postgres",
 REM06_DISCOVERY_DATABASE_URL:"postgres://discovery.example.invalid/postgres"
};

test("open registration works without a beta invitation, with all private-media and human review boundaries intact",()=>{
 const cfg=readConfig({...base,REM06_OPEN_SIGNUPS_ENABLED:"1",REM06_OPEN_SIGNUPS_APPROVED:"1"});
 assert.equal(cfg.rem05b?.inviteOnly,false);
 assert.equal(cfg.realRegistration?.enabled,true);
 assert.equal(cfg.rem05d?.durablePrivateOnly,true);
 assert.equal(cfg.realPublication?.enabled,true);
 assert.equal(cfg.realPublication?.namespace,"luemi-live");
});

test("open registration requires a positive operator approval, privacy and signed V2 sessions",()=>{
 for(const patch of [
  {REM06_OPEN_SIGNUPS_APPROVED:"0"},
  {REM06_PRIVACY_APPROVED:"0"},
  {REM05B_SESSIONS_ENABLED:"0"},
  {STAGING_BOOTSTRAP_ONLY:"1"},
  {REM06_BETA_INVITES_ENABLED:"1",REM06_BETA_INVITES_APPROVED:"1"}
 ]){
  assert.throws(()=>readConfig({
   ...base,REM06_OPEN_SIGNUPS_ENABLED:"1",REM06_OPEN_SIGNUPS_APPROVED:"1",...patch
  }),/Open registration requires/);
 }
});

test("open registration cannot publish without private media or human moderation approval",()=>{
 for(const patch of [
  {REM06_MEDIA_ENABLED:"0"},
  {REM06_MODERATION_OPERATIONAL_APPROVED:"0"},
  {REM06_PUBLISHER_DATABASE_URL:base.REM06_DISCOVERY_DATABASE_URL},
  {REM06_PUBLISHER_DATABASE_URL:""}
 ]){
  assert.throws(()=>readConfig({
   ...base,REM06_OPEN_SIGNUPS_ENABLED:"1",REM06_OPEN_SIGNUPS_APPROVED:"1",...patch
  }),/REG01D requires|Open registration requires server-backed private photo uploads/);
 }
});

test("open signups may save server photos privately without publishing or a 20-person cap",()=>{
 const env={...base,
  REM06_OPEN_SIGNUPS_ENABLED:"1",REM06_OPEN_SIGNUPS_APPROVED:"1",
  REM06_PUBLICATION_ENABLED:"0",
  REM06_MODERATION_OPERATIONAL_APPROVED:"0",
  REM06_PUBLISHER_DATABASE_URL:"",
  REM06_DISCOVERY_DATABASE_URL:""};
 const cfg=readConfig(env);
 assert.equal(cfg.rem05b?.inviteOnly,false);
 assert.equal(cfg.rem05b?.maxNewActors,undefined,
  "public signup must not inherit the 20-account self-service beta cap");
 assert.equal(cfg.rem05d?.durablePrivateOnly,true);
 assert.equal(cfg.realRegistration?.enabled,true);
 assert.equal(cfg.realPublication,undefined);
});
test("open signups fail closed when real private photo upload is disabled",()=>{
 for(const overrides of [
  {REM06_MEDIA_ENABLED:"0"},
  {REM06_PRIVATE_DRAFT_ENABLED:"0"}
 ]) assert.throws(()=>readConfig({...base,REM06_PUBLICATION_ENABLED:"0",
  REM06_OPEN_SIGNUPS_ENABLED:"1",REM06_OPEN_SIGNUPS_APPROVED:"1",...overrides}),
  /Open registration requires server-backed private photo uploads/);
});
test("express owner approval enables no-pre-review publishing only with real safety and deletion operations",()=>{
 const flags={
  REM06_OPEN_SIGNUPS_ENABLED:"1",REM06_OPEN_SIGNUPS_APPROVED:"1",
  REM06_MODERATION_OPERATIONAL_APPROVED:"0",
  REM06_INSTANT_PUBLICATION_ENABLED:"1",
  REM06_INSTANT_PUBLICATION_OWNER_ACCEPTED:"1",
  REM06_ERASURE_REQUEST_ENABLED:"1",REM06_ERASURE_POLICY_APPROVED:"1",
  REM06_ERASURE_REQUEST_DATABASE_URL:"postgres://erasure_req.example.invalid/postgres",
  REM06_ERASURE_WORKER_ENABLED:"1",REM06_ERASURE_MAINTENANCE_APPROVED:"1",
  REM06_ERASURE_WORKER_DATABASE_URL:"postgres://erasure_worker.example.invalid/postgres",
  REG01H_SAFETY_OPERATOR_ENABLED:"1",REG01H_SAFETY_POLICY_APPROVED:"1",
  REG01H_OPERATOR_LABEL:"abuse_team",
  REG01H_SAFETY_OPERATOR_DATABASE_URL:"postgres://safety_worker.example.invalid/postgres"
 };
 const c=readConfig({...base,...flags});
 assert.equal(c.rem05b?.maxNewActors,undefined);
 assert.equal(c.rem05d?.instantAcceptance,true);
 assert.equal(c.realPublication?.enabled,true);
 assert.equal(c.realErasure?.enabled,true);
 assert.equal(c.releaseOperations?.safetyOperatorCliConfigured,true);
 assert.equal(c.releaseOperations?.erasureWorkerCliConfigured,true);
 for(const patch of [
  {REM06_INSTANT_PUBLICATION_OWNER_ACCEPTED:"0"},
  {REM06_PRIVACY_APPROVED:"0"},
  {REM06_MEDIA_ENABLED:"0"},
  {REM06_ERASURE_WORKER_ENABLED:"0"},
  {REG01H_SAFETY_OPERATOR_ENABLED:"0"},
  {REM06_ERASURE_REQUEST_ENABLED:"0"},
  {REM06_OPEN_SIGNUPS_ENABLED:"0"},
  {REM06_PUBLICATION_ENABLED:"0"}
 ])assert.throws(()=>readConfig({...base,...flags,...patch}),
  /Instant publication|Open registration|REG01D requires|Production V2 requires/);
});
test("legacy manual review remains the default",()=>{
 const c=readConfig({...base,REM06_OPEN_SIGNUPS_ENABLED:"1",REM06_OPEN_SIGNUPS_APPROVED:"1"});
 assert.equal(c.rem05d?.instantAcceptance,undefined);
});
test("legacy invite-only mode is unchanged when open registration is disabled",()=>{
 const cfg=readConfig({
  ...base,REM06_BETA_INVITES_ENABLED:"1",REM06_BETA_INVITES_APPROVED:"1"
 });
 assert.equal(cfg.rem05b?.inviteOnly,true);
 assert.equal(cfg.realPublication?.enabled,true);
 assert.throws(()=>readConfig({...base,REM06_OPEN_SIGNUPS_ENABLED:"0"}),/Production V2 requires|REG01D requires/);
});

test("open registration can opt into matches and chats only with isolated DB roles and explicit policies",()=>{
 const env={...base,REM06_OPEN_SIGNUPS_ENABLED:"1",REM06_OPEN_SIGNUPS_APPROVED:"1",
  LUEMI_CHATS_V1_ENABLED:"1",LUEMI_CHATS_POLICY_APPROVED:"1",
  LUEMI_CHATS_DATABASE_URL:"postgres://chats.example.invalid/postgres",
  LUEMI_MATCHES_V1_ENABLED:"1",LUEMI_MATCHES_POLICY_APPROVED:"1",
  LUEMI_MATCHES_DATABASE_URL:"postgres://matches.example.invalid/postgres"};
 const cfg=readConfig(env);
 assert.equal(cfg.chats?.enabled,true);
 assert.equal(cfg.matches?.enabled,true);
 assert.throws(()=>readConfig({...env,LUEMI_MATCHES_DATABASE_URL:env.LUEMI_CHATS_DATABASE_URL}),/Matches require/);
});

test("production cannot silently open Telegram signups without an approved admission mode",()=>{
 assert.throws(()=>readConfig({...base,REM06_PUBLICATION_ENABLED:"0",
  REM06_OPEN_SIGNUPS_ENABLED:"0",REM06_BETA_INVITES_ENABLED:"0"}),
  /Production V2 requires an explicitly approved admission mode/);
});
test("authenticated beta can enable first-party limited city reverse without paid provider credentials",()=>{
 const env={...base,REM06_BETA_INVITES_ENABLED:"1",REM06_BETA_INVITES_APPROVED:"1",
  REM05C_ENABLED:"1",REM05C_LOCAL_REVERSE_ENABLED:"1",
  REM05C_GEO_PROVIDER_ENABLED:"0",REM06_PUBLICATION_ENABLED:"0"};
 const cfg=readConfig(env);
 assert.equal(cfg.rem05c?.geo?.localReverseEnabled,true);
 assert.equal(cfg.rem05c?.geo?.providerEnabled,false);
 assert.throws(()=>readConfig({...env,NODE_ENV:"test",REM05B_SESSIONS_ENABLED:"0",
  REM06_BETA_INVITES_ENABLED:"0"}),
  /Local reverse geolocation requires authenticated V2 sessions/);
});

test("real early beta admits signed accounts without invites, caps at 10 and preserves private photo publication",()=>{
 const env={...base,
  REM06_OPEN_SIGNUPS_ENABLED:"1",REM06_OPEN_SIGNUPS_APPROVED:"1",
  REM06_MODERATION_OPERATIONAL_APPROVED:"0",
  REM06_EARLY_BETA_ENABLED:"1",
  REM06_EARLY_BETA_MAX_ACCOUNTS:"10",
  REM06_INSTANT_PUBLICATION_ENABLED:"1",
  REM06_INSTANT_PUBLICATION_OWNER_ACCEPTED:"1"
 };
 const config=readConfig(env);
 assert.equal(config.rem05b?.inviteOnly,false);
 assert.equal(config.rem05b?.maxNewActors,10);
 assert.equal(config.rem05d?.durablePrivateOnly,true);
 assert.equal(config.rem05d?.instantAcceptance,true);
 assert.equal(config.realRegistration?.enabled,true);
 assert.equal(config.realPublication?.enabled,true);
 for(const patch of [
  {REM06_EARLY_BETA_MAX_ACCOUNTS:"1"},
  {REM06_EARLY_BETA_MAX_ACCOUNTS:"51"},
  {REM06_EARLY_BETA_MAX_ACCOUNTS:"10.5"},
  {REM06_EARLY_BETA_MAX_ACCOUNTS:"NaN"},
  {REM06_FRIENDS_TEST_ENABLED:"1"},
  {REM06_SELF_SERVICE_BETA_ENABLED:"1"},
  {REM06_BETA_INVITES_ENABLED:"1"},
  {REM06_OPEN_SIGNUPS_ENABLED:"0"}
 ])assert.throws(()=>readConfig({...env,...patch}),
  /Real early beta requires|Friends test must|Self-service beta requires|Open registration requires|Production V2 requires/);
});
test("legacy public release remains unlimited without explicit early beta cap",()=>{
 const cfg=readConfig({...base,REM06_OPEN_SIGNUPS_ENABLED:"1",
  REM06_OPEN_SIGNUPS_APPROVED:"1",REM06_EARLY_BETA_MAX_ACCOUNTS:"10"});
 assert.equal(cfg.rem05b?.maxNewActors,undefined);
});
