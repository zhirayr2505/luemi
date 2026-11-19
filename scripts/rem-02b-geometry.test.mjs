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
 // V4.2 is the ONLY user-approved profile that opts into a small spring
 // overrun. The shared controller still clamps legacy motions by default.
 const spring=clockFixture("sheet",0);let value=0,commits=0;
 spring.motion.start(0,200,335,[.17,.84,.18,1.13],v=>value=v,()=>commits++,0,true);
 spring.advance(260);
 assert(value>200&&value<216,"profile spring overshoots its target by a bounded few pixels");
 spring.advance(76);
 close(value,200,.1);
 assert.equal(commits,1,"elastic settle commits exactly once");
 const legacy=clockFixture("sheet",0);let legacyValue=0;
 legacy.motion.start(0,200,335,[.17,.84,.18,1.13],v=>legacyValue=v,()=>{});
 legacy.advance(260);
 assert(legacyValue<=200,"other consumers retain non-overshooting motion");
 console.log("REM02B_UNIT_PASS V4.2 spring overshoot is bounded and opt-in only");
}
console.log("REM-02B shared motion geometry QA PASS; owner geometry has a dedicated contract");
