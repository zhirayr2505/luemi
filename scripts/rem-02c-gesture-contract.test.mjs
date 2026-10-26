import assert from "node:assert/strict";
import ts from "typescript";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const compile=x=>ts.transpileModule(x,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=x=>"data:text/javascript;base64,"+Buffer.from(x).toString("base64");
const motionURL=url(compile(read("apps/web/src/ui/motion-controller.ts")));
const gestureURL=url(compile(read("apps/web/src/ui/gesture-arbiter.ts")).replaceAll('from "../ui/motion-controller"','from "'+motionURL+'"'));
const mod=await import(gestureURL);
const noLayoutTarget={
 closest(){return null;},
 get scrollTop(){throw new Error("gesture target must not measure scroll position");},
 get scrollHeight(){throw new Error("gesture target must not measure scroll geometry");}
};
assert.equal(mod.isGestureModalBlocked(noLayoutTarget),false,"resting scrolled panels may begin horizontal gesture");
assert.equal(mod.isGestureModalBlocked({closest:()=>({})}),true,"nested modal must retain gesture exclusion");
assert.equal(mod.isGestureModalBlocked(null),true,"missing target is blocked");
const browseOnly={closest(selector){
 return [".nb-card",".fy-rail",".nb-location",".discovery-filter-sheet"].some(c=>selector.includes(c))?{}:null;
}};
assert.equal(mod.isGestureModalBlocked(browseOnly),false,
 "visitor modal gate must not accidentally blacklist unrelated browse/nearby elements");
console.log("REM02C_UNIT_PASS pointerdown modal gate has no forced layout reads");
const ar=new mod.GestureArbiter();
const native=ar.begin("pointer",5,"route");
assert.equal(ar.begin("touch",0,"sheet"),native,"pointer/touch single logical candidate");
assert.equal(ar.begin("touch",0,"tabs"),native);
assert.equal(ar.begin("touch",0,"native"),native);
assert.equal(ar.claim("sheet",native),true);
assert.equal(ar.claim("tabs",native),false);
assert.equal(ar.claim("route",native),false);
assert.equal(ar.claim("native",native),false);
assert.equal(ar.owner(),"sheet");
assert.equal(ar.finish("tabs",native),false);
assert.equal(ar.finish("sheet",native),true);
assert.equal(ar.finish("sheet",native),false);
assert.equal(ar.snapshot().active,false);
console.log("REM02C_UNIT_PASS pointer+Touch candidates only one owner and one terminal");

// A pointerup in the outer visitor route may precede touchend in the inner
// sheet on Android. Releasing the outer candidate must NOT kill the inner
// gesture before it claims the vertical motion. This was the profile bug.
const parent=ar.begin("pointer",40,"route");
assert.equal(ar.begin("touch",0,"sheet"),parent);
assert.equal(ar.begin("touch",0,"tabs"),parent);
ar.finishCandidate(parent,"route");
assert.equal(ar.candidate("sheet",parent),true,"parent release preserves child");
assert.equal(ar.claim("sheet",parent),true,"child may claim after parent pointer terminal");
assert.equal(ar.finish("sheet",parent),true);
assert.equal(ar.snapshot().active,false);
const leftover=ar.begin("pointer",41,"browse");
assert.equal(ar.begin("pointer",41,"native"),leftover);
ar.finishCandidate(leftover,"browse");
assert.equal(ar.candidate("native",leftover),true,"native candidate survives browse release");
ar.finishCandidate(leftover,"native");
assert.equal(ar.snapshot().active,false,"last candidate releases session");
const sameKind=ar.begin("touch",9,"sheet");
assert.equal(ar.begin("touch",10,"tabs"),null,"second native touch cancels interaction");
assert.equal(ar.finish("sheet",sameKind),false,"cancelled touch never commits");
assert.equal(ar.snapshot().active,false);
console.log("REM02C_UNIT_PASS candidate-specific release, pointer/touch ordering and second-finger protection");


const mixed=ar.begin("pointer",71,"tabs");
assert.equal(ar.begin("touch",0,"sheet"),mixed);
assert.equal(ar.claim("sheet",mixed),true,"native Touch sheet wins a shared candidate");
assert.equal(ar.claim("tabs",mixed),false,"mouse/pen tab cannot paint over sheet");
assert.equal(ar.finish("sheet",mixed),true);
const opposite=ar.begin("pointer",72,"tabs");
ar.begin("touch",0,"sheet");
assert.equal(ar.claim("tabs",opposite),true);
assert.equal(ar.claim("sheet",opposite),false,"native Touch cannot overwrite claimed mouse/pen tabs");
assert.equal(ar.finish("tabs",opposite),true);
console.log("REM02C_UNIT_PASS mouse/pen tabs and native Touch sheet have exclusive write ownership");

const scroll=ar.begin("touch",8,"native");
ar.begin("touch",8,"sheet");ar.begin("touch",8,"tabs");
assert.equal(ar.nativeScroll(scroll),true);
assert.equal(ar.owner(),"native");
assert.equal(ar.claim("tabs",scroll),false,"passive scrolled content cannot steal native session");
assert.equal(ar.claim("sheet",scroll),false);
assert.equal(ar.finish("native",scroll),true);
console.log("REM02C_UNIT_PASS native scroll vetoes all custom writers and commits zero custom paints");

const second=ar.begin("pointer",12,"hero");
ar.claim("hero",second);
ar.secondFinger();
assert.equal(ar.owner(),null);
assert.equal(ar.finish("hero",second),false);
assert.equal(ar.begin("pointer",13,"hero"),second+1);
ar.cancel();
console.log("REM02C_UNIT_PASS second finger aborts custom session, stale generation cannot finish");

const tap=ar.begin("pointer",14,"browse");
assert.equal(ar.candidate("browse",tap),true);
ar.finishCandidate(tap);
assert.equal(ar.owner(),null);
assert.equal(ar.snapshot().active,false,"ordinary tap remains click");
const canceled=ar.begin("pointer",15,"route");
ar.claim("route",canceled);
ar.cancel();ar.cancel();
assert.equal(ar.finish("route",canceled),false);
console.log("REM02C_UNIT_PASS tap, pointercancel/lostpointercapture idempotence");

ar.dispose();
const afterStrictMode=ar.begin("touch",3,"sheet");
assert.ok(afterStrictMode!==null,"StrictMode provisional dispose must not brick recognizer");
assert.equal(ar.claim("sheet",afterStrictMode),true);
assert.equal(ar.finish("sheet",afterStrictMode),true);
ar.dispose();
console.log("REM02C_UNIT_PASS StrictMode post-cleanup gesture reconstruction");

const p=[{id:"a"},{id:"b"},{id:"c"}],reversed=[p[2],p[0],p[1]];
assert.equal(mod.preservePhotoId(p,reversed,"b"),2);
assert.equal(mod.preservePhotoId(p,reversed,"a"),1);
assert.equal(mod.preservePhotoId(p,[], "a"),0);
assert.equal(mod.preservePhotoId(p,reversed,"deleted",1),1);
console.log("REM02C_UNIT_PASS reordered/removed photos rebase by identity, never stale index");

const prevMatrix=globalThis.DOMMatrixReadOnly;
const prevCSS=globalThis.getComputedStyle;
globalThis.DOMMatrixReadOnly=class{constructor(matrix){
 const match=matrix.match(/^matrix\(([^)]+)\)$/);
 this.m41=match?Number(match[1].split(",")[4]):0;
}};
globalThis.getComputedStyle=el=>({transform:el.transform});
assert.equal(mod.computedTranslation({transform:"matrix(1,0,0,1,-162.5,0)"}),-162.5);
assert.equal(mod.fractionalTrack({transform:"matrix(1,0,0,1,-162.5,0)"},325,0),.5);
assert.ok(Math.abs(mod.fractionalTrack({transform:"none"},325,2))<1e-9,"matrix none is coordinate zero, signed zero allowed");
assert.equal(mod.fractionalTrack(null,0,2),2);
globalThis.DOMMatrixReadOnly=prevMatrix;
globalThis.getComputedStyle=prevCSS;
console.log("REM02C_UNIT_PASS actual matrix freezing recovers half-slide fractional coordinate");


