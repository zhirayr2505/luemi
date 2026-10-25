// Operator-only safety actions. Not imported by public HTTP API.
// Two explicit gates plus a credential exclusively holding luemi_safety_operator.
import {suspendReportedActor,pendingSafetyAppeals,decideSafetyAppeal} from "./safety-operator.js";
const env=process.env;
async function main(){
 if(env.REG01H_SAFETY_OPERATOR_ENABLED!=="1"||
    env.REG01H_SAFETY_POLICY_APPROVED!=="1"||
    !env.REG01H_SAFETY_OPERATOR_DATABASE_URL||
    !env.REM05B_BOT_NAMESPACE||!env.REG01H_OPERATOR_LABEL)
  throw Error("safety_operator_disabled");
 const o={databaseUrl:env.REG01H_SAFETY_OPERATOR_DATABASE_URL,
  namespace:env.REM05B_BOT_NAMESPACE,operatorLabel:env.REG01H_OPERATOR_LABEL};
 const [action,id,...parts]=process.argv.slice(2);
 if(action==="suspend"&&id&&
  ["spam","harassment","impersonation","unsafe_media","minor_suspected"].includes(parts[0]??"")){
   await suspendReportedActor(o,id,parts[0] as
    "spam"|"harassment"|"impersonation"|"unsafe_media"|"minor_suspected");
   process.stdout.write("Safety action recorded.\n");
 }else if(action==="appeals"&&!id){
   const pending=await pendingSafetyAppeals(o);
   // Operator terminal only: appeals contain sensitive user statements.
   process.stdout.write(JSON.stringify(pending)+"\n");
 }else if(["accept","reject"].includes(action??"")&&id&&parts.join(" ").length>=10){
   await decideSafetyAppeal(o,id,action==="accept"?"accepted":"rejected",parts.join(" "));
   process.stdout.write("Appeal decision recorded.\n");
 }else throw Error("invalid_safety_operation");
}
void main().catch(()=>{process.stderr.write("Safety operation refused.\n");process.exitCode=1;});
