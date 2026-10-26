import assert from "node:assert/strict";
import ts from "typescript";
import {readFileSync} from "node:fs";
const load=async path=>{
 const source=readFileSync(new URL("../"+path,import.meta.url),"utf8");
 const js=ts.transpileModule(source,{fileName:path,compilerOptions:{
  module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
 }}).outputText;
 return import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
};
const {ProfileMorphMotion}=await load("apps/web/src/discovery/profile-morph-a2-motion.ts");
const {profileMorphGeometry,morphFrame}=await load("apps/web/src/discovery/profile-morph-a2-geometry.ts");
const make=reduce=>{
 let now=0,next=0,painted=[],commits=[],callbacks=new Map();
 const clock={now:()=>now,request:cb=>{callbacks.set(++next,cb);return next;},cancel:id=>callbacks.delete(id)};
 const step=ms=>{
  now+=ms;const batch=[...callbacks];callbacks.clear();
  for(const [,callback] of batch)callback(now);
 };
 const engine=new ProfileMorphMotion(p=>painted.push(p),clock,target=>commits.push(target),()=>reduce);
 return {engine,step,painted,commits,pending:()=>callbacks.size};
};
{
 const {engine,step,painted,commits,pending}=make(false);
 assert.equal(engine.snapshot().progress,0,"compact opens at p=0");
 engine.dragStart(100,300);
 engine.drag(220);
 assert.ok(Math.abs(engine.snapshot().progress-.4)<1e-7,"1:1 drag");
 engine.release(0);
 step(100);
 const sampled=engine.snapshot().progress;
 engine.dragStart(200,300);
 assert.ok(Math.abs(engine.snapshot().progress-sampled)<1e-7,"gesture interrupts CURRENT visual position");
 engine.drag(250);
 engine.release(-1.1);
 for(let i=0;i<40;i++)step(16.7);
 assert.equal(engine.snapshot().progress,0,"reverse settles compact");
 assert.equal(pending(),0,"no orphan RAF at rest");
 assert.deepEqual(commits,[0],"superseded settle never commits");
 assert.ok(painted.every(p=>Number.isFinite(p)&&p>=0&&p<=1),"bounded paint positions");
 engine.dispose();assert.equal(pending(),0);
}
{
 const {engine,step,commits,pending}=make(false);
 for(let i=0;i<50;i++){
  engine.settle(i%2===0?1:0);
  step(5);
  engine.dragStart(300,240);
  engine.drag(300+((i%2===0)?120:-120));
  engine.release(0);
  step(2);
 }
 engine.settle(1);
 for(let i=0;i<40;i++)step(17);
 assert.equal(engine.snapshot().progress,1,"50 reversals end at newest target");
 assert.equal(commits.at(-1),1);
 assert.equal(pending(),0);
 engine.dispose();
 engine.settle(0);
 assert.equal(pending(),0,"disposed instance never reschedules");
}
{
 const {engine,commits,pending}=make(true);
 engine.settle(1);
 assert.equal(engine.snapshot().progress,1,"reduced motion preserves state without tween");
 assert.deepEqual(commits,[1]);assert.equal(pending(),0);
 engine.dispose();
}
{
 const g=profileMorphGeometry(390,740,90),compact=morphFrame(g,0),expanded=morphFrame(g,1);
 assert.ok(g.expandedTop>g.compactTop);
 assert.equal(compact.sheetY,0);
 assert.equal(expanded.sheetY,g.span);
 assert.equal(compact.radius,50);
 assert.equal(expanded.radius,0);
 for(let i=0;i<=20;i++){
  const f=morphFrame(g,i/20);
  assert.ok(f.sheetY>=0&&f.sheetY<=g.span);
  assert.ok(f.scaleX>0&&f.scaleY>0);
 }
}
console.log("Profile Morph A2 controller: interruption/reversal/geometry/reduced-motion PASS");
