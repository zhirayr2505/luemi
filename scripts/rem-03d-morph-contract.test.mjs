import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const load=path=>ts.transpileModule(readFileSync(new URL("../apps/web/src/"+path,import.meta.url),"utf8"),
 {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const morph=await import("data:text/javascript;base64,"+Buffer.from(load("discovery/photo-viewer-morph.ts")).toString("base64"));
const eq=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<eps,String(a)+" differs from "+String(b));
const viewport={left:0,top:0,width:393,height:852};
const cases=[
 {name:"hero",box:{left:11,top:105,width:360,height:190},nat:{width:720,height:960},pos:"22% 70%",fit:"cover"},
 {name:"grid3x4",box:{left:22,top:170,width:204,height:272},nat:{width:720,height:960},pos:"50% 50%",fit:"cover"},
 {name:"landscape",box:{left:14,top:120,width:300,height:175},nat:{width:1600,height:650},pos:"18% 70%",fit:"cover"},
 {name:"panorama",box:{left:0,top:100,width:393,height:205},nat:{width:3000,height:300},pos:"100% 50%",fit:"cover"},
 {name:"contained",box:{left:10,top:80,width:280,height:280},nat:{width:1600,height:650},pos:"50% 50%",fit:"contain"}
];
for(const c of cases){
 const result=morph.calculateMorph(c.box,c.nat,c.fit,c.pos,c.box,viewport);
 assert.ok(result,c.name+" must produce a source morph");
 eq(result.sourceImage.width/result.sourceImage.height,c.nat.width/c.nat.height);
 eq(result.destination.width/result.destination.height,c.nat.width/c.nat.height);
 eq(result.uniformScale,result.sourceImage.width/result.destination.width);
 eq(result.uniformScale,result.sourceImage.height/result.destination.height);
 assert.ok(!/scale\([^,)]+,/.test(morph.morphTransform(result)),c.name+" uses uniform scale only");
 assert.ok(morph.insetClip(result.sourceClip,viewport).startsWith("inset("));
}
const box={left:0,top:0,width:100,height:100},natural={width:200,height:100};
const cover=morph.fitImage(box,natural,"cover",{x:.22,y:.7});
eq(cover.width,200);eq(cover.height,100);eq(cover.left,-22);
assert.equal(morph.objectPosition("right bottom",box,cover).x,1);
assert.equal(morph.objectPosition("calc(20% + 5px) 50%",box,cover),null);
assert.equal(morph.calculateMorph(box,natural,"fill","50% 50%",box,viewport),null,
 "distorting object-fit fill must use fade fallback");
assert.equal(morph.intersect({left:0,top:0,width:20,height:20},{left:50,top:50,width:20,height:20}),null);
assert.equal(morph.validInViewport({left:0,top:1200,width:180,height:200},viewport),false);
assert.equal(morph.validInViewport({left:0,top:200,width:180,height:200},viewport),true);
const clip=morph.intersect({left:10,top:20,width:300,height:200},{left:90,top:75,width:120,height:100});
assert.deepEqual(clip,{left:90,top:75,width:120,height:100});
const pre=load("viewport/viewport-model.ts");
const uri="data:text/javascript;base64,"+Buffer.from(pre).toString("base64");
const safeSource=load("discovery/photo-viewer-safe-area.ts").replace(
 /from ["']\.\.\/viewport\/viewport-model["']/,"from "+JSON.stringify(uri));
const safe=await import("data:text/javascript;base64,"+Buffer.from(safeSource).toString("base64"));
assert.deepEqual(safe.combineInsets({top:24,bottom:18,left:3},{top:41,bottom:7,right:5},{top:29,bottom:27}),
 {top:41,bottom:27,left:3,right:5});
assert.deepEqual(safe.combineInsets(null,null,null),{top:0,bottom:0,left:0,right:0});
console.log("REM03D_UNIT_PASS 5 aspect fixtures, cover crop and position, uniform matrix, source fallbacks, clipping, max-safe-insets");
