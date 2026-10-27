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
  }),/REG01D requires/);
 }
});

test("legacy invite-only mode is unchanged when open registration is disabled",()=>{
 const cfg=readConfig({
  ...base,REM06_BETA_INVITES_ENABLED:"1",REM06_BETA_INVITES_APPROVED:"1"
 });
 assert.equal(cfg.rem05b?.inviteOnly,true);
 assert.equal(cfg.realPublication?.enabled,true);
 assert.throws(()=>readConfig({...base,REM06_OPEN_SIGNUPS_ENABLED:"0"}),/REG01D requires/);
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
