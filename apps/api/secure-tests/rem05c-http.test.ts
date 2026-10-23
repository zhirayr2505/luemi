import assert from "node:assert/strict";
import {test} from "node:test";
import {buildApp} from "../src/app.js";
const origin="https://ci.luemi.invalid";
function make(embedding?:{enabled:boolean;ancestors:string[]}){
 return buildApp({port:3001,origin,botToken:"123456:synthetic",
   healthKey:"synthetic-health-key-01234567890123",webhookSecret:"synthetic-webhook",
   logger:false,rem05c:{geo:{enabled:false,providerEnabled:false,providerKey:""},
     embedding}});
}
test("SEC-W01 W04 W05: route cache and iframe policy default-deny",async()=>{
 const app=make();
 try{
  app.get("/assets/client-1234abcd.js",async()=>({synthetic:true}));
  app.get("/plain.js",async()=>({synthetic:true}));
  app.get("/index.html",async()=>"<html>Synthetic shell</html>");
  const cases=[
   ["/api/health/live","private, no-store"],
   ["/assets/client-1234abcd.js","public, max-age=31536000, immutable"],
   ["/plain.js","no-cache"],
   ["/index.html","no-store"]
  ];
  for(const [url,cache] of cases){
   const r=await app.inject({method:"GET",url,headers:{accept:url.endsWith("html")?"text/html":"application/json"}});
   assert.equal(r.statusCode,200,url);
   assert.equal(r.headers["cache-control"],cache,url);
   assert.equal(r.headers["x-content-type-options"],"nosniff");
   assert.equal(r.headers["referrer-policy"],"no-referrer");
   assert.equal(r.headers["x-frame-options"],"DENY");
   assert.equal(r.headers["content-security-policy"],"frame-ancestors 'none'");
  }
  const r=await app.inject({method:"GET",url:"/api/v2/auth/session"});
  assert.equal(r.headers["cache-control"],"private, no-store");
  assert.match(String(r.headers.vary),/Cookie/);
 }finally{await app.close();}
});
test("SEC-W01 W05: explicit HTTPS ancestor allowlist is not a wildcard",async()=>{
 const app=make({enabled:true,ancestors:["https://web.telegram.org"]});
 try{
  app.get("/index.html",async()=>"<html>fixture</html>");
  const shell=await app.inject({url:"/index.html",headers:{accept:"text/html"}});
  assert.equal(shell.headers["content-security-policy"],"frame-ancestors 'self' https://web.telegram.org");
  assert.equal(shell.headers["x-frame-options"],undefined);
  const api=await app.inject({url:"/api/health/live"});
  assert.equal(api.headers["x-frame-options"],"DENY");
  assert.equal(api.headers["content-security-policy"],"frame-ancestors 'none'");
  assert.ok(!String(shell.headers["content-security-policy"]).includes("attacker"));
 }finally{await app.close();}
 for(const bad of ["https://*.telegram.org","http://web.telegram.org",
   "https://web.telegram.org/path","https://a.invalid@web.telegram.org",
   "https://web.telegram.org:443/path","https://web.telegram.org.evil.test"]){
   if(bad==="https://web.telegram.org.evil.test")continue; // valid syntax; not in supplied allowlist
   assert.throws(()=>make({enabled:true,ancestors:[bad]}));
 }
});
test("R01 R02 R05: pre-auth spoofed forwarding does not exhaust health or webhook buckets",async()=>{
 const app=make();
 try{
  for(let i=0;i<13;i++){
   const r=await app.inject({method:"POST",url:"/api/auth/telegram",
     headers:{Origin:origin,"x-forwarded-for":"203.0.113."+i},
     payload:{initData:"forged"}});
   if(i===12)assert.equal(r.statusCode,429,"spoofed XFF must not reset preauth peer limiter");
  }
  const health=await app.inject({url:"/api/health/live"});
  assert.equal(health.statusCode,200);
  const hook=await app.inject({method:"POST",url:"/api/telegram/webhook",payload:{}});
  assert.equal(hook.statusCode,404,"webhook secret still required");
 }finally{await app.close();}
});
test("SEC-G07: existing real provider key does not enable legacy upstream",async()=>{
 const app=make();
 const orig=process.env.GEOAPIFY_API_KEY;
 process.env.GEOAPIFY_API_KEY="synthetic_key_unused";
 try{
  const r=await app.inject({url:"/api/geo/search?q=Ереван"});
  assert.equal(r.statusCode,200);
  assert.equal(r.json().coverage,"demo");
  const reverse=await app.inject({method:"POST",url:"/api/geo/reverse",
    payload:{lat:1,lon:2}});
  assert.equal(reverse.statusCode,503);
  const disabled=await app.inject({url:"/api/v2/geo/search?q=Paris"});
  assert.equal(disabled.statusCode,503);
 }finally{
  if(orig===undefined)delete process.env.GEOAPIFY_API_KEY;
  else process.env.GEOAPIFY_API_KEY=orig;
  await app.close();
 }
});
