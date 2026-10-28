// One-time, manually dispatched closed-beta credential bootstrap.
// Does NOT activate real registration, moderation, chat or geocoder flags.
// This script must NEVER print URLs, DB passwords, API keys or the session pepper.
import {randomBytes} from "node:crypto";
import {Client} from "pg";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";

const PROJECT="czzyoxrwtnvbicypwrdd";
const RENDER_SERVICE="srv-dbahj0e7bikc73elkcv0";
export function admissionNamespace(mode){
 if(mode==="open")return "luemi-production";
 if(mode==="beta")return "luemi-beta-20261027";
 throw Error("Select approved open or beta admission mode");
}
export const ROLES=Object.freeze([
 ["luemi_beta_auth","luemi_auth_issuer","REM05B_AUTH_DATABASE_URL"],
 ["luemi_beta_request","luemi_request","REM05B_REQUEST_DATABASE_URL"],
 ["luemi_beta_media","luemi_media_worker","REM06_MEDIA_WORKER_DATABASE_URL"],
 ["luemi_beta_publisher","luemi_profile_publisher","REM06_PUBLISHER_DATABASE_URL"],
 ["luemi_beta_discovery","luemi_discovery_reader","REM06_DISCOVERY_DATABASE_URL"],
 ["luemi_beta_chats","luemi_chats_writer","LUEMI_CHATS_DATABASE_URL"],
 ["luemi_beta_matches","luemi_match_writer","LUEMI_MATCHES_DATABASE_URL"],
 ["luemi_beta_geo","luemi_geo_budget","REM05C_BUDGET_DATABASE_URL"]
]);

export function validateOwnerConnection(raw){
 if(typeof raw!=="string"||raw.length>2048)throw Error("Use the Supabase Connect SESSION pooler URL");
 let url;
 try{url=new URL(raw);}catch{throw Error("Invalid Supabase session pooler URL");}
 if(!["postgres:","postgresql:"].includes(url.protocol)||
    !/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname)||
    url.port!=="5432"||url.pathname!=="/postgres"||
    decodeURIComponent(url.username)!=="postgres."+PROJECT||
    !url.password||url.hash||url.searchParams.has("options"))
  throw Error("Owner DB URL must match the correct LUEMI project SESSION pooler on port 5432");
 return url;
}
export function makeScopedConnection(owner,role,password){
 if(!ROLES.some(([name])=>name===role)||!/^[a-f0-9]{64}$/.test(password))
  throw Error("Invalid scoped database principal");
 const url=new URL(owner.href);
 url.username=encodeURIComponent(role+"."+PROJECT);
 url.password=password;
 url.searchParams.set("sslmode","require");
 return url.toString();
}
export function checkRoleMetadata(rows){
 if(rows.length!==ROLES.length)throw Error("Database beta roles incomplete");
 for(const [name,group] of ROLES){
  const row=rows.find(item=>item.rolname===name);
  if(!row||row.rolcanlogin||row.rolsuper||row.rolbypassrls||
    row.rolcreatedb||row.rolcreaterole||row.count_memberships!==1||
    row.member_of!==group)
   throw Error("Unsafe beta role: "+name);
 }
}
async function setRenderEnv(apiKey,key,value){
 const response=await fetch(
  "https://api.render.com/v1/services/"+RENDER_SERVICE+"/env-vars/"+encodeURIComponent(key),{
  method:"PUT",
  headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json",
   "Accept":"application/json"},
  body:JSON.stringify({value}),
  signal:AbortSignal.timeout(12000),
  redirect:"error",
 });
 // Never output response bodies: Render can echo secrets in the JSON response.
 await response.body?.cancel();
 if(!response.ok)throw Error("Render environment write denied: "+key+" (HTTP "+response.status+")");
}

