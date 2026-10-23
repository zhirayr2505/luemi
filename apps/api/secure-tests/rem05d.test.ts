import assert from "node:assert/strict";
import {test} from "node:test";
import {createHmac} from "node:crypto";
import {Pool} from "pg";
import {buildApp} from "../src/app.js";
import {addSyntheticMetadata,makeSyntheticPng,makeSynthetic50MpHeader,sanitizePng} from "../src/rem05d-image.js";
import {memoryPrivateStore,syntheticModerate} from "../src/rem05d-private.js";
import type {PrivateObjectStore} from "../src/rem05d-private.js";
const adminUrl=process.env.REM05D_ADMIN_DATABASE_URL;
const issuerUrl=process.env.REM05D_ISSUER_DATABASE_URL;
const requestUrl=process.env.REM05D_REQUEST_DATABASE_URL;
const workerUrl=process.env.REM05D_WORKER_DATABASE_URL;
const moderatorUrl=process.env.REM05D_MODERATOR_DATABASE_URL;
const combinedUrl=process.env.REM05D_COMBINED_DATABASE_URL;
const extraColumnUrl=process.env.REM05D_EXTRA_COLUMN_DATABASE_URL;
if(!adminUrl||!issuerUrl||!requestUrl||!workerUrl||!moderatorUrl||!combinedUrl||!extraColumnUrl)
 throw new Error("REM-05D needs real disposable PostgreSQL role connections");
const origin="https://ci.luemi.invalid",token="123456:synthetic_rem05d_bot",namespace="ci_rem05d";
function sign(id:number){
 const data={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:"Synthetic"})};
 const message=Object.entries(data).sort(([a],[b])=>a.localeCompare(b,"en")).map(([k,v])=>k+"="+v).join("\n");
 const key=createHmac("sha256","WebAppData").update(token).digest();
 return new URLSearchParams({...data,hash:createHmac("sha256",key).update(message).digest("hex")}).toString();
}
const b={enabled:true,issuerDatabaseUrl:issuerUrl!,requestDatabaseUrl:requestUrl!,
 pepper:"synthetic-rem05d-pepper-1234567890-1234567890",namespace,origin,botToken:token,
 idleMs:43200000,absoluteMs:604800000,maxSessions:5};
function app(opts:{request?:string;worker?:string;enabled?:boolean;storage?:PrivateObjectStore}={}){
 return buildApp({port:3001,origin,botToken:token,healthKey:"synthetic_health_key_123456789012345",
 logger:false,rem05b:{...b,requestDatabaseUrl:opts.request??requestUrl!},
 rem05d:opts.enabled===false?undefined:{enabled:true,testOnly:true,
   requestDatabaseUrl:opts.request??requestUrl!,workerDatabaseUrl:opts.worker??workerUrl!,
   namespace,consentVersion:"ci-consent-v1",storage:opts.storage??memoryPrivateStore()}});
}
const admin=new Pool({connectionString:adminUrl});
const request=new Pool({connectionString:requestUrl});
const worker=new Pool({connectionString:workerUrl});
const mod=new Pool({connectionString:moderatorUrl});
function headers(cookie?:string,csrf?:string){return {
 origin,"sec-fetch-site":"same-origin",...(cookie?{cookie}:{}),...(csrf?{"x-luemi-csrf":csrf}:{})};}
