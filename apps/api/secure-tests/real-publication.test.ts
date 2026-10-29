import assert from "node:assert/strict";
import {test} from "node:test";
import {createHmac} from "node:crypto";
import {Pool} from "pg";
import {buildApp} from "../src/app.js";
import {memoryPrivateStore,syntheticModerate} from "../src/rem05d-private.js";
import {makeSyntheticPng,sanitizePng} from "../src/rem05d-image.js";
import type {PrivateObjectStore} from "../src/rem05d-private.js";
import {runErasureBatch} from "../src/real-erasure-worker.js";

const adminUrl=process.env.REG01_ADMIN_DATABASE_URL,issuerUrl=process.env.REG01_ISSUER_DATABASE_URL;
const requestUrl=process.env.REG01_REQUEST_DATABASE_URL,workerUrl=process.env.REG01_WORKER_DATABASE_URL;
const moderatorUrl=process.env.REG01_MODERATOR_DATABASE_URL;
const publisherUrl=process.env.REG01_PUBLISHER_DATABASE_URL,readerUrl=process.env.REG01_READER_DATABASE_URL;
const erasureRequestUrl=process.env.REG01_ERASURE_REQUEST_DATABASE_URL;
const erasureWorkerUrl=process.env.REG01_ERASURE_WORKER_DATABASE_URL;
if(!adminUrl||!issuerUrl||!requestUrl||!workerUrl||!moderatorUrl||!publisherUrl||!readerUrl||!erasureRequestUrl||!erasureWorkerUrl)
 throw new Error("REG01D requires disposable database roles");
const admin=new Pool({connectionString:adminUrl}),reader=new Pool({connectionString:readerUrl});
const namespace="ci_reg01",origin="https://ci.luemi.invalid",token="123456:synthetic_reg01_bot";
const consentVersion="beta-consent-v1";
const deletionBody={confirmation:"DELETE MY LUEMI ACCOUNT",reason:"prefer_not_to_say",details:""};
function sign(id:number){
 const d={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:"Synthetic"})};
 const message=Object.entries(d).sort(([a],[b])=>a.localeCompare(b,"en"))
  .map(([k,v])=>k+"="+v).join("\n");
 const key=createHmac("sha256","WebAppData").update(token).digest();
 return new URLSearchParams({...d,hash:createHmac("sha256",key).update(message).digest("hex")}).toString();
}
const session={enabled:true,issuerDatabaseUrl:issuerUrl!,requestDatabaseUrl:requestUrl!,
 pepper:"synthetic-reg01-pepper-1234567890-1234567890",namespace,origin,botToken:token,
 idleMs:43200000,absoluteMs:604800000,maxSessions:5};
const makeApp=(opts:{storage?:PrivateObjectStore;publisher?:string;reader?:string;erasure?:boolean;erasureUrl?:string}={})=>{
 const storage=opts.storage??memoryPrivateStore();
 return buildApp({port:3001,origin,botToken:token,
  healthKey:"synthetic_health_key_123456789012345",logger:false,rem05b:session,
  realRegistration:{enabled:true,requestDatabaseUrl:requestUrl!,namespace,consentVersion},
  rem05d:{enabled:true,durablePrivateOnly:true,requestDatabaseUrl:requestUrl!,
   workerDatabaseUrl:workerUrl!,namespace,consentVersion,storage},
  realPublication:{enabled:true,requestDatabaseUrl:requestUrl!,publisherDatabaseUrl:opts.publisher??publisherUrl!,
   discoveryDatabaseUrl:opts.reader??readerUrl!,namespace,consentVersion,storage},
  realErasure:opts.erasure?{enabled:true,databaseUrl:opts.erasureUrl??erasureRequestUrl!,namespace}:undefined
 });
};
type User={id:string;cookie:string;csrf:string};
async function identity(app:ReturnType<typeof makeApp>,telegram:number):Promise<User>{
 const reply=await app.inject({method:"POST",url:"/api/v2/auth/telegram",
  headers:{origin,"sec-fetch-site":"same-origin"},payload:{initData:sign(telegram)}});
 assert.equal(reply.statusCode,200,reply.body);
 return{id:reply.json().user.id,
  cookie:String(reply.headers["set-cookie"]).split(";")[0],
  csrf:reply.json().csrfToken as string};
}
const headers=(user:User)=>({origin,"sec-fetch-site":"same-origin",
 cookie:user.cookie,"x-luemi-csrf":user.csrf});
