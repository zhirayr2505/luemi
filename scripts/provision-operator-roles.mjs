// Manually authorized provisioning of distinct, least-privilege operator logins.
// NO feature flags are enabled; the script never logs credentials or database values.
import {randomBytes,createHmac} from "node:crypto";
import {Client} from "pg";
import {validateOwnerConnection,makeEncryptedConnection,assertEncryptedClient} from "./closed-beta-bootstrap.mjs";
const PROJECT="czzyoxrwtnvbicypwrdd",SERVICE="srv-dbahj0e7bikc73elkcv0";
const ROLES=Object.freeze([
 ["luemi_ops_erasure_request","luemi_erasure_requester","REM06_ERASURE_REQUEST_DATABASE_URL"],
 ["luemi_ops_erasure_worker","luemi_erasure_worker","REM06_ERASURE_WORKER_DATABASE_URL"],
 ["luemi_ops_safety","luemi_safety_operator","REG01H_SAFETY_OPERATOR_DATABASE_URL"],
 ["luemi_ops_reports","luemi_human_moderator","REG01G_MODERATOR_DATABASE_URL"]
]);
const SEED="LUEMI_OPERATOR_BOOTSTRAP_SEED";
const CONFIRM="PROVISION_LUEMI_PROTECTED_OPERATORS";
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const secretFor=(seed,name)=>createHmac("sha256",Buffer.from(seed,"hex")).update("luemi-ops-v1:"+name).digest("hex");
function scopedUrl(owner,name,password){
 const url=makeEncryptedConnection(owner);
 url.username=name+"."+PROJECT;url.password=password;
 return url.toString();
}
async function renderValue(token,key){
 const res=await fetch("https://api.render.com/v1/services/"+SERVICE+"/env-vars/"+encodeURIComponent(key),
  {headers:{Authorization:"Bearer "+token,Accept:"application/json"},
   redirect:"error",signal:AbortSignal.timeout(16000),cache:"no-store"});
 if(res.status===404){await res.body?.cancel();return null;}
 if(!res.ok){await res.body?.cancel();throw Error("render_read_refused:"+key);}
 const body=await res.json(); // CONTAINS SECRET: never print
 const v=body?.envVar??body;
 assert(v?.key===key&&typeof v.value==="string"&&v.value.length<=2048,"invalid_render_variable");
 return v.value;
}
async function setRender(token,key,value){
 const res=await fetch("https://api.render.com/v1/services/"+SERVICE+"/env-vars/"+encodeURIComponent(key),
  {method:"PUT",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json",Accept:"application/json"},
   body:JSON.stringify({value}),redirect:"error",signal:AbortSignal.timeout(16000)});
 await res.body?.cancel(); // some API responses echo the secret
 if(!res.ok)throw Error("render_write_refused:"+key);
}
async function verify(db,role,parent){
 const query=await db.query(
  "SELECT r.rolcanlogin,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole, "+
  "(SELECT count(*)::int FROM pg_auth_members m WHERE m.member=r.oid) AS memberships, "+
  "pg_has_role(r.rolname,$2::name,'member') AS member "+
  "FROM pg_roles r WHERE r.rolname=$1",[role,parent]);
 const r=query.rows[0];
 assert(query.rowCount===1&&r.rolcanlogin&&!r.rolsuper&&!r.rolbypassrls&&
  !r.rolcreatedb&&!r.rolcreaterole&&r.memberships===1&&r.member===true,
  "operator_role_verification_failed:"+role);
}
async function connectScoped(owner,role,parent,password){
 const db=new Client({connectionString:scopedUrl(owner,role,password),connectionTimeoutMillis:6000});
 try{
  await db.connect();assertEncryptedClient(db);
  const r=await db.query("SELECT current_user AS principal,session_user AS sess, "+
   "current_setting('row_security') AS rls, "+
   "pg_has_role(current_user,$1::name,'member') AS member",[parent]);
  assert(r.rows[0]?.principal===role&&r.rows[0]?.sess===role&&
   r.rows[0]?.rls==="on"&&r.rows[0]?.member===true,"unsafe_operator_login");
 }finally{await db.end().catch(()=>{});}
}
async function main(){
 assert(process.env.GITHUB_ACTIONS==="true"&&
  process.env.GITHUB_REPOSITORY==="zhirayr2505/luemi"&&
  process.env.GITHUB_REF==="refs/heads/main"&&
  process.env.GITHUB_EVENT_NAME==="workflow_dispatch"&&
  process.env.GITHUB_ACTOR==="zhirayr2505"&&
  process.env.LUEMI_OPERATOR_CONFIRM===CONFIRM,"owner_confirmation_required");
 const token=process.env.BETA_RENDER_API_KEY;
 assert(typeof token==="string"&&token.length>20,"protected_render_secret_missing");
 const owner=validateOwnerConnection(process.env.BETA_SUPABASE_OWNER_URL);
 let seed=await renderValue(token,SEED);
 if(seed!==null)assert(/^[a-f0-9]{64}$/.test(seed),"invalid_operator_seed");
 else {seed=randomBytes(32).toString("hex");await setRender(token,SEED,seed);}
 const entries=ROLES.map(([role,parent,key])=>({role,parent,key,password:secretFor(seed,role)}));
 // Refuse to replace any unrelated or manually created credential.
 for(const e of entries){
  const existing=await renderValue(token,e.key);
  if(existing!==null)assert(existing===scopedUrl(owner,e.role,e.password),
   "operator_credential_conflict:"+e.key);
 }
 const db=new Client({connectionString:makeEncryptedConnection(owner).href,connectionTimeoutMillis:7000});
 let connected=false;
 try{
  await db.connect();connected=true;assertEncryptedClient(db);
  await db.query("BEGIN");
  try{
   for(const e of entries){
    const existing=await db.query("SELECT rolcanlogin FROM pg_roles WHERE rolname=$1",[e.role]);
    if(existing.rowCount===0)await db.query("CREATE ROLE "+e.role+" WITH NOLOGIN INHERIT");
    await db.query("GRANT "+e.parent+" TO "+e.role);
    // A 64-character random HMAC digest is ASCII hex and SQL-safe after validation.
    await db.query("ALTER ROLE "+e.role+" WITH NOLOGIN PASSWORD '"+e.password+"'");
   }
   await db.query("COMMIT");
  }catch{await db.query("ROLLBACK").catch(()=>{});throw Error("operator_role_staging_failed");}
  for(const e of entries)await setRender(token,e.key,scopedUrl(owner,e.role,e.password));
  // If write fails, the newly staged NOLOGIN roles remain incapable of authenticating.
  await db.query("BEGIN");
  try{
   for(const e of entries)await db.query("ALTER ROLE "+e.role+" WITH LOGIN");
   await db.query("COMMIT");
  }catch{await db.query("ROLLBACK").catch(()=>{});throw Error("operator_enable_failed");}
  for(const e of entries)await verify(db,e.role,e.parent);
  // Supavisor may cache prior NOLOGIN/password states. Retry only a small,
  // bounded number of times; never waive the identity/TLS/RLS checks.
  for(const e of entries){
   let passed=false;
   for(let attempt=0;attempt<5;attempt++){
    try{await connectScoped(owner,e.role,e.parent,e.password);passed=true;break;}
    catch{
     if(attempt<4)await new Promise(done=>setTimeout(done,6000));
    }
   }
   assert(passed,"operator_connection_not_verified:"+e.role);
  }
  process.stdout.write("LUEMI_OPERATOR_LOGIN_PROVISIONED: 4 isolated credentials verified; no feature flags activated.\n");
 }catch{
  // Fail closed on a first provision attempt. Never disable an already-live operator.
  if(connected){
   const current=await Promise.all(entries.map(e=>renderValue(token,e.key).catch(()=>null)));
   if(current.some((v,i)=>v===null))for(const e of entries)
    await db.query("ALTER ROLE "+e.role+" WITH NOLOGIN").catch(()=>{});
  }
  throw Error("operator_provisioning_not_verified");
 }finally{await db.end().catch(()=>{});}
}
main().catch(()=>{process.stderr.write("LUEMI_OPERATOR_PROVISION_FAILED; no credentials printed.\n");process.exitCode=1;});
