// REG01F standalone maintenance CLI. NOT a Render cron or HTTP route.
// Never log keys, DSNs, user records or sensitive exception messages.
import {createDurablePrivateStore} from "./real-private-storage.js";
import {runErasureBatch} from "./real-erasure-worker.js";
const env=process.env;
async function main():Promise<void>{
 if(env.REM06_ERASURE_WORKER_ENABLED!=="1"||
  env.REM06_ERASURE_POLICY_APPROVED!=="1"||
  env.REM06_ERASURE_MAINTENANCE_APPROVED!=="1"||
  env.REM06_MEDIA_BUCKET!=="luemi-profile-private"||
  !env.REM06_ERASURE_WORKER_DATABASE_URL||
  !env.REM05B_BOT_NAMESPACE||!env.REM06_SUPABASE_PROJECT_REF||
  !env.REM06_SUPABASE_STORAGE_SECRET)
  throw new Error("REG01F maintenance disabled or missing approved configuration");
 const storage=createDurablePrivateStore({
  projectRef:env.REM06_SUPABASE_PROJECT_REF,
  namespace:env.REM05B_BOT_NAMESPACE,
  secret:env.REM06_SUPABASE_STORAGE_SECRET,
  bucket:"luemi-profile-private"
 });
 const result=await runErasureBatch({
  databaseUrl:env.REM06_ERASURE_WORKER_DATABASE_URL,
  namespace:env.REM05B_BOT_NAMESPACE,storage,limit:1
 });
 // Metadata only. No Telegram identities, keys, DSNs or Storage payloads.
 process.stdout.write(JSON.stringify(result)+"\n");
 if(result.failed>0)process.exitCode=1;
}
void main().catch(()=>{
 process.stderr.write("REG01F erasure maintenance did not complete. Inspect protected logs.\n");
 process.exitCode=1;
});
