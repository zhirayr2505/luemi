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
  assert.equal(r.headers["cache-control"],"no-store");
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
  safetyAppeal:{enabled:true}
 } as ApiConfig;
 const result=describeReleaseConfig(all);
 assert.equal(result.state,"configured_not_verified");
 assert.equal(result.verification,"configuration_only");
 assert.equal(result.endToEnd,"not_probed");
 assert.equal(result.privacyAndHumanModeration,"requires_operator_verification");
 assert.deepEqual(result.missing,[]);
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
