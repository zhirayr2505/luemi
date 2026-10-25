import assert from "node:assert/strict";
import {test} from "node:test";
import {createHmac} from "node:crypto";
import {Pool} from "pg";
import {buildApp} from "../src/app.js";
import {memoryPrivateStore,syntheticModerate} from "../src/rem05d-private.js";
import {makeSyntheticPng} from "../src/rem05d-image.js";
import type {PrivateObjectStore} from "../src/rem05d-private.js";

const adminUrl=process.env.REG01_ADMIN_DATABASE_URL,issuerUrl=process.env.REG01_ISSUER_DATABASE_URL;
const requestUrl=process.env.REG01_REQUEST_DATABASE_URL,workerUrl=process.env.REG01_WORKER_DATABASE_URL;
const moderatorUrl=process.env.REG01_MODERATOR_DATABASE_URL;
const publisherUrl=process.env.REG01_PUBLISHER_DATABASE_URL,readerUrl=process.env.REG01_READER_DATABASE_URL;
if(!adminUrl||!issuerUrl||!requestUrl||!workerUrl||!moderatorUrl||!publisherUrl||!readerUrl)
 throw new Error("REG01D requires disposable database roles");
const admin=new Pool({connectionString:adminUrl}),reader=new Pool({connectionString:readerUrl});
const namespace="ci_reg01",origin="https://ci.luemi.invalid",token="123456:synthetic_reg01_bot";
const consentVersion="beta-consent-v1";
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
const makeApp=(opts:{storage?:PrivateObjectStore;publisher?:string;reader?:string}={})=>{
 const storage=opts.storage??memoryPrivateStore();
 return buildApp({port:3001,origin,botToken:token,
  healthKey:"synthetic_health_key_123456789012345",logger:false,rem05b:session,
  realRegistration:{enabled:true,requestDatabaseUrl:requestUrl!,namespace,consentVersion},
  rem05d:{enabled:true,durablePrivateOnly:true,requestDatabaseUrl:requestUrl!,
   workerDatabaseUrl:workerUrl!,namespace,consentVersion,storage},
  realPublication:{enabled:true,publisherDatabaseUrl:opts.publisher??publisherUrl!,
   discoveryDatabaseUrl:opts.reader??readerUrl!,namespace,consentVersion,storage}
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
  assert.equal((await app.inject({method:"POST",url:"/api/v3/profile/publish"})).statusCode,401);
  const a=await identity(app,8011001),b=await identity(app,8011002),c=await identity(app,8011003);
  const ids=await prepare(app,a);
  const denied=await mutate(app,a,"/api/v3/profile/publish",{revision:1});
  assert.equal(denied.statusCode,409,denied.body);
  assert.deepEqual((await feed(app,b)).json().profiles,[]);
  for(const id of ids)await syntheticModerate(moderatorUrl!,id,"approved");
  assert.equal((await mutate(app,a,"/api/v3/profile/publish",{revision:0})).statusCode,422);
  assert.equal((await mutate(app,a,"/api/v3/profile/publish",{revision:2})).statusCode,409);
  const pub=await mutate(app,a,"/api/v3/profile/publish",{revision:1});
  assert.equal(pub.statusCode,200,pub.body);
  assert.deepEqual(pub.json(),{state:"published",revision:1,photoCount:3});
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
  assert.deepEqual(img.rawPayload,makeSyntheticPng());
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
  assert.equal((await mutate(app,a,"/api/v3/profile/unpublish")).statusCode,200,"idempotent hide");
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
test("01D: disjoint DB roles cannot publish from session request credentials",async()=>{
 const app=makeApp({publisher:requestUrl!});
 try{
  const x=await identity(app,8011004);
  const denied=await mutate(app,x,"/api/v3/profile/publish",{revision:1});
  assert.equal(denied.statusCode,503,denied.body);
 }finally{await app.close();}
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
test("01D admin connection cleanup",async()=>{await admin.end();await reader.end();});
