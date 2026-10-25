import {test} from "node:test";
import assert from "node:assert/strict";
import {readConfig} from "../src/config.js";
import {buildApp} from "../src/app.js";

// Simulates a main-branch Render process WITHOUT connecting to any live service.
const env={
 NODE_ENV:"production",
 APP_ORIGIN:"https://luemi.onrender.com",
 TELEGRAM_BOT_TOKEN:"123456:synthetic_main_ci_not_a_real_bot",
 HEALTH_CHECK_KEY:"synthetic_health_ci_not_a_real_secret_0001",
 TELEGRAM_SETUP_ON_START:"0"
} satisfies Record<string,string>;

test("01I: production baseline boots with every real-user feature off",async()=>{
 const config=readConfig(env);
 assert.equal(config.origin,"https://luemi.onrender.com");
 assert.equal(config.setupOnStart,false);
 assert.equal(config.rem05b,undefined);
 assert.equal(config.rem05d,undefined);
 assert.equal(config.realRegistration,undefined);
 assert.equal(config.realPublication,undefined);
 assert.equal(config.realErasure,undefined);
 assert.equal(config.safetyAppeal,undefined);
 assert.equal(config.rem05c?.geo?.providerEnabled,false);
 const app=buildApp({...config,logger:false});
 try{
  const ok=await app.inject({method:"GET",url:"/api/health/live"});
  assert.equal(ok.statusCode,200,ok.body);
  for(const [method,url] of [
   ["GET","/api/v3/registration/draft"],
   ["GET","/api/v3/discovery/feed"],
   ["GET","/api/v3/profile/status"],
   ["POST","/api/v3/profile/publish"],
   ["POST","/api/v3/account/request-deletion"],
   ["POST","/api/v3/safety/appeal"],
   ["POST","/api/v2/media/intents"]
  ] as const){
   const reply=await app.inject({method,url,
    headers:{origin:env.APP_ORIGIN,"sec-fetch-site":"same-origin"}});
   assert.equal(reply.statusCode,404,method+" "+url+" unexpectedly available");
  }
 }finally{await app.close();}
});

test("01I: accidental beta flags cannot activate real registrations on main",()=>{
 for(const flag of [
  "REM06_PRIVATE_DRAFT_ENABLED","REM06_MEDIA_ENABLED","REM06_PUBLICATION_ENABLED",
  "REM06_ERASURE_REQUEST_ENABLED","REM06_SAFETY_APPEALS_ENABLED",
  "REM06_BETA_INVITES_ENABLED"
 ]){
  assert.throws(()=>readConfig({...env,[flag]:"1"}),undefined,
   "main cannot enable "+flag+" without full explicit approvals");
 }
});
test("01I: production origin is exact and malformed origins are rejected",()=>{
 for(const origin of [
  "https://luemi.onrender.com/","https://luemi.onrender.com/path",
  "https://luemi.onrender.com?ab=1","https://luemi.onrender.com#part",
  "https://bad@luemi.onrender.com","http://luemi.onrender.com",
  "https://luemi.onrender.com:443"
 ]){
  assert.throws(()=>readConfig({...env,APP_ORIGIN:origin}),/APP_ORIGIN/,
   origin);
 }
});
test("01I: a production build cannot accidentally run test-only REM05D",()=>{
 assert.throws(()=>readConfig({...env,REM05D_PRIVATE_ENABLED:"1"}),/REM-05D/);
});
