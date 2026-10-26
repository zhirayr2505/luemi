import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const moduleURL=s=>"data:text/javascript;base64,"+Buffer.from(s).toString("base64");
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const motionURL=moduleURL(compile(read("apps/web/src/ui/motion-controller.ts")));
const easeURL=moduleURL(compile(read("apps/web/src/ui/motion.ts")));
const geom=await import(moduleURL(compile(read("apps/web/src/discovery/geometry-motion.ts"))
 .replaceAll('from "../ui/motion"','from "'+easeURL+'"')
 .replaceAll('from "../ui/motion-controller"','from "'+motionURL+'"')));
const geometry=await import(moduleURL(compile(read("apps/web/src/discovery/profile-morph-a2-geometry.ts"))));
const close=(a,b,eps=1)=>assert.ok(Math.abs(a-b)<=eps,`Expected | ${a}-${b} | <= ${eps}`);

function clockFixture(kind="sheet",initial=385){
 let now=0,id=0;
 const jobs=new Map(),old=[];
 const frame=cb=>{const key=++id;jobs.set(key,cb);return key};
 const cancelFrame=key=>{const cb=jobs.get(key);if(cb)old.push(cb);jobs.delete(key);};
 const motion=new geom.GeometryMotion(kind,()=>now,frame,cancelFrame,initial,0);
 const advance=ms=>{now+=ms;const pending=[...jobs.values()];jobs.clear();for(const cb of pending)cb(now);};
 const controls={motion,advance,clock:()=>now,jobs,old};
 return controls;
}
for(const percent of [.25,.5,.9]){
 const f=clockFixture(),pixels={y:385},commits=[];
 f.motion.start(385,46,335,[.22,.79,.22,1],v=>pixels.y=v,()=>commits.push(f.clock()));
 f.advance(335*percent);
 const before=f.motion.sample();
 const speed=f.motion.snapshot().velocity;
 assert.ok(Number.isFinite(speed)&&speed<0,"settling velocity must reflect actual live easing derivative");
 close(pixels.y,before,1);
 const left=335*(1-percent);
 f.motion.rebase(1,before+7,60);
 assert.equal(f.motion.snapshot().phase,"settling");
 close(f.motion.snapshot().remaining,left,.1);
 f.advance(left/2);
 assert.ok(pixels.y>=Math.min(60,before+7)-.05&&pixels.y<=Math.max(60,before+7)+.05,`settling stays between the actual rebased value and target at ${percent}`);
 f.advance(left/2+.5);
 close(pixels.y,60,1);
 assert.equal(commits.length,1);
 assert.equal(f.motion.snapshot().phase,"idle");
 assert.equal(f.jobs.size,0);
 console.log(`REM02B_UNIT_PASS sheet resize ${Math.round(percent*100)}% settling; remainder ${Math.round(left)}ms and final ≤1px`);
}
{
 const f=clockFixture("tabs",0);let frac=0,commits=0;
 f.motion.start(0,4,295,[.22,.77,.23,1],v=>frac=v,()=>commits++);
 f.advance(90);
 const current=f.motion.sample();
 f.motion.rebase(1,current,4);
 f.advance(90);
 const current2=f.motion.sample();
 f.motion.rebase(2,current2,4);
 f.advance(116);
 close(frac,4,1/320);
 assert.equal(commits,1);
 assert.equal(f.motion.snapshot().remaining,0);
 console.log("REM02B_UNIT_PASS tab fractional resize twice, full 295ms budget, ≤1px");
}
{
 const f=clockFixture();let y=385;
 f.motion.start(385,46,335,[.22,.79,.22,1],v=>y=v,()=>{});
 f.advance(128);
 f.motion.suspend();const held=f.motion.snapshot();
 assert.equal(held.phase,"suspended");
 assert.ok(held.remaining>100);
 f.advance(1000);
 f.motion.reveal(2,held.current+12,63);
 close(f.motion.snapshot().remaining,held.remaining,.1);
 f.advance(held.remaining+1);
 close(y,63);
 console.log("REM02B_UNIT_PASS hidden→visible pauses clock, resumes unfinished interval");
}
{
 const f=clockFixture();const effects=[];
 f.motion.start(385,46,335,[.22,.79,.22,1],v=>effects.push(v),()=>effects.push("stale"));
 f.advance(85);
 const callback=f.old.at(-1);
 f.motion.cancel();
 f.motion.start(f.motion.sample(),385,335,[.22,.79,.22,1],v=>effects.push(v),()=>effects.push("current"));
 callback?.(f.clock());
 assert.equal(effects.includes("stale"),false);
 f.advance(336);
 close(f.motion.sample(),385);
 assert.equal(effects.filter(x=>x==="current").length,1);
 console.log("REM02B_UNIT_PASS rapid reversal, cancellation, stale callbacks never repaint/commit");
}
{
 for(const [w,h] of [[320,580],[393,852],[412,915],[700,650]]){
  const g=geometry.profileMorphGeometry(w,h,92);
  assert.ok(g.compactTop>=g.avatarY+g.avatarSize+20,"compact avatar is not sheet-clipped");
  assert.ok(g.expandedTop>g.compactTop,"expanded sheet below compact");
  assert.ok(g.span>=120,"physical handoff span");
  const a=geometry.morphFrame(g,0),b=geometry.morphFrame(g,1);
  close(a.sheetY,0,.001);close(b.sheetY,g.span,.001);
  close(a.photoX,g.avatarX,.001);close(b.photoX,0,.001);
  for(let i=0;i<=100;i++){
   const p=i/100,f=geometry.morphFrame(g,p);
   assert.ok(f.sheetY>=0&&f.sheetY<=g.span);
   assert.ok(f.scaleX>0&&f.scaleY>0,"finite nonzero bitmap transforms");
  }
 }
 console.log("PROFILE_A2_GEOMETRY_PASS compact/expanded and 101 samples x 4 viewports");
}
{
 const a2=read("apps/web/src/discovery/ProfileMorphA2.tsx");
 assert.ok(a2.includes("profileMorphGeometry(")&&a2.includes("morphFrame(geometry.current,p)"));
 assert.ok(a2.includes("observer.disconnect()")&&a2.includes("engine.sample()"));
 assert.ok(!a2.includes("style.top=")&&!a2.includes("remapSheetPixel"),"legacy top writer gone");
 console.log("PROFILE_A2_VIEWPORT_WIRING_PASS");
}
console.log("REM-02B shared viewer geometry and Profile Morph A2 geometry QA PASS");
