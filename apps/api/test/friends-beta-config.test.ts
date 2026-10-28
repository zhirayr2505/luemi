import test from "node:test";
import assert from "node:assert/strict";
import {readConfig} from "../src/config.js";

// Synthetic values only. Never read live credentials in CI.
const trial={
 NODE_ENV:"production",
 APP_ORIGIN:"https://luemi.onrender.com",
 TELEGRAM_BOT_TOKEN:"123456:synthetic_test_bot_token",
 HEALTH_CHECK_KEY:"h".repeat(32),
 REM05B_SESSIONS_ENABLED:"1",
 REM05B_BOT_NAMESPACE:"luemi-beta-20261027",
 REM05B_AUTH_DATABASE_URL:"postgresql://user@issuer.invalid/postgres",
 REM05B_REQUEST_DATABASE_URL:"postgresql://user@request.invalid/postgres",
 REM05B_SESSION_PEPPER:"p".repeat(64),
 REM06_BETA_INVITES_ENABLED:"1",
 REM06_BETA_INVITES_APPROVED:"1",
 REM06_OPEN_SIGNUPS_ENABLED:"0",
 REM06_OPEN_SIGNUPS_APPROVED:"0",
 REM06_FRIENDS_TEST_ENABLED:"1",
 REM06_FRIENDS_TEST_NOTICE_ACCEPTED:"1",
 REM06_PRIVACY_APPROVED:"0",
 REM06_PRIVATE_DRAFT_ENABLED:"1",
 REM06_CONSENT_VERSION:"friends-test-v1",
 REM06_MEDIA_ENABLED:"0",
 REM06_PUBLICATION_ENABLED:"0",
 LUEMI_CHATS_V1_ENABLED:"0",
 LUEMI_MATCHES_V1_ENABLED:"0"
};

test("friends pilot enables real signed Telegram sessions and server drafts, not published user content",()=>{
 const c=readConfig(trial);
 assert.equal(c.rem05b?.enabled,true);
 assert.equal(c.rem05b?.inviteOnly,true);
 assert.equal(c.rem05b?.namespace,"luemi-beta-20261027");
 assert.equal(c.realRegistration?.enabled,true);
 assert.equal(c.realRegistration?.consentVersion,"friends-test-v1");
 assert.equal(c.realPublication,undefined);
 assert.equal(c.rem05d,undefined);
 assert.equal(c.matches,undefined);
 assert.equal(c.chats,undefined);
 assert.equal(c.releaseOperations?.privacyFlagConfigured,false,
  "testing notice does not masquerade as a legally approved policy");
});

test("pilot refuses missing owner invite approval, test disclosure, signed session or private draft",()=>{
 const bad=[
  {REM06_BETA_INVITES_ENABLED:"0"},
  {REM06_BETA_INVITES_APPROVED:"0"},
  {REM06_FRIENDS_TEST_NOTICE_ACCEPTED:"0"},
  {REM05B_SESSIONS_ENABLED:"0"},
  {REM06_PRIVATE_DRAFT_ENABLED:"0"},
  {REM06_OPEN_SIGNUPS_ENABLED:"1"},
  {STAGING_BOOTSTRAP_ONLY:"1"},
  {REM06_PUBLICATION_ENABLED:"1"},
  {REM06_MEDIA_ENABLED:"1"},
  {LUEMI_CHATS_V1_ENABLED:"1"},
  {LUEMI_MATCHES_V1_ENABLED:"1"},
  {REM06_ERASURE_REQUEST_ENABLED:"1"}
 ];
 for(const item of bad)
  assert.throws(()=>readConfig({...trial,...item}),/Friends test must be invite-only/,
   JSON.stringify(item));
});

test("friends disclosure exception cannot accidentally authorize global open signup",()=>{
 assert.throws(()=>readConfig({...trial,REM06_FRIENDS_TEST_ENABLED:"0",
  REM06_OPEN_SIGNUPS_ENABLED:"1",REM06_BETA_INVITES_ENABLED:"0",
  REM06_OPEN_SIGNUPS_APPROVED:"1"}),/Open registration requires approved privacy policy/);
 assert.throws(()=>readConfig({...trial,REM06_FRIENDS_TEST_ENABLED:"0"}),
  /REG01G invite gate requires/);
});