const profile=read("apps/web/src/discovery/ProfileMorphA2.tsx");
const route=read("apps/web/src/discovery/VisitorProfileRoute.tsx");
const css=read("apps/web/src/discovery/profile-morph-a2.css");
const browse=read("apps/web/src/discovery/DiscoveryApp.tsx");
assert.ok(profile.includes('gestureArbiter?.begin("pointer"')&&
 profile.includes('gestureArbiter?.claim(')&&profile.includes('gestureArbiter?.finish('),
 "A2 visitor route shares exclusive GestureArbiter for sheet/hero/tabs");
assert.ok(profile.includes('onPointerCancel={e=>endSheet(e,true)}')&&
 profile.includes('onPointerCancel={e=>slideEnd(e,"photo",true)}')&&
 profile.includes('onPointerCancel={e=>slideEnd(e,"tab",true)}'),
 "all A2 pointer owners cancel deterministically");
assert.ok(css.includes(".pm-a2-page")&&css.includes("overflow-y:auto")&&
 css.includes("touch-action:pan-y")&&css.includes(".pm-a2-handle")&&css.includes("touch-action:none"),
 "native vertical scroll preserved, touch-action none only in gesture handle");
assert.ok(route.includes('gestureArbiter={gestures}')&&route.includes('if(isGestureModalBlocked(target))return;'),
 "Telegram modal and route arbitration preserved");
assert.ok(browse.includes("browseMotion.current.schedulePaint")&&
 !read("apps/web/src/discovery/discovery.css").includes("touch-action:none"),
 "Discovery gesture ownership unchanged");
console.log("PROFILE_A2_GESTURE_ADAPTER_PASS shared arbiter and scroll boundaries");
