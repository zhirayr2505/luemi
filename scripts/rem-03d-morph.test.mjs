import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const root=new URL("../apps/web/src/discovery/",import.meta.url);
const compile=path=>ts.transpileModule(readFileSync(new URL(path,root),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=code=>"data:text/javascript;base64,"+Buffer.from(code).toString("base64");
const state=uri(compile("photo-viewer-state.ts"));
const morph=await import(uri(compile("photo-viewer-morph.ts").replace(/from ["']\.\/photo-viewer-state["']/,"from "+JSON.stringify(state))));
const vp=await import(uri(compile("photo-viewer-viewport.ts").replace(/from ["']\.\.\/viewport\/viewport-model["']/,"from "+JSON.stringify(uri(compile("../viewport/viewport-model.ts"))))));
const close=(a,b,eps=1e-5)=>assert.ok(Math.abs(a-b)<=eps,String(a)+" != "+String(b));
const viewport={width:393,height:852},natural={width:720,height:960};
const hero={left:30,top:115,width:333,height:300};
const pixels=morph.objectPixels(hero,natural,"cover","50% 20%");
close(pixels.width,333);close(pixels.height,444);close(pixels.top,115+.2*(300-444));
const g=morph.computeMorph(hero,pixels,natural,viewport);assert.ok(g);
close(g.mediaScale,g.target.width/g.sourcePixels.width);
close(g.mediaScale,g.target.height/g.sourcePixels.height);
const grid={left:120,top:185,width:150,height:200};
const gm=morph.computeMorph(grid,morph.objectPixels(grid,natural,"cover","center center"),natural,viewport);
assert.ok(gm);close(gm.mediaScale,gm.target.width/gm.sourcePixels.width);
for(const size of [natural,{width:3300,height:330},{width:1900,height:650},{width:480,height:1500}]){
 for(const fit of ["cover","contain"]){
  const source={left:24,top:40,width:170,height:220};
  const image=morph.objectPixels(source,size,fit,"78% 13%");
  const result=morph.computeMorph(source,image,size,viewport);
  assert.ok(result);close(result.mediaScale,result.target.width/result.sourcePixels.width);
  close(result.mediaScale,result.target.height/result.sourcePixels.height);
  assert.ok(!("mediaScaleX" in result)&&!("mediaScaleY" in result));
 }
}
const cropped=morph.computeMorph(hero,pixels,natural,viewport,{left:30,top:120,width:200,height:90});
assert.ok(cropped);close(cropped.source.width,200);close(cropped.source.height,90);
assert.equal(morph.computeMorph(hero,pixels,natural,viewport,{left:500,top:120,width:200,height:90}),null);
const photo={id:"qa-alpha",src:"media.png",version:"2"};
const d={photoId:photo.id,resourceKey:JSON.stringify([photo.id,photo.src,photo.version]),contextId:"same"};
assert.equal(morph.validMorphSource(photo,d,"same","qa-alpha",hero,viewport),true);
assert.equal(morph.validMorphSource(photo,d,"other","qa-alpha",hero,viewport),false);
assert.equal(morph.validMorphSource(photo,d,"same","qa-beta",hero,viewport),false);
assert.equal(morph.validMorphSource(photo,{...d,resourceKey:"old"},"same","qa-alpha",hero,viewport),false);
const safe=vp.normalizeSafe({top:20,bottom:25},{top:32,bottom:14},{top:18,bottom:40});
assert.deepEqual(safe,{top:32,bottom:40,left:0,right:0},"never sum overlapping insets");
const snap={safeInsets:{top:26,right:3,bottom:19,left:5},contentInsets:{top:30,right:1,bottom:17,left:2}};
assert.deepEqual(vp.safeFromSnapshot(snap),{top:30,right:3,bottom:19,left:5});
assert.ok(vp.sameViewerViewport({width:393,height:852,safe,revision:1},{width:393,height:852,safe,revision:99}));
console.log("REM03D_UNIT_PASS hero 20% crop, 3:4 grid, four ratios/two fits uniform matrix, source identity, max safe insets, revision");
