import assert from "node:assert/strict";
import ts from "typescript";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const src=read("apps/web/src/ui/motion-lifecycle.ts");
const compiled=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const lifecycle=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
const listeners=new Map(),telegram=new Map();
function makeEvents(prefix){
 return {addEventListener(type,cb){const k=prefix+type;const set=listeners.get(k)||new Set();set.add(cb);listeners.set(k,set);},
 removeEventListener(type,cb){listeners.get(prefix+type)?.delete(cb);}};
}
const d=makeEvents("doc:"),w=makeEvents("win:");
let visibility="visible",suspends=0,resumes=0;
globalThis.document={...d,get visibilityState(){return visibility;}};
globalThis.window={...w,Telegram:{WebApp:{
 onEvent(type,cb){const s=telegram.get(type)||new Set();s.add(cb);telegram.set(type,s);},
 offEvent(type,cb){telegram.get(type)?.delete(cb);}
}}};
const dispatch=(prefix,type)=>{for(const cb of listeners.get(prefix+type)||[])cb();};
const tg=type=>{for(const cb of telegram.get(type)||[])cb();};
const dispose=lifecycle.bindMotionLifecycle(()=>suspends++,()=>resumes++);
visibility="hidden";dispatch("doc:","visibilitychange");
tg("deactivated");dispatch("win:","pagehide");
assert.equal(suspends,1,"one background transition across all providers");
visibility="visible";tg("activated");dispatch("win:","pageshow");
assert.equal(resumes,1,"one foreground transition across all providers");
tg("deactivated");visibility="hidden";dispatch("doc:","visibilitychange");
visibility="visible";dispatch("doc:","visibilitychange");
assert.equal(suspends,2);assert.equal(resumes,2);
dispose();
dispatch("doc:","visibilitychange");tg("activated");
assert.equal(resumes,2);
assert.ok([...listeners.values()].every(s=>s.size===0),"no document/window leaked listeners");
assert.ok([...telegram.values()].every(s=>s.size===0),"no Telegram leaked subscriptions");
console.log("REM02D_UNIT_PASS lifecycle suspend/resume idempotent, Telegram/browser listener baseline restored");

const profile=read("apps/web/src/discovery/ProfileMorphA2.tsx");
const driver=read("apps/web/src/discovery/profile-morph-a2-motion.ts");
const route=read("apps/web/src/discovery/VisitorProfileRoute.tsx");
for(const x of ["suspendForRoute","rollbackRoute","commitRouteClose","suspendForBackground","resumeFromBackground"])
 assert.ok(profile.includes(x)&&route.includes(x),"profile and route retain lifecycle handoff "+x);
assert.ok(driver.includes("suspend()")&&driver.includes("resume()")&&driver.includes("dispose()"));
assert.ok(driver.includes("this.stop()")&&driver.includes("this.generation++"),
 "cancel pending callback on dispose, background and route handoff");
assert.ok(profile.includes('window.addEventListener("resize",scheduleMeasure)')&&
 profile.includes('window.removeEventListener("resize",scheduleMeasure)')&&
 profile.includes("observer.disconnect()"),"all geometry observers disposed");
assert.ok(route.includes('routeMotion.current.finish(token')&&route.includes('routeMotion.current.cancel(liveToken.current,"external")'));
console.log("PROFILE_A2_LIFECYCLE_ADAPTER_PASS");
