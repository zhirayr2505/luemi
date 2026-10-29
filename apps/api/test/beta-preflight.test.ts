import test from "node:test";
import assert from "node:assert/strict";
import {describeRealBetaPrerequisites} from "../src/beta-preflight.js";

test("preflight never prints secrets, urls or actor IDs",()=>{
 const fakeToken="1000:secret-telegram-token-example";
 const fakeDb="postgres://private-username:secret-password@db.private:5432/secret";
 const env={
  TELEGRAM_BOT_TOKEN:fakeToken,REM05B_AUTH_DATABASE_URL:fakeDb,
  REM06_CONSENT_VERSION:"luemi-early-beta-v1",
  VITE_LUEMI_CONSENT_VERSION:"luemi-early-beta-v1",
  REM06_MEDIA_BUCKET:"luemi-profile-private",
  LUEMI_CHATS_MEDIA_BUCKET:"luemi-chat-private",
  REM06_EARLY_BETA_MAX_ACCOUNTS:"10"
 };
 const status=describeRealBetaPrerequisites(env);
 const text=JSON.stringify(status);
 for(const secret of [fakeToken,fakeDb,"private-username","secret-password"])
  assert(!text.includes(secret),"secret disclosed by beta preflight");
 assert.equal(status.secretValuesLogged,false);
 assert.equal(status.capValid,true);
 assert.equal(status.consentVersionsMatch,true);
 assert.equal(status.profileBucketCorrect,true);
 assert(status.missingCredentialNames.includes("REM06_MEDIA_WORKER_DATABASE_URL"));
 assert(status.disabledFlagNames.includes("REM06_OPEN_SIGNUPS_ENABLED"));
 assert.equal(status.verification,"configuration_presence_only");
});
test("preflight reports incompatible beta modes and invalid caps",()=>{
 const state=describeRealBetaPrerequisites({
  REM06_EARLY_BETA_MAX_ACCOUNTS:"-2",
  REM06_FRIENDS_TEST_ENABLED:"1",REM06_BETA_INVITES_ENABLED:"1",
  STAGING_BOOTSTRAP_ONLY:"1"
 });
 assert.equal(state.capValid,false);
 assert.deepEqual(state.conflictingEnabledFlags,[
  "REM06_BETA_INVITES_ENABLED","REM06_FRIENDS_TEST_ENABLED","STAGING_BOOTSTRAP_ONLY"]);
 assert.equal(state.consentVersionsMatch,false);
});
