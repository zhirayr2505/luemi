import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import test from "node:test";
import {Pool} from "pg";
import {buildApp} from "../src/app.js";
import {validateTelegramInitData} from "../src/telegram-auth.js";

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
function tamperUser(raw:string):string {
 const p=new URLSearchParams(raw);
 const user=JSON.parse(p.get("user")!);
 user.id=102;
 p.set("user",JSON.stringify(user));
 return p.toString();
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
   "a=b", tamperUser(sign(101)),sign(101,"Тест",now-3601),
   sign(101,"Тест",now+300),sign(101,"Тест",now, "999999:wrong-bot"),
   sign(101)+"&auth_date="+now,sign(101)+"&auth_date="+now+"&hash=x",
   "x".repeat(8200)
  ];
  assert.equal(validateTelegramInitData(sign(101,"Тест",now+61),token,now),null,
   "exact +61s skew must fail under a pinned server clock");
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
  const pendingAll=await mutation(app,"/api/v2/auth/logout-all",aCookie,aCsrf);
  assert.equal(pendingAll.statusCode,403,"no owner-approved step-up for logout-all");
  assert.deepEqual(pendingAll.json(),{error:"additional_confirmation_required"});
  for(const reply of active)assert.equal((await get(app,"/api/v2/me",sid(reply))).statusCode,200,
    "disabled logout-all must not revoke anything");
  // Test-only DBA revocation emulates future authorized logout-all policy.
  // This is not a production API backdoor.
  await admin.query("UPDATE luemi_private.sessions SET revoked_at=clock_timestamp() "+
    "WHERE actor_id=$1 AND environment=$2 AND revoked_at IS NULL",[uuid,"ci_bot_a"]);
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
 const capability=await scoped.query(
  "SELECT row_security_active('luemi_private.actors'::regclass) AS actors_rls,"+
  "row_security_active('luemi_private.sessions'::regclass) AS sessions_rls,"+
  "has_table_privilege(current_user,'luemi_private.actors','SELECT') AS table_select,"+
  "has_column_privilege(current_user,'luemi_private.actors','id','SELECT') AS column_select,"+
  "has_table_privilege(current_user,'luemi_private.actors','UPDATE') AS actor_update,"+
  "has_table_privilege(current_user,'luemi_private.sessions','SELECT') AS session_select");
 console.log("REM05B_REDACTED_ROLE_CAPABILITY",JSON.stringify(capability.rows[0]));
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
 const bad=makeApp({...opts,issuerDatabaseUrl:"postgres://synthetic_invalid:synthetic_invalid@127.0.0.1:1/missing"});
 try{
  assert.equal((await auth(bad,sign(999))).statusCode,503);
  assert.equal((await get(bad,"/api/v2/me","__Host-luemi_sid="+"A".repeat(43))).statusCode,503);
  assert.equal((await get(bad,"/api/v2/me")).statusCode,401);
 }finally{await bad.close();}
});
test("REM05B server-clock expiry, account lock and environment partition",async()=>{
 const appA=makeApp({...opts,namespace:"ci_clock_a"});
 const appB=makeApp({...opts,namespace:"ci_clock_b"});
 try{
  const signed=sign(9_987_654_321,"Immutable");
  const first=await auth(appA,signed),other=await auth(appB,signed);
  assert.equal(first.statusCode,200);
  assert.equal(other.statusCode,200);
  const id=first.json().user.id;
  assert.notEqual(id,other.json().user.id,"same Telegram ID in different bot namespace must differ");
  const previous=sid(first);
  await issuer.query("UPDATE luemi_private.sessions SET idle_expires_at=clock_timestamp() "+
   "WHERE actor_id=$1 AND environment=$2",[id,"ci_clock_a"]);
  assert.equal((await get(appA,"/api/v2/me",previous)).statusCode,401);
  const again=await auth(appA,signed);
  assert.equal(again.statusCode,200);
  const fresh=sid(again);
  await admin.query("UPDATE luemi_private.sessions SET absolute_expires_at=clock_timestamp() "+
   "WHERE actor_id=$1 AND environment=$2 AND revoked_at IS NULL",[id,"ci_clock_a"]);
  assert.equal((await get(appA,"/api/v2/me",fresh)).statusCode,401,"absolute expiry enforced by server");
  for(const status of ["suspended","deleted"]){
   await admin.query("UPDATE luemi_private.actors SET status=$1 WHERE id=$2",[status,id]);
   assert.equal((await auth(appA,signed)).statusCode,403);
   assert.equal((await issuer.query("SELECT count(*)::int AS n FROM luemi_private.actors "+
     "WHERE environment=$1 AND telegram_id=$2",["ci_clock_a","9987654321"])).rows[0].n,1);
  }
  assert.equal((await get(appB,"/api/v2/me",sid(other))).statusCode,200,
    "one bot namespace suspension does not block another");
 }finally{await Promise.all([appA.close(),appB.close()]);}
});

