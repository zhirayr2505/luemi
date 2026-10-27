/**
 * Operator-approved LUEMI public release. Must run ONLY in a protected GitHub
 * Actions environment; secrets are NEVER logged or committed.
 * Preconditions: scoped DB bootstrap succeeded, real privacy notice reviewed,
 * actual Supabase private Storage secret, Geoapify key, and owner support chat.
 */
import {Client} from "pg";
import {ROLES,validateOwnerConnection} from "./closed-beta-bootstrap.mjs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";

const REF="czzyoxrwtnvbicypwrdd";
const SERVICE="srv-dbahj0e7bikc73elkcv0";
const ROOT="https://api.render.com/v1/services/"+SERVICE;
const PUBLIC_FLAGS=Object.freeze({
 REM05B_SESSIONS_ENABLED:"1",
 REM05B_BOT_NAMESPACE:"luemi-production",
 REM06_OPEN_SIGNUPS_ENABLED:"1",
 REM06_OPEN_SIGNUPS_APPROVED:"1",
 REM06_BETA_INVITES_ENABLED:"0",
 REM06_BETA_INVITES_APPROVED:"0",
 REM05D_PRIVATE_ENABLED:"0",
 REM05D_PUBLICATION_ENABLED:"0",
 REM06_SAFETY_APPEALS_ENABLED:"0",
 REM06_PRIVACY_APPROVED:"1",
 REM06_CONSENT_VERSION:"luemi-public-v1",
 REM06_PRIVATE_DRAFT_ENABLED:"1",
 REM06_MEDIA_ENABLED:"1",
 REM06_MEDIA_BUCKET:"luemi-profile-private",
 REM06_SUPABASE_PROJECT_REF:REF,
 REM06_PUBLICATION_ENABLED:"1",
 REM06_MODERATION_OPERATIONAL_APPROVED:"0",
 REM06_AUTOPUBLISH_PHOTOS_ENABLED:"1",
 REM06_AUTOPUBLISH_APPROVED:"1",
 REM06_ERASURE_REQUEST_ENABLED:"1",
 REM06_ERASURE_POLICY_APPROVED:"1",
 LUEMI_CHATS_V1_ENABLED:"1",
 LUEMI_CHATS_POLICY_APPROVED:"1",
 LUEMI_CHATS_MEDIA_ENABLED:"1",
 LUEMI_CHATS_MEDIA_BUCKET:"luemi-chat-private",
 LUEMI_MATCHES_V1_ENABLED:"1",
 LUEMI_MATCHES_POLICY_APPROVED:"1",
 REM05C_ENABLED:"1",
 REM05C_GEO_PROVIDER_ENABLED:"1",
 REM05C_SEARCH_DAILY:"20",
 REM05C_REVERSE_DAILY:"6",
 REM05C_GLOBAL_DAILY_CAP:"100",
 REM05C_VENDOR_DAILY_QUOTA:"100",
 REM05C_MAX_INFLIGHT:"2",
 VITE_LUEMI_REAL_ONLY:"1",
 VITE_LUEMI_AUTH_V2:"1",
 VITE_LUEMI_PRIVATE_DRAFT_UI:"1",
 VITE_LUEMI_PRIVATE_MEDIA_UI:"1",
 VITE_LUEMI_REAL_DISCOVERY_UI:"1",
 VITE_LUEMI_REAL_MATCHES:"1",
 VITE_LUEMI_REAL_CHATS:"1",
 VITE_LUEMI_CHATS_DEMO:"0",
 VITE_LUEMI_GEO_PROVIDER_ENABLED:"1",
 VITE_LUEMI_AUTOPUBLISH_PHOTOS:"1",
 VITE_LUEMI_CONSENT_VERSION:"luemi-public-v1",
 VITE_LUEMI_PRIVACY_POLICY_PATH:"/privacy"
});
export function releaseFlags(){return {...PUBLIC_FLAGS};}
export function validStorageSecret(value){
 return typeof value==="string"&&(
  /^sb_secret_[A-Za-z0-9_-]{24,}$/.test(value)||
  /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value));
}
export function verifyScopedRoles(rows){
 if(rows.length!==ROLES.length)throw Error("Missing isolated DB logins");
 for(const [name,group] of ROLES){
  const r=rows.find(v=>v.rolname===name);
  if(!r||!r.rolcanlogin||r.rolsuper||r.rolbypassrls||r.rolcreaterole||
     r.rolcreatedb||Number(r.memberships)!==1||r.member_of!==group)
   throw Error("Unsafe scoped role: "+name);
 }
}
async function api(apiKey,path,method="GET",body){
 const r=await fetch("https://api.render.com/v1"+path,{
  method,headers:{Authorization:"Bearer "+apiKey,Accept:"application/json",
    ...(body===undefined?{}:{"Content-Type":"application/json"})},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
  redirect:"error",signal:AbortSignal.timeout(16000)});
 if(!r.ok){await r.body?.cancel();throw Error("Render operation denied ("+method+" "+r.status+")");}
 return r.json();
}
async function readEnv(apiKey){
 const out=new Map();let cursor,turns=0;
 do{
  const url=new URL(ROOT+"/env-vars");
  url.searchParams.set("limit","100");
  if(cursor)url.searchParams.set("cursor",cursor);
  const rows=await api(apiKey,url.pathname+url.search);
  if(!Array.isArray(rows))throw Error("Unexpected Render environment shape");
  for(const item of rows){
   if(typeof item?.envVar?.key!=="string"||typeof item.envVar.value!=="string")
    throw Error("Render environment entry lacks a usable value");
   if(/^\\*{3,}$/.test(item.envVar.value)||item.envVar.value==="[REDACTED]")
    throw Error("Render returned a masked secret; refusing unsafe bulk overwrite");
   out.set(item.envVar.key,item.envVar.value);
  }
  cursor=rows.length===100?rows.at(-1)?.cursor:undefined;
  if(++turns>6)throw Error("Too many environment pages");
 }while(cursor);
 return out;
}
async function saveEnv(apiKey,vars){
 const payload=[...vars].map(([key,value])=>({key,value}));
 const output=await api(apiKey,"/services/"+SERVICE+"/env-vars","PUT",payload);
 if(!Array.isArray(output))throw Error("Render did not accept full environment set");
 // Never print any of the response (it may contain passwords).
}
async function deploy(apiKey){
 const result=await api(apiKey,"/services/"+SERVICE+"/deploys","POST",
  {clearCache:"clear",deployMode:"build_and_deploy"});
 if(!/^dep-[a-z0-9]+$/.test(result?.id??""))throw Error("Invalid deployment receipt");
 return result.id;
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitLive(apiKey,id){
 for(let i=0;i<32;i++){
  const d=await api(apiKey,"/services/"+SERVICE+"/deploys/"+id);
  if(d.status==="live")return;
  if(["build_failed","update_failed","canceled","pre_deploy_failed"].includes(d.status))
   throw Error("Render public deploy failed: "+d.status);
  await pause(7000);
 }
 throw Error("Render public deploy not confirmed");
}
async function checkScopedConnection(url,principal,group){
 const db=new Client({connectionString:url,connectionTimeoutMillis:6000});
 try{
  await db.connect();
  const q=await db.query("SELECT current_user AS principal, session_user AS sess,"+
   "current_setting('row_security') AS rls,"+
   "pg_has_role(current_user,$1::name,'member') AS member,"+
   "(SELECT NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole FROM pg_roles WHERE rolname=current_user) AS safe",
   [group]);
  const row=q.rows[0];
  if(row?.principal!==principal||row?.sess!==principal||
    row?.rls!=="on"||row?.member!==true||row?.safe!==true)
   throw Error("Unsafe DB role: "+principal);
 }finally{await db.end().catch(()=>{});}
}
async function checkDatabase(ownerUrl,env){
 const owner=new Client({connectionString:ownerUrl,connectionTimeoutMillis:7000});
 try{
  await owner.connect();
  const rows=(await owner.query("SELECT r.rolname,r.rolcanlogin,r.rolsuper,r.rolbypassrls,"+
   "r.rolcreaterole,r.rolcreatedb,count(g.oid)::int AS memberships,max(g.rolname) AS member_of "+
   "FROM pg_roles r LEFT JOIN pg_auth_members m ON m.member=r.oid "+
   "LEFT JOIN pg_roles g ON g.oid=m.roleid WHERE r.rolname LIKE 'luemi_beta_%' "+
   "GROUP BY r.oid,r.rolname,r.rolcanlogin,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb")).rows;
  verifyScopedRoles(rows.filter(row=>ROLES.some(([name])=>name===row.rolname)));
  const buckets=(await owner.query("SELECT id,public FROM storage.buckets WHERE id IN ('luemi-profile-private','luemi-chat-private')")).rows;
  if(buckets.length!==2||buckets.some(r=>r.public!==false))throw Error("Private Storage buckets missing");
  const profileSchema=(await owner.query("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid "+
   "WHERE n.nspname IN ('luemi_private','luemi_chats') AND c.relkind='r' "+
   "AND c.relname IN ('actors','sessions','private_profile_drafts','media_assets','public_profiles','matches','conversations','messages') "+
   "AND c.relrowsecurity AND c.relforcerowsecurity")).rows[0]?.n;
  if(profileSchema!==8)throw Error("Expected RLS-protected tables missing");
 }finally{await owner.end().catch(()=>{});}
 for(const [name,group,envKey] of ROLES){
  const value=env.get(envKey);
  if(!value||!value.startsWith("postgres"))throw Error("Scoped Render connection missing: "+envKey);
  const u=new URL(value);
  if(decodeURIComponent(u.username)!==name+"."+REF||
     !/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(u.hostname)||
     u.port!=="5432")throw Error("Incorrect scoped DB URL: "+envKey);
  await checkScopedConnection(value,name,group);
 }
}
export async function activate({
 ownerUrl=process.env.BETA_SUPABASE_OWNER_URL,
 apiKey=process.env.BETA_RENDER_API_KEY,
 storageSecret=process.env.PUBLIC_SUPABASE_STORAGE_SECRET,
 geoKey=process.env.PUBLIC_GEOAPIFY_API_KEY,
 approval=process.env.PUBLIC_RELEASE_APPROVAL
}={}){
 if(approval!=="RELEASE_PUBLIC_REAL_USERS"||
   !validStorageSecret(storageSecret)||
   typeof apiKey!=="string"||apiKey.length<20||
   typeof geoKey!=="string"||geoKey.length<16)
  throw Error("Protected operator approval, Render key, private Storage secret and Geoapify key required");
 const owner=validateOwnerConnection(ownerUrl);
 const previous=await readEnv(apiKey);
 if(previous.get("APP_ORIGIN")!=="https://luemi.onrender.com"||
    !previous.has("TELEGRAM_BOT_TOKEN")||!previous.has("HEALTH_CHECK_KEY")||
    !previous.has("REM05B_SESSION_PEPPER")||
    previous.get("STAGING_BOOTSTRAP_ONLY")==="1")
  throw Error("Live Render configuration missing Telegram or cryptographic secrets");
 await checkDatabase(owner.href,previous);
 const next=new Map(previous);
 for(const [key,value] of Object.entries(PUBLIC_FLAGS))next.set(key,value);
 next.set("REM06_SUPABASE_STORAGE_SECRET",storageSecret);
 next.set("GEOAPIFY_API_KEY",geoKey);
 const support=next.get("LUEMI_SUPPORT_TELEGRAM_CHAT_ID");
 if(!support||!/^\d{5,15}$/.test(support))throw Error("Working Telegram support owner chat ID required");
 await saveEnv(apiKey,next);
 try{
  const id=await deploy(apiKey);
  await waitLive(apiKey,id);
  const policy=await fetch("https://luemi.onrender.com/privacy.html",{redirect:"error",signal:AbortSignal.timeout(10000)});
  if(!policy.ok)throw Error("Privacy notice missing on production");
  await policy.body?.cancel();
  const unauth=await fetch("https://luemi.onrender.com/api/v2/auth/telegram",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({initData:"invalid"}),signal:AbortSignal.timeout(10000)});
  if(unauth.status!==401&&unauth.status!==403)throw Error("Telegram authentication guard not active");
  await unauth.body?.cancel();
  console.info("LUEMI_PUBLIC_RELEASE_LIVE: verified open registration, private media, matching and geo configured. Deploy "+id);
 }catch(e){
  try{
   await saveEnv(apiKey,previous);
   const id=await deploy(apiKey);
   console.error("LUEMI_PUBLIC_RELEASE_ROLLBACK_REQUESTED: "+id);
  }catch{console.error("LUEMI_PUBLIC_RELEASE_ROLLBACK_NEEDS_OPERATOR");}
  throw e;
 }
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 try{await activate();}
 catch(e){
  // The exception should only contain static messages authored in this source.
  console.error("LUEMI_PUBLIC_RELEASE_FAILED: "+(e instanceof Error?e.message:"unknown"));
  process.exitCode=1;
 }
}
