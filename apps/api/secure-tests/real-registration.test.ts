import assert from "node:assert/strict";
import {test} from "node:test";
import {createHmac} from "node:crypto";
import {Pool} from "pg";
import {buildApp} from "../src/app.js";
import {readConfig} from "../src/config.js";

const adminUrl=process.env.REG01_ADMIN_DATABASE_URL;
const issuerUrl=process.env.REG01_ISSUER_DATABASE_URL;
const requestUrl=process.env.REG01_REQUEST_DATABASE_URL;
const combinedUrl=process.env.REG01_COMBINED_DATABASE_URL;
if(!adminUrl||!issuerUrl||!requestUrl||!combinedUrl)
 throw new Error("REG01 secure-tests require disposable Postgres URLs");
const origin="https://ci.luemi.invalid",token="123456:synthetic_reg01_bot";
const namespace="ci_reg01",consentVersion="beta-consent-v1";
const admin=new Pool({connectionString:adminUrl});
const scoped=new Pool({connectionString:requestUrl});
function sign(id:number){
 const d={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:"Synthetic"})};
 const check=Object.entries(d).sort(([a],[b])=>a.localeCompare(b,"en")).map(([k,v])=>k+"="+v).join("\n");
 const secret=createHmac("sha256","WebAppData").update(token).digest();
 return new URLSearchParams({...d,hash:createHmac("sha256",secret).update(check).digest("hex")}).toString();
}
const sessions={enabled:true,issuerDatabaseUrl:issuerUrl!,requestDatabaseUrl:requestUrl!,
 pepper:"synthetic-reg01-pepper-1234567890-1234567890",namespace,origin,botToken:token,
 idleMs:43200000,absoluteMs:604800000,maxSessions:5};
