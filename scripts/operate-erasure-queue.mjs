// Protected workflow: never print database URLs, tokens, user data or object keys.
// Can health-check isolated operator logins and process a small erasure outbox batch.
import {Client} from "pg";
import {createDurablePrivateStore} from "../apps/api/dist/real-private-storage.js";
import {runErasureBatch} from "../apps/api/dist/real-erasure-worker.js";
import {erasureRoleSafe} from "../apps/api/dist/real-erasure.js";
import {safeSafetyRole} from "../apps/api/dist/safety-operator.js";
import {listReviewQueue} from "../apps/api/dist/human-moderation.js";

const project="czzyoxrwtnvbicypwrdd",service="srv-dbahj0e7bikc73elkcv0";
const expected={
 REM06_ERASURE_REQUEST_DATABASE_URL:"luemi_ops_erasure_request",
 REM06_ERASURE_WORKER_DATABASE_URL:"luemi_ops_erasure_worker",
 REG01H_SAFETY_OPERATOR_DATABASE_URL:"luemi_ops_safety",
 REG01G_MODERATOR_DATABASE_URL:"luemi_ops_reports"
};
const allow=new Set([...Object.keys(expected),
 "REM05B_BOT_NAMESPACE","REM06_ERASURE_WORKER_ENABLED",
 "REM06_ERASURE_POLICY_APPROVED","REM06_ERASURE_MAINTENANCE_APPROVED",
 "REG01H_SAFETY_OPERATOR_ENABLED","REG01H_SAFETY_POLICY_APPROVED",
 "REG01G_HUMAN_REVIEW_ENABLED","REG01G_HUMAN_REVIEW_POLICY_APPROVED",
 "REG01H_OPERATOR_LABEL","REG01G_MODERATOR_LABEL",
 "REM06_MEDIA_BUCKET","REM06_SUPABASE_PROJECT_REF","REM06_SUPABASE_STORAGE_SECRET"]);
