import assert from "node:assert/strict";
import {buildSync} from "esbuild";
import {pathToFileURL} from "node:url";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
const dir=mkdtempSync(join(tmpdir(),"luemi-v3-"));
try{
 const load=async(name)=>{
  const output=join(dir,name+".mjs");
  buildSync({entryPoints:[`apps/web/src/discovery/profile-v3/${name}.ts`],outfile:output,bundle:true,platform:"node",format:"esm"});
  return import(pathToFileURL(output));
 };
 const {createProfileLayout,photoMask,photoOffset,coverSize}=await load("geometry/ProfileGeometry");
 const {ProfileMotionEngine}=await load("motion/ProfileMotionEngine");
 const {ProfileGestureCoordinator}=await load("gestures/ProfileGestureCoordinator");
 const sizes=[[320,568],[360,640],[390,740],[412,800],[412,915],[640,360],[412,450]];
 for(const [width,height] of sizes){
  const l=createProfileLayout({width,height,insets:{top:24,bottom:28}});
  for(const v of Object.values(l))if(typeof v==="number")assert(Number.isFinite(v));
  assert(l.compactTop>=0&&l.expandedTop>=l.compactTop&&l.expandedTop<=height);
  assert(l.scroll.height>=0&&l.avatar.y+l.avatar.height<=height);
  for(const p of [0,.17,.36,.58,.82,1]){
   const mask=photoMask(l,p),offset=photoOffset(l,p,800,1100);
   assert(mask.width>0&&mask.height>0&&mask.x>=0&&mask.y>=0);
   assert(mask.x+mask.width<=width+.001&&mask.y+mask.height<=height+.001);
   if(p===1)assert(offset.width>=mask.width&&offset.height>=mask.height);
   if(p===0){assert(offset.width>=mask.width-.001&&offset.height>=mask.height-.001);assert(Math.abs(offset.x-(mask.width-offset.width)*.5)<.001);assert(Math.abs(offset.y-(mask.height-offset.height)*.38)<.001);}
   assert(l.expandedTop<=Math.max(395,height*.435)+1 || height<540);
   assert(Math.abs(offset.width/offset.height-800/1100)<1e-12);
  }
  assert(Math.abs(coverSize(800,1100,l.photo).width/coverSize(800,1100,l.photo).height-800/1100)<1e-12);
 }
 let time=0,next=0;const queue=new Map();
 const clock={now:()=>time,request(cb){const id=++next;queue.set(id,cb);return id;},cancel(id){queue.delete(id);}};
 const advance=(ms)=>{time+=ms;const callbacks=[...queue.values()];queue.clear();for(const cb of callbacks)cb(time);};
 const layout=createProfileLayout({width:390,height:740});let painted=-1,commits=[];
 const engine=new ProfileMotionEngine(layout,p=>painted=p,to=>commits.push(to),()=>false,clock);
 assert.equal(engine.getProgress(),0);engine.animateTo(1);advance(400);
 assert.equal(engine.getProgress(),1);assert.equal(engine.getSnapshot().phase,"EXPANDED");
 engine.beginDrag(200);engine.updateDrag(200-layout.span*.4);
 assert(Math.abs(engine.getProgress()-.6)<.001);engine.endDrag(-.5);
 const release=engine.getProgress();advance(15);assert(engine.getProgress()<=release);
 engine.beginDrag(130);assert(Math.abs(engine.getProgress()-painted)<.0001);
 engine.updateDrag(130+layout.span*.2);engine.endDrag(.5);advance(400);assert.equal(engine.getProgress(),1);
 for(let i=0;i<20;i++){engine.animateTo(i%2?1:0);advance(12);engine.beginDrag(100);engine.updateDrag(100+(i%2?25:-25));engine.endDrag(i%2?1:-1);}
 engine.animateTo(0);advance(400);assert.equal(engine.getProgress(),0);
 engine.animateTo(1);const stale=[...queue.values()][0];engine.beginDrag(90);engine.updateDrag(90+layout.span*.36);
 const before=painted;stale(time+10);assert.equal(painted,before);
 const physical=layout.compactTop+layout.span*engine.getProgress();
 const revised=createProfileLayout({width:390,height:650});engine.rebaseViewport(revised);
 assert(Math.abs(revised.compactTop+revised.span*engine.getProgress()-physical)<1);
 engine.cancelDrag();advance(400);
 const beforeDispose=painted;engine.dispose();assert.equal(queue.size,0);
 engine.animateTo(1);advance(400);assert.equal(painted,beforeDispose);
 assert(commits.length>=2);
 const g=new ProfileGestureCoordinator();assert(g.begin({id:1,x:0,y:0,time:0},"handle"));
 assert.equal(g.move({id:1,x:2,y:30,time:16}).owner,"SHEET");g.cancel();assert.equal(g.owner(),"NONE");
 assert(g.begin({id:2,x:0,y:0,time:0},"content"));assert.equal(g.move({id:2,x:0,y:25,time:16}).owner,"NATIVE_SCROLL");
 assert.equal(g.claimSheetFromContent(3,"down"),false);
 assert.equal(g.claimSheetFromContent(2,"up"),false);
 assert.equal(g.claimSheetFromContent(2,"down"),true);assert.equal(g.owner(),"SHEET");
 assert.equal(g.claimSheetFromContent(2,"down"),false);
 g.cancel();assert(g.begin({id:4,x:0,y:30,time:0},"content"));
 assert.equal(g.move({id:4,x:0,y:0,time:16}).owner,"NATIVE_SCROLL");
 assert.equal(g.claimSheetFromContent(4,"up"),true);assert.equal(g.owner(),"SHEET");
 g.secondFinger();assert.equal(g.owner(),"NONE");g.releaseSecondFinger();g.dispose();
 console.log("Profile V3 foundation: geometry 7 viewports, aspect, motion interruption/reversals, stale RAF, resize, dispose, gesture ownership PASS");
}finally{rmSync(dir,{recursive:true,force:true});}
