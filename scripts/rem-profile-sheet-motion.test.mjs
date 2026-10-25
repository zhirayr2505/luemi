import assert from "node:assert/strict";
import ts from "typescript";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const js=x=>ts.transpileModule(x,{compilerOptions:{
  module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const asURL=x=>"data:text/javascript;base64,"+Buffer.from(x).toString("base64");
const dependency=asURL(js(read("apps/web/src/ui/motion.ts")));
const engine=js(read("apps/web/src/discovery/profile-sheet-motion.ts"))
 .replaceAll('from "../ui/motion"','from "'+dependency+'"');
const {ProfileSheetMotion}=await import(asURL(engine));
const make=initial=>{
 let now=0,id=0;
 const callbacks=new Map(),samples=[];
 const m=new ProfileSheetMotion(initial,(y,dragging)=>samples.push({y,dragging}),
  ()=>now,cb=>{const i=++id;callbacks.set(i,cb);return i;},
  key=>{callbacks.delete(key);});
 const step=delta=>{
  now+=delta;
  const list=[...callbacks.values()];callbacks.clear();
  for(const cb of list)cb(now);
 };
 return {m,samples,step,advance:()=>now,pending:()=>callbacks.size};
};
const near=(actual,wanted,epsilon=1)=>assert.ok(Math.abs(actual-wanted)<=epsilon,
 "expected "+actual+" within "+epsilon+"px of "+wanted);
{
 const x=make(434);const {m,samples,step}=x;let done=0;
 m.resize(44,434,434,false,false);
 m.drag(330);m.drag(240);near(m.value,240);
 m.settle(true,()=>done++);
 const y=m.value;
 step(16);assert.ok(m.value<=y,"collapse cannot jump downward");
 step(280);near(m.value,44,.01);
 assert.equal(done,1);assert.equal(x.pending(),0);
 assert.equal(samples.some((a,i)=>i>0&&a.y>samples[i-1].y+2&&samples[i-1].y<=330),false,
  "collapse must not move opposite the finger/target");
 m.drag(190);m.settle(false,()=>done++);
 step(300);near(m.value,434,.01);assert.equal(done,2);
 console.log("SHEET_UNIT_PASS both endpoints and single owner");
}
{
 const x=make(434),{m,step,samples}=x;let stale=0,fresh=0;
 m.resize(44,434,434,false,false);m.settle(true,()=>stale++);
 step(60);const midpoint=m.value;
 m.drag(midpoint-75);const finger=m.value;
 step(20);near(m.value,finger,.01);
 m.settle(false,()=>fresh++);
 step(310);near(m.value,434,.01);
 assert.equal(stale,0);assert.equal(fresh,1);
 assert.ok(samples.every(s=>Number.isFinite(s.y)));
 console.log("SHEET_UNIT_PASS interrupt stale settle, finger authority");
}
{
 const x=make(434),{m,step,pending}=x;let done=0;
 m.resize(44,434,434,false,false);
 m.settle(true,()=>done++);
 step(110);const y=m.value;
 m.pause();near(m.value,y,.01);
 step(600);near(m.value,y,.01);assert.equal(done,0);
 m.resume();step(190);near(m.value,44,.01);
 assert.equal(done,1);assert.equal(pending(),0);
 console.log("SHEET_UNIT_PASS paused Telegram background resumes remaining time");
}
{
 const x=make(434),{m,step}=x;let done=0;
 m.resize(44,434,434,false,false);
 m.settle(true,()=>done++);step(90);
 const before=m.value;
 m.resize(52,381,before,false,false);
 near(m.value,before,.01);step(201);
 near(m.value,52,.01);assert.equal(done,1);
 m.drag(205);m.resize(55,350,205,false,true);
 near(m.value,205,.01);
 m.settle(false,()=>done++);step(310);
 near(m.value,350,.01);assert.equal(done,2);
 console.log("SHEET_UNIT_PASS resize while running and while held");
}
{
 const x=make(434),{m,step}=x;let done=0;
 m.resize(44,434,434,false,false);
 m.settle(true,()=>done++);
 m.dispose();step(400);
 assert.equal(done,0);assert.equal(x.pending(),0);
 assert.equal(m.isDisposed(),true);
 console.log("SHEET_UNIT_PASS dispose prevents detached RAF painting");
}
