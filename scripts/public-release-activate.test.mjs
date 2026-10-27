import assert from "node:assert/strict";
import test from "node:test";
import {ROLES} from "./closed-beta-bootstrap.mjs";
import {releaseFlags,validStorageSecret,verifyScopedRoles,activate} from "./public-release-activate.mjs";

test("public release never includes demo or invite gate",()=>{
 const flags=releaseFlags();
 assert.equal(flags.REM06_OPEN_SIGNUPS_ENABLED,"1");
 assert.equal(flags.REM06_BETA_INVITES_ENABLED,"0");
 assert.equal(flags.REM06_AUTOPUBLISH_PHOTOS_ENABLED,"1");
 assert.equal(flags.VITE_LUEMI_REAL_ONLY,"1");
 assert.equal(flags.VITE_LUEMI_CHATS_DEMO,"0");
 assert.equal(flags.VITE_LUEMI_AUTOPUBLISH_PHOTOS,"1");
 assert.equal(flags.VITE_LUEMI_PRIVACY_POLICY_PATH,"/privacy");
 assert.equal(flags.REM06_ERASURE_REQUEST_ENABLED,"1");
 assert.equal(flags.REM05C_GEO_PROVIDER_ENABLED,"1");
 assert.equal(flags.REM06_MODERATION_OPERATIONAL_APPROVED,"0");
});
test("only actual private storage secrets qualify for production activation",()=>{
 assert.equal(validStorageSecret("sb_secret_"+"x".repeat(32)),true);
 assert.equal(validStorageSecret(["header","payload","signature"].join(".")),true);
 for(const invalid of ["",undefined,"anon","sb_publishable_"+"x".repeat(32),"sb_secret_short"])
  assert.equal(validStorageSecret(invalid),false);
});
test("every API login needs exactly one scoped group and no bypass privileges",()=>{
 const rows=ROLES.map(([name,group])=>({
  rolname:name,rolcanlogin:true,rolsuper:false,rolbypassrls:false,
  rolcreaterole:false,rolcreatedb:false,memberships:1,member_of:group
 }));
 assert.equal(rows.length,9);
 assert.doesNotThrow(()=>verifyScopedRoles(rows));
 for(const patch of [
  {rolcanlogin:false},{rolsuper:true},{rolbypassrls:true},
  {rolcreaterole:true},{rolcreatedb:true},{memberships:2},{member_of:"postgres"}
 ])assert.throws(()=>verifyScopedRoles([{...rows[0],...patch},...rows.slice(1)]));
 assert.throws(()=>verifyScopedRoles(rows.slice(1)));
});
test("release refuses missing human approval and secrets before any network operation",async()=>{
 await assert.rejects(()=>activate({
  ownerUrl:"",apiKey:"",storageSecret:"",geoKey:"",approval:""
 }),/Protected operator approval/);
});
