import assert from "node:assert/strict";
import ts from "typescript";
import {readFileSync} from "node:fs";
async function load(path){
 const source=readFileSync(new URL("../"+path,import.meta.url),"utf8");
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
}
const {createGeoOperationGate}=await load("apps/web/src/registration/geo-operation.ts");
const gate=createGeoOperationGate();
const a=gate.begin(),aSignal=gate.attach(a);
assert.equal(gate.isCurrent(a),true);
const b=gate.begin(),bSignal=gate.attach(b);
assert.equal(aSignal.aborted,true);assert.equal(gate.isCurrent(a),false);
assert.equal(gate.isCurrent(b),true);assert.equal(bSignal.aborted,false);
gate.cancel(a);assert.equal(gate.isCurrent(b),true,"stale cleanup never cancels current B");
gate.cancel(b);assert.equal(bSignal.aborted,true);assert.equal(gate.isCurrent(b),false);
const gps=gate.begin();
gate.dispose();assert.equal(gate.isCurrent(gps),false,"unmount invalidates unabortable GPS callback");
gate.resume();assert.equal(gate.isCurrent(gps),false,"StrictMode remount never revives stale GPS");
const fresh=gate.begin();assert.equal(gate.isCurrent(fresh),true);
const {selectionHaptic}=await load("apps/web/src/ui/haptic.ts");
const prior=globalThis.window;
try{
 delete globalThis.window;assert.doesNotThrow(()=>selectionHaptic(),"absent Telegram bridge");
 let invoked=0;
 globalThis.window={Telegram:{WebApp:{HapticFeedback:{selectionChanged(){invoked++;throw new Error("simulated bridge failure");}}}}};
 assert.doesNotThrow(()=>selectionHaptic(),"optional throwing bridge is swallowed");assert.equal(invoked,1);
 globalThis.window={Telegram:{WebApp:{HapticFeedback:{selectionChanged(){invoked++;}}}}};
 selectionHaptic();assert.equal(invoked,2,"working feedback remains callable");
}finally{if(prior===undefined)delete globalThis.window;else globalThis.window=prior;}
console.log("REM-01A LU-18/LU-37 pure operation gate and optional bridge PASS");
