/** Deterministic adversarial fuzz for LUEMI input/motion ownership.
 * This is a pure-state test, not a measurement of Android or iOS FPS.
 * 100,000 mixed gesture operations + 50,000 motion operations are generated
 * with reproducible seeds. Failures print the seed and operation index.
 */
import assert from "node:assert/strict";
import ts from "typescript";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const compile=src=>ts.transpileModule(src,{compilerOptions:{
 module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
}}).outputText;
const dataUrl=src=>"data:text/javascript;base64,"+Buffer.from(src).toString("base64");
const motion=await import(dataUrl(compile(read("apps/web/src/ui/motion-controller.ts"))));
const gesture=await import(dataUrl(compile(read("apps/web/src/ui/gesture-arbiter.ts"))));
const owners=["sheet","route","tabs","hero","browse","native"];
const movingOwners=owners.filter(s=>s!=="native");
function rng(seed){
 let state=seed>>>0;
 return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296};
}
const choose=(rnd,array)=>array[Math.floor(rnd()*array.length)];
let gestures=0,motions=0,lateFrames=0;
for(let seed=1;seed<=100;seed++){
 const rnd=rng(seed*1009+47),arb=new gesture.GestureArbiter();
 let staleSerials=[];
 for(let step=0;step<1000;step++){
  const before=arb.snapshot(),event=Math.floor(rnd()*9);
  const owner=choose(rnd,owners);
  try{
   if(event<=2){
    const kind=rnd()<.50?"touch":"pointer";
    const id=kind==="touch"?0:Math.floor(rnd()*3)+1;
    const result=arb.begin(kind,id,owner);
    if(result!==null){
     assert.equal(result,arb.snapshot().generation);
     assert.equal(arb.snapshot().active,true);
    }
   }else if(event===3){
    const result=arb.claim(owner,before.generation);
    if(result)assert.equal(arb.owner(),owner);
   }else if(event===4){
    const current=arb.snapshot().generation;
    arb.finishCandidate(current,owner);
   }else if(event===5){
    const finished=arb.finish(owner,before.generation);
    if(finished){
     assert.equal(before.owner,owner);
     assert.equal(arb.snapshot().active,false);
     staleSerials.push(before.generation);
    }
   }else if(event===6)arb.cancel();
   else if(event===7)arb.secondFinger();
   else {
    const snap=arb.snapshot();
    if(snap.active&&snap.owner===null){
     // Parent candidate release must not kill an unrelated child.
     const routeSerial=arb.begin("pointer",2,"route");
     if(routeSerial!==null){
      const serial=arb.begin("touch",0,"sheet");
      if(serial!==null){
       arb.finishCandidate(serial,"route");
       assert.equal(arb.candidate("sheet",serial),true);
      }
     }
    }
   }
   const after=arb.snapshot();
   if(!after.active){
    assert.equal(after.owner,null);
    if(before.active)staleSerials.push(before.generation);
   }else{
    assert.ok(after.owner===null||owners.includes(after.owner));
   }
   for(const stale of staleSerials.slice(-4)){
    if(stale<after.generation){
     assert.equal(arb.claim("route",stale),false,"stale generation claimed");
     assert.equal(arb.finish("sheet",stale),false,"stale generation finished");
    }
   }
   if(staleSerials.length>30)staleSerials=staleSerials.slice(-20);
   gestures++;
  }catch(err){
   throw new Error("gesture seed="+seed+" step="+step+" event="+event+
    " before="+JSON.stringify(before)+" after="+JSON.stringify(arb.snapshot()),
    {cause:err});
  }
 }
 arb.cancel();assert.equal(arb.snapshot().active,false);
}
for(let seed=1;seed<=50;seed++){
 const rnd=rng(seed*733+59),queue=new Map(),history=[];
 let nextId=0;const scheduler={
  frame:cb=>{const id=++nextId;queue.set(id,cb);return id},
  // Deliberately DON'T erase cancelled callbacks. An interrupted WebView
  // may deliver one late, and that callback must never mutate new pixels.
  cancelFrame:()=>{}
 };
 const c=new motion.MotionController(choose(rnd,movingOwners),scheduler,0,0);
 let tokens=[];
 for(let step=0;step<1000;step++){
  const event=Math.floor(rnd()*11),state=c.snapshot(),token=c.token();
  try{
   if(event===0){
    const newToken=c.begin(Math.round(rnd()*500),state.geometryRevision);
    if(newToken)tokens.push(newToken);
   }else if(event===1)c.claim(token);
   else if(event===2)c.schedulePaint(token,Math.round(rnd()*500),value=>{
    assert.ok(Number.isFinite(value));
    history.push({value,generation:token.generation});
   });
   else if(event===3){
    const before=c.snapshot(), jobs=[...queue.entries()];
    queue.clear();
    for(const [,cb] of jobs){
     const oldLength=history.length;
     cb();lateFrames++;
     if(before.phase!=="dragging"||before.disposed)
      assert.equal(history.length,oldLength,"non-dragging RAF wrote pixels");
    }
   }else if(event===4)c.settle(token,Math.round(rnd()*500));
   else if(event===5)c.close(token,Math.round(rnd()*500));
   else if(event===6)c.finish(token,{paint:value=>history.push({value,generation:token.generation})});
   else if(event===7)c.interrupt(token,"interrupted");
   else if(event===8)c.resume(token,choose(rnd,["dragging","settling"]));
   else if(event===9)c.rebase(state.geometryRevision+1,Math.round(rnd()*500));
   else c.cancel(token,"gesture-cancel");
   const now=c.snapshot();
   assert.ok(Number.isFinite(now.current)&&Number.isFinite(now.target));
   assert.ok(Number.isFinite(now.geometryRevision)&&Number.isFinite(now.generation));
   for(const old of tokens.slice(-4)){
    if(old.generation!==now.generation||old.geometryRevision!==now.geometryRevision)
     assert.equal(c.owns(old),false,"stale token retained ownership");
   }
   if(tokens.length>25)tokens=tokens.slice(-15);
   motions++;
  }catch(err){
   throw new Error("motion seed="+seed+" step="+step+" event="+event+
    " before="+JSON.stringify(state)+" after="+JSON.stringify(c.snapshot()),{cause:err});
  }
 }
 c.dispose();
 const painted=history.length;
 for(const [,cb] of queue)cb();
 assert.equal(history.length,painted,"late post-dispose callback painted");
 assert.equal(c.snapshot().disposed,true);
}
// Targeted hostile interleavings omitted from the generic random walk:
// fresh RAF after a cancelled RAF, terminal pixel before semantic commit,
// and reentrant cleanup/onCommit must never publish a second completion.
let commitRaces=0,atomicTerminals=0;
for(let seed=1;seed<=7000;seed++){
 const rnd=rng(seed*7717+109),queue=[];
 let frame=0;
 const scheduler={
  frame:cb=>{queue.push({id:++frame,cb});return frame;},
  cancelFrame:()=>{} // browser may still deliver old callbacks
 };
 const c=new motion.MotionController(choose(rnd,movingOwners),scheduler,0,0);
 let token=c.begin(0);assert.ok(token&&c.claim(token));
 let writes=0,oldPaints=0;
 for(let i=0;i<4;i++)assert.equal(c.schedulePaint(token,i+1,()=>oldPaints++),true);
 assert.equal(queue.length,1,"one pending RAF regardless of touchmove burst");
 const stale=queue[0].cb;
 if(seed%2===0){
  const paused=c.interrupt(token,"interrupted");
  assert.ok(paused);
  token=c.resume(paused,"dragging");
  assert.ok(token);
  const expected=seed%383+3;
  assert.equal(c.schedulePaint(token,expected,()=>writes++),true);
  stale();commitRaces++;
  assert.equal(oldPaints,0,"old queued RAF wrote after restart");
  assert.equal(c.snapshot().current,0,"old queued RAF changed new state");
  queue[1].cb();
  assert.equal(writes,1);
  assert.equal(c.snapshot().current,expected);
 }else{
  stale();commitRaces++;
  assert.equal(oldPaints,1);
 }
 const endpoint=Math.floor(rnd()*3200)-800,order=[];
 assert.equal((seed%3===0?c.close(token,endpoint):c.settle(token,endpoint)),true);
 const staleAfterEnd=c.token();
 let onCommitCount=0;
 assert.equal(c.track(token,()=>order.push("cleanup")),true);
 const ok=c.finish(token,{
  paint(value){
   assert.equal(value,endpoint);
   order.push("paint");
   assert.equal(c.finish(token,{paint:()=>{throw Error("recursive finish")}}),false);
  },
  onCommit(value){
   assert.equal(value,endpoint);
   assert.equal(order.at(-1),"paint","pixels must settle before semantic state");
   onCommitCount++;
   order.push("commit");
   assert.equal(c.finish(token,{paint:()=>{throw Error("double commit")}}),false);
  }
 });
 assert.equal(ok,true);
 assert.equal(onCommitCount,1);
 assert.deepEqual(order,["cleanup","paint","commit"]);
 assert.equal(c.finish(staleAfterEnd,{paint:()=>{throw Error("stale paint")}}),false);
 assert.equal(c.snapshot().phase,"idle");
 assert.equal(c.snapshot().lastSettled,endpoint);
 atomicTerminals++;
 c.dispose();
 for(const {cb} of queue)cb(); // replay ALL callbacks after dispose
 assert.equal(c.begin(0),null);
}

console.log("LUEMI_GESTURE_MOTION_CHAOS_PASS "+JSON.stringify({
 gestureOperations:gestures,motionOperations:motions,lateFrameCallbacks:lateFrames,
 seeds:7150,hostileRafReplays:commitRaces,atomicTerminals,mode:"deterministic adversarial pure-state, not device GPU QA"
}));
