import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const path=new URL("../apps/web/src/discovery/",import.meta.url);
const compile=name=>ts.transpileModule(readFileSync(new URL(name,path),"utf8"),{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText;
const uri=s=>"data:text/javascript;base64,"+Buffer.from(s).toString("base64");
const stateUri=uri(compile("photo-viewer-state.ts"));
const mod=await import(uri(compile("photo-viewer-geometry.ts").replace(
 /from ["']\.\/photo-viewer-state["']/,"from "+JSON.stringify(stateUri))));
const photos=Array.from({length:6},(_,i)=>({id:"p"+i,src:"src"+i,version:"v1",status:"published"}));
assert.deepEqual(mod.trackWindow([],null).map(s=>s.photo),[null,null,null]);
assert.deepEqual(mod.trackWindow(photos.slice(0,1),"p0").map(s=>s.photo?.id??null),[null,"p0",null]);
assert.deepEqual(mod.trackWindow(photos.slice(0,2),"p0").map(s=>s.photo?.id??null),[null,"p0","p1"]);
assert.deepEqual(mod.trackWindow(photos,"p3").map(s=>s.photo?.id??null),["p2","p3","p4"]);
assert.deepEqual(mod.trackWindow(photos,"p5").map(s=>s.photo?.id??null),["p4","p5",null]);
assert.equal(mod.trackWindow(photos,"p2")[1].photo,photos[2],"identity preserved, no recreated model");
for(const x of [-390,-120,-10,0,35,160,390]){
 const dx=mod.allowedOffset(x,393,true,true);
 assert.ok(Math.abs(dx-x)<.0001,"interior is precisely 1:1 CSS px");
}
assert.ok(mod.allowedOffset(120,393,false,true)>0&&mod.allowedOffset(120,393,false,true)<120);
assert.ok(mod.allowedOffset(-120,393,true,false)<0&&mod.allowedOffset(-120,393,true,false)>-120);
assert.ok(mod.allowedOffset(500,393,true,true)>393&&mod.allowedOffset(500,393,true,true)<500);
assert.ok(mod.edgeResistance(100000,393)<393*.32+.001,"finite monotonic overscroll bound");
assert.equal(mod.destination(-393*.18,393,0,true,true),-1);
assert.equal(mod.destination(393*.18,393,0,true,true),1);
assert.equal(mod.destination(0,393,-.53,true,true),-1);
assert.equal(mod.destination(0,393,.53,true,true),1);
assert.equal(mod.destination(-393*.16,393,-.49,true,true),0);
assert.equal(mod.destination(-393*.8,393,-.8,false,false),0,"no transition past boundaries");
assert.equal(mod.destination(393*.8,393,.8,false,true),0);
assert.equal(mod.destination(-393*.8,393,-.8,true,false),0);
assert.ok(Math.abs(mod.resizeOffset(-393*.4,393,430)+172)<1e-9,"viewport rebase preserves fractional pixel offset");
assert.equal(mod.recenterOffset(-393,1,393),0);
assert.equal(mod.recenterOffset(393,-1,393),0);
const trace=[{x:0,t:0},{x:60,t:150},{x:60,t:200},{x:35,t:230},{x:5,t:245}];
assert.ok(mod.recentVelocity(trace)<-.52,"flick samples recent direction, not long-start average");
assert.equal(mod.recentVelocity([{x:0,t:1}]),0);
assert.equal(mod.recentVelocity([{x:0,t:0},{x:60,t:20},{x:60,t:200}]),0,
 "a held-finger release after 80ms cannot inherit stale flick velocity");
console.log("REM03B_UNIT_PASS 0/1/2/6 slots, 1:1 translation, bounded edge resistance, velocity sampling, 17%/.52 threshold, recenter and resize");
