// REG01K PRIVATE operator CLI. Never imported by server/routes/web bundle.
// Do not execute without separately approved LUEMI-only test environment.
// No credentials, Telegram identities or real photographs are logged.
import {createDurablePrivateStore} from "./real-private-storage.js";
import {probePrivateStorage,PrivateStorageProbeError} from "./private-storage-probe.js";

async function main(){
 const e=process.env;
 const LUEMI_PROJECT_REF="czzyoxrwtnvbicypwrdd";
 if(process.argv.length!==3||process.argv[2]!=="--execute-synthetic-upload"||
  e.REG01K_SYNTHETIC_STORAGE_TEST_ENABLED!=="1"||
  e.REG01K_LUEMI_SHARED_BUCKET_PROBE_APPROVED!=="1"||
  e.REG01K_SHARED_PROJECT_RISK_ACCEPTED!=="1"||
  e.REG01K_STORAGE_COST_APPROVED_ZERO!=="1"||
  e.REG01K_PRIVACY_APPROVED!=="1"||
  e.REG01K_PROJECT_REF!==LUEMI_PROJECT_REF||
  e.REG01K_OPERATOR_CONFIRMED_PROJECT_REF!==LUEMI_PROJECT_REF||
  e.REG01K_BUCKET!=="luemi-profile-private"||
  !e.REG01K_STORAGE_SECRET||!e.REG01K_SYNTHETIC_NAMESPACE?.startsWith("ci_"))
  throw Error("REG01K probe disabled, wrong LUEMI project or missing explicit acceptance");
 const store=createDurablePrivateStore({
  projectRef:LUEMI_PROJECT_REF,
  namespace:e.REG01K_SYNTHETIC_NAMESPACE,
  secret:e.REG01K_STORAGE_SECRET,
  bucket:"luemi-profile-private"
 });
 try{
  const result=await probePrivateStorage(store,e.REG01K_SYNTHETIC_NAMESPACE,async key=>{
   // No Authorization/apikey is ever sent to the public endpoint. The path
   // is randomly synthesized and cannot identify a real LUEMI user.
   const url="https://"+LUEMI_PROJECT_REF+".supabase.co/storage/v1/object/public/"+
    "luemi-profile-private/"+key.split("/").map(encodeURIComponent).join("/");
   const response=await fetch(url,{
    method:"GET",redirect:"manual",cache:"no-store",
    signal:AbortSignal.timeout(12000)
   });
   try{
    if([400,401,403,404].includes(response.status))return "denied" as const;
    if(response.status===200)return "accessible" as const;
    throw Error("unknown_public_storage_response");
   }finally{await response.body?.cancel();}
  });
  process.stdout.write(JSON.stringify(result)+"\n");
 }catch(error){
  if(error instanceof PrivateStorageProbeError&&error.code==="cleanup_unconfirmed"){
   // Only a newly random synthetic path, never a stored profile photo or token.
   process.stderr.write("REG01K cleanup not confirmed. Operator must delete synthetic key: "+
    error.recoveryObjectKey+"\n");
  }
  throw Error("REG01K private Storage readiness refused");
 }
}
void main().catch(()=>{
 process.stderr.write("REG01K not accepted; no private beta approval granted.\n");
 process.exitCode=1;
});
