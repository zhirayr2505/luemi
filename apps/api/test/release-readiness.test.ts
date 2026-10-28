import test from "node:test";
import assert from "node:assert/strict";
import {buildApp} from "../src/app.js";
import {readConfig, type ApiConfig} from "../src/config.js";
import {describeReleaseConfig} from "../src/release-readiness.js";

const healthKey="ci-health-key-not-a-real-secret-123456789";
const cfg=readConfig({
 NODE_ENV:"test",APP_ORIGIN:"https://luemi.onrender.com",
 STAGING_BOOTSTRAP_ONLY:"1",HEALTH_CHECK_KEY:healthKey
});
test("release diagnostic is private, no-cache, and never leaks config secrets",async()=>{
 const app=buildApp({...cfg,healthKey,logger:false});
 try{
  for(const url of ["/api/health/ready","/api/health/release"]){
   for(const headers of [{},{"x-health-key":"wrong"},{"x-health-key":healthKey+"evil"}]){
    const r=await app.inject({method:"GET",url,headers});
    assert.equal(r.statusCode,404,url+" "+r.body);
   }
  }
  const r=await app.inject({method:"GET",url:"/api/health/release",
   headers:{"x-health-key":healthKey}});
  assert.equal(r.statusCode,200,r.body);
  assert.match(String(r.headers["cache-control"]),/\bno-store\b/);
  assert.match(String(r.headers["cache-control"]),/\bprivate\b/);
  const status=r.json();
  assert.equal(status.state,"blocked");
  assert.equal(status.verification,"configuration_only");
  assert.equal(status.database,"not_probed");
  assert.equal(status.storage,"not_probed");
  assert.equal(status.endToEnd,"not_probed");
  assert.equal(status.capabilities.signedTelegramSessions,false);
  assert(status.missing.includes("openAdmission"));
  assert(!r.body.includes(healthKey));
  assert(!r.body.includes("postgres://"));
  const ready=await app.inject({method:"GET",url:"/api/health/ready",
   headers:{"x-health-key":healthKey}});
  assert.deepEqual(ready.json(),{status:"ready",database:"not_probed",stage:"blocked"});
 }finally{await app.close();}
});

test("even fully configured flags are never marked live or E2E verified",()=>{
 const all={
  ...cfg,
  rem05b:{enabled:true,inviteOnly:false},
  realRegistration:{enabled:true},
  rem05d:{enabled:true,durablePrivateOnly:true},
  realPublication:{enabled:true},
  matches:{enabled:true},
  chats:{enabled:true},
  realErasure:{enabled:true},
  safetyAppeal:{enabled:true},
  releaseOperations:{
   privacyFlagConfigured:true,
   humanReviewCliConfigured:true,
   erasureWorkerCliConfigured:true,
   safetyOperatorCliConfigured:true
  }
 } as ApiConfig;
 const result=describeReleaseConfig(all);
 assert.equal(result.state,"configured_not_verified");
 assert.equal(result.verification,"configuration_only");
 assert.equal(result.endToEnd,"not_probed");
 assert.equal(result.privacyAndHumanModeration,"requires_operator_verification");
 assert.deepEqual(result.missing,[]);
 assert.equal(result.legalReview,"unverified");
 assert.equal(result.armeniaCrossBorderTransfer,"unverified");
 assert.equal(result.databaseTlsPeerVerification,"unverified");
});

test("open admission by itself never claims that published profiles or chats are available",()=>{
 const partial={
  ...cfg,rem05b:{enabled:true,inviteOnly:false},
  realRegistration:{enabled:true}
 } as ApiConfig;
 const status=describeReleaseConfig(partial);
 assert.equal(status.state,"blocked");
 assert.equal(status.capabilities.openAdmission,true);
 assert.equal(status.capabilities.realChats,false);
 assert.equal(status.capabilities.reviewedPublication,false);
 assert(status.missing.includes("privatePhotos"));
 assert(status.missing.includes("accountDeletion"));
});

