import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const src=readFileSync(new URL("../apps/web/src/startup/startup-coordinator.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {startStartup}=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function caseRun({critical,optional,criticalMs=35,optionalMs=10,disposeMs=null}){
 const events=[];
 const handle=startStartup({critical,optional,deadlineMs:criticalMs,optionalBudgetMs:optionalMs,
  onCritical:r=>events.push({name:"critical",result:r}),onOptionalReady:()=>events.push({name:"visual"})});
 if(disposeMs!==null){await sleep(disposeMs);handle.dispose();}
 else await sleep(Math.max(criticalMs,optionalMs)+18);
 handle.dispose();return events;
}
const pending=()=>new Promise(()=>{});
let events=await caseRun({critical:async()=>({user:{firstName:"QA"}}),optional:pending});
assert.equal(events.filter(e=>e.name==="critical").length,1);
assert.equal(events.find(e=>e.name==="critical").result.kind,"success");
assert.equal(events.filter(e=>e.name==="visual").length,1,"fonts never ready must not block visual");
events=await caseRun({critical:async()=>{throw new Error("HTTP 401");},optional:pending});
assert.equal(events.find(e=>e.name==="critical").result.kind,"error");
assert.equal(events.find(e=>e.name==="critical").result.reason,"HTTP 401");
assert.equal(events.filter(e=>e.name==="visual").length,1,"optional timeout does not bypass auth");
let aborted=false;
events=await caseRun({critical:signal=>{signal.addEventListener("abort",()=>{aborted=true;});return pending();},optional:pending});
assert.ok(aborted,"15s deadline aborts even if adapter does not settle");
assert.equal(events.find(e=>e.name==="critical").result.reason,"auth-deadline");
events=await caseRun({critical:async()=>{throw new Error("network offline");},optional:async()=>{throw new Error("logo failed");}});
assert.equal(events.find(e=>e.name==="critical").result.kind,"error");
assert.equal(events.filter(e=>e.name==="visual").length,1,"logo failure does not block system font fallback");
events=await caseRun({critical:async()=>{await sleep(25);return {user:"late"};},optional:pending,disposeMs:2});
assert.deepEqual(events,[],"unmount prevents all later callbacks");
let release;
const slow=()=>new Promise(resolve=>{release=resolve;});
const seen=[],first=startStartup({critical:slow,optional:pending,deadlineMs:45,optionalBudgetMs:5,
 onCritical:r=>seen.push(["old",r]),onOptionalReady:()=>{}});
await sleep(1);first.dispose();
const retry=startStartup({critical:async()=>2,optional:pending,deadlineMs:45,optionalBudgetMs:5,
 onCritical:r=>seen.push(["new",r]),onOptionalReady:()=>{}});
release(1);await sleep(12);retry.dispose();
assert.deepEqual(seen.map(x=>x[0]),["new"],"retry generation isolates stale old success");
console.log("REM04A_STARTUP_UNIT_PASS fonts never ready, logo fail, HTTP401, offline, timeout, abort, dispose, retry, stale critical resolution");