async function readRenderEnv(apiKey,key){
 const response=await fetch(
  "https://api.render.com/v1/services/"+RENDER_SERVICE+"/env-vars/"+encodeURIComponent(key),{
  headers:{"Authorization":"Bearer "+apiKey,"Accept":"application/json"},
  signal:AbortSignal.timeout(12000),redirect:"error"
 });
 if(response.status===404){await response.body?.cancel();return null;}
 if(!response.ok){
  await response.body?.cancel();
  throw Error("Render environment read denied: "+key+" (HTTP "+response.status+")");
 }
 // The response contains production credentials. Never log it.
 const value=await response.json();
 if(value?.key!==key||typeof value.value!=="string"||value.value.length>2048)
  throw Error("Invalid stored Render environment value: "+key);
 return value.value;
}
export function validateSavedScopedConnection(owner,role,raw){
 if(typeof raw!=="string"||raw.length>2048)throw Error("Invalid stored scoped role URL");
 let parsed;
 try{parsed=new URL(raw);}catch{throw Error("Invalid stored scoped role URL");}
 if(!/^[a-f0-9]{64}$/.test(parsed.password)||
    parsed.href!==makeScopedConnection(owner,role,parsed.password))
  throw Error("Stored scoped role URL does not match approved LUEMI connection");
 return parsed.password;
}
async function loadPreviousCredentials(apiKey,owner,namespace){
 // Restore the previously generated, strong and already persisted credentials
 // after a failed attempt; rotating each retry defeats Supavisor auth caching.
 const found=await Promise.all(ROLES.map(async ([name,,key])=>({
  name,raw:await readRenderEnv(apiKey,key)
 })));
 const present=found.filter(x=>x.raw!==null);
 if(!present.length)return null;
 if(present.length!==ROLES.length)
  throw Error("Partial stored Render credentials; abort rather than rotate blindly");
 const credentials=new Map(found.map(({name,raw})=>[
  name,validateSavedScopedConnection(owner,name,raw)
 ]));
 const pepper=await readRenderEnv(apiKey,"REM05B_SESSION_PEPPER");
 const storedNamespace=await readRenderEnv(apiKey,"REM05B_BOT_NAMESPACE");
 if(!/^[a-f0-9]{64}$/.test(pepper??"")||storedNamespace!==namespace)
  throw Error("Stored session pepper or namespace mismatch; refusing unsafe reuse");
 return {credentials,pepper};
}
export function classifyScopedConnectionFailure(error){
 const code=typeof error?.code==="string"?error.code:"";
 const message=typeof error?.message==="string"?error.message.toLowerCase():"";
 if(code==="28P01"||/password authentication failed|invalid password/.test(message))return "AUTH_REJECTED";
 if(/tenant.*not found|user.*not found/.test(message))return "TENANT_USER_NOT_FOUND";
 if(/circuit breaker/.test(message))return "POOLER_CIRCUIT_BREAKER";
 if(/eauthquery|unsupported or invalid secret format/.test(message))return "POOLER_AUTH_QUERY";
 if(code==="42501"||/permission denied/.test(message))return "PERMISSION_DENIED";
 if(code==="ECONNREFUSED"||/connection refused/.test(message))return "CONNECTION_REFUSED";
 if(code==="ETIMEDOUT"||/timeout|timed out/.test(message))return "TIMEOUT";
 if(/certificate|\bssl\b|\btls\b/.test(message))return "TLS_FAILURE";
 return "OTHER";
}