test("REM05B disjoint PG roles: combined/inherited/NOINHERIT and effective ACLs are fail-closed",async()=>{
 const urls=[
  ["combined","REM05B_TEST_COMBINED_DATABASE_URL"],
  ["indirect","REM05B_TEST_INDIRECT_DATABASE_URL"],
  ["noinherit","REM05B_TEST_NOINHERIT_DATABASE_URL"],
  ["readall","REM05B_TEST_READALL_DATABASE_URL"],
  ["createrole","REM05B_TEST_CREATE_ROLE_DATABASE_URL"],
  ["extra-column","REM05B_TEST_EXTRA_COLUMN_DATABASE_URL"]
 ] as const;
 const root=makeApp({...opts,namespace:"ci_pg_collision"});
 try{
  const a=await auth(root,sign(8877001,"Separate A"));
  const b=await auth(root,sign(8877002,"Separate B"));
  assert.equal(a.statusCode,200);assert.equal(b.statusCode,200);
  const actorA=a.json().user.id,actorB=b.json().user.id;
  const issuerToken=sid(a);
  assert.notEqual(actorA,actorB);
  for(const [label,key] of urls){
   const url=process.env[key];
   assert.ok(url,"Missing disposable test-only connection for "+label);
   const pool=new Pool({connectionString:url,max:1});
   try{
    const flags=await pool.query<{issuer:boolean;request:boolean}>(
     "SELECT pg_has_role(current_user,'luemi_auth_issuer','member') AS issuer,"+
     "pg_has_role(current_user,'luemi_request','member') AS request");
    if(["combined","indirect","noinherit"].includes(label)){
     assert.equal(flags.rows[0].issuer,true,label+" issuer role membership");
     assert.equal(flags.rows[0].request,true,label+" request role membership");
    }
    if(label==="extra-column"){
     const access=await pool.query<{unexpected:boolean}>(
       "SELECT has_column_privilege(current_user,'luemi_private.actors','telegram_id','SELECT') AS unexpected");
     assert.equal(access.rows[0].unexpected,true,
       "the synthetic direct grant must be demonstrated, not inferred");
    }
    if(label==="combined"||label==="indirect"){
     const rls=await pool.query("SELECT row_security_active('luemi_private.actors'::regclass) AS active");
     assert.equal(rls.rows[0].active,true,"active PostgreSQL RLS required");
     // An inheriting mixed role has both permissive policies. This is the
     // actual problem: its SELECT sees A and B without a server actor context.
     const leaky=await pool.query<{id:string}>(
      "SELECT id FROM luemi_private.actors WHERE id=ANY($1::uuid[]) ORDER BY id",
      [[actorA,actorB]]);
     assert.deepEqual(leaky.rows.map(x=>x.id).sort(),[actorA,actorB].sort(),
      "prove dangerous effective union of policies on a disposable DB");
    }
    const probeIssuer=makeApp({...opts,namespace:"ci_pg_collision",issuerDatabaseUrl:url});
    try{
     assert.equal((await auth(probeIssuer,sign(8800090+urls.findIndex(([name])=>name===label)))).statusCode,503);
     assert.equal((await get(probeIssuer,"/api/v2/me",issuerToken)).statusCode,503);
    }finally{await probeIssuer.close();}
    const probeRequest=makeApp({...opts,namespace:"ci_pg_collision",requestDatabaseUrl:url});
    try{
     assert.equal((await get(probeRequest,"/api/v2/me",issuerToken,{"x-actor-id":actorB,"x-role":"admin"})).statusCode,503,
      label+" privileged/mixed request pool must reject even A/B");
    }finally{await probeRequest.close();}
   }finally{await pool.end();}
  }
  const scopedTruth=await scoped.query<{id:string}>("SELECT id FROM luemi_private.actors");
  assert.equal(scopedTruth.rowCount,0,"normal request account still denies absent GUC");
  assert.equal((await get(root,"/api/v2/me",issuerToken)).json().id,actorA,
   "correct isolated roles still accept A only");
 }finally{await root.close();}
});
test("REM05B signature field canonicalization, duplicate encodings and client authority forgery",async()=>{
 const app=makeApp({...opts,namespace:"ci_signature_matrix"});
 try{
  const valid=sign(7700001,"Éлена 🌙",now,token,{signature:"synthetic-base64url-signature"});
  const accepted=await auth(app,valid);
  assert.equal(accepted.statusCode,200,
   "For bot-token HMAC the signed signature field must be covered by canonical input");
  const p=new URLSearchParams(valid);
  p.set("signature","tampered");
  assert.equal((await auth(app,p.toString())).statusCode,401);
  const edOnly=new URLSearchParams(valid);edOnly.delete("hash");
  assert.equal((await auth(app,edOnly.toString())).statusCode,401,
   "Ed25519-only third-party verification must not silently replace bot HMAC");
  const malformed=[
   valid+"&si%67nature=second",
   valid+"&hash="+"0".repeat(64),
   valid+"&__proto__=admin",
   valid.replace(/%[A-Fa-f0-9]{2}/,"BAD%GG"),
   "hash="+"0".repeat(64)+"&auth_date="+now+"&user=%7Bbad",
   sign(7700002,""),
   sign(7700003," \t"),
   sign(7700004,"A".repeat(257)),
   sign(7700005,"Valid",now,token,{role:"admin",ownerId:"7700001"})
  ];
  for(const [index,raw] of malformed.entries()){
   const response=await auth(app,raw);
   if(index===8){
    // Properly signed extra fields are data, not authorization authority.
    assert.equal(response.statusCode,200);
    const self=await get(app,"/api/v2/me",sid(response),{"x-role":"superuser","x-actor-id":accepted.json().user.id});
    assert.equal(self.statusCode,200);
    assert.notEqual(self.json().id,accepted.json().user.id);
    assert.equal(self.json().capabilities.publish,false);
   }else assert.equal(response.statusCode,401,"negative initData "+index);
  }
  assert.equal((await get(app,"/api/v2/me",sid(accepted),{"x-role":"admin"})).json().id,
    accepted.json().user.id);
 }finally{await app.close();}
});
test("REM05B connection reuse A→B→anonymous, failed transactions and refreshed logout races",async()=>{
 const app=makeApp({...opts,namespace:"ci_pool_rollback"});
 try{
  const a=await auth(app,sign(88001001)),b=await auth(app,sign(88001002));
  assert.equal(a.statusCode,200);assert.equal(b.statusCode,200);
  const idA=a.json().user.id,idB=b.json().user.id;
  for(let i=0;i<6;i++){
   const self=i%2?idB:idA,other=i%2?idA:idB;
   const db=await scoped.connect();
   try{
    await db.query("BEGIN");
    await db.query("SELECT set_config('luemi.actor_id',$1,true)",[self]);
    assert.equal((await db.query("SELECT id FROM luemi_private.actors WHERE id=$1",[self])).rowCount,1);
    assert.equal((await db.query("SELECT id FROM luemi_private.actors WHERE id=$1",[other])).rowCount,0);
    if(i%2===0)await assert.rejects(db.query("SELECT 1/0"));
    await db.query("ROLLBACK");
   }finally{db.release();}
   assert.equal((await scoped.query("SELECT id FROM luemi_private.actors")).rowCount,0,
    "actor GUC must not leak after pooled error/rollback");
  }
  const aCookie=sid(a),aCsrf=a.json().csrfToken;
  const [logout,refresh]=await Promise.all([
   mutation(app,"/api/v2/auth/logout",aCookie,aCsrf),
   mutation(app,"/api/v2/auth/refresh",aCookie,aCsrf)
  ]);
  assert.ok([200,401].includes(logout.statusCode));
  assert.ok([200,401].includes(refresh.statusCode));
  assert.notEqual(logout.statusCode,refresh.statusCode,
   "one competing operation wins while the other becomes stale");
  assert.equal((await get(app,"/api/v2/me",aCookie)).statusCode,401,
   "old cookie always invalid after competing logout/refresh");
  if(refresh.statusCode===200){
   const rotated=sid(refresh);
   // A stale logout may lose the race, in which case the rotated cookie
   // remains legitimately active. No stronger guarantee is asserted.
   assert.equal((await get(app,"/api/v2/me",rotated)).statusCode,200);
   assert.equal((await mutation(app,"/api/v2/auth/logout",rotated,refresh.json().csrfToken)).statusCode,200);
   assert.equal((await get(app,"/api/v2/me",rotated)).statusCode,401);
  }
  assert.equal((await get(app,"/api/v2/me",sid(b))).json().id,idB,
   "B never inherits A revocation or pooled context");
 }finally{await app.close();}
});

test.after(async()=>{await Promise.all([issuer.end(),scoped.end(),admin.end()]);});
