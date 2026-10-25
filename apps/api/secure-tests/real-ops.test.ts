import assert from "node:assert/strict";
import {test} from "node:test";
import {createHmac} from "node:crypto";
import {Pool} from "pg";
import {buildApp} from "../src/app.js";
import {readConfig} from "../src/config.js";
import {makeSyntheticPng,sanitizePng} from "../src/rem05d-image.js";
import {memoryPrivateStore} from "../src/rem05d-private.js";
import {changeInvite} from "../src/beta-invite-operator.js";
import {listReviewQueue,fetchPrivateReviewImage,decideReviewPhoto,triageReviewReport} from "../src/human-moderation.js";
const env=process.env;
const issuer=env.REG01_ISSUER_DATABASE_URL!,request=env.REG01_REQUEST_DATABASE_URL!;
const worker=env.REG01_WORKER_DATABASE_URL!,publisher=env.REG01_PUBLISHER_DATABASE_URL!;
const reader=env.REG01_READER_DATABASE_URL!,invite=env.REG01_INVITE_DATABASE_URL!;
const reviewer=env.REG01_HUMAN_MODERATOR_DATABASE_URL!;
const adminUrl=env.REG01_ADMIN_DATABASE_URL!;
if([issuer,request,worker,publisher,reader,invite,reviewer,adminUrl].some(x=>!x))
 throw new Error("REG01G disposable PostgreSQL role configuration required");
const origin="https://ci.luemi.invalid",bot="123456:synthetic_reg01_bot",ns="ci_reg01g";
const cv="beta-consent-v1";
const admin=new Pool({connectionString:adminUrl});
const store=memoryPrivateStore();
const opts={databaseUrl:reviewer,namespace:ns,operatorLabel:"synthetic_human_01",storage:store};
function init(id:number){
 const data={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:"Synthetic"})};
 const msg=Object.entries(data).sort(([a],[b])=>a.localeCompare(b,"en"))
  .map(([k,v])=>k+"="+v).join("\n");
 const key=createHmac("sha256","WebAppData").update(bot).digest();
 return new URLSearchParams({...data,hash:createHmac("sha256",key).update(msg).digest("hex")}).toString();
}
const baseSession={enabled:true,issuerDatabaseUrl:issuer,requestDatabaseUrl:request,
 pepper:"synthetic-reg01-pepper-1234567890-1234567890",namespace:ns,origin,botToken:bot,
 idleMs:43200000,absoluteMs:604800000,maxSessions:5};
type User={id:string;cookie:string;csrf:string};
const sessionHeaders=(user:User)=>({origin,"sec-fetch-site":"same-origin",
 cookie:user.cookie,"x-luemi-csrf":user.csrf});
