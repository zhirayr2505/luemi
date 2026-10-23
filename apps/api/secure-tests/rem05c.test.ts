import assert from "node:assert/strict";
import {test} from "node:test";
import {createHmac} from "node:crypto";
import {Pool} from "pg";
import {buildApp} from "../src/app.js";
import {GeoBudget} from "../src/rem05c-quota.js";
const adminUrl=process.env.REM05B_TEST_ADMIN_DATABASE_URL;
const issuerUrl=process.env.REM05B_TEST_ISSUER_DATABASE_URL;
const requestUrl=process.env.REM05B_TEST_REQUEST_DATABASE_URL;
const budgetUrl=process.env.REM05C_TEST_BUDGET_DATABASE_URL;
if(!adminUrl||!issuerUrl||!requestUrl||!budgetUrl)
 throw new Error("REM-05C requires real disposable PostgreSQL role URLs");
const origin="https://ci.luemi.invalid",botToken="123456:synthetic-rem05c";
const actorA="11111111-1111-4111-8111-111111111111";
const actorB="22222222-2222-4222-8222-222222222222";
function sign(id:number){
 const p={auth_date:String(Math.floor(Date.now()/1000)),
  user:JSON.stringify({id,first_name:"Synthetic"})};
 const msg=Object.entries(p).sort(([a],[b])=>a.localeCompare(b,"en"))
   .map(([k,v])=>k+"="+v).join("\n");
 const key=createHmac("sha256","WebAppData").update(botToken).digest();
 return new URLSearchParams({...p,hash:createHmac("sha256",key).update(msg).digest("hex")}).toString();
}
const admin=new Pool({connectionString:adminUrl});
function budget(namespace:string,cap=6){
 return{databaseUrl:budgetUrl,namespace,actorSearchPerDay:4,
    actorReversePerDay:2,globalDailyCap:cap,maxInFlight:3};
}
test("SEC-G04 G09: two real pools and 100 concurrent admissions share atomic budget",async()=>{
 const namespace="rem05c_durable_100";
 const one=new GeoBudget(budget(namespace,7)),two=new GeoBudget(budget(namespace,7));
 try{
  const admits=await Promise.all(Array.from({length:100},async(_,i)=>{
    const b=i%2?one:two;
    const x=await b.reserve(i%2?actorA:actorB,"search");
    if(x.ok){await x.release();return true;}
    assert.ok(x.reason==="quota"||x.reason==="unavailable");
    return false;
  }));
  const passed=admits.filter(Boolean).length;
  assert.ok(passed<=7&&passed>0);
  const rows=await admin.query<{used:string}>("SELECT used::text FROM luemi_private.geo_daily_usage "+
    "WHERE namespace=$1 AND scope='global'",[namespace]);
  assert.equal(rows.rowCount,1);
  assert.equal(Number(rows.rows[0].used),passed,"no overspend or negative counter");
  const usage=await admin.query<{n:string}>("SELECT sum(used)::text AS n FROM luemi_private.geo_daily_usage "+
    "WHERE namespace=$1 AND scope='actor'",[namespace]);
  assert.equal(Number(usage.rows[0].n),passed,"actor and global reservations commit atomically");
 }finally{await one.close();await two.close();}
});
test("SEC-G01 G02 G03 G07 G08 G09: actual sessions and fake provider, separate NAT actors",async()=>{
 let calls=0;
 const fake:typeof fetch=async()=>{calls++;return Response.json({
   results:[{result_type:"city",place_id:"synthetic-101",country_code:"AM",
     country:"Армения",city:"Ереван"}]});};
 const namespace="rem05c_full_api";
 const rem05b={enabled:true,issuerDatabaseUrl:issuerUrl!,requestDatabaseUrl:requestUrl!,
   pepper:"synthetic-rem05c-pepper-at-least-thirtytwo-123",namespace,
   origin,botToken,idleMs:43200000,absoluteMs:604800000,maxSessions:5};
 const create=()=>buildApp({port:3001,origin,botToken,healthKey:"synthetic_health_key_123456789012345",
  webhookSecret:"synthetic_webhook",logger:false,rem05b,
  rem05c:{geo:{enabled:true,providerEnabled:true,providerKey:"synthetic_key",
    budget:budget(namespace,5),providerFetch:fake},embedding:{enabled:false,ancestors:[]}}});
 const app1=create(),app2=create();
 try{
  const no=await app1.inject({url:"/api/v2/geo/search?q=Yerevan"});
  assert.equal(no.statusCode,401);assert.equal(calls,0);
  const legacy=await app1.inject({url:"/api/geo/search?q=Ереван"});
  assert.equal(legacy.json().coverage,"demo");assert.equal(calls,0);
  const a=await app1.inject({method:"POST",url:"/api/v2/auth/telegram",
    headers:{origin,"sec-fetch-site":"same-origin"},payload:{initData:sign(101)}});
  const b=await app2.inject({method:"POST",url:"/api/v2/auth/telegram",
    headers:{origin,"sec-fetch-site":"same-origin"},payload:{initData:sign(202)}});
  assert.equal(a.statusCode,200);assert.equal(b.statusCode,200);
  const cookieA=String(a.headers["set-cookie"]).split(";")[0];
  const cookieB=String(b.headers["set-cookie"]).split(";")[0];
  for(const cookie of [cookieA,cookieB]){
    const wrong=await app1.inject({url:"/api/v2/geo/search?q=Yerevan",
      headers:{cookie,"x-forwarded-for":"198.51.100.97","x-actor-id":actorB}});
    assert.equal(wrong.statusCode,200);
    assert.equal(wrong.json().coverage,"world");
  }
  const invalid=await app1.inject({url:"/api/v2/geo/search?q=%3C%3C",
    headers:{cookie:cookieA}});
  assert.equal(invalid.statusCode,400);
  const invalidPost=await app1.inject({method:"POST",url:"/api/v2/geo/reverse",
    headers:{cookie:cookieA,origin,"x-luemi-csrf":a.json().csrfToken},
    payload:{lat:91,lon:0}});
  assert.equal(invalidPost.statusCode,400);
  const cross=await app1.inject({method:"POST",url:"/api/v2/geo/reverse",
    headers:{cookie:cookieA,origin:"https://attacker.invalid",
      "x-luemi-csrf":a.json().csrfToken},payload:{lat:50,lon:40}});
  assert.equal(cross.statusCode,403);
  for(let i=0;i<10;i++){
    const reply=await (i%2?app1:app2).inject({url:"/api/v2/geo/search?q=Yerevan",
      headers:{cookie:i%2?cookieA:cookieB,"x-forwarded-for":"8.8.8."+i}});
    assert.ok([200,429].includes(reply.statusCode),String(reply.statusCode));
    if(reply.statusCode===429)assert.ok(Number(reply.headers["retry-after"])>=1);
  }
  assert.ok(calls<=5,"only budgeted fake provider calls");
  const global=await admin.query<{used:string}>("SELECT used::text FROM luemi_private.geo_daily_usage "+
    "WHERE namespace=$1 AND scope='global'",[namespace]);
  assert.equal(Number(global.rows[0].used),calls);
  assert.equal((await app1.inject({url:"/api/v2/me",headers:{cookie:cookieA}})).statusCode,200,
    "geo denial does not block unrelated verified API");
 }finally{await app1.close();await app2.close();}
});
test("SEC-G09: budget unavailable fails closed before provider",async()=>{
 const calls=0;
 const unavailableBudget=new GeoBudget({...budget("rem05c_store_down",1),
  databaseUrl:"postgres://synthetic_user:synthetic_password@127.0.0.1:1/down"});
 try{
  const r=await unavailableBudget.reserve(actorA,"search");
  assert.deepEqual({ok:r.ok}, {ok:false});
  assert.equal(calls,0);
 }finally{await unavailableBudget.close();}
});
test.after(async()=>{await admin.end();});
