// One-time, manually dispatched closed-beta credential bootstrap.
// Does NOT activate real registration, moderation, chat or geocoder flags.
// This script must NEVER print URLs, DB passwords, API keys or the session pepper.
import {randomBytes} from "node:crypto";
import {Client} from "pg";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";

const PROJECT="czzyoxrwtnvbicypwrdd";
const RENDER_SERVICE="srv-dbahj0e7bikc73elkcv0";
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
const delay=ms=>new Promise(done=>setTimeout(done,ms));
async function checkConnection(url,role,group){
 for(let attempt=0;attempt<4;attempt++){
  const db=new Client({connectionString:url,connectionTimeoutMillis:4000});
  try{
   await db.connect();
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
  }catch{
   if(attempt===3)throw Error("Scoped connection failed: "+role+"; check Supavisor role cache and Render URLs");
   await delay(1200);
  }finally{await db.end().catch(()=>{});}
 }
}
export async function bootstrap({
 ownerUrl=process.env.BETA_SUPABASE_OWNER_URL,
 renderApiKey=process.env.BETA_RENDER_API_KEY
}={}){
 if(typeof renderApiKey!=="string"||renderApiKey.length<20)
  throw Error("BETA_RENDER_API_KEY is missing");
 const owner=validateOwnerConnection(ownerUrl);
 const db=new Client({connectionString:owner.href,connectionTimeoutMillis:7000});
 const credentials=new Map(ROLES.map(([name])=>[name,randomBytes(32).toString("hex")]));
 const pepper=randomBytes(32).toString("hex");
 const configured=[];
 try{
  await db.connect();
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
  // Keep the DB roles NOLOGIN until ALL credentials exist in Render.
  await db.query("BEGIN");
  try{
   for(const [name] of ROLES){
    const secret=credentials.get(name);
    // Names are compile-time constants and passwords are fixed-format random hex.
    await db.query("ALTER ROLE "+name+" WITH NOLOGIN PASSWORD '"+secret+"'");
   }
   await db.query("COMMIT");
  }catch(error){await db.query("ROLLBACK").catch(()=>{});throw error;}
  for(const [name,,renderKey] of ROLES){
   const url=makeScopedConnection(owner,name,credentials.get(name));
   await setRenderEnv(renderApiKey,renderKey,url);
   configured.push(renderKey);
  }
  await setRenderEnv(renderApiKey,"REM05B_SESSION_PEPPER",pepper);
  await db.query("BEGIN");
  try{
   for(const [name] of ROLES)await db.query("ALTER ROLE "+name+" WITH LOGIN");
   await db.query("COMMIT");
  }catch(error){await db.query("ROLLBACK").catch(()=>{});throw error;}
  for(const [name,group] of ROLES)
   await checkConnection(makeScopedConnection(owner,name,credentials.get(name)),name,group);
  console.info("BETA_DB_BOOTSTRAP_OK: 8 isolated LOGIN roles verified; Render credentials installed.");
  console.info("Feature flags remain OFF. No registration, storage review, or chat access was activated.");
 }catch(error){
  // Feature flags are OFF. Disable every known app role if bootstrap is partial;
  // Render may contain unusable credentials but can never connect after fail.
  await db.query("BEGIN").catch(()=>{});
  for(const [name] of ROLES){
   try{await db.query("ALTER ROLE "+name+" WITH NOLOGIN");}catch{/* failure reported below */}
  }
  await db.query("COMMIT").catch(()=>{});
  console.error("BETA_DB_BOOTSTRAP_FAILED (no secrets logged): "+(error instanceof Error?error.message:"unknown"));
  console.error("Do not enable any runtime feature flag. Check role LOGIN states and rerun only after resolving the cause.");
  process.exitCode=1;
 }finally{
  await db.end().catch(()=>{});
 }
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 await bootstrap();
}
