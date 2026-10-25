import assert from "node:assert/strict";
import {test} from "node:test";
import {createHmac} from "node:crypto";
import {Pool} from "pg";
import {buildApp} from "../src/app.js";
import {makeSyntheticPng} from "../src/rem05d-image.js";
import {memoryPrivateStore,syntheticModerate} from "../src/rem05d-private.js";
import {runErasureBatch} from "../src/real-erasure-worker.js";
import {triageReviewReport} from "../src/human-moderation.js";
import {changeInvite} from "../src/beta-invite-operator.js";
import {suspendReportedActor,pendingSafetyAppeals,decideSafetyAppeal} from "../src/safety-operator.js";
const env=process.env;
const dbAdmin=env.REG01_ADMIN_DATABASE_URL!,issuer=env.REG01_ISSUER_DATABASE_URL!;
const request=env.REG01_REQUEST_DATABASE_URL!,mediaWorker=env.REG01_WORKER_DATABASE_URL!;
const publisher=env.REG01_PUBLISHER_DATABASE_URL!,reader=env.REG01_READER_DATABASE_URL!;
const reviewer=env.REG01_HUMAN_MODERATOR_DATABASE_URL!,invite=env.REG01_INVITE_DATABASE_URL!;
const safety=env.REG01_SAFETY_OPERATOR_DATABASE_URL!,appeal=env.REG01_SAFETY_APPEAL_DATABASE_URL!;
const moderator=env.REG01_MODERATOR_DATABASE_URL!;
const eraseRequest=env.REG01_ERASURE_REQUEST_DATABASE_URL!,eraseWorker=env.REG01_ERASURE_WORKER_DATABASE_URL!;
if([dbAdmin,issuer,request,mediaWorker,publisher,reader,reviewer,invite,safety,appeal,moderator,eraseRequest,eraseWorker].some(x=>!x))
 throw Error("01H requires disposable role credentials");