async function get(token,key){
 if(!allow.has(key))throw Error("unapproved_maintenance_key");
 const r=await fetch("https://api.render.com/v1/services/"+service+"/env-vars/"+encodeURIComponent(key),
  {headers:{Authorization:"Bearer "+token,Accept:"application/json"},redirect:"error",
   cache:"no-store",signal:AbortSignal.timeout(14000)});
 if(!r.ok){await r.body?.cancel();throw Error("missing_operator_config:"+key);}
 const body=await r.json(); // secret: never print
 const v=body?.envVar??body;
 if(v?.key!==key||typeof v.value!=="string"||!v.value||v.value.length>2048)
  throw Error("invalid_operator_config:"+key);
 return v.value;
}
function validateConnection(raw,role){
 const u=new URL(raw);
 if(!["postgres:","postgresql:"].includes(u.protocol)||
  !/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(u.hostname)||
  u.port!=="5432"||u.pathname!=="/postgres"||
  decodeURIComponent(u.username)!==role+"."+project||!u.password||
  u.searchParams.get("sslmode")!=="require")
  throw Error("invalid_scoped_operator_url");
 return raw;
}
async function roleProbe(raw,role,group,kind){
 const db=new Client({connectionString:validateConnection(raw,role),connectionTimeoutMillis:5000});
 try{
  await db.connect();
  if(db?.connection?.stream?.encrypted!==true)throw Error("unencrypted_operator_connection");
  const identity=await db.query(
   "SELECT current_user AS principal,session_user AS session,pg_has_role(current_user,$1::name,'member') AS member,"+
   "current_setting('row_security') AS rls",[group]);
  if(identity.rows[0]?.principal!==role||identity.rows[0]?.session!==role||
   identity.rows[0]?.member!==true||identity.rows[0]?.rls!=="on")
   throw Error("operator_identity_denied");
  if(kind==="request"&&!(await erasureRoleSafe(db,"luemi_erasure_requester")))
   throw Error("erasure_requester_role_denied");
  if(kind==="worker"&&!(await erasureRoleSafe(db,"luemi_erasure_worker")))
   throw Error("erasure_worker_role_denied");
  if(kind==="safety"&&!(await safeSafetyRole(db)))
   throw Error("safety_operator_role_denied");
 }finally{await db.end().catch(()=>{});}
}
let diagnosticPhase="scope";
async function main(){
 const action=process.env.LUEMI_OP_ACTION;
 if(process.env.GITHUB_ACTIONS!=="true"||
    process.env.GITHUB_REPOSITORY!=="zhirayr2505/luemi"||
    process.env.GITHUB_REF!=="refs/heads/main"||
    !["verify","erase"].includes(action))
  throw Error("protected_operator_scope_required");
 const onSchedule=process.env.GITHUB_EVENT_NAME==="schedule";
 if(onSchedule&&action!=="erase")throw Error("invalid_schedule");
 if(!onSchedule&&(process.env.GITHUB_EVENT_NAME!=="workflow_dispatch"||
   process.env.GITHUB_ACTOR!=="zhirayr2505"||
   process.env.LUEMI_OP_CONFIRM!==(action==="erase"?"RUN_LUEMI_APPROVED_ERASURE_BATCH":"RUN_LUEMI_OPERATOR_CHECK")))
  throw Error("owner_confirmation_required");
 const token=process.env.BETA_RENDER_API_KEY;
 if(typeof token!=="string"||token.length<20)throw Error("missing_protected_render_access");
 diagnosticPhase="namespace";
 const namespace=await get(token,"REM05B_BOT_NAMESPACE");
 // Read-only readiness must also work for the existing private beta.
 // Destructive maintenance stays production-only until the release gates pass.
 if(!["luemi-beta-20261027","luemi-production"].includes(namespace))
  throw Error("wrong_operator_namespace");
 if(action==="erase"&&namespace!=="luemi-production")
  throw Error("erasure_requires_production_namespace");
 diagnosticPhase="operator_credentials";
 const request=await get(token,"REM06_ERASURE_REQUEST_DATABASE_URL");
 const worker=await get(token,"REM06_ERASURE_WORKER_DATABASE_URL");
 const safety=await get(token,"REG01H_SAFETY_OPERATOR_DATABASE_URL");
 const reports=await get(token,"REG01G_MODERATOR_DATABASE_URL");
 diagnosticPhase="requester_login";
 await roleProbe(request,expected.REM06_ERASURE_REQUEST_DATABASE_URL,"luemi_erasure_requester","request");
 diagnosticPhase="worker_login";
 await roleProbe(worker,expected.REM06_ERASURE_WORKER_DATABASE_URL,"luemi_erasure_worker","worker");
 diagnosticPhase="safety_login";
 await roleProbe(safety,expected.REG01H_SAFETY_OPERATOR_DATABASE_URL,"luemi_safety_operator","safety");
 // A report reviewer may be permitted to inspect case IDs, but not user rows.
 diagnosticPhase="reviewer_login_and_queue";
 const review=await listReviewQueue({databaseUrl:validateConnection(reports,
  expected.REG01G_MODERATOR_DATABASE_URL),namespace,operatorLabel:"luemi_report_check"});
 process.stdout.write("LUEMI_OPERATOR_ROLES_VERIFIED: 4 scoped logins; pending reports (bounded): "+
  review.reports.length+(review.reports.length===25?"+":"")+"\n");
 if(action==="verify")return;
 diagnosticPhase="erasure_approval";
 // "approved" flags MUST reflect an externally approved, real operational policy.
 for(const key of ["REM06_ERASURE_WORKER_ENABLED","REM06_ERASURE_POLICY_APPROVED",
  "REM06_ERASURE_MAINTENANCE_APPROVED"])
  if(await get(token,key)!=="1")throw Error("erasure_policy_not_active");
 if(await get(token,"REM06_MEDIA_BUCKET")!=="luemi-profile-private"||
   await get(token,"REM06_SUPABASE_PROJECT_REF")!==project)
  throw Error("wrong_private_storage");
 diagnosticPhase="private_storage_configuration";
 const secret=await get(token,"REM06_SUPABASE_STORAGE_SECRET");
 diagnosticPhase="approved_erasure_batch";
 const result=await runErasureBatch({
  databaseUrl:validateConnection(worker,expected.REM06_ERASURE_WORKER_DATABASE_URL),
  namespace,storage:createDurablePrivateStore({
   projectRef:project,namespace,bucket:"luemi-profile-private",secret
  }),limit:5
 });
 process.stdout.write("LUEMI_ERASURE_BATCH: completed="+result.completed+
  ", failed="+result.failed+", pending="+result.pending+"\n");
 if(result.failed>0||result.pending)process.exitCode=1;
}
main().catch(()=>{
 // Only fixed phase names are emitted. Never log exceptions, URLs, secrets or rows.
 process.stderr.write("LUEMI_OPERATOR_OPERATION_REFUSED phase="+diagnosticPhase+" (no sensitive logs).\n");
 process.exitCode=1;
});
