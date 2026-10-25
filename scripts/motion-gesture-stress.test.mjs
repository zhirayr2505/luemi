/** Deterministic hostile scheduler / pointer-touch model stress.
 * Property checks complement (not replace) real browser and device QA.
 * Reproducible by TEST_SEED, no time/sleep/network, no secrets.
 */
import assert from "node:assert/strict";
import ts from "typescript";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const transpile=code=>ts.transpileModule(code,{compilerOptions:{
 module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=s=>"data:text/javascript;base64,"+Buffer.from(s).toString("base64");
const motionUrl=url(transpile(read("apps/web/src/ui/motion-controller.ts")));
const motion=await import(motionUrl);
const gestureSrc=transpile(read("apps/web/src/ui/gesture-arbiter.ts"))
 .replaceAll('from "../ui/motion-controller"','from "'+motionUrl+'"');
const {GestureArbiter}=await import(url(gestureSrc));
let seed=Number(process.env.TEST_SEED??0x51A71C25)>>>0;
if(!seed)seed=1;
const initialSeed=seed,rand=()=>{
 seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;
};
const pick=a=>a[rand()%a.length];
const owners=["route","sheet","tabs","hero","browse","native"];
let gestureOperations=0,motionOperations=0,terminalCommits=0,lateFrames=0;

// Phase A: randomized interleavings of cross-source pointer and touch owners.
// Checks single winner, generation/terminal monotonicity and stale rejection.
for(let caseIndex=0;caseIndex<6500;caseIndex++){
 const ar=new GestureArbiter(),pointerId=caseIndex+10,touchId=caseIndex+100000;
 const first=pick(owners),second=pick(owners.filter(o=>o!==first));
 const serial=ar.begin("pointer",pointerId,first);gestureOperations++;
 assert.ok(serial!==null);
 const touchSerial=ar.begin("touch",touchId,second);gestureOperations++;
 assert.equal(touchSerial,serial);
 // Additional same-ID candidates imitate nested route/sheet/tab adapters.
 const third=pick(owners.filter(o=>o!==first&&o!==second));
 assert.equal(ar.begin("touch",touchId,third),serial);gestureOperations++;
 const candidates=[first,second,third];
 const before=ar.snapshot();
 assert.equal(before.active,true);
 assert.equal(before.owner,null);
 // The parent can terminate *its* candidate before the sheet claims.
 if((rand()&1)===0){
  ar.finishCandidate(serial,first);gestureOperations++;
  assert.equal(ar.candidate(second,serial),true);
 }
 const winner=pick([second,third]);
 const granted=ar.claim(winner,serial);gestureOperations++;
 assert.equal(granted,true,"nested touch candidate must be claimable");
 assert.equal(ar.owner(),winner);
 for(let i=0;i<8;i++){
  const rival=pick(owners.filter(o=>o!==winner));
  assert.equal(ar.claim(rival,serial),false);
  assert.equal(ar.finish(rival,serial),false);
  assert.equal(ar.nativeScroll(serial),false);
  gestureOperations+=3;
 }
 if(rand()%4===0){
  ar.secondFinger();gestureOperations++;
  assert.equal(ar.snapshot().active,false);
  assert.equal(ar.finish(winner,serial),false);
 }else{
  assert.equal(ar.finish(winner,serial),true);
  assert.equal(ar.finish(winner,serial),false);
  gestureOperations+=2;terminalCommits++;
 }
 assert.equal(ar.snapshot().active,false);
 assert.equal(ar.owner(),null);
 assert.equal(ar.claim(winner,serial),false);
 gestureOperations++;
 const next=ar.begin("pointer",pointerId+1,first);
 assert.ok(next>serial);
 assert.equal(ar.finish(winner,serial),false);
 gestureOperations+=2;
 // A second same-source contact invalidates the complete session.
 assert.equal(ar.begin("pointer",pointerId+2,second),null);
 assert.equal(ar.snapshot().active,false);
 assert.equal(ar.finish(first,next),false);
 gestureOperations+=2;
 ar.cancel();ar.dispose();
 // StrictMode remount: dispose must not permanently disable the recognizer.
 const remount=ar.begin("touch",touchId+1,first);
 assert.ok(remount!==null&&remount>next);
 assert.equal(ar.claim(first,remount),true);
 assert.equal(ar.finish(first,remount),true);
 gestureOperations+=3;
}

// Phase B: hostile queue delivers cancelled RAFs *after* a newer generation.
// Each completion must atomically publish endpoint then one semantic commit.
for(let caseIndex=0;caseIndex<5500;caseIndex++){
 const callbacks=[],cancelled=new Set();
 let nextFrame=0;
 const scheduler={
  frame:cb=>{const id=++nextFrame;callbacks.push({id,cb});return id;},
  cancelFrame:id=>{cancelled.add(id);}
 };
 const owner=pick(owners.filter(o=>o!=="native"));
 const c=new motion.MotionController(owner,scheduler,0,0);
 const stale=[];
 const commits=[];
 let painted=0;
 let token=c.begin(0);motionOperations++;
 assert.ok(token&&c.claim(token));
 motionOperations++;
 let value=0;
 for(let frame=0;frame<4;frame++){
  value=(rand()%1400)-350;
  assert.equal(c.schedulePaint(token,value,()=>painted++),true);
  motionOperations++;
 }
 // One queued frame no matter how many touch-move paints.
 assert.equal(callbacks.length,1);
 const pending=callbacks[0];
 if(rand()%2===0){
  // Interrupted/queued old RAF must not scribble after rebase/resume.
  let next=c.interrupt(token,"interrupted");motionOperations++;
  assert.ok(next&&next.generation>token.generation);
  stale.push(token);
  token=c.resume(next,"dragging");motionOperations++;
  assert.ok(token&&token.generation>next.generation);
  const freshValue=(rand()%999)+1;
  assert.equal(c.schedulePaint(token,freshValue,()=>painted++),true);
  motionOperations++;
  const paintBefore=painted;
  pending.cb();lateFrames++;
  assert.equal(painted,paintBefore,"stale RAF altered the new generation");
  assert.equal(c.snapshot().current,0);
  callbacks.at(-1).cb();motionOperations++;
  assert.equal(c.snapshot().current,freshValue);
 }else{
  pending.cb();motionOperations++;
  assert.equal(c.snapshot().current,value);
 }
 const endpoint=(rand()%4000)-1000;
 const close=(rand()&1)===0;
 assert.equal(close?c.close(token,endpoint):c.settle(token,endpoint),true);
 motionOperations++;
 for(const old of stale){
  assert.equal(c.finish(old,{paint:()=>painted++}),false);
  assert.equal(c.paint(old,13,()=>painted++),false);
  motionOperations+=2;
 }
 let endpointPixels=null;
 const published=[];
 assert.equal(c.finish(token,{
  paint:n=>{
   endpointPixels=n;
   assert.equal(c.finish(token,{paint:()=>{throw Error("reentrant finish");}}),false);
  },
  onCommit:n=>{
   assert.equal(endpointPixels,endpoint);
   published.push(n);
   assert.equal(c.finish(token,{paint:()=>{throw Error("double publish");}}),false);
  }
 }),true);
 motionOperations+=3;
 assert.deepEqual(published,[endpoint]);
 assert.equal(c.snapshot().phase,"idle");
 assert.equal(c.snapshot().lastSettled,endpoint);
 assert.equal(c.finish(token,{paint:()=>{throw Error("postcommit paint");}}),false);
 motionOperations++;
 terminalCommits++;
 c.dispose();c.dispose();
 assert.equal(c.begin(0),null);
 motionOperations++;
}
console.log("LUEMI_HOSTILE_STATE_STRESS_PASS "+JSON.stringify({
 seed:initialSeed,gestureScenarios:6500,motionScenarios:5500,
 gestureOperations,motionOperations,totalOperations:gestureOperations+motionOperations,
 terminalCommits,hostileLateFrames:lateFrames
}));