async function identity(server:ReturnType<typeof app>,id:number){
 const r=await server.inject({method:"POST",url:"/api/v2/auth/telegram",
 headers:headers(),payload:{initData:sign(id)}});
 assert.equal(r.statusCode,200,r.body);
 return{id:r.json().user.id as string,cookie:String(r.headers["set-cookie"]).split(";")[0],
  csrf:r.json().csrfToken as string};
}
function get(server:ReturnType<typeof app>,path:string,user?:{cookie:string}){
 return server.inject({method:"GET",url:path,headers:user?{cookie:user.cookie}:{}});
}
function put(server:ReturnType<typeof app>,path:string,user:{cookie:string;csrf:string},payload:unknown){
 return server.inject({method:"PUT",url:path,headers:headers(user.cookie,user.csrf),payload});
}
function post(server:ReturnType<typeof app>,path:string,user:{cookie:string;csrf:string},payload:unknown){
 return server.inject({method:"POST",url:path,headers:headers(user.cookie,user.csrf),payload});
}
test("D/MOD: public flags default-deny, protected API, CAS, A/B and SQL role evidence",async()=>{
 const server=app();
 try{
  assert.equal((await get(server,"/api/v2/profile/draft")).statusCode,401);
  assert.equal((await get(server,"/api/v2/profile/public/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).statusCode,401);
  const a=await identity(server,90101),other=await identity(server,90202);
  assert.notEqual(a.id,other.id);
  const missing=await get(server,"/api/v2/profile/draft",a);
  assert.deepEqual(missing.json(),{state:"empty",revision:0,fields:{}});
  assert.equal((await put(server,"/api/v2/profile/draft",a,{revision:0,fields:{displayName:"Private"}})).statusCode,200);
  assert.equal((await get(server,"/api/v2/profile/draft",other)).json().state,"empty");
  const old=await Promise.all(Array.from({length:2},()=>put(server,"/api/v2/profile/draft",a,
   {revision:1,fields:{displayName:"Private",about:"Only A"}})));
  assert.deepEqual(old.map(r=>r.statusCode).sort(),[200,409]);
  assert.equal((await get(server,"/api/v2/profile/draft",a)).json().revision,2);
  const spoofed=await server.inject({method:"GET",url:"/api/v2/profile/draft",
    headers:{cookie:a.cookie,"x-actor-id":other.id,"x-role":"moderator"}});
  assert.equal(spoofed.json().fields.displayName,"Private","headers cannot replace session authority");
  assert.equal((await put(server,"/api/v2/profile/draft",
    {cookie:a.cookie,csrf:"bad"}, {revision:2,fields:{displayName:"Compromised"}})).statusCode,403);
  assert.equal((await server.inject({method:"PUT",url:"/api/v2/profile/draft",
    headers:{...headers(a.cookie,a.csrf),origin:"https://attacker.invalid"},
    payload:{revision:2,fields:{displayName:"Compromised"}}})).statusCode,403);
  for(const malicious of [
   {ownerId:other.id},{publication_status:"published"},{isPremium:true},
   {birthDate:"2020-01-01"},{birthDate:"2023-02-31"},
   {consentVersion:"invalid"},{about:"x".repeat(900)}
  ])assert.equal((await put(server,"/api/v2/profile/draft",a,
    {revision:2,fields:malicious})).statusCode,422);
  const now=new Date(),minor=new Date(Date.UTC(now.getUTCFullYear()-17,now.getUTCMonth(),now.getUTCDate()));
  assert.equal((await put(server,"/api/v2/profile/draft",a,
   {revision:2,fields:{birthDate:minor.toISOString().slice(0,10)}})).statusCode,422);
  assert.equal((await post(server,"/api/v2/profile/submit",a,{})).statusCode,403);
  assert.equal((await get(server,"/api/v2/profile/public/"+a.id,other)).statusCode,404);
  assert.equal((await post(server,"/api/v2/profile/blocks",a,{targetId:other.id})).statusCode,200);
  assert.deepEqual((await get(server,"/api/v2/profile/blocks",a)).json().blocks,[other.id]);
  assert.deepEqual((await get(server,"/api/v2/profile/blocks",other)).json().blocks,[]);
  assert.equal((await post(server,"/api/v2/profile/blocks",a,{targetId:a.id})).statusCode,422);
  const rep=await post(server,"/api/v2/profile/reports",a,
   {targetId:other.id,reason:"spam",clientRef:"syntheticreport001"});
  assert.equal(rep.statusCode,200,rep.body);
  const duplicate=await post(server,"/api/v2/profile/reports",a,
   {targetId:other.id,reason:"spam",clientRef:"syntheticreport001"});
  assert.equal(duplicate.json().id,rep.json().id);
  assert.equal((await post(server,"/api/v2/profile/reports",a,
   {targetId:other.id,reason:"harassment",clientRef:"syntheticreport001"})).statusCode,409);
  assert.equal((await get(server,"/api/v2/profile/reports",other)).json().reports.length,0);
  const role=await request.query(`SELECT current_user, row_security_active('luemi_private.private_profile_drafts'::regclass) AS rls,
    has_table_privilege(current_user,'luemi_private.sessions','SELECT') AS sessions,
    has_table_privilege(current_user,'luemi_private.audit_events','SELECT') AS audit`);
  assert.equal(role.rows[0].rls,true);assert.equal(role.rows[0].sessions,false);
  assert.equal(role.rows[0].audit,false);
  assert.equal((await request.query("SELECT owner_id FROM luemi_private.private_profile_drafts")).rowCount,0);
  for(const [actor,expected] of [[a.id,1],[other.id,0]] as const){
   const c=await request.connect();
   try{
    await c.query("BEGIN");
    await c.query("SELECT set_config('luemi.actor_id',$1,true)",[actor]);
    await c.query("SELECT set_config('luemi.environment',$1,true)",[namespace]);
    const r=await c.query("SELECT owner_id FROM luemi_private.private_profile_drafts");
    assert.equal(r.rowCount,expected);
    if(actor===a.id){
     await assert.rejects(c.query("UPDATE luemi_private.private_profile_drafts SET owner_id=$1 WHERE owner_id=$2",
      [other.id,a.id]));
    }
    await c.query("ROLLBACK");
   }finally{c.release();}
  }
  assert.equal((await request.query("SELECT owner_id FROM luemi_private.private_profile_drafts")).rowCount,0);
  await assert.rejects(worker.query("SELECT * FROM luemi_private.private_profile_drafts"));
  await assert.rejects(mod.query("SELECT * FROM luemi_private.sessions"));
  await assert.rejects(request.query("SELECT * FROM luemi_private.moderation_decisions"));
  await assert.rejects(request.query("SELECT * FROM luemi_private.audit_events"));
  const adminConn=await admin.connect();
  try{
   await adminConn.query("BEGIN");
   await adminConn.query("SET LOCAL ROLE anon");
   await assert.rejects(adminConn.query("SELECT owner_id FROM luemi_private.private_profile_drafts"));
   await adminConn.query("ROLLBACK");
  }finally{adminConn.release();}
  // Disjoint role hierarchy cannot be used for private resource queries.
  const bad=app({request:combinedUrl!});
  try{
   assert.equal((await get(bad,"/api/v2/profile/draft",a)).statusCode,503);
  }finally{await bad.close();}
  const sneaky=app({request:extraColumnUrl!});
  try{
   assert.equal((await get(sneaky,"/api/v2/profile/draft",a)).statusCode,503,
    "a request login with SELECT(decision) grant must fail closed before data access");
  }finally{await sneaky.close();}
  console.log("REM05D_ROLE_A_B_ANON_CAS_PUBLISH_DENY_PASS");
 }finally{await server.close();}
});
test("M: actual RLS media, intent concurrency, sanitized PNG, moderator-only approval and revocation",async()=>{
 const server=app();
 try{
  const a=await identity(server,90303),bUser=await identity(server,90404);
  const clean=makeSyntheticPng(),withGps=addSyntheticMetadata(clean);
  const normalized=sanitizePng(withGps);
  assert.ok(!normalized.bytes.includes(Buffer.from("GPSLatitude")));
  assert.equal(normalized.width,1);assert.equal(normalized.height,1);
  for(const malformed of [
    Buffer.from("not a PNG"),makeSynthetic50MpHeader(),withGps.subarray(0,20),
    Buffer.concat([withGps,Buffer.from("tail")])
  ])assert.throws(()=>sanitizePng(malformed));
  const flood=await Promise.all(Array.from({length:50},(_,i)=>post(server,
   "/api/v2/media/intents",a,{bytes:withGps.length,mime:"image/png",clientKey:"synthetic-key-"+i})));
  const good=flood.filter(r=>r.statusCode===200);
  assert.equal(good.length,6,JSON.stringify(flood.map(x=>x.statusCode)));
  assert.equal(flood.filter(r=>r.statusCode===409).length,44);
  const chosen=good[0].json().assetId as string;
  assert.ok(!good[0].body.includes("private/"));
  const replay=await post(server,"/api/v2/media/intents",a,
   {bytes:withGps.length,mime:"image/png",clientKey:"synthetic-key-"+flood.findIndex(x=>x.json().assetId===chosen)});
  assert.equal(replay.json().assetId,chosen);
  assert.equal((await post(server,"/api/v2/media/intents",a,
   {bytes:2,mime:"image/png",clientKey:"synthetic-key-"+flood.findIndex(x=>x.json().assetId===chosen)})).statusCode,409);
  assert.equal((await get(server,"/api/v2/media/"+chosen,a)).statusCode,404);
  assert.equal((await get(server,"/api/v2/media/"+chosen,bUser)).statusCode,404);
  const illegal=await server.inject({method:"PUT",url:"/api/v2/media/"+chosen+"/bytes",
    headers:{...headers(bUser.cookie,bUser.csrf),"content-type":"image/png"},payload:withGps});
  assert.equal(illegal.statusCode,404);
  const up=await server.inject({method:"PUT",url:"/api/v2/media/"+chosen+"/bytes",
    headers:{...headers(a.cookie,a.csrf),"content-type":"image/png"},payload:withGps});
  assert.equal(up.statusCode,200,up.body);
  assert.equal(up.json().status,"pending_review");
  assert.equal((await get(server,"/api/v2/media/"+chosen,a)).statusCode,404);
  await assert.rejects(syntheticModerate(requestUrl!,chosen,"approved"),/moderation_role_denied/);
  await syntheticModerate(moderatorUrl!,chosen,"approved");
  const after=await get(server,"/api/v2/media/"+chosen,a);
  assert.equal(after.statusCode,200,after.body);
  assert.deepEqual(after.rawPayload,normalized.bytes);
  assert.match(String(after.headers["cache-control"]),/no-store/);
  assert.equal((await get(server,"/api/v2/media/"+chosen,bUser)).statusCode,404);
  assert.equal((await get(server,"/api/v2/profile/public/"+a.id,bUser)).statusCode,404);
  const info=await admin.query(
   "SELECT state,publication_status,original_key,derivative_key FROM luemi_private.media_assets WHERE id=$1",[chosen]);
  assert.equal(info.rows[0].state,"approved");
  assert.equal(info.rows[0].publication_status,"private");
  assert.ok(!after.body.includes(info.rows[0].derivative_key));
  await admin.query("UPDATE luemi_private.media_assets SET state='revoked' WHERE id=$1",[chosen]);
  assert.equal((await get(server,"/api/v2/media/"+chosen,a)).statusCode,404);
  const tokenHash=await admin.query("SELECT token_hash FROM luemi_private.sessions WHERE actor_id=$1",[a.id]);
  assert.ok(tokenHash.rowCount);
  await admin.query("UPDATE luemi_private.sessions SET revoked_at=clock_timestamp() WHERE actor_id=$1",[a.id]);
  assert.equal((await get(server,"/api/v2/profile/draft",a)).statusCode,401);
  assert.equal((await get(server,"/api/v2/media/"+chosen,a)).statusCode,401);
  console.log("REM05D_MEDIA_PRIVATE_DERIVATIVE_MODERATION_REVOKE_PASS");
 }finally{await server.close();}
});
test("D09: session revoked while draft UPDATE waits on a real PostgreSQL row lock must ROLLBACK",async()=>{
 const server=app();
 const hold=await admin.connect();
 let pending:Promise<Awaited<ReturnType<typeof put>>>|undefined;
 let holding=false;
 try{
  const a=await identity(server,90505);
  assert.equal((await put(server,"/api/v2/profile/draft",a,
   {revision:0,fields:{displayName:"Before"}})).statusCode,200);
  await hold.query("BEGIN");
  holding=true;
  await hold.query("SELECT owner_id FROM luemi_private.private_profile_drafts WHERE owner_id=$1 FOR UPDATE",[a.id]);
  pending=put(server,"/api/v2/profile/draft",a,
   {revision:1,fields:{displayName:"After revocation"}});
  // Confirm the UPDATE is actually blocked on the row lock; don't merely race
  // timers and accidentally pass due to early pre-handler 401.
  let blocked=false;
  for(let i=0;i<120;i++){
   const q=await admin.query<{blocked:boolean}>(`
    SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock'
      AND query LIKE 'UPDATE luemi_private.private_profile_drafts SET revision=%') AS blocked`);
   if(q.rows[0].blocked){blocked=true;break;}
   await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.ok(blocked,"draft UPDATE must reach a database row-lock wait before revocation");
  await admin.query("UPDATE luemi_private.sessions SET revoked_at=clock_timestamp() "+
   "WHERE actor_id=$1 AND revoked_at IS NULL",[a.id]);
  await hold.query("COMMIT");
  holding=false;
  const response=await pending;
  assert.equal(response.statusCode,401,response.body);
  const row=await admin.query<{revision:string;payload:{displayName:string}}>(
   "SELECT revision::text,payload FROM luemi_private.private_profile_drafts WHERE owner_id=$1",[a.id]);
  assert.equal(row.rows[0].revision,"1","transaction after logout must never commit revision 2");
  assert.equal(row.rows[0].payload.displayName,"Before");
  console.log("REM05D_REVOKED_DURING_ROWLOCK_ROLLBACK_PASS");
 }finally{
  if(holding)await hold.query("ROLLBACK").catch(()=>{});
  if(pending)await pending.catch(()=>{});
  hold.release();await server.close();
 }
});
test("M11: revoke approved media while private storage GET is in flight; never deliver stale pixels",async()=>{
 const store=memoryPrivateStore();
 let entered!:()=>void,release!:()=>void;
 const fetching=new Promise<void>(resolve=>{entered=resolve;});
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const slowStore:PrivateObjectStore={
  put:(key,bytes)=>store.put(key,bytes),
  get:async(key)=>{entered();await gate;return store.get(key);},
  delete:(key)=>store.delete(key)
 };
 const server=app({storage:slowStore});
 try{
  const a=await identity(server,90606);
  const png=makeSyntheticPng();
  const intent=await post(server,"/api/v2/media/intents",a,
   {bytes:png.length,mime:"image/png",clientKey:"slow-read-fixture-001"});
  assert.equal(intent.statusCode,200,intent.body);
  const id=intent.json().assetId as string;
  const upload=await server.inject({method:"PUT",url:"/api/v2/media/"+id+"/bytes",
   headers:{...headers(a.cookie,a.csrf),"content-type":"image/png"},payload:png});
  assert.equal(upload.statusCode,200,upload.body);
  await syntheticModerate(moderatorUrl!,id,"approved");
  const pending=get(server,"/api/v2/media/"+id,a);
  // Signals after the first role/RLS read has finished and storage.get starts.
  await Promise.race([fetching,new Promise<never>((_resolve,reject)=>
   setTimeout(()=>reject(new Error("storage GET did not start")),4000))]);
  await admin.query("UPDATE luemi_private.media_assets SET state='revoked' WHERE id=$1",[id]);
  release();
  const response=await pending;
  assert.equal(response.statusCode,404,"revoked media cannot be delivered from an in-flight object fetch");
  assert.ok(!response.rawPayload.equals(png),"private pixels must not leak");
  console.log("REM05D_MEDIA_REVOKED_DURING_STORAGE_READ_PASS");
 }finally{release();await server.close();}
});
test("D-R4 RED: revoke original session while synthetic PrivateObjectStore PUT is stalled; SQL must not promote media",async()=>{
 const backing=memoryPrivateStore();
 let entered!:()=>void,release!:()=>void;
 const putStarted=new Promise<void>(resolve=>{entered=resolve;});
 const unblockPut=new Promise<void>(resolve=>{release=resolve;});
 let stagedKey:string|undefined;
 const slowStore:PrivateObjectStore={
  put:async(key,bytes)=>{stagedKey=key;entered();await unblockPut;await backing.put(key,bytes);},
  get:(key)=>backing.get(key),
  delete:(key)=>backing.delete(key)
 };
 const server=app({storage:slowStore});
 let inFlight:ReturnType<typeof server.inject>|undefined;
 try{
  const a=await identity(server,90707),png=makeSyntheticPng();
  const intent=await post(server,"/api/v2/media/intents",a,
   {bytes:png.length,mime:"image/png",clientKey:"revocation-upload-red-001"});
  assert.equal(intent.statusCode,200,intent.body);
  const id=intent.json().assetId as string;
  const upload=server.inject({method:"PUT",url:"/api/v2/media/"+id+"/bytes",
   headers:{...headers(a.cookie,a.csrf),"content-type":"image/png"},payload:png});
  inFlight=upload;
  await Promise.race([putStarted,new Promise<never>((_resolve,reject)=>
   setTimeout(()=>reject(new Error("storage PUT did not start")),5000))]);
  const before=await admin.query(
   "SELECT a.state AS asset_state,u.state AS upload_state, "+
   "(SELECT count(*)::int FROM luemi_private.moderation_jobs j WHERE j.asset_id=a.id) AS jobs "+
   "FROM luemi_private.media_assets a JOIN luemi_private.media_uploads u ON u.asset_id=a.id WHERE a.id=$1",[id]);
  assert.equal(before.rows[0].asset_state,"reserved");
  assert.equal(before.rows[0].upload_state,"reserved");
  assert.equal(before.rows[0].jobs,0);
  const revoked=await admin.query(
   "UPDATE luemi_private.sessions SET revoked_at=clock_timestamp() "+
   "WHERE actor_id=$1 AND environment=$2 AND revoked_at IS NULL RETURNING id,token_hash,generation",
   [a.id,namespace]);
  assert.equal(revoked.rowCount,1,"revoke exactly the active upload session generation");
  release();
  const response=await upload;
  assert.equal(response.statusCode,401,response.body);
  const after=await admin.query(
   "SELECT a.state AS asset_state,u.state AS upload_state, "+
   "(SELECT count(*)::int FROM luemi_private.moderation_jobs j "+
   "WHERE j.asset_id=a.id AND j.state='pending_review') AS actionable_jobs "+
   "FROM luemi_private.media_assets a JOIN luemi_private.media_uploads u ON u.asset_id=a.id WHERE a.id=$1",[id]);
  assert.equal(after.rows[0].asset_state,"reserved","revoked upload must never promote to pending_review");
  assert.equal(after.rows[0].upload_state,"reserved","revoked upload must never become received");
  assert.equal(after.rows[0].actionable_jobs,0,"revoked upload must not enqueue moderation");
  assert.equal((await get(server,"/api/v2/media/"+id,a)).statusCode,401);
  if(stagedKey){
   let cleaned=false;
   for(let i=0;i<60;i++){
    if(await backing.get(stagedKey)===null){cleaned=true;break;}
    await new Promise(resolve=>setTimeout(resolve,10));
   }
   assert.ok(cleaned,"revoked session should trigger compensating object deletion");
  }
  console.log("REM05D_UPLOAD_REVOCATION_SQL_AND_OBJECT_ROLLBACK_PASS");
 }finally{
  release();
  if(inFlight)await inFlight.catch(()=>{});
  await server.close();
 }
});
test("D-R4: suspending/banning actor or rotating same session during storage PUT rolls back worker SQL",async()=>{
 for(const mode of ["suspended","banned","refresh"] as const){
  const backing=memoryPrivateStore();
  let entered!:()=>void,release!:()=>void;
  const waiting=new Promise<void>(resolve=>{entered=resolve;});
  const gate=new Promise<void>(resolve=>{release=resolve;});
  let key:string|undefined;
  const gated:PrivateObjectStore={
   put:async(k,v)=>{key=k;entered();await gate;await backing.put(k,v);},
   get:(k)=>backing.get(k),delete:(k)=>backing.delete(k)
  };
  const server=app({storage:gated});
  let upload:ReturnType<typeof server.inject>|undefined;
  try{
   const user=await identity(server,mode==="suspended"?90808:mode==="banned"?90909:91010);
   const png=makeSyntheticPng();
   const intent=await post(server,"/api/v2/media/intents",user,
    {bytes:png.length,mime:"image/png",clientKey:"d-r4-actor-"+mode+"-001"});
   assert.equal(intent.statusCode,200,intent.body);
   const id=intent.json().assetId as string;
   upload=server.inject({method:"PUT",url:"/api/v2/media/"+id+"/bytes",
    headers:{...headers(user.cookie,user.csrf),"content-type":"image/png"},payload:png});
   await Promise.race([waiting,new Promise<never>((_res,reject)=>
    setTimeout(()=>reject(new Error("PUT gate not reached: "+mode)),5000))]);
   if(mode==="refresh"){
    const refresh=await post(server,"/api/v2/auth/refresh",user,{});
    assert.equal(refresh.statusCode,200,refresh.body);
    assert.ok(String(refresh.headers["set-cookie"]).includes("luemi_"),
     "token rotation must return a new session cookie");
   }else{
    const banned=await admin.query("UPDATE luemi_private.actors SET status=$2 WHERE id=$1 RETURNING status",
     [user.id,mode]);
    assert.equal(banned.rowCount,1);
   }
   release();
   const response=await upload;
   assert.equal(response.statusCode,401,mode+": "+response.body);
   const row=await admin.query(
    "SELECT a.state asset,u.state upload,(SELECT count(*)::int FROM luemi_private.moderation_jobs j "+
    "WHERE j.asset_id=a.id) jobs FROM luemi_private.media_assets a "+
    "JOIN luemi_private.media_uploads u ON u.asset_id=a.id WHERE a.id=$1",[id]);
   assert.equal(row.rows[0].asset,"reserved",mode);
   assert.equal(row.rows[0].upload,"reserved",mode);
   assert.equal(row.rows[0].jobs,0,mode);
   if(key){
    let deleted=false;
    for(let i=0;i<60;i++){
     if(await backing.get(key)===null){deleted=true;break;}
     await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.ok(deleted,mode+": staged private object must be deleted");
   }
  }finally{
   release();if(upload)await upload.catch(()=>{});await server.close();
  }
 }
 console.log("REM05D_UPLOAD_BANNED_SUSPENDED_ROTATED_SQL_ROLLBACK_PASS");
});
test("D-R4: storage PUT writes bytes then fails before PostgreSQL COMMIT; compensate or fail closed",async()=>{
 for(const cleanupFails of [false,true]){
  const backing=memoryPrivateStore();
  let savedKey:string|undefined;
  const interrupted:PrivateObjectStore={
   put:async(k,v)=>{savedKey=k;await backing.put(k,v);throw new Error("synthetic_store_interrupted_after_bytes");},
   get:(k)=>backing.get(k),
   delete:async(k)=>{if(cleanupFails)throw new Error("synthetic_delete_unavailable");await backing.delete(k);}
  };
  const server=app({storage:interrupted});
  try{
   const user=await identity(server,cleanupFails?91212:91111),png=makeSyntheticPng();
   const intent=await post(server,"/api/v2/media/intents",user,
    {bytes:png.length,mime:"image/png",clientKey:"storage-after-write-"+cleanupFails+"-001"});
   assert.equal(intent.statusCode,200,intent.body);
   const id=intent.json().assetId as string;
   const resp=await server.inject({method:"PUT",url:"/api/v2/media/"+id+"/bytes",
    headers:{...headers(user.cookie,user.csrf),"content-type":"image/png"},payload:png});
   assert.equal(resp.statusCode,503,resp.body);
   const status=await admin.query("SELECT a.state asset,u.state upload, "+
    "(SELECT count(*)::int FROM luemi_private.moderation_jobs j WHERE j.asset_id=a.id) jobs "+
    "FROM luemi_private.media_assets a JOIN luemi_private.media_uploads u ON u.asset_id=a.id "+
    "WHERE a.id=$1",[id]);
   assert.deepEqual(status.rows[0],{asset:"reserved",upload:"reserved",jobs:0});
   assert.ok(savedKey);
   assert.equal((await backing.get(savedKey!))===null,!cleanupFails);
   assert.equal((await get(server,"/api/v2/media/"+id,user)).statusCode,404,
    "orphan in the private object store must not be readable through authenticated gateway");
  }finally{await server.close();}
 }
 console.log("REM05D_UPLOAD_STAGED_STORAGE_FAILURE_FAIL_CLOSED_PASS");
});
test("Off by default on ordinary app configuration and signed UI is not activated",async()=>{
 const off=app({enabled:false});
 try{
  assert.equal((await off.inject({url:"/api/v2/profile/draft"})).statusCode,404);
  assert.equal((await off.inject({url:"/api/v2/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"})).statusCode,404);
 }finally{await off.close();}
});
test.after(async()=>{await Promise.all([admin.end(),request.end(),worker.end(),mod.end()]);});