function server(db=requestUrl!,enabled=true){
 return buildApp({port:3001,origin,botToken:token,healthKey:"synthetic_health_key_123456789012345",
 logger:false,rem05b:{...sessions,requestDatabaseUrl:db},
 realRegistration:enabled?{enabled:true,requestDatabaseUrl:db,namespace,consentVersion}:undefined});
}
type User={id:string;cookie:string;csrf:string};
async function identity(app:ReturnType<typeof server>,id:number):Promise<User>{
 const r=await app.inject({method:"POST",url:"/api/v2/auth/telegram",
 headers:{origin,"sec-fetch-site":"same-origin"},payload:{initData:sign(id)}});
 assert.equal(r.statusCode,200,r.body);
 return {id:r.json().user.id,cookie:String(r.headers["set-cookie"]).split(";")[0],csrf:r.json().csrfToken};
}
function get(app:ReturnType<typeof server>,user:User){
 return app.inject({method:"GET",url:"/api/v3/registration/draft",headers:{cookie:user.cookie}});
}
function put(app:ReturnType<typeof server>,user:User,revision:number,fields:Record<string,unknown>,
 override:Record<string,string>={}){
 return app.inject({method:"PUT",url:"/api/v3/registration/draft",
 headers:{origin,"sec-fetch-site":"same-origin",cookie:user.cookie,"x-luemi-csrf":user.csrf,...override},
 payload:{revision,fields:{...fields,consentVersion}}});
}
test("REG01A absent without explicit backend flag; all publish routes absent",async()=>{
 const a=server(requestUrl!,false);
 try{
  assert.equal((await a.inject({method:"GET",url:"/api/v3/registration/draft"})).statusCode,404);
  assert.equal((await a.inject({method:"POST",url:"/api/v3/registration/publish"})).statusCode,404);
 }finally{await a.close();}
});
test("REG01A private draft, A/B RLS, CAS and malicious-field rejection",async()=>{
 const app=server();
 try{
  assert.equal((await app.inject({method:"GET",url:"/api/v3/registration/draft"})).statusCode,401);
  const a=await identity(app,7011001),b=await identity(app,7011002);
  assert.notEqual(a.id,b.id);
  assert.deepEqual((await get(app,a)).json(),{state:"empty",revision:0,fields:{}});
  assert.equal((await get(app,b)).json().state,"empty");
  const valid={displayName:"Անահիտ",birthDate:"1998-05-12",gender:"woman",
   city:"Ереван",countryCode:"AM",placeId:"offline:am:yerevan",radius:300,
   searchScope:"radius",audience:"everyone",ageMin:18,ageMax:70,
   goal:"friendship",languages:["hy"],interests:["music"],about:"Привет"};
  const saved=await put(app,a,0,valid);
  assert.equal(saved.statusCode,200,saved.body);
  assert.deepEqual(saved.json(),{state:"private",revision:1,published:false});
  const got=(await get(app,a)).json();
  assert.equal(got.fields.displayName,"Անահիտ");
  assert.equal(got.fields.birthDate,"1998-05-12");
  assert.equal(got.fields.consentVersion,consentVersion);
  assert.equal((await get(app,b)).json().state,"empty");
  const simultaneous=await Promise.all([put(app,a,1,valid),put(app,a,1,valid)]);
  assert.deepEqual(simultaneous.map(x=>x.statusCode).sort(),[200,409]);
  assert.equal((await get(app,a)).json().revision,2);
  assert.equal((await put(app,b,1,valid)).statusCode,409);
  for(const field of [{ownerId:b.id},{published:true},{isModerator:true},{storageKey:"public/key"},
    {birthDate:"2020-01-01"},{displayName:"a1"},{ageMin:70,ageMax:20}]){
   assert.equal((await put(app,a,2,field)).statusCode,422,JSON.stringify(field));
  }
  assert.equal((await put(app,a,2,valid,{origin:"https://attacker.invalid"})).statusCode,403);
  assert.equal((await put(app,a,2,valid,{"x-luemi-csrf":"wrong"})).statusCode,403);
  const forged=await app.inject({method:"GET",url:"/api/v3/registration/draft",
   headers:{cookie:a.cookie,"x-actor-id":b.id,"x-role":"admin"}});
  assert.equal(forged.json().fields.displayName,"Անահիտ");
  assert.equal((await app.inject({method:"POST",url:"/api/v3/registration/publish",
   headers:{cookie:a.cookie}})).statusCode,404);
  assert.equal((await scoped.query("SELECT owner_id FROM luemi_private.private_profile_drafts")).rowCount,0);
  // PostgreSQL RLS is enforced across actors and tenant namespaces.
  const db=await scoped.connect();
  try{
   await db.query("BEGIN");
   await db.query("SELECT set_config('luemi.actor_id',$1,true)",[b.id]);
   await db.query("SELECT set_config('luemi.environment',$1,true)",[namespace]);
   assert.equal((await db.query("SELECT owner_id FROM luemi_private.private_profile_drafts")).rowCount,0);
   await db.query("ROLLBACK");
  }finally{db.release();}
  const anon=await admin.connect();
  try{
   await anon.query("BEGIN");
   await anon.query("SET LOCAL ROLE anon");
   await assert.rejects(anon.query("SELECT * FROM luemi_private.private_profile_drafts"));
   await anon.query("ROLLBACK");
  }finally{anon.release();}
  // Actual database role overlap -> fail CLOSED.
  const bad=server(combinedUrl!);
  try{assert.equal((await get(bad,a)).statusCode,503);}
  finally{await bad.close();}
  // Live session revocation blocks GET and writes even when client retains cookie.
  await admin.query("UPDATE luemi_private.sessions SET revoked_at=clock_timestamp() WHERE actor_id=$1",[a.id]);
  assert.equal((await get(app,a)).statusCode,401);
  assert.equal((await put(app,a,2,valid)).statusCode,401);
 }finally{await app.close();}
});
test("REG01A boot flags fail CLOSED for unapproved privacy and publication",()=>{
 const base={NODE_ENV:"test",PORT:"3001",APP_ORIGIN:origin,
  TELEGRAM_BOT_TOKEN:token,HEALTH_CHECK_KEY:"synthetic_health_key_123456789012345",
  REM05B_SESSIONS_ENABLED:"1",REM05B_AUTH_DATABASE_URL:issuerUrl!,
  REM05B_REQUEST_DATABASE_URL:requestUrl!,REM05B_SESSION_PEPPER:sessions.pepper,
  REM05B_BOT_NAMESPACE:namespace,REM06_PRIVATE_DRAFT_ENABLED:"1"};
 assert.throws(()=>readConfig(base),/privacy\/DB gates/);
 const authorized={...base,REM06_PRIVACY_APPROVED:"1",REM06_CONSENT_VERSION:consentVersion};
 const cfg=readConfig(authorized);
 assert.equal(cfg.realRegistration?.consentVersion,consentVersion);
 assert.throws(()=>readConfig({...authorized,REM06_PUBLICATION_ENABLED:"1"}),/HARD DISABLED/);
 assert.throws(()=>readConfig({...authorized,STAGING_BOOTSTRAP_ONLY:"1"}),/privacy\/DB gates/);
});
test("REG01A disposable pool cleanup",async()=>{await admin.end();await scoped.end();});