test("even a fully configured public product without staff CLI gates remains blocked",()=>{
 const notStaffed={
  ...cfg,
  rem05b:{enabled:true,inviteOnly:false},
  realRegistration:{enabled:true},
  rem05d:{enabled:true,durablePrivateOnly:true},
  realPublication:{enabled:true},
  matches:{enabled:true},
  chats:{enabled:true},
  realErasure:{enabled:true},
  safetyAppeal:{enabled:true}
 } as ApiConfig;
 const gate=describeReleaseConfig(notStaffed);
 assert.equal(gate.state,"blocked");
 for(const missing of ["humanReviewCliConfigured","erasureWorkerCliConfigured",
  "safetyOperatorCliConfigured","privacyFlagConfigured"])
   assert(gate.missing.includes(missing),missing);
});

test("independent operator CLI configuration is fail-closed, isolated and nonsecret",()=>{
 const env={
  NODE_ENV:"production",
  APP_ORIGIN:"https://luemi.onrender.com",
  TELEGRAM_BOT_TOKEN:"123456:synthetic_nonreal_bot",
  HEALTH_CHECK_KEY:"h".repeat(32),
  REM06_PRIVACY_APPROVED:"1",REM06_CONSENT_VERSION:"luemi-pending-v1",
  REG01G_HUMAN_REVIEW_ENABLED:"1",REG01G_HUMAN_REVIEW_POLICY_APPROVED:"1",
  REG01G_MODERATOR_DATABASE_URL:"postgresql://fake@moderator.invalid/postgres",
  REG01G_MODERATOR_LABEL:"owner_manual_review",
  REM06_ERASURE_WORKER_ENABLED:"1",REM06_ERASURE_POLICY_APPROVED:"1",
  REM06_ERASURE_MAINTENANCE_APPROVED:"1",
  REM06_ERASURE_WORKER_DATABASE_URL:"postgresql://fake@erasure.invalid/postgres",
  REM06_MEDIA_BUCKET:"luemi-profile-private",
  REM06_SUPABASE_PROJECT_REF:"syntheticprojectid",
  REM06_SUPABASE_STORAGE_SECRET:"only_fake_value",
  REG01H_SAFETY_OPERATOR_ENABLED:"1",REG01H_SAFETY_POLICY_APPROVED:"1",
  REG01H_SAFETY_OPERATOR_DATABASE_URL:"postgresql://fake@safety.invalid/postgres",
  REG01H_OPERATOR_LABEL:"owner_safety_review"
 };
 const good=readConfig(env);
 const status=good.releaseOperations!;
 assert.deepEqual(status,{
  privacyFlagConfigured:true,
  humanReviewCliConfigured:true,
  erasureWorkerCliConfigured:true,
  safetyOperatorCliConfigured:true
 });
 assert(!JSON.stringify(describeReleaseConfig(good)).includes("fake@"));
 for(const overrides of [
  {REG01G_HUMAN_REVIEW_ENABLED:"0"},
  {REG01G_MODERATOR_DATABASE_URL:env.REM06_ERASURE_WORKER_DATABASE_URL},
  {REG01G_MODERATOR_DATABASE_URL:env.REG01G_MODERATOR_DATABASE_URL,REM05B_AUTH_DATABASE_URL:env.REG01G_MODERATOR_DATABASE_URL},
  {REG01H_SAFETY_OPERATOR_DATABASE_URL:env.REG01G_MODERATOR_DATABASE_URL},
  {REM06_ERASURE_MAINTENANCE_APPROVED:"0"},
  {REM06_SUPABASE_STORAGE_SECRET:""},
  {REG01H_OPERATOR_LABEL:""},
  {REG01H_SAFETY_POLICY_APPROVED:"0"},
  {REM06_CONSENT_VERSION:""}
 ]){
  const config=readConfig({...env,...overrides});
  assert(Object.values(config.releaseOperations!).includes(false),
   "Bad ops configuration should not pass");
 }
});