const delay=ms=>new Promise(done=>setTimeout(done,ms));
// Supavisor can briefly cache a previous password/NOLOGIN state following a
// role rotation. Never retry a successful connection whose RLS/session check is
// unsafe. Retry only connection failures with bounded, spaced attempts.
async function checkConnection(url,role,group){
 let lastFailure="OTHER";
 const maxAttempts=6;
 for(let attempt=0;attempt<maxAttempts;attempt++){
  const db=new Client({connectionString:url,connectionTimeoutMillis:5000});
  let phase="connect";
  try{
   await db.connect();
   phase="verify";
   const {rows}=await db.query(
    "SELECT current_user AS principal,session_user AS sess,"+
    "current_setting('row_security') AS rls,"+
    "pg_has_role(current_user,$1::name,'member') AS member,"+
    "(SELECT NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole "+
    "AND NOT rolcreatedb FROM pg_roles WHERE rolname=current_user) AS safe",
    [group]);
   if(rows[0]?.principal!==role||rows[0]?.sess!==role||
     rows[0]?.rls!=="on"||rows[0]?.member!==true||rows[0]?.safe!==true)
    throw Error("Unsafe scoped role session: "+role);
   return;
  }catch(error){
   if(error instanceof Error&&error.message.startsWith("Unsafe scoped role session:"))
    throw error;
   // Never log DB errors verbatim: server strings may include sensitive data.
   lastFailure=classifyScopedConnectionFailure(error);
   // Only temporary pooler credential propagation receives bounded retries.
   if(phase==="verify"||!["AUTH_REJECTED","TIMEOUT","CONNECTION_REFUSED"].includes(lastFailure)||
      attempt===maxAttempts-1)
    throw Error("Scoped connection failed: "+role+" ("+phase+", "+lastFailure+
     "); check Supavisor authentication without weakening RLS");
   await delay(7000);
  }finally{await db.end().catch(()=>{});}
 }
}
export async function bootstrap({
 ownerUrl=process.env.BETA_SUPABASE_OWNER_URL,
 renderApiKey=process.env.BETA_RENDER_API_KEY,
 admissionMode=process.env.LUEMI_BOOTSTRAP_MODE??"open"
}={}){
 const namespace=admissionNamespace(admissionMode);
 if(typeof renderApiKey!=="string"||renderApiKey.length<20)
  throw Error("BETA_RENDER_API_KEY is missing");
 const owner=validateOwnerConnection(ownerUrl);
 const db=new Client({connectionString:owner.href,connectionTimeoutMillis:7000});
 // Reuse complete, previously stored credentials rather than rotating on every
 // retry. The failed-run rollback leaves roles NOLOGIN but preserves valid secrets.
 const saved=await loadPreviousCredentials(renderApiKey,owner,namespace);
 const credentials=saved?.credentials??new Map(ROLES.map(([name])=>[name,randomBytes(32).toString("hex")]));
 const pepper=saved?.pepper??randomBytes(32).toString("hex");
 let connected=false;
 try{
  await db.connect();connected=true;
  const result=await db.query(
   "SELECT r.rolname,r.rolcanlogin,r.rolsuper,r.rolbypassrls,"+
   "r.rolcreatedb,r.rolcreaterole,COUNT(g.oid)::int AS count_memberships,"+
   "MAX(g.rolname) AS member_of FROM pg_roles r "+
   "LEFT JOIN pg_auth_members m ON m.member=r.oid "+
   "LEFT JOIN pg_roles g ON g.oid=m.roleid "+
   "WHERE r.rolname LIKE 'luemi_beta_%' "+
   "GROUP BY r.oid,r.rolname,r.rolcanlogin,r.rolsuper,"+
   "r.rolbypassrls,r.rolcreatedb,r.rolcreaterole");
  // Check ten roles, including NOLOGIN human-review and erasure accounts;
  // ordinary API roles must never inherit either operator's grant.
  const appRows=result.rows.filter(r=>ROLES.some(([name])=>name===r.rolname));
  checkRoleMetadata(appRows);
  for(const operator of ["luemi_beta_human","luemi_beta_erasure"]){
   const row=result.rows.find(r=>r.rolname===operator);
   if(!row||row.rolcanlogin||row.rolsuper||row.rolbypassrls)
    throw Error("Unsafe operator shell: "+operator);
  }
  if(admissionMode==="beta"){
   const invites=await db.query(
    "SELECT COUNT(*)::int AS active FROM luemi_private.beta_invites "+
    "WHERE environment=$1 AND state='active'",[namespace]);
   if(invites.rows[0]?.active!==2)
    throw Error("Refusing beta bootstrap: expected exactly two active invitations");
  }
  // Open registration has no invitation dependency: verified Telegram
  // credentials, privacy, profile/matches RLS and moderation still apply.
  // The script NEVER activates open signup, private media, or chats.
  // Preserve previously provisioned passwords and session pepper on retry:
  // re-running ALTER ROLE PASSWORD invalidates Supavisor's credential cache.
  // Roles remain NOLOGIN until all Render credentials are persisted.
  if(!saved){
   await db.query("BEGIN");
   try{
    for(const [name] of ROLES){
     const secret=credentials.get(name);
     await db.query("ALTER ROLE "+name+" WITH NOLOGIN PASSWORD '"+secret+"'");
    }
    await db.query("COMMIT");
   }catch(error){await db.query("ROLLBACK").catch(()=>{});throw error;}
   for(const [name,,renderKey] of ROLES){
    const url=makeScopedConnection(owner,name,credentials.get(name));
    await setRenderEnv(renderApiKey,renderKey,url);
   }
   await setRenderEnv(renderApiKey,"REM05B_SESSION_PEPPER",pepper);
   await setRenderEnv(renderApiKey,"REM05B_BOT_NAMESPACE",namespace);
  }
  await db.query("BEGIN");
  try{
   for(const [name] of ROLES)await db.query("ALTER ROLE "+name+" WITH LOGIN");
   await db.query("COMMIT");
  }catch(error){await db.query("ROLLBACK").catch(()=>{});throw error;}
  // A newly enabled LOGIN role may still appear NOLOGIN to Supavisor until
  // the pooler's credential cache refreshes. Allow propagation before probing.
  await delay(15000);
  for(const [name,group] of ROLES)
   await checkConnection(makeScopedConnection(owner,name,credentials.get(name)),name,group);
  console.info("LUEMI_DB_BOOTSTRAP_OK: 8 isolated LOGIN roles verified; Render credentials installed; admission="+admissionMode+".");
  console.info("Feature flags remain OFF. No registration, storage review, or chat access was activated.");
 }catch(error){
  // Feature flags are OFF. Disable every known app role if bootstrap is partial;
  // Render may contain unusable credentials but can never connect after fail.
  if(connected){
   await db.query("ROLLBACK").catch(()=>{});
   try{
    await db.query("BEGIN");
    for(const [name] of ROLES)await db.query("ALTER ROLE "+name+" WITH NOLOGIN");
    await db.query("COMMIT");
   }catch{
    await db.query("ROLLBACK").catch(()=>{});
    console.error("Security rollback needs operator verification.");
   }
  }
  console.error("LUEMI_DB_BOOTSTRAP_FAILED (no secrets logged): "+(error instanceof Error?error.message:"unknown"));
  console.error("Do not enable any runtime feature flag. Check role LOGIN states and rerun only after resolving the cause.");
  process.exitCode=1;
 }finally{
  await db.end().catch(()=>{});
 }
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 await bootstrap();
}
