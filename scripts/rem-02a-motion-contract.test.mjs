import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const compile=s=>ts.transpileModule(s,{compilerOptions:{
 module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
}}).outputText;
const url=s=>"data:text/javascript;base64,"+Buffer.from(s).toString("base64");
const motionURL=url(compile(read("apps/web/src/ui/motion-controller.ts")));
const viewportURL=url(compile(read("apps/web/src/viewport/viewport-model.ts")));
const motion=await import(motionURL);
const adapterSource=compile(read("apps/web/src/discovery/profile-motion.ts"))
 .replaceAll('from "../ui/motion-controller"', 'from "'+motionURL+'"')
 .replaceAll('from "../viewport/viewport-model"', 'from "'+viewportURL+'"');
const adapter=await import(url(adapterSource));

let id=0;const pending=new Map(),canceled=[];
const scheduler={
 frame:cb=>{const n=++id;pending.set(n,cb);return n;},
 cancelFrame:n=>{pending.delete(n);canceled.push(n);}
};
const flush=()=>{const jobs=[...pending.entries()];pending.clear();for(const [,cb] of jobs)cb();};
const c=new motion.MotionController("sheet",scheduler,385,11);
const assertPhase=(phase,msg)=>assert.equal(c.snapshot().phase,phase,msg);
let t=c.begin(385);
assertPhase("candidate");assert.equal(c.claim(t),true);assertPhase("dragging");
assert.equal(c.claim(t),false,"axis owner cannot be claimed twice");
assert.equal(c.schedulePaint(t,377,()=>{}),true);
assert.equal(c.schedulePaint(t,368,()=>{}),true);
assert.equal(pending.size,1,"at most one queued RAF per controller");
const painted=[];const consumer=value=>painted.push(value);
assert.equal(c.schedulePaint(t,351,consumer,-.4),true);
flush();assert.deepEqual(painted,[351]);
assert.equal(c.snapshot().velocity,-.4);assert.equal(c.snapshot().current,351);
console.log("REM02A_UNIT_PASS single RAF coalescing, candidate→dragging and velocity sample");

assert.equal(c.settle(t,46),true);assertPhase("settling");
const updates=[];
const completeToken=t;
const complete=()=>c.finish(completeToken,{paint:x=>updates.push("paint:"+x),onCommit:()=>updates.push("commit")});
assert.equal(complete(),true);assert.deepEqual(updates,["paint:46","commit"]);
assert.equal(complete(),false);assert.deepEqual(updates,["paint:46","commit"]);
assert.equal(c.snapshot().lastSettled,46);
console.log("REM02A_UNIT_PASS finish writes terminal pixels then semantic commit exactly once");

t=c.begin(46);assert.equal(c.claim(t),true);
assert.equal(c.paint(t,92,consumer,.2),true);
assert.equal(c.settle(t,385),true);
const staleToken=t;
const stale=()=>c.finish(staleToken,{paint:consumer,onCommit:()=>updates.push("STALE")});
const paused=c.interrupt(t,"interrupted");
assertPhase("suspended");assert.equal(paused.generation,t.generation+1);
assert.equal(stale(),false);
assert.equal(c.resume(paused,"settling",46)?.generation,paused.generation+1);
const next=c.token();
assert.equal(stale(),false);
const done=()=>c.finish(next,{paint:consumer,onCommit:()=>updates.push("RESUMED")});
assert.equal(done(),true);assert.equal(done(),false);
assert.equal(updates.includes("STALE"),false);
assert.equal(updates.filter(x=>x==="RESUMED").length,1);
console.log("REM02A_UNIT_PASS settle→interrupt→resume; outdated callbacks rejected");

t=c.begin(385);c.claim(t);
let released=0;c.track(t,()=>{released++;});
c.schedulePaint(t,330,consumer);
const rebased=c.rebase(12,328,400);
assert.equal(rebased.geometryRevision,12);
assertPhase("suspended");
assert.equal(c.snapshot().current,328);assert.equal(c.snapshot().target,400);
assert.equal(pending.size,0);assert.equal(released,1);
assert.equal(c.paint(t,290,consumer),false,"old geometry paint denied");
assert.equal(c.finish(t,{paint:consumer}),false);
assert.equal(c.rebase(11),null,"old revision forbidden");
const resumed=c.resume(rebased,"settling",410);
assert.ok(resumed);assert.equal(c.finish(rebased,{paint:consumer}),false);
assert.equal(c.finish(resumed,{paint:consumer,onCommit:()=>updates.push("geometry")}),true);
assert.equal(c.snapshot().lastSettled,410);
console.log("REM02A_UNIT_PASS viewport revision rebase invalidates old frame/finish; paused continuity");