const feed=(app:ReturnType<typeof makeApp>,user:User)=>
 app.inject({method:"GET",url:"/api/v3/discovery/feed",headers:{cookie:user.cookie}});
const photo=(app:ReturnType<typeof makeApp>,user:User,id:string)=>
 app.inject({method:"GET",url:"/api/v3/discovery/photo/"+id,headers:{cookie:user.cookie}});
const mutate=(app:ReturnType<typeof makeApp>,user:User,url:string,payload?:unknown)=>
 app.inject({method:"POST",url,headers:headers(user),...(payload===undefined?{}:{payload})});
async function consent(app:ReturnType<typeof makeApp>,user:User){
 const res=await app.inject({method:"PUT",url:"/api/v3/registration/draft",
  headers:headers(user),payload:{revision:0,fields:{
   displayName:"Adult",birthDate:"1995-01-01",consentVersion
  }}});
 assert.equal(res.statusCode,200,res.body);
}
async function prepare(app:ReturnType<typeof makeApp>,user:User){
 const d=await app.inject({method:"PUT",url:"/api/v3/registration/draft",
  headers:headers(user),payload:{revision:0,fields:{
   displayName:"Ани",birthDate:"1997-05-12",gender:"woman",city:"Ереван",
   countryCode:"AM",placeId:"offline:am:yerevan",goal:"friendship",
   interests:["music"],languages:["hy"],about:"Тестовый взрослый пользователь",consentVersion
  }}});
 assert.equal(d.statusCode,200,d.body);
 const png=makeSyntheticPng(),ids:string[]=[];
 for(let i=0;i<3;i++){
  const intent=await mutate(app,user,"/api/v2/media/intents",
   {bytes:png.length,mime:"image/png",clientKey:"reg01d-photo-"+i+"-"+user.id});
  assert.equal(intent.statusCode,200,intent.body);
  const id=intent.json().assetId as string;
  const upload=await app.inject({method:"PUT",url:"/api/v2/media/"+id+"/bytes",
   headers:{...headers(user),"content-type":"image/png"},payload:png});
  assert.equal(upload.statusCode,200,upload.body);
  ids.push(id);
 }
 return ids;
}
test("01D: default-deny unauthenticated and unapproved, publish only moderated 3/3, block and hide",async()=>{
 const app=makeApp();
 try{
  assert.equal((await app.inject({method:"GET",url:"/api/v3/discovery/feed"})).statusCode,401);
  assert.equal((await app.inject({method:"POST",url:"/api/v3/profile/publish",headers:{origin,"sec-fetch-site":"same-origin"}})).statusCode,401);
  const a=await identity(app,8011001),b=await identity(app,8011002),c=await identity(app,8011003);
  assert.equal((await feed(app,b)).statusCode,403,"unregistered viewer must not browse dating profiles");
  await consent(app,b);await consent(app,c);
  const ids=await prepare(app,a);
  const initial=await app.inject({method:"GET",url:"/api/v3/profile/status",headers:{cookie:a.cookie}});
  assert.equal(initial.statusCode,200,initial.body);
  assert.equal(initial.json().state,"draft");
  assert.equal(initial.json().pending,3);
  assert.equal(initial.json().approved,0);
  const denied=await mutate(app,a,"/api/v3/profile/publish",{revision:1});
  assert.equal(denied.statusCode,409,denied.body);
  assert.deepEqual((await feed(app,b)).json().profiles,[]);
  for(const id of ids)await syntheticModerate(moderatorUrl!,id,"approved");
  assert.equal((await mutate(app,a,"/api/v3/profile/publish",{revision:0})).statusCode,422);
  assert.equal((await mutate(app,a,"/api/v3/profile/publish",{revision:2})).statusCode,409);
  const pub=await mutate(app,a,"/api/v3/profile/publish",{revision:1});
  assert.equal(pub.statusCode,200,pub.body);
  assert.deepEqual(pub.json(),{state:"published",revision:1,photoCount:3});
  const ownerPublished=await app.inject({method:"GET",url:"/api/v3/profile/status",
   headers:{cookie:a.cookie}});
  assert.equal(ownerPublished.json().state,"published");
  assert.equal(ownerPublished.json().approved,3);
  const response=await feed(app,b);
  assert.equal(response.statusCode,200,response.body);
  assert.match(String(response.headers["cache-control"]),/no-store/);
  const profiles=response.json().profiles as Array<Record<string,unknown>>;
  assert.equal(profiles.length,1);
  assert.equal(profiles[0].id,a.id);
  assert.equal(profiles[0].name,"Ани");
  assert.equal(profiles[0].age,29);
  assert.equal(profiles[0].birthDate,undefined);
  assert.equal(profiles[0].consentVersion,undefined);
  assert.equal(profiles[0].storageKey,undefined);
  assert.equal((profiles[0].photos as Array<unknown>).length,3);
  assert.equal((await feed(app,a)).json().profiles.length,0);
  const img=await photo(app,b,ids[0]);
  assert.equal(img.statusCode,200,img.body);
  assert.equal(img.headers["content-type"],"image/png");
  assert.deepEqual(img.rawPayload,sanitizePng(makeSyntheticPng()).bytes);
  assert.equal((await photo(app,a,ids[0])).statusCode,404,"owner cannot bypass public visitor endpoint");
  // A block in EITHER direction hides both public profile and its pixels.
  const block=await mutate(app,b,"/api/v2/profile/blocks",{targetId:a.id});
  assert.equal(block.statusCode,200,block.body);
  assert.equal((await feed(app,b)).json().profiles.length,0);
  assert.equal((await photo(app,b,ids[0])).statusCode,404);
  assert.equal((await feed(app,c)).json().profiles.length,1);
  const unblock=await app.inject({method:"DELETE",url:"/api/v2/profile/blocks/"+a.id,headers:headers(b)});
  assert.equal(unblock.statusCode,200,unblock.body);
  assert.equal((await feed(app,b)).json().profiles.length,1);
  const hidden=await mutate(app,a,"/api/v3/profile/unpublish");
  assert.equal(hidden.statusCode,200,hidden.body);
  assert.equal((await feed(app,b)).json().profiles.length,0);
  assert.equal((await photo(app,b,ids[0])).statusCode,404);
  const ownerHidden=await app.inject({method:"GET",url:"/api/v3/profile/status",
   headers:{cookie:a.cookie}});
  assert.equal(ownerHidden.json().state,"hidden");
  assert.equal((await mutate(app,a,"/api/v3/profile/unpublish")).statusCode,200,"idempotent hide");
  // Re-publish (with previously approved photographs), then withdraw consent.
  const republish=await mutate(app,a,"/api/v3/profile/publish",{revision:1});
  assert.equal(republish.statusCode,200,republish.body);
  assert.equal((await feed(app,b)).json().profiles.length,1);
  const withdrawn=await mutate(app,a,"/api/v3/profile/withdraw-consent");
  assert.equal(withdrawn.statusCode,200,withdrawn.body);
  assert.deepEqual(withdrawn.json(),{state:"consent_withdrawn",dataDeleted:false});
  assert.equal((await feed(app,b)).json().profiles.length,0);
  assert.equal((await photo(app,b,ids[0])).statusCode,404);
  assert.equal((await feed(app,a)).statusCode,403,"withdrawn owner loses access to dating feed");
  assert.equal((await mutate(app,a,"/api/v3/profile/publish",{revision:1})).statusCode,403);
  const revokedConsent=await admin.query<{consent_version:string|null}>(
   "SELECT consent_version FROM luemi_private.private_profile_drafts WHERE owner_id=$1",
   [a.id]);
  assert.equal(revokedConsent.rows[0].consent_version,null);
  const again=await mutate(app,a,"/api/v3/profile/withdraw-consent");
  assert.equal(again.statusCode,200,"withdrawal remains idempotent");

  // DB-level reader has no raw private draft access.
  await assert.rejects(reader.query("SELECT * FROM luemi_private.private_profile_drafts"));
  await assert.rejects(reader.query("UPDATE luemi_private.public_profiles SET publication_status='published'"));
  const anon=await admin.connect();
  try{
   await anon.query("BEGIN");
   await anon.query("SET LOCAL ROLE anon");
   await assert.rejects(anon.query("SELECT * FROM luemi_private.public_profiles"));
   await anon.query("ROLLBACK");
  }finally{anon.release();}
 }finally{await app.close();}
});
test("01D: reusing the requester login for publishing is rejected at bootstrap",()=>{
 assert.throws(()=>makeApp({publisher:requestUrl!}),
  /separate publisher\/discovery roles/);
});
test("01D: disclosure reevaluated after storage read and revoked on moderator change",async()=>{
 const storage=memoryPrivateStore();
 let entered!:()=>void,release!:()=>void;
 const fetching=new Promise<void>(resolve=>{entered=resolve;});
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const slow:PrivateObjectStore={put:(k,b)=>storage.put(k,b),
  get:async key=>{entered();await gate;return storage.get(key);},
  delete:key=>storage.delete(key)};
 const app=makeApp({storage:slow});
 try{
  const x=await identity(app,8011005),viewer=await identity(app,8011006);
  await consent(app,viewer);
  const ids=await prepare(app,x);
  for(const id of ids)await syntheticModerate(moderatorUrl!,id,"approved");
  assert.equal((await mutate(app,x,"/api/v3/profile/publish",{revision:1})).statusCode,200);
  const pending=photo(app,viewer,ids[0]);
  await Promise.race([fetching,new Promise<never>((_,reject)=>
   setTimeout(()=>reject(new Error("GET not started")),5000))]);
  await admin.query("UPDATE luemi_private.media_assets SET state='revoked' WHERE id=$1",[ids[0]]);
  release();
  const reply=await pending;
  assert.equal(reply.statusCode,404,"revoked pixels must not leave the API after slow Storage read");
 }finally{release?.();await app.close();}
});
test("01F: delete-account queues exactly owner assets, immediately revokes access, "+
 "flaky Storage retries without resurrecting PII",async()=>{
 const storage=memoryPrivateStore();
 const app=makeApp({erasure:true,storage});
 try{
  const a=await identity(app,8011010),b=await identity(app,8011011);
  await consent(app,b);
  const ids=await prepare(app,a);
  for(const id of ids)await syntheticModerate(moderatorUrl!,id,"approved");
  assert.equal((await mutate(app,a,"/api/v3/profile/publish",{revision:1})).statusCode,200);
  assert.equal((await feed(app,b)).json().profiles.length,1);
  assert.equal((await photo(app,b,ids[0])).statusCode,200);
  const block=await mutate(app,a,"/api/v2/profile/blocks",{targetId:b.id});
  assert.equal(block.statusCode,200);
  const report=await mutate(app,a,"/api/v2/profile/reports",{
   targetId:b.id,reason:"spam",clientRef:"reg01f-report-0001"});
  assert.equal(report.statusCode,200);
  const suspectedMinor=await mutate(app,a,"/api/v2/profile/reports",{
   targetId:b.id,reason:"minor_suspected",clientRef:"reg01f-minor-report-0001"});
  assert.equal(suspectedMinor.statusCode,200,suspectedMinor.body);
  const noConsent=await mutate(app,a,"/api/v2/profile/reports",{
   targetId:b.id,reason:"nonconsensual_photo",clientRef:"reg01f-no-consent-0001"});
  assert.equal(noConsent.statusCode,200,noConsent.body);
  const uri="/api/v3/account/request-deletion";
  const missing=await mutate(app,a,uri,{confirmation:"not the exact phrase"});
  assert.equal(missing.statusCode,422);
  assert.equal((await mutate(app,a,uri,{...deletionBody,ownerId:b.id})).statusCode,422);
  const noOrigin=await app.inject({method:"POST",url:uri,
   headers:{cookie:a.cookie,"x-luemi-csrf":a.csrf},
   payload:deletionBody});
  assert.equal(noOrigin.statusCode,403);
  const deleted=await mutate(app,a,uri,deletionBody);
  assert.equal(deleted.statusCode,202,deleted.body);
  assert.equal(deleted.json().state,"deletion_grace");
  assert.equal(deleted.json().publicAccessRevoked,true);
  assert.equal(deleted.json().sessionsRevoked,true);
  assert.equal(deleted.json().storagePending,true);
  assert.equal(deleted.json().dataDeleted,false);
  assert.equal(deleted.json().canRestore,true);
  assert.ok(Date.parse(deleted.json().restoreUntil)>Date.now()+70*3600000);
  assert.match(String(deleted.headers["set-cookie"]),/Max-Age=0/);
  assert.equal((await feed(app,b)).json().profiles.length,0);
  assert.equal((await photo(app,b,ids[0])).statusCode,404);
  assert.equal((await app.inject({method:"GET",url:"/api/v2/auth/session",
   headers:{cookie:a.cookie}})).statusCode,401);
  const relogin=await app.inject({method:"POST",url:"/api/v2/auth/telegram",
   headers:{origin,"sec-fetch-site":"same-origin"},payload:{initData:sign(8011010)}});
  assert.equal(relogin.statusCode,409,"login must offer explicit recovery, not silently restore");
  assert.equal(relogin.json().error,"account_pending_deletion");
  assert.equal((await mutate(app,a,uri,deletionBody)).statusCode,401);
  const q=await admin.query<{id:string;state:string}>(
   "SELECT id,state FROM luemi_private.erasure_requests WHERE actor_id=$1",[a.id]);
  assert.equal(q.rowCount,1);
  assert.equal(q.rows[0].state,"pending");
  const objects=await admin.query<{object_key:string}>(
   "SELECT object_key FROM luemi_private.erasure_objects WHERE request_id=$1",
   [q.rows[0].id]);
  assert.equal(objects.rowCount,3);
  // The special worker role must not inspect or delete the OTHER user, even
  // when one pending erasure request exists in the same environment.
  await admin.query("INSERT INTO luemi_private.geo_daily_usage "+
   "(namespace,scope,actor_id,kind,period,used) VALUES "+
   "($1,'actor',$2,'search',CURRENT_DATE,2),"+
   "($1,'actor',$3,'search',CURRENT_DATE,7)",
   [namespace,a.id,b.id]);
  const workerProbe=new Pool({connectionString:erasureWorkerUrl!});
  try{
   assert.equal((await workerProbe.query(
    "SELECT id FROM luemi_private.actors WHERE id=$1",[b.id])).rowCount,0);
   assert.equal((await workerProbe.query(
    "SELECT id FROM luemi_private.sessions WHERE actor_id=$1",[b.id])).rowCount,0);
   assert.equal((await workerProbe.query(
    "SELECT actor_id FROM luemi_private.geo_daily_usage WHERE actor_id=$1",[b.id])).rowCount,0);
   assert.equal((await workerProbe.query(
    "DELETE FROM luemi_private.geo_daily_usage WHERE actor_id=$1 RETURNING actor_id",[b.id])).rowCount,0);
   const foreignAudit=await admin.query<{id:string}>(
    "INSERT INTO luemi_private.audit_events(actor_id,event_type) "+
    "VALUES($1,'report_created') RETURNING id::text",[b.id]);
   const forbidden=await workerProbe.query(
    "DELETE FROM luemi_private.audit_events WHERE id=$1 RETURNING id",[foreignAudit.rows[0].id]);
   assert.equal(forbidden.rowCount,0,"worker must not erase another adult's audit");
   assert.equal((await admin.query(
    "SELECT id FROM luemi_private.audit_events WHERE id=$1",[foreignAudit.rows[0].id])).rowCount,1);
  }finally{await workerProbe.end();}
  for(const object of objects.rows)assert.ok(await storage.get(object.object_key));
  const tooEarly=await runErasureBatch({databaseUrl:erasureWorkerUrl!,namespace,storage,limit:1});
  assert.deepEqual(tooEarly,{completed:0,failed:0,pending:false},
   "worker MUST NOT delete before the 72h deadline");
  await admin.query("UPDATE luemi_private.erasure_requests "+
   "SET eligible_at=clock_timestamp()-interval '1 second' WHERE id=$1",[q.rows[0].id]);
  // First deletion succeeds in external Storage, second fails. SQL must
  // roll back, and a retry must treat the missing first object as deleted.
  let deletions=0;
  const flaky:PrivateObjectStore={put:(k,b)=>storage.put(k,b),get:k=>storage.get(k),
   delete:async key=>{
    deletions++;
    if(deletions===2)throw new Error("synthetic-storage-outage");
    await storage.delete(key);
   }};
  const blocked=await runErasureBatch({databaseUrl:erasureWorkerUrl!,namespace,
   storage:flaky,limit:1});
  assert.deepEqual(blocked,{completed:0,failed:1,pending:true});
  assert.equal(deletions,2);
  assert.equal((await admin.query(
   "SELECT 1 FROM luemi_private.erasure_objects WHERE request_id=$1 AND deleted_at IS NOT NULL",
   [q.rows[0].id])).rowCount,0,"SQL markers must roll back on partial external success");
  assert.equal((await admin.query("SELECT 1 FROM luemi_private.actors WHERE id=$1",[a.id])).rowCount,1);
  assert.equal((await admin.query("SELECT 1 FROM luemi_private.sessions WHERE actor_id=$1",[a.id])).rowCount,1);
  const done=await runErasureBatch({databaseUrl:erasureWorkerUrl!,namespace,
   storage,limit:1});
  assert.deepEqual(done,{completed:1,failed:0,pending:false});
  for(const object of objects.rows)assert.equal(await storage.get(object.object_key),null);
  assert.equal((await admin.query(
   "SELECT actor_id FROM luemi_private.geo_daily_usage WHERE actor_id=$1",[a.id])).rowCount,0);
  assert.equal((await admin.query(
   "SELECT actor_id FROM luemi_private.geo_daily_usage WHERE actor_id=$1",[b.id])).rowCount,1);
  for(const [table,column] of [
   ["sessions","actor_id"],["private_profile_drafts","owner_id"],
   ["public_profiles","owner_id"],["media_assets","owner_id"],["media_uploads","owner_id"]
  ]){
   const found=await admin.query("SELECT 1 FROM luemi_private."+table+" WHERE "+column+"=$1",[a.id]);
   assert.equal(found.rowCount,0,table+" retains a deleted owner");
  }
  // A minimal FK-only tombstone remains so recipients can retain their own
  // history. It must not contain the prior Telegram identifier or profile.
  const tombstone=await admin.query<{status:string;first_name:string;telegram_id:string;anonymized_at:string|null}>(
   "SELECT status,first_name,telegram_id::text,anonymized_at::text "+
   "FROM luemi_private.actors WHERE id=$1",[a.id]);
  assert.equal(tombstone.rowCount,1);
  assert.equal(tombstone.rows[0].status,"deleted");
  assert.equal(tombstone.rows[0].first_name,"Удалённый аккаунт");
  assert.ok(tombstone.rows[0].anonymized_at);
  assert.ok(BigInt(tombstone.rows[0].telegram_id)>=9000000000000000000n);
  assert.equal((await admin.query(
   "SELECT 1 FROM luemi_private.reports WHERE reporter_id=$1 OR subject_id=$1",[a.id])).rowCount,0);
  assert.equal((await admin.query(
   "SELECT 1 FROM luemi_private.blocks WHERE blocker_id=$1 OR blocked_id=$1",[a.id])).rowCount,0);
  assert.equal((await admin.query(
   "SELECT 1 FROM luemi_private.moderation_jobs WHERE asset_id=ANY($1::uuid[])",[ids])).rowCount,0);
  assert.equal((await admin.query(
   "SELECT 1 FROM luemi_private.erasure_objects WHERE request_id=$1",[q.rows[0].id])).rowCount,0);
  const receipt=await admin.query<{state:string;finished_at:string}>(
   "SELECT state,finished_at FROM luemi_private.erasure_requests WHERE id=$1",[q.rows[0].id]);
  assert.equal(receipt.rows[0].state,"complete");
  assert.ok(receipt.rows[0].finished_at);
  assert.equal((await feed(app,b)).json().profiles.length,0);
  assert.equal((await app.inject({method:"GET",url:"/api/v2/auth/session",
   headers:{cookie:b.cookie}})).statusCode,200,"other adults remain authenticated");
 }finally{await app.close();}
});
test("01F: erasure waits for in-flight Storage write and queues its derivative",async()=>{
 const store=memoryPrivateStore();
 let entered!:()=>void,release!:()=>void;
 const pendingStorage=new Promise<void>(resolve=>{entered=resolve;});
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const storage:PrivateObjectStore={
  get:k=>store.get(k),delete:k=>store.delete(k),
  put:async(key,bytes)=>{entered();await gate;await store.put(key,bytes);}
 };
 const app=makeApp({erasure:true,storage});
 try{
  const user=await identity(app,8011013);
  await consent(app,user);
  const png=makeSyntheticPng();
  const intent=await mutate(app,user,"/api/v2/media/intents",{
   bytes:png.length,mime:"image/png",clientKey:"reg01f-race-early-upload"});
  assert.equal(intent.statusCode,200,intent.body);
  const asset=intent.json().assetId as string;
  const uploading=app.inject({method:"PUT",url:"/api/v2/media/"+asset+"/bytes",
   headers:{...headers(user),"content-type":"image/png"},payload:png});
  await Promise.race([pendingStorage,new Promise<never>((_,reject)=>
   setTimeout(()=>reject(new Error("storage_not_entered")),5000))]);
  // Media worker owns the per-user advisory lock; erasure must wait until
  // its SQL and Storage operation have finished before taking its outbox snapshot.
  const deleting=mutate(app,user,"/api/v3/account/request-deletion",
   deletionBody);
  release();
  const [uploaded,disabled]=await Promise.all([uploading,deleting]);
  if(uploaded.statusCode!==200){
    assert.equal(uploaded.statusCode,401,"deletion must refuse late upload");
    assert.deepEqual(uploaded.json(),{error:"unauthorized"});
  }
  assert.equal(disabled.statusCode,202,disabled.body);
  const receipt=await admin.query<{id:string}>(
   "SELECT id FROM luemi_private.erasure_requests WHERE actor_id=$1",[user.id]);
  assert.equal(receipt.rowCount,1);
  const files=await admin.query<{object_key:string}>(
   "SELECT object_key FROM luemi_private.erasure_objects WHERE request_id=$1",
   [receipt.rows[0].id]);
  assert.equal(files.rowCount,1,"in-flight derivative must appear in deletion queue");
  await admin.query("UPDATE luemi_private.erasure_requests "+
   "SET eligible_at=clock_timestamp()-interval '1 second' WHERE id=$1",[receipt.rows[0].id]);
  const done=await runErasureBatch({databaseUrl:erasureWorkerUrl!,namespace,
   storage,limit:1});
  assert.deepEqual(done,{completed:1,failed:0,pending:false});
  assert.equal(await store.get(files.rows[0].object_key),null);
 }finally{release?.();await app.close();}
});
test("01F: miswired requester role, worker role or unapproved feature fail closed",async()=>{
 const miswired=makeApp({erasure:true,erasureUrl:requestUrl!});
 try{
  const user=await identity(miswired,8011012);
  assert.equal((await mutate(miswired,user,"/api/v3/account/request-deletion",
   deletionBody)).statusCode,503);
  assert.equal((await miswired.inject({method:"GET",url:"/api/v2/auth/session",
   headers:{cookie:user.cookie}})).statusCode,200);
 }finally{await miswired.close();}
 const normal=makeApp();
 try{
  assert.equal((await normal.inject({method:"POST",url:"/api/v3/account/request-deletion",
   headers:{origin,"sec-fetch-site":"same-origin"}})).statusCode,404);
 }finally{await normal.close();}
 await assert.rejects(runErasureBatch({databaseUrl:erasureRequestUrl!,namespace,
  storage:memoryPrivateStore()}),/erasure_worker_role_denied/);
});
test("72h recovery requires signed same-owner Telegram confirmation and retains private pixels",async()=>{
 const storage=memoryPrivateStore(),app=makeApp({erasure:true,storage});
 try{
  const owner=await identity(app,8011041);
  const photos=await prepare(app,owner);
  assert.equal(photos.length,3);
  const deleteReply=await mutate(app,owner,"/api/v3/account/request-deletion",deletionBody);
  assert.equal(deleteReply.statusCode,202,deleteReply.body);
  const queue=await admin.query<{id:string}>(
   "SELECT id FROM luemi_private.erasure_requests WHERE actor_id=$1 AND state='pending'",[owner.id]);
  assert.equal(queue.rowCount,1);
  assert.equal((await app.inject({method:"GET",url:"/api/v2/auth/session",
   headers:{cookie:owner.cookie}})).statusCode,401);
  const pending=await app.inject({method:"POST",url:"/api/v2/auth/telegram",
   headers:{origin,"sec-fetch-site":"same-origin"},payload:{initData:sign(8011041)}});
  assert.equal(pending.statusCode,409,pending.body);
  assert.equal(pending.json().error,"account_pending_deletion");
  const recoverUrl="/api/v2/auth/recover-deletion";
  const unsigned=await app.inject({method:"POST",url:recoverUrl,
   headers:{origin,"sec-fetch-site":"same-origin"},
   payload:{initData:"forged",confirmation:"RESTORE MY LUEMI ACCOUNT"}});
  assert.equal(unsigned.statusCode,401);
  const passive=await app.inject({method:"POST",url:recoverUrl,
   headers:{origin,"sec-fetch-site":"same-origin"},payload:{initData:sign(8011041)}});
  assert.equal(passive.statusCode,422);
  const stranger=await app.inject({method:"POST",url:recoverUrl,
   headers:{origin,"sec-fetch-site":"same-origin"},
   payload:{initData:sign(8011042),confirmation:"RESTORE MY LUEMI ACCOUNT"}});
  assert.equal(stranger.statusCode,409);
  const restored=await app.inject({method:"POST",url:recoverUrl,
   headers:{origin,"sec-fetch-site":"same-origin"},
   payload:{initData:sign(8011041),confirmation:"RESTORE MY LUEMI ACCOUNT"}});
  assert.equal(restored.statusCode,200,restored.body);
  assert.deepEqual(restored.json(),{state:"restored_hidden",republicationRequired:true});
  const q=await admin.query("SELECT id FROM luemi_private.erasure_requests WHERE actor_id=$1",[owner.id]);
  assert.equal(q.rowCount,0,"recover must cancel deletion outbox");
  const returned=await admin.query<{state:string;publication_status:string}>(
   "SELECT state,publication_status FROM luemi_private.media_assets WHERE owner_id=$1",[owner.id]);
  assert.equal(returned.rowCount,3);
  assert(returned.rows.every(x=>x.publication_status==="private"));
  assert.equal((await admin.query(
   "SELECT id FROM luemi_private.actors WHERE id=$1 AND status='active'",[owner.id])).rowCount,1);
  const reauth=await app.inject({method:"POST",url:"/api/v2/auth/telegram",
   headers:{origin,"sec-fetch-site":"same-origin"},payload:{initData:sign(8011041)}});
  assert.equal(reauth.statusCode,200,reauth.body);
  const worker=await runErasureBatch({databaseUrl:erasureWorkerUrl!,namespace,storage,limit:1});
  assert.deepEqual(worker,{completed:0,failed:0,pending:false});
  const files=await admin.query<{derivative_key:string}>(
   "SELECT derivative_key FROM luemi_private.media_assets WHERE owner_id=$1",[owner.id]);
  for(const file of files.rows)assert.ok(await storage.get(file.derivative_key));
  // Force an unrelated synthetic deletion into the past and verify no recovery.
  const overdue=await identity(app,8011043);
  await consent(app,overdue);
  assert.equal((await mutate(app,overdue,"/api/v3/account/request-deletion",deletionBody)).statusCode,202);
  await admin.query("UPDATE luemi_private.erasure_requests "+
   "SET eligible_at=clock_timestamp()-interval '1 second' WHERE actor_id=$1",[overdue.id]);
  const expired=await app.inject({method:"POST",url:recoverUrl,
   headers:{origin,"sec-fetch-site":"same-origin"},
   payload:{initData:sign(8011043),confirmation:"RESTORE MY LUEMI ACCOUNT"}});
  assert.equal(expired.statusCode,410,expired.body);
  await runErasureBatch({databaseUrl:erasureWorkerUrl!,namespace,storage,limit:1});
 }finally{await app.close();}
});
test("01D admin connection cleanup",async()=>{await admin.end();await reader.end();});