const appFactory=(invitationOnly:boolean,moderation:boolean)=>buildApp({
 port:3001,origin,botToken:bot,healthKey:"synthetic_health_key_123456789012345",logger:false,
 rem05b:{...baseSession,inviteOnly:invitationOnly},
 ...(moderation?{
  realRegistration:{enabled:true,requestDatabaseUrl:request,namespace:ns,consentVersion:cv},
  rem05d:{enabled:true,durablePrivateOnly:true,requestDatabaseUrl:request,
   workerDatabaseUrl:worker,namespace:ns,consentVersion:cv,storage:store},
  realPublication:{enabled:true,requestDatabaseUrl:request,publisherDatabaseUrl:publisher,
   discoveryDatabaseUrl:reader,namespace:ns,consentVersion:cv,storage:store}
 }: {})
});
async function authorize(app:ReturnType<typeof appFactory>,id:number){
 const reply=await app.inject({method:"POST",url:"/api/v2/auth/telegram",
  headers:{origin,"sec-fetch-site":"same-origin"},payload:{initData:init(id)}});
 assert.equal(reply.statusCode,200,reply.body);
 return{id:reply.json().user.id as string,
  cookie:String(reply.headers["set-cookie"]).split(";")[0],
  csrf:reply.json().csrfToken as string} satisfies User;
}
test("01G: private allowlist blocks uninvited Telegram identity before DB account insert",async()=>{
 const app=appFactory(true,false);
 try{
  const outsider=9200101;
  const denied=await app.inject({method:"POST",url:"/api/v2/auth/telegram",
   headers:{origin,"sec-fetch-site":"same-origin"},payload:{initData:init(outsider)}});
  assert.equal(denied.statusCode,403,denied.body);
  assert.equal(denied.json().error,"invitation_required");
  assert.equal((await admin.query(
   "SELECT 1 FROM luemi_private.actors WHERE telegram_id=$1",[outsider])).rowCount,0);
  const allowed=9200102;
  assert.deepEqual(await changeInvite({databaseUrl:invite,namespace:ns,
   telegramId:String(allowed),state:"active"}),{state:"active"});
  const user=await authorize(app,allowed);
  assert.equal((await app.inject({method:"GET",url:"/api/v2/auth/session",
   headers:{cookie:user.cookie}})).statusCode,200);
  assert.deepEqual(await changeInvite({databaseUrl:invite,namespace:ns,
   telegramId:String(allowed),state:"revoked"}),{state:"revoked"});
  assert.equal((await app.inject({method:"GET",url:"/api/v2/auth/session",
   headers:{cookie:user.cookie}})).statusCode,401,"revocation invalidates old active session");
  const noRelog=await app.inject({method:"POST",url:"/api/v2/auth/telegram",
   headers:{origin,"sec-fetch-site":"same-origin"},payload:{initData:init(allowed)}});
  assert.equal(noRelog.statusCode,403);
  await assert.rejects(changeInvite({databaseUrl:issuer,namespace:ns,
   telegramId:String(allowed),state:"active"}),/invite_operator_role_denied/);
  const operatorPool=new Pool({connectionString:invite});
  try{
   await assert.rejects(operatorPool.query("SELECT * FROM luemi_private.sessions"));
   assert.equal((await operatorPool.query("SELECT telegram_id FROM luemi_private.beta_invites")).rowCount,0,
    "operator needs an explicitly scoped transaction");
  }finally{await operatorPool.end();}
  assert.equal((await admin.query("SELECT 1 FROM luemi_private.beta_invites "+
   "WHERE telegram_id=$1 AND state='revoked'",[allowed])).rowCount,1);
 }finally{await app.close();}
});
test("01G: photo review and report triage use scoped human role, not browser/admin",async()=>{
 const app=appFactory(false,true);
 try{
  const owner=await authorize(app,9200111),viewer=await authorize(app,9200112);
  const eligible=await app.inject({method:"PUT",url:"/api/v3/registration/draft",
   headers:sessionHeaders(viewer),payload:{revision:0,fields:{
    displayName:"Adult Viewer",birthDate:"1995-01-01",consentVersion:cv
   }}});
  assert.equal(eligible.statusCode,200,eligible.body);
  const draft=await app.inject({method:"PUT",url:"/api/v3/registration/draft",
   headers:sessionHeaders(owner),payload:{revision:0,fields:{
    displayName:"Adult",birthDate:"1997-02-03",gender:"woman",city:"Yerevan",
    countryCode:"AM",placeId:"offline:am:yerevan",goal:"friendship",interests:["music"],
    languages:["hy"],about:"Synthetic profile",consentVersion:cv
   }}});
  assert.equal(draft.statusCode,200,draft.body);
  const png=makeSyntheticPng();
  const photos:string[]=[];
  for(let i=0;i<3;i++){
   const intent=await app.inject({method:"POST",url:"/api/v2/media/intents",
    headers:sessionHeaders(owner),
    payload:{bytes:png.length,mime:"image/png",clientKey:"reg01g-photo-"+i}});
   assert.equal(intent.statusCode,200,intent.body);
   const id=intent.json().assetId as string;
   photos.push(id);
   const upload=await app.inject({method:"PUT",url:"/api/v2/media/"+id+"/bytes",
    headers:{...sessionHeaders(owner),"content-type":"image/png"},payload:png});
   assert.equal(upload.statusCode,200,upload.body);
  }
  const pending=await listReviewQueue(opts);
  for(const id of photos)assert.ok(pending.photos.some(p=>p.asset_id===id));
  assert.deepEqual(await fetchPrivateReviewImage(opts,photos[0]),sanitizePng(png).bytes);
  await assert.rejects(decideReviewPhoto(opts,photos[0],"approved","human_policy_violation"),
   /invalid_human_photo_decision/);
  for(const id of photos){
   assert.deepEqual(await decideReviewPhoto(opts,id,"approved","human_safe"),
    {state:"decided",decision:"approved"});
  }
  await assert.rejects(decideReviewPhoto(opts,photos[0],"approved","human_safe"),
   /review_photo_already_decided/);
  await assert.rejects(fetchPrivateReviewImage(opts,photos[0]),/review_media_not_pending/);
  const publish=await app.inject({method:"POST",url:"/api/v3/profile/publish",
   headers:sessionHeaders(owner),payload:{revision:1}});
  assert.equal(publish.statusCode,200,publish.body);
  const report=await app.inject({method:"POST",url:"/api/v2/profile/reports",
   headers:sessionHeaders(viewer),payload:{
    targetId:owner.id,reason:"spam",clientRef:"reg01g-report-00000001"
   }});
  assert.equal(report.statusCode,200,report.body);
  const reportId=report.json().id as string;
  assert.ok((await listReviewQueue(opts)).reports.some(r=>r.id===reportId));
  const handled=await triageReviewReport(opts,reportId,"triaged","spam");
  assert.deepEqual(handled,{state:"triaged"});
  await assert.rejects(triageReviewReport(opts,reportId,"triaged","spam"),
   /review_report_already_decided/);
  const recorded=await admin.query("SELECT id FROM luemi_private.human_report_reviews "+
   "WHERE report_id=$1 AND action='triaged' AND moderator_label=$2",
   [reportId,opts.operatorLabel]);
  assert.equal(recorded.rowCount,1);
  const decisions=await admin.query("SELECT id FROM luemi_private.moderation_decisions "+
   "WHERE job_id IN (SELECT id FROM luemi_private.moderation_jobs "+
   "WHERE asset_id=ANY($1::uuid[])) AND reason_code='human_safe'",[photos]);
  assert.equal(decisions.rowCount,3);
  const unauth=await app.inject({method:"POST",url:"/api/v3/admin/moderate/photo",
   headers:sessionHeaders(owner)});
  assert.equal(unauth.statusCode,404,"no internet facing moderator API");
  const blockedOpts={...opts,databaseUrl:request};
  await assert.rejects(listReviewQueue(blockedOpts),/human_moderator_role_denied/);
 }finally{await app.close();}
});
test("01G: real invite rollout requires explicit privacy and operator approval",()=>{
 const flags={NODE_ENV:"test",APP_ORIGIN:origin,TELEGRAM_BOT_TOKEN:bot,
  REM06_BETA_INVITES_ENABLED:"1",REM05B_SESSIONS_ENABLED:"1",
  HEALTH_CHECK_KEY:"synthetic_health_key_123456789012345"};
 assert.throws(()=>readConfig(flags),/REG01G invite gate/);
});
test("01G: teardown",async()=>admin.end());
