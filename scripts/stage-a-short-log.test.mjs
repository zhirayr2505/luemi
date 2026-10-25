import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const source=readFileSync(new URL("../apps/web/src/ui/motion-debug.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
}}).outputText;
const uri="data:text/javascript;base64,"+Buffer.from(compiled).toString("base64");
const {compactMotionLog}=await import(uri);
const log=[],write=(t,event,extra={})=>log.push(JSON.stringify({t,event,...extra}));
for(let attempt=0;attempt<9;attempt++){
 const begin=attempt*1400;
 write(begin,"settleSheet",{source:"touchend",next:true,stack:"event at ProfileMaster.tsx:902"});
 write(begin+1,"engine.start",{target:46});
 let y=380;
 for(let frame=1;frame<=65;frame++){
  const t=begin+frame*16;
  y=Math.max(46,y-6);
  if(frame===42)y=380; // synthetic jump near the endpoint
  write(t,"paintSheet",{y});
  write(t+0.1,"frame.y",{paintedY:y,phase:"settling",domTop:y+"px"});
  write(t+0.2,"engine.put",{y});
 }
 write(begin+1060,"measure.enter",{reason:"ResizeObserver:hero"});
 write(begin+1061,"measure.apply",{reason:"ResizeObserver:hero",top:46,bottom:380,
  stack:"at ProfileMaster.tsx:420"});
 write(begin+1100,"engine.resize",{nextMin:46,nextMax:380});
 write(begin+1110,"engine.done",{target:46});
 write(begin+1111,"setCollapsed.invoke",{next:true});
 write(begin+1112,"ProfileMaster.render",{collapsed:true});
}
const short=compactMotionLog(log);
assert.ok(short.length<=14000,"short text must fit in an ordinary ChatGPT message");
assert.ok(short.includes("LUEMI STAGE A SHORT"));
assert.ok(short.includes("settleSheet"));
assert.ok(short.includes("measure.apply"));
assert.ok(short.includes("engine.done"));
assert.ok(short.includes("setCollapsed.invoke"));
assert.ok(short.includes("FRAME_JUMP"),"large Y reversals should be signaled");
assert.ok(!short.includes("sourceEvents=0"));
assert.equal(compactMotionLog([]).includes("sourceEvents=0"),true);
assert.ok(compactMotionLog(["{broken json","{}",JSON.stringify({t:2,event:"engine.done",target:44})])
 .includes("engine.done"),"corrupt records should be skipped, not crash logger");
console.log("STAGE_A_COMPACT_LOG_PASS "+JSON.stringify({originalEntries:log.length,shortChars:short.length}));