t=c.begin(410);c.claim(t);c.paint(t,350,consumer);
assert.equal(c.cancel(t,"gesture-cancel"),true);
assert.equal(c.cancel(t,"gesture-cancel"),false);
assert.equal(c.snapshot().cancelReason,"gesture-cancel");
assert.equal(c.snapshot().phase,"idle");
assert.equal(c.finish(t,{paint:consumer}),false);
console.log("REM02A_UNIT_PASS cancel twice and stale after-cancel finish");

t=c.begin(350);assert.equal(c.close(t,900),true);
assertPhase("closing");assert.equal(c.schedulePaint(t,420,consumer),false);
const closeToken=t;
const closeDone=()=>c.finish(closeToken,{paint:consumer,onCommit:()=>updates.push("close")});
assert.equal(closeDone(),true);
assert.equal(closeDone(),false);
assert.equal(updates.filter(x=>x==="close").length,1);
console.log("REM02A_UNIT_PASS closing endpoint and exactly-once route completion");

t=c.begin(0);c.claim(t);let cleaned=0;
c.track(t,()=>cleaned++);
c.schedulePaint(t,5,()=>updates.push("unexpected"));
c.dispose();c.dispose();
flush();assert.equal(cleaned,1);
assert.equal(c.snapshot().disposed,true);
assert.equal(c.begin(0),null);
assert.equal(c.schedulePaint(t,9,consumer),false);
assert.equal(c.finish(t,{paint:consumer}),false);
assert.equal(pending.size,0);
console.log("REM02A_UNIT_PASS dispose drains pending RAF/external timers and invalidates tokens");

const adversarial=new Map();let serial=0;
const unreliable={
 frame:cb=>{const next=++serial;adversarial.set(next,cb);return next;},
 // Intentionally let a cancelled callback run later as a hostile scheduler.
 cancelFrame:()=>{}
};
const raced=new motion.MotionController("tabs",unreliable,0,0);
let first=raced.begin(0);raced.claim(first);
const observed=[];
raced.schedulePaint(first,13,n=>observed.push("stale-"+n));
const late=adversarial.get(1);
const interrupted=raced.interrupt(first,"interrupted");
const restarted=raced.resume(interrupted,"dragging");
raced.schedulePaint(restarted,37,n=>observed.push("fresh-"+n));
late();
assert.equal(raced.snapshot().current,0,"late RAF must not update current");
assert.deepEqual(observed,[],"late RAF must not paint");
assert.ok(adversarial.has(2),"late RAF must not clear pending new generation");
adversarial.get(2)();
assert.deepEqual(observed,["fresh-37"]);
assert.equal(raced.snapshot().current,37);
first=raced.begin(37);
raced.settle(first,80);
const nested=[];
raced.track(first,()=>nested.push(raced.finish(first,{paint:()=>nested.push("bad cleanup")})));
assert.equal(raced.finish(first,{paint:n=>{
 nested.push("paint-"+n);
 nested.push(raced.finish(first,{paint:()=>nested.push("bad paint")}));
},onCommit:()=>nested.push("commit")}),true);
assert.deepEqual(nested,[false,"paint-80",false,"commit"],
 "cleanup and synchronous pixel write cannot re-enter completion");
assert.equal(raced.finish(first,{paint:()=>{}}),false);
raced.dispose();
console.log("REM02A_UNIT_PASS hostile late RAF cannot steal fresh frame; reentrant finish rejected atomically");


let s=motion.createMotionSnapshot("hero",0,0);
const initial=s;
s=motion.reduceMotion(s,{type:"finish",token:motion.motionToken(s)});
assert.equal(s,initial,"idle finish pure reducer no-op");
s=motion.reduceMotion(s,{type:"begin",value:10});
const candidate=motion.motionToken(s);
s=motion.reduceMotion(s,{type:"claim",token:candidate});
s=motion.reduceMotion(s,{type:"paint",token:candidate,value:8,velocity:1});
s=motion.reduceMotion(s,{type:"settle",token:candidate,target:20});
const settled=motion.reduceMotion(s,{type:"finish",token:candidate});
assert.equal(settled.phase,"idle");assert.equal(settled.current,20);
assert.equal(motion.reduceMotion(settled,{type:"finish",token:candidate}),settled);
const ended=motion.reduceMotion(settled,{type:"dispose"});
assert.equal(motion.reduceMotion(ended,{type:"begin",value:0}),ended);
console.log("REM02A_UNIT_PASS pure transition reducer determinism and immutable no-op");