const admin=new Pool({connectionString:dbAdmin});
const origin="https://ci.luemi.invalid",bot="123456:synthetic_reg01_bot",ns="ci_reg01h";
const cv="beta-consent-v1",store=memoryPrivateStore();
const operator={databaseUrl:safety,namespace:ns,operatorLabel:"synthetic_safety_operator"};
const reviewerOpts={databaseUrl:reviewer,namespace:ns,operatorLabel:"synthetic_human_review"};
function init(id:number){
 const d={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:"Synthetic"})};
 const message=Object.entries(d).sort(([a],[b])=>a.localeCompare(b,"en")).map(([k,v])=>k+"="+v).join("\n");
 const key=createHmac("sha256","WebAppData").update(bot).digest();
 return new URLSearchParams({...d,hash:createHmac("sha256",key).update(message).digest("hex")}).toString();
}
const makeApp=(opts:{safetyUrl?:string;enabled?:boolean}={})=>buildApp({
 port:3001,origin,botToken:bot,healthKey:"synthetic_health_key_123456789012345",logger:false,
 rem05b:{enabled:true,issuerDatabaseUrl:issuer,requestDatabaseUrl:request,
  pepper:"synthetic-reg01-pepper-1234567890-1234567890",namespace:ns,origin,botToken:bot,
  idleMs:43200000,absoluteMs:604800000,maxSessions:5,inviteOnly:true},
 realRegistration:{enabled:true,requestDatabaseUrl:request,namespace:ns,consentVersion:cv},
 rem05d:{enabled:true,durablePrivateOnly:true,requestDatabaseUrl:request,
  workerDatabaseUrl:mediaWorker,namespace:ns,consentVersion:cv,storage:store},
 realPublication:{enabled:true,requestDatabaseUrl:request,publisherDatabaseUrl:publisher,
  discoveryDatabaseUrl:reader,namespace:ns,consentVersion:cv,storage:store},
 realErasure:{enabled:true,databaseUrl:eraseRequest,namespace:ns},
 safetyAppeal:opts.enabled===false?undefined:{
  enabled:true,databaseUrl:opts.safetyUrl??appeal,namespace:ns,origin,botToken:bot}
});
type User={id:string;cookie:string;csrf:string};
const headers=(u:User)=>({origin,"sec-fetch-site":"same-origin",cookie:u.cookie,"x-luemi-csrf":u.csrf});
async function enter(app:ReturnType<typeof makeApp>,telegram:number){
 await changeInvite({databaseUrl:invite,namespace:ns,telegramId:String(telegram),state:"active"});
 const r=await app.inject({method:"POST",url:"/api/v2/auth/telegram",
 headers:{origin,"sec-fetch-site":"same-origin"},payload:{initData:init(telegram)}});
 assert.equal(r.statusCode,200,r.body);
 return{id:r.json().user.id as string,cookie:String(r.headers["set-cookie"]).split(";")[0],
  csrf:r.json().csrfToken as string} satisfies User;
}
test("01H: report must be human triaged, suspend revokes all sessions and hides private pixels",async()=>{
 const app=makeApp();
 try{
  const owner=await enter(app,9300011),viewer=await enter(app,9300012);
  const consent=await app.inject({method:"PUT",url:"/api/v3/registration/draft",
   headers:headers(viewer),payload:{revision:0,fields:{
    displayName:"Viewer",birthDate:"1993-01-03",consentVersion:cv
   }}});
  assert.equal(consent.statusCode,200,consent.body);
  const draft=await app.inject({method:"PUT",url:"/api/v3/registration/draft",
   headers:headers(owner),payload:{revision:0,fields:{
    displayName:"Synthetic Owner",birthDate:"1993-01-03",gender:"woman",
    city:"Yerevan",countryCode:"AM",placeId:"offline:am:yerevan",
    goal:"friendship",interests:["art"],languages:["hy"],about:"Review test",consentVersion:cv
   }}});
  assert.equal(draft.statusCode,200,draft.body);
  const png=makeSyntheticPng(),ids:string[]=[];
  for(let i=0;i<3;i++){
   const intent=await app.inject({method:"POST",url:"/api/v2/media/intents",
    headers:headers(owner),payload:{bytes:png.length,mime:"image/png",clientKey:"reg01h-photo-"+i}});
   assert.equal(intent.statusCode,200,intent.body);
   const assetId=intent.json().assetId as string;
   ids.push(assetId);
   const upload=await app.inject({method:"PUT",url:"/api/v2/media/"+assetId+"/bytes",
    headers:{...headers(owner),"content-type":"image/png"},payload:png});
   assert.equal(upload.statusCode,200,upload.body);
   await syntheticModerate(moderator,assetId,"approved");
  }
  const publish=await app.inject({method:"POST",url:"/api/v3/profile/publish",
   headers:headers(owner),payload:{revision:1}});
  assert.equal(publish.statusCode,200,publish.body);
  assert.equal((await app.inject({method:"GET",url:"/api/v3/discovery/feed",
   headers:{cookie:viewer.cookie}})).json().profiles.length,1);
  const report=await app.inject({method:"POST",url:"/api/v2/profile/reports",
   headers:headers(viewer),payload:{targetId:owner.id,reason:"spam",clientRef:"reg01h-report-001"}});
  assert.equal(report.statusCode,200,report.body);
  const reportId=report.json().id as string;
  await assert.rejects(suspendReportedActor(operator,reportId,"spam"),/safety_report_not_triaged/);
  await triageReviewReport(reviewerOpts,reportId,"triaged","spam");
  const suspended=await suspendReportedActor(operator,reportId,"spam");
  assert.equal(suspended.state,"suspended");
  await assert.rejects(suspendReportedActor(operator,reportId,"spam"),/safety_report_not_triaged/);
  assert.equal((await app.inject({method:"GET",url:"/api/v3/discovery/feed",
   headers:{cookie:viewer.cookie}})).json().profiles.length,0);
  assert.equal((await app.inject({method:"GET",url:"/api/v3/discovery/photo/"+ids[0],
   headers:{cookie:viewer.cookie}})).statusCode,404);
  assert.equal((await app.inject({method:"GET",url:"/api/v2/auth/session",
   headers:{cookie:owner.cookie}})).statusCode,401);
  const relog=await app.inject({method:"POST",url:"/api/v2/auth/telegram",
   headers:{origin,"sec-fetch-site":"same-origin"},payload:{initData:init(9300011)}});
  assert.equal(relog.statusCode,403,"suspension excludes relogin");
  const wrong=await app.inject({method:"POST",url:"/api/v3/safety/appeal",
   headers:{origin},payload:{initData:"forged",statement:"Please recheck my profile decision."}});
  assert.equal(wrong.statusCode,401);
  const foreign=await app.inject({method:"POST",url:"/api/v3/safety/appeal",
   headers:{origin},payload:{initData:init(9300012),statement:"Please recheck my profile decision."}});
  assert.equal(foreign.statusCode,404);
  const badOrigin=await app.inject({method:"POST",url:"/api/v3/safety/appeal",
   headers:{origin:"https://attacker.invalid"},
   payload:{initData:init(9300011),statement:"Please recheck my profile decision."}});
  assert.equal(badOrigin.statusCode,403);
  const submitted=await app.inject({method:"POST",url:"/api/v3/safety/appeal",
   headers:{origin,"sec-fetch-site":"same-origin"},
   payload:{initData:init(9300011),statement:"Please review this suspension; I believe it is incorrect."}});
  assert.equal(submitted.statusCode,202,submitted.body);
  assert.deepEqual(submitted.json(),{state:"appeal_received",reviewPending:true});
  const twice=await app.inject({method:"POST",url:"/api/v3/safety/appeal",
   headers:{origin},payload:{initData:init(9300011),statement:"Please review this suspension again."}});
  assert.equal(twice.statusCode,409);
  const list=await pendingSafetyAppeals(operator);
  assert.equal(list.length,1);
  const accept=await decideSafetyAppeal(operator,list[0].id,"accepted",
   "A second human verified the report was incorrect.");
  assert.deepEqual(accept,{state:"accepted"});
  await assert.rejects(decideSafetyAppeal(operator,list[0].id,"rejected",
   "Cannot resolve twice."),/safety_appeal_not_pending/);
  const active=await admin.query<{status:string}>(
   "SELECT status FROM luemi_private.actors WHERE id=$1",[owner.id]);
  assert.equal(active.rows[0].status,"active");
  assert.equal((await app.inject({method:"GET",url:"/api/v2/auth/session",
   headers:{cookie:owner.cookie}})).statusCode,401,"old session remains revoked");
  assert.equal((await app.inject({method:"GET",url:"/api/v3/discovery/feed",
   headers:{cookie:viewer.cookie}})).json().profiles.length,0,"no automatic republish");
  const newLogin=await app.inject({method:"POST",url:"/api/v2/auth/telegram",
   headers:{origin,"sec-fetch-site":"same-origin"},payload:{initData:init(9300011)}});
  assert.equal(newLogin.statusCode,200,newLogin.body);
  const republish=await app.inject({method:"POST",url:"/api/v3/profile/publish",
   headers:{origin,"sec-fetch-site":"same-origin",
    cookie:String(newLogin.headers["set-cookie"]).split(";")[0],
    "x-luemi-csrf":newLogin.json().csrfToken},payload:{revision:1}});
  assert.equal(republish.statusCode,409,"previous published photos must be re-reviewed");
  assert.equal((await admin.query("SELECT id FROM luemi_private.account_enforcements "+
   "WHERE id=$1 AND state='restored'",[suspended.caseId])).rowCount,1);
  const deletion=await app.inject({method:"POST",url:"/api/v3/account/request-deletion",
   headers:{origin,"sec-fetch-site":"same-origin",
    cookie:String(newLogin.headers["set-cookie"]).split(";")[0],
    "x-luemi-csrf":newLogin.json().csrfToken},
   payload:{confirmation:"DELETE MY LUEMI ACCOUNT"}});
  assert.equal(deletion.statusCode,202,deletion.body);
  const erased=await runErasureBatch({databaseUrl:eraseWorker,namespace:ns,storage:store,limit:1});
  assert.deepEqual(erased,{completed:1,failed:0,pending:false});
  assert.equal((await admin.query("SELECT 1 FROM luemi_private.account_enforcements "+
   "WHERE actor_id=$1",[owner.id])).rowCount,0);
  assert.equal((await admin.query("SELECT 1 FROM luemi_private.account_appeals "+
   "WHERE actor_id=$1",[owner.id])).rowCount,0);
  assert.equal((await admin.query("SELECT 1 FROM luemi_private.actors "+
   "WHERE id=$1",[viewer.id])).rowCount,1);
  // Safety operator must never access raw Telegram identities or stored sessions.
  const spy=new Pool({connectionString:safety});
  try{
   await assert.rejects(spy.query("SELECT telegram_id FROM luemi_private.actors"));
   await assert.rejects(spy.query("SELECT token_hash FROM luemi_private.sessions"));
  }finally{await spy.end();}
 }finally{await app.close();}
});
test("01H: normal user DB role cannot masquerade as safety operator",async()=>{
 await assert.rejects(
  pendingSafetyAppeals({...operator,databaseUrl:request}),
  /safety_role_denied/
 );
});
test("01H: safety appeals absent unless explicitly enabled; wrong DB roles fail shut",async()=>{
 const off=makeApp({enabled:false});
 try{
  assert.equal((await off.inject({method:"POST",url:"/api/v3/safety/appeal",
   headers:{origin}})).statusCode,404);
 }finally{await off.close();}
 const wrong=makeApp({safetyUrl:request});
 try{
  const r=await wrong.inject({method:"POST",url:"/api/v3/safety/appeal",
   headers:{origin},payload:{initData:init(9300011),statement:"Please reconsider this suspension."}});
  assert.equal(r.statusCode,503);
 }finally{await wrong.close();}
});
test("01H: teardown",async()=>admin.end());
