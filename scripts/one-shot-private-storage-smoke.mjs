// Owner-authorized, synthetic-only REG01K probe bootstrap.
// The Render API key is read from the protected beta-bootstrap GitHub Environment.
// Never print credentials or HTTP error bodies; never change Render environment.
import {randomBytes} from "node:crypto";
import {spawn} from "node:child_process";

const PROJECT="czzyoxrwtnvbicypwrdd";
const SERVICE="srv-dbahj0e7bikc73elkcv0";
const CONFIRM="PROBE_LUEMI_PRIVATE_STORAGE_ONCE";
const allowedKeys=new Set(["REM06_SUPABASE_STORAGE_SECRET","REM06_SUPABASE_PROJECT_REF"]);
async function readRenderVariable(key,renderKey){
 if(!allowedKeys.has(key))throw Error("unexpected_render_variable");
 const response=await fetch("https://api.render.com/v1/services/"+SERVICE+
  "/env-vars/"+encodeURIComponent(key),{
  headers:{Authorization:"Bearer "+renderKey,Accept:"application/json"},
  signal:AbortSignal.timeout(12000),redirect:"error",cache:"no-store"
 });
 if(!response.ok){await response.body?.cancel();throw Error("render_variable_unavailable");}
 // Never print this JSON; it contains confidential credentials.
 const body=await response.json();
 const item=body?.envVar??body;
 if(item?.key!==key||typeof item.value!=="string"||item.value.length<1||
   item.value.length>2048)throw Error("invalid_render_variable");
 return item.value;
}
async function main(){
 if(process.env.GITHUB_ACTIONS!=="true"||
    process.env.GITHUB_REPOSITORY!=="zhirayr2505/luemi"||
    process.env.GITHUB_ACTOR!=="zhirayr2505"||
    process.env.GITHUB_REF!=="refs/heads/main"||
    process.env.GITHUB_EVENT_NAME!=="workflow_dispatch"||
    process.env.GITHUB_RUN_NUMBER!=="1"||
    process.env.GITHUB_RUN_ATTEMPT!=="1"||
    process.env.OWNER_PROBE_CONFIRM!==CONFIRM)
  throw Error("scope_not_approved");
 const renderKey=process.env.BETA_RENDER_API_KEY;
 if(typeof renderKey!=="string"||renderKey.length<20)throw Error("protected_environment_secret_missing");
 const projectRef=await readRenderVariable("REM06_SUPABASE_PROJECT_REF",renderKey);
 if(projectRef!==PROJECT)throw Error("wrong_project");
 const storageSecret=await readRenderVariable("REM06_SUPABASE_STORAGE_SECRET",renderKey);
 const safeNamespace="ci_luemi_"+randomBytes(12).toString("hex");
 // REG01K gate approvals apply ONLY to this zero-personal-data, one-run test.
 // Production REM06_* feature/policy flags are intentionally unchanged.
 const runnerEnv={
  ...process.env,
  BETA_RENDER_API_KEY:"",
  REM06_SUPABASE_STORAGE_SECRET:"",
  REG01K_SYNTHETIC_STORAGE_TEST_ENABLED:"1",
  REG01K_LUEMI_SHARED_BUCKET_PROBE_APPROVED:"1",
  REG01K_SHARED_PROJECT_RISK_ACCEPTED:"1",
  REG01K_STORAGE_COST_APPROVED_ZERO:"1",
  REG01K_PRIVACY_APPROVED:"1",
  REG01K_PROJECT_REF:PROJECT,
  REG01K_OPERATOR_CONFIRMED_PROJECT_REF:PROJECT,
  REG01K_BUCKET:"luemi-profile-private",
  REG01K_STORAGE_SECRET:storageSecret,
  REG01K_SYNTHETIC_NAMESPACE:safeNamespace
 };
 const exitCode=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,
   ["apps/api/dist/private-storage-probe-runner.js","--execute-synthetic-upload"],
   {env:runnerEnv,stdio:"inherit",shell:false});
  child.on("error",()=>reject(Error("probe_runner_unavailable")));
  child.on("exit",code=>resolve(code));
 });
 if(exitCode!==0)throw Error("private_storage_probe_failed");
 process.stdout.write("LUEMI_SYNTHETIC_STORAGE_PROBE_VERIFIED_AND_CLEANED\n");
}
main().catch(()=>{
 // Do not print exceptions: third-party stack traces can contain secrets.
 process.stderr.write("LUEMI_SYNTHETIC_STORAGE_PROBE_NOT_VERIFIED\n");
 process.exitCode=1;
});
