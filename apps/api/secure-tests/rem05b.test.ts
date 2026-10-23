import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import test from "node:test";
import {Pool} from "pg";
import {buildApp} from "../src/app.js";

const issuerUrl=process.env.REM05B_TEST_ISSUER_DATABASE_URL;
const requestUrl=process.env.REM05B_TEST_REQUEST_DATABASE_URL;
const adminUrl=process.env.REM05B_TEST_ADMIN_DATABASE_URL;
if(!issuerUrl||!requestUrl||!adminUrl)throw new Error("REM-05B requires real disposable PostgreSQL role URLs");
const origin="https://ci.luemi.invalid",token="123456:synthetic-rem05b-only";
const opts={enabled:true,issuerDatabaseUrl:issuerUrl,requestDatabaseUrl:requestUrl,
 pepper:"synthetic-rem05b-pepper-never-live-123456789",namespace:"ci_bot_a",
 origin,botToken:token,idleMs:12*60*60*1000,absoluteMs:7*24*60*60*1000,maxSessions:5};
const now=Math.floor(Date.now()/1000);
function sign(userId:number,firstName="Тест",date=now,bot=token,extra:Record<string,string>={}){
 const data={auth_date:String(date),user:JSON.stringify({id:userId,first_name:firstName}),...extra};
 const message=Object.entries(data).sort(([a],[b])=>a.localeCompare(b,"en"))
 .map(([k,v])=>k+"="+v).join("\n");
 const key=createHmac("sha256","WebAppData").update(bot).digest();
 return new URLSearchParams({...data,hash:createHmac("sha256",key).update(message).digest("hex")}).toString();
}
function makeApp(settings=opts){
 return buildApp({port:3001,origin,botToken:token,healthKey:"synthetic_health_key_length_32_chars",logger:false,rem05b:settings});
}
function headers(extra:Record<string,string>={}){return{Origin:origin,"sec-fetch-site":"same-origin",...extra};}
function auth(app:ReturnType<typeof makeApp>,raw:string,extra:Record<string,string>={}){
 return app.inject({method:"POST",url:"/api/v2/auth/telegram",headers:headers(extra),payload:{initData:raw}});
}
function sid(reply:{headers:Record<string,unknown>}):string{
 const value=reply.headers["set-cookie"];
 assert.equal(typeof value,"string","Secure cookie issued");
 const cookie=(value as string).split(";")[0];
 assert.match(cookie,/^__Host-luemi_sid=[A-Za-z0-9_-]{43}$/);
 return cookie;
}
function get(app:ReturnType<typeof makeApp>,url:string,cookie?:string,extra:Record<string,string>={}){
 return app.inject({method:"GET",url,headers:cookie?{cookie,...extra}:extra});
}
function mutation(app:ReturnType<typeof makeApp>,url:string,cookie:string,csrf:string,extra:Record<string,string>={}){
 return app.inject({method:"POST",url,headers:headers({cookie,"x-luemi-csrf":csrf,...extra}),payload:{}});
}
const admin=new Pool({connectionString:adminUrl});
const issuer=new Pool({connectionString:issuerUrl});
const scoped=new Pool({connectionString:requestUrl});
test("REM05B real PostgreSQL: signature, A/B, RLS, sessions, concurrency, CSRF and revocation",async()=>{
 let app=makeApp();
 try{
  assert.equal((await get(app,"/api/v2/me")).statusCode,401);
  assert.equal((await get(app,"/api/v2/auth/session")).statusCode,401);
  const invalid=[
   "a=b", sign(101).replace("101","102"),sign(101,"Тест",now-3601),
   sign(101,"Тест",now+61),sign(101,"Тест",now, "999999:wrong-bot"),
   sign(101)+"&auth_date="+now,sign(101)+"&auth_date="+now+"&hash=x",
   "x".repeat(8200)
  ];
  for(const raw of invalid)assert.equal((await auth(app,raw)).statusCode,401);
  const records=await issuer.query<{count:string}>("SELECT count(*)::text AS count FROM luemi_private.actors");
  assert.equal(Number(records.rows[0].count),0,"Invalid input must not provision accounts");
  const signed=sign(4_294_967_299,"Синтетический пользователь");
  const replies=await Promise.all(Array.from({length:50},()=>auth(app,signed)));
  assert.equal(replies.filter(r=>r.statusCode===200).length,5,"five-device ceiling");
  assert.equal(replies.filter(r=>r.statusCode===429).length,45,"no 50 live sessions");
  const active=replies.filter(r=>r.statusCode===200);
  // Preserve the unchanged legacy global 60/min limit; continue on a fresh
  // Fastify instance rather than testing LU-26 topology in REM-05B.
  await app.close(); app=makeApp();
  const uuid=active[0].json().user.id;
  assert.match(uuid,/^[a-f0-9-]{36}$/);
  assert.equal(new Set(active.map(r=>r.json().user.id)).size,1);
  const mapped=await issuer.query<{id:string;telegram_id:string}>(
   "SELECT id,telegram_id::text FROM luemi_private.actors WHERE environment=$1",["ci_bot_a"]);
  assert.equal(mapped.rowCount,1);
  assert.equal(mapped.rows[0].telegram_id,"4294967299");
  assert.equal((await issuer.query(
   "SELECT token_hash FROM luemi_private.sessions WHERE actor_id=$1 AND revoked_at IS NULL",[uuid]
  )).rows.length,5);
  const aCookie=sid(active[0]),aCsrf=active[0].json().csrfToken;
  assert.ok(!JSON.stringify(active[0].json()).includes("4294967299"),"No Telegram ID in v2 envelope");
  assert.match(String(active[0].headers["set-cookie"]),/Path=\/; Secure; HttpOnly; SameSite=Lax/);
  assert.equal((await get(app,"/api/v2/me",aCookie,{"x-actor-id":"fake","x-role":"admin"})).json().id,uuid);
  assert.equal((await get(app,"/api/v2/auth/session",aCookie)).json().user.id,uuid);
  assert.equal((await mutation(app,"/api/v2/auth/logout",aCookie,"wrong")).statusCode,403);
  assert.equal((await app.inject({method:"POST",url:"/api/v2/auth/logout",headers:{cookie:aCookie,"x-luemi-csrf":aCsrf},payload:{}})).statusCode,403);
  assert.equal((await mutation(app,"/api/v2/auth/logout",aCookie,aCsrf,{origin:"https://attacker.invalid","sec-fetch-site":"cross-site"})).statusCode,403);
  assert.equal((await get(app,"/api/v2/me",undefined,{authorization:"Bearer "+aCookie.slice(aCookie.indexOf("=")+1)})).statusCode,401);
  assert.equal((await mutation(app,"/api/v2/auth/logout-all",aCookie,aCsrf)).statusCode,200);
  for(const reply of active)assert.equal((await get(app,"/api/v2/me",sid(reply))).statusCode,401);
  const refreshedName=await auth(app,sign(4_294_967_299,"Другое имя"));
  assert.equal(refreshedName.statusCode,200);
  assert.equal(refreshedName.json().user.id,uuid);
  assert.equal(refreshedName.json().user.firstName,"Синтетический пользователь","persist original name");
  const rCookie=sid(refreshedName),rCsrf=refreshedName.json().csrfToken;
  const rotate=await Promise.all(Array.from({length:2},()=>mutation(app,"/api/v2/auth/refresh",rCookie,rCsrf)));
  assert.equal(rotate.filter(r=>r.statusCode===200).length,1,"atomic refresh");
  assert.equal(rotate.filter(r=>r.statusCode===401).length,1);
  assert.equal((await get(app,"/api/v2/me",rCookie)).statusCode,401,"old generation revoked");
  const newCookie=sid(rotate.find(r=>r.statusCode===200)!);
  assert.equal((await get(app,"/api/v2/me",newCookie)).statusCode,200);
  const current=rotate.find(r=>r.statusCode===200)!;
  assert.equal((await mutation(app,"/api/v2/auth/logout",newCookie,current.json().csrfToken)).statusCode,200);
  assert.equal((await get(app,"/api/v2/me",newCookie)).statusCode,401);
  const replay=await auth(app,signed);
  assert.equal(replay.statusCode,200,"signed Telegram initData replay remains possible within 1h");
  assert.equal((await get(app,"/api/v2/me",sid(replay))).statusCode,200);
  await admin.query("UPDATE luemi_private.actors SET status='banned' WHERE id=$1",[uuid]);
  assert.equal((await auth(app,signed)).statusCode,403);
  assert.equal((await get(app,"/api/v2/me",sid(replay))).statusCode,401);
  assert.equal((await issuer.query("SELECT count(*)::int AS n FROM luemi_private.actors WHERE environment='ci_bot_a'")).rows[0].n,1);
 }finally{await app.close();}
});
test("REM05B actual request role RLS no actor cross-tenant or pooled context",async()=>{
 const app=makeApp({...opts,namespace:"ci_bot_b"});
 try{
  const a=await auth(app,sign(123456,"Actor A")),b=await auth(app,sign(567890,"Actor B"));
  assert.equal(a.statusCode,200);assert.equal(b.statusCode,200);
  const idA=a.json().user.id,idB=b.json().user.id;
  assert.notEqual(idA,idB);
  assert.equal((await get(app,"/api/v2/me",sid(a),{"x-actor-id":idB})).json().id,idA);
  const role=await scoped.query<{rolbypassrls:boolean;rolsuper:boolean}>(
   "SELECT rolbypassrls,rolsuper FROM pg_roles WHERE rolname=current_user");
  assert.equal(role.rows[0].rolbypassrls,false);
  assert.equal(role.rows[0].rolsuper,false);
  assert.equal((await scoped.query("SELECT id FROM luemi_private.actors")).rowCount,0,"missing GUC is deny");
  for(const [self,other] of [[idA,idB],[idB,idA]]){
   const conn=await scoped.connect();
   try{
    await conn.query("BEGIN");
    await conn.query("SELECT set_config('luemi.actor_id',$1,true)",[self]);
    assert.equal((await conn.query("SELECT id FROM luemi_private.actors WHERE id=$1",[self])).rowCount,1);
    assert.equal((await conn.query("SELECT id FROM luemi_private.actors WHERE id=$1",[other])).rowCount,0);
    await conn.query("ROLLBACK");
   }finally{conn.release();}
  }
  assert.equal((await scoped.query("SELECT id FROM luemi_private.actors")).rowCount,0,"rollback cleared context");
  for(const roleName of ["anon","authenticated"]){
   const conn=await admin.connect();
   try{
    await conn.query("BEGIN");
    await conn.query("SET LOCAL ROLE "+roleName);
    await assert.rejects(conn.query("SELECT id FROM luemi_private.actors"));
    await conn.query("ROLLBACK");
   }finally{conn.release();}
  }
 }finally{await app.close();}
});
test("REM05B privileged-role configuration is rejected at the API boundary",async()=>{
 const wrongIssuer=makeApp({...opts,namespace:"ci_role_probe",issuerDatabaseUrl:adminUrl});
 try{
  assert.equal((await auth(wrongIssuer,sign(220033))).statusCode,503);
 }finally{await wrongIssuer.close();}
 const wrongRequest=makeApp({...opts,namespace:"ci_role_probe",requestDatabaseUrl:adminUrl});
 try{
  const valid=await auth(wrongRequest,sign(220034));
  assert.equal(valid.statusCode,200);
  assert.equal((await get(wrongRequest,"/api/v2/me",sid(valid))).statusCode,503);
 }finally{await wrongRequest.close();}
});
test("REM05B fail-closed DB unavailable and rejected third-party cookie fixture",async()=>{
 const bad=makeApp({...opts,issuerDatabaseUrl:"postgres://invalid:invalid@127.0.0.1:1/missing"});
 try{
  assert.equal((await auth(bad,sign(999))).statusCode,503);
  assert.equal((await get(bad,"/api/v2/me","__Host-luemi_sid="+"A".repeat(43))).statusCode,503);
  assert.equal((await get(bad,"/api/v2/me")).statusCode,401);
 }finally{await bad.close();}
});
test.after(async()=>{await Promise.all([issuer.end(),scoped.end(),admin.end()]);});
