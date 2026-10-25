// REG01G standalone operator-only human review CLI. NEVER a public route.
import {open} from "node:fs/promises";
import {constants} from "node:fs";
import {createDurablePrivateStore} from "./real-private-storage.js";
import {listReviewQueue,fetchPrivateReviewImage,decideReviewPhoto,triageReviewReport} from "./human-moderation.js";
const env=process.env;
async function main(){
 if(env.REG01G_HUMAN_REVIEW_ENABLED!=="1"||
  env.REG01G_HUMAN_REVIEW_POLICY_APPROVED!=="1"||
  !env.REG01G_MODERATOR_DATABASE_URL||!env.REM05B_BOT_NAMESPACE||
  !env.REG01G_MODERATOR_LABEL)
  throw new Error("human_review_disabled");
 const opts={databaseUrl:env.REG01G_MODERATOR_DATABASE_URL,
  namespace:env.REM05B_BOT_NAMESPACE,operatorLabel:env.REG01G_MODERATOR_LABEL};
 const [action,id,arg,path]=process.argv.slice(2);
 if(action==="queue"){
  const pending=await listReviewQueue(opts);
  // Operator-only terminal output. Never include Telegram IDs, drafts or Storage paths.
  process.stdout.write(JSON.stringify(pending)+"\n");
 }else if(action==="preview"&&id&&arg){
  if(env.REM06_MEDIA_BUCKET!=="luemi-profile-private"||
   !env.REM06_SUPABASE_PROJECT_REF||!env.REM06_SUPABASE_STORAGE_SECRET)
   throw new Error("operator_private_storage_disabled");
  const storage=createDurablePrivateStore({
   projectRef:env.REM06_SUPABASE_PROJECT_REF,
   namespace:env.REM05B_BOT_NAMESPACE,
   secret:env.REM06_SUPABASE_STORAGE_SECRET,
   bucket:"luemi-profile-private"
  });
  const bytes=await fetchPrivateReviewImage({...opts,storage},id);
  // Never overwrite. Caller-specified local file, private permissions.
  const file=await open(arg,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|
   (constants.O_NOFOLLOW??0),0o600);
  try{await file.writeFile(bytes);}finally{await file.close();}
  process.stdout.write("Private PNG review copy written. Delete securely after review.\n");
 }else if(action==="approve"&&id){
  await decideReviewPhoto(opts,id,"approved","human_safe");
  process.stdout.write("Photo decision recorded.\n");
 }else if(action==="reject"&&id&&["human_policy_violation","human_minor_suspected"].includes(arg??"")){
  await decideReviewPhoto(opts,id,"rejected",
    arg as "human_policy_violation"|"human_minor_suspected");
  process.stdout.write("Photo rejection recorded.\n");
 }else if(action==="report"&&id&&
  ["triaged","dismissed"].includes(arg??"")&&path){
  await triageReviewReport(opts,id,arg as "triaged"|"dismissed",
   path as "spam"|"harassment"|"impersonation"|"unsafe_media"|"no_violation");
  process.stdout.write("Report decision recorded.\n");
 }else throw new Error("invalid_operator_operation");
}
void main().catch(()=>{
 process.stderr.write("Human moderation operation refused; no identifiers logged.\n");
 process.exitCode=1;
});
