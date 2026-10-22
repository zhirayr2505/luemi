import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const path=new URL("../apps/web/src/discovery/",import.meta.url);
const load=async name=>{
 const source=readFileSync(new URL(name,path),"utf8");
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
};
const g=await load("photo-viewer-morph.ts"),a=await load("photo-viewer-safe-area.ts");
const src={left:17,top:93,width:359,height:570},dest={left:0,top:0,width:393,height:852};
const dims=[{width:720,height:960},{width:1500,height:650},{width:3000,height:400},{width:480,height:1500}];
const close=(x,y,eps=1e-8)=>assert.ok(Math.abs(x-y)<=eps,x+" != "+y);
for(const natural of dims){
 for(const fit of ["cover","contain","none","scale-down"]){
  for(const pos of ["center 20%","left top","right bottom","center center"]){
   const m=g.computeMorph(src,natural,fit,pos,dest);
   close(m.source.width/m.source.height,natural.width/natural.height);
   close(m.destination.width/m.destination.height,natural.width/natural.height);
   close(m.source.width/m.destination.width,m.scale);
   close(m.source.height/m.destination.height,m.scale);
   assert.ok(m.clipInsets.every(v=>v>=0&&Number.isFinite(v)));
   assert.ok(Number.isFinite(m.translateX)&&Number.isFinite(m.translateY));
  }
 }
}
const hero=g.computeMorph(src,{width:720,height:960},"cover","center 20%",dest);
close(hero.source.left,src.left+(src.width-hero.source.width)/2);
close(hero.source.top,src.top+(src.height-hero.source.height)*.2);
assert.ok(hero.clipInsets[0]>0||hero.clipInsets[3]>0);
const panorama=g.computeMorph({left:0,top:0,width:294,height:392},
 {width:2700,height:580},"cover","center center",dest);
assert.ok(panorama.clipInsets[3]>0&&panorama.clipInsets[1]>0);
assert.deepEqual(g.objectPosition("right bottom"),{x:1,y:1});
assert.deepEqual(g.objectPosition("center 20%"),{x:.5,y:.2});
assert.deepEqual(g.objectPosition("top"),{x:.5,y:0});
const style=g.geometryStyles(hero);
const mediaScale=style.transform.match(/scale\(([^)]*)\)/)?.[1];
assert.ok(mediaScale&&Number.isFinite(Number(mediaScale))&&!mediaScale.includes(","),
 "only one scale argument is allowed for image pixels (translate3d commas are unrelated)");
assert.ok(style.clipPath.startsWith("inset("));
const insets=a.normalizeInsets({top:14,bottom:18,left:1,right:2},
 {top:20,bottom:5,left:0,right:0},{top:17,bottom:32,left:4,right:1});
assert.deepEqual(insets,{top:20,bottom:32,left:4,right:2});
console.log("REM03D_UNIT_PASS 4 media ratios × 4 object-fit × 4 object-position, single uniform scale, hero 20% crop, 3:4 panoramic crop and nonadditive safe areas");