const props=motion.MOTION_PROPERTY_OWNERS;
const seen=new Set();
for(const [property,owner] of Object.entries(props)){
 assert.equal(seen.has(property),false);seen.add(property);
 assert.ok(adapter.PROFILE_MOTION_WRITER_TABLE[owner].includes(property),"owner matrix "+property);
}
assert.equal(seen.size,12,"all 12 active mutable properties assigned exactly one owner");
const authority=adapter.createProfileMotionAuthority();
const surface={scrollTop:0,style:{transform:"",opacity:""}};
authority.run("sheet",["sheet-scroll","elastic-sheet","parallax"],()=>{
 surface.scrollTop=100;surface.style.transform="translate3d(0,10px,0)";
});
assert.equal(surface.scrollTop,100);
assert.equal(authority.ownerOf("sheet-scroll"),"sheet");
assert.throws(()=>authority.run("tabs",["sheet-scroll"],()=>{}),/conflicting motion writer/);
assert.throws(()=>authority.run("sheet",["route-transform"],()=>{}),/conflicting motion writer/);
const pair={track:0,ink:0};
authority.run("tabs",adapter.PROFILE_MOTION_WRITER_TABLE.tabs,()=>{
 pair.track=255;pair.ink=80;
});
assert.deepEqual(pair,{track:255,ink:80});
authority.dispose();
assert.equal(authority.ownerOf("sheet-scroll"),null);
assert.throws(()=>authority.run("sheet",["blur"],()=>{}),/disposed/);
console.log("REM02A_ADAPTER_PASS owner matrix and sheet/tabs DOM fixture; conflicting owners fail closed");

const parent=new EventTarget();let revisions=[];
const unbind=adapter.bindMotionViewport(parent,(rev,snap)=>revisions.push([rev,snap.revision]));
const type=(await import(viewportURL)).VIEWPORT_REVISION_EVENT;
parent.dispatchEvent(new CustomEvent(type,{detail:{revision:19}}));
parent.dispatchEvent(new CustomEvent(type,{detail:{revision:19}}));
parent.dispatchEvent(new CustomEvent(type,{detail:{revision:18}}));
parent.dispatchEvent(new CustomEvent(type,{detail:{revision:20}}));
unbind();unbind();
parent.dispatchEvent(new CustomEvent(type,{detail:{revision:21}}));
assert.deepEqual(revisions,[[19,19],[20,20]]);
console.log("REM02A_ADAPTER_PASS viewport revision bridge monotonicity and listener cleanup");

const profile=read("apps/web/src/discovery/ProfileMaster.tsx");
const route=read("apps/web/src/discovery/VisitorProfileRoute.tsx");
const browse=read("apps/web/src/discovery/DiscoveryApp.tsx");
const css=read("apps/web/src/discovery/profile-master.css");
const ease=read("apps/web/src/ui/motion.ts");
assert.ok(profile.includes('motionAuthority.current.run("sheet",PROFILE_MOTION_WRITER_TABLE.sheet')&&
 profile.includes('motionAuthority.current.run("tabs",PROFILE_MOTION_WRITER_TABLE.tabs')&&
 profile.includes('motionAuthority.current.run("hero",PROFILE_MOTION_WRITER_TABLE.hero'));
assert.ok(route.includes('motionAuthority.current.run("route",PROFILE_MOTION_WRITER_TABLE.route'));
assert.ok(browse.includes('motionAuthority.current.run("browse",PROFILE_MOTION_WRITER_TABLE.browse'));
const sheetMotion=read("apps/web/src/discovery/profile-sheet-motion.ts");
assert.ok(profile.includes('ensureSheetMotion().settle(next,()=>')&&
 sheetMotion.includes('private readonly paint:(y:number,dragging:boolean)=>void')&&
 sheetMotion.includes('get phase():Stage')&&
 sheetMotion.includes('duration=290')&&
 sheetMotion.includes('easeAt(fraction,.22,.79,.22,1)')&&
 profile.includes('runner.start(from,i,295,[.22,.77,.23,1]')&&
 profile.includes('runner.rebase(tabsRevision.current,fraction,destination)')&&
 profile.includes("transform 290ms cubic-bezier(.2,.76,.22,1)"),
 "REM-02B source contract: new one-owner sheet timeline and unchanged tab/photo motion");
assert.ok(route.includes("const OPEN_DURATION=260;")&&route.includes("const CLOSE_DURATION=230;")&&
 route.includes('const EASING="cubic-bezier(.2,.82,.24,1)";'));
assert.ok(browse.includes("380")&&browse.includes("clickBlockUntil.current=performance.now()+260"));
assert.ok(css.includes("border-radius:34px 34px 0 0"));
assert.ok(!ease.includes("export function animateValue("), "obsolete parallel RAF animator removed");
console.log("REM02A_ADAPTER_PASS existing sheet/route/tabs/pager motion timing and easing tokens unchanged");
console.log("REM-02A UNIT AND ADAPTER QA PASS; physical A55/iOS NOT VERIFIED");
