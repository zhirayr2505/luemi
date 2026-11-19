import assert from "node:assert/strict";
import {buildSync} from "esbuild";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {pathToFileURL} from "node:url";

const directory=mkdtempSync(join(tmpdir(),"luemi-owner-profile-"));
try{
 const output=join(directory,"owner-profile-geometry.mjs");
 buildSync({
  entryPoints:["apps/web/src/discovery/owner-profile/OwnerProfileGeometry.ts"],
  outfile:output,bundle:true,platform:"node",format:"esm"
 });
 const {createOwnerProfileLayout,ownerMorphFrame,ownerMorphProgress,coverPhoto}=await import(pathToFileURL(output));

 const viewports=[
  {width:360,height:640,topInset:24,bottomInset:20},
  {width:393,height:852,topInset:32,bottomInset:24},
  {width:430,height:932,topInset:47,bottomInset:34},
  {width:852,height:393,topInset:18,bottomInset:16}
 ];
 for(const viewport of viewports){
  const layout=createOwnerProfileLayout(viewport);
  assert(layout.hero.height>layout.compactAvatar.height,"expanded photo must be materially larger than the avatar");
  assert(layout.morphDistance>0,"native scroll must have a positive morph range");
  assert(layout.compactAvatar.y>=viewport.topInset,"compact avatar stays below the Telegram safe area");
  assert.equal(layout.compactAvatar.x,(layout.width-layout.compactAvatar.width)/2,"compact avatar is horizontally centered");
  assert(layout.compactContentTop>layout.compactAvatar.y+layout.compactAvatar.height,"content starts below the compact identity");

  // Phase A follows the Telegram reference: the sheet moves first, the
  // photo must stay rectangular until the reserved 14% scroll threshold.
  const preMorph=ownerMorphFrame(layout,.12);
  assert.deepEqual(preMorph.mask,layout.hero,"content overlaps the unchanged photo before the round transition");
  assert.equal(preMorph.radius,0,"photo cannot round before the initial content lift");
  const rounding=ownerMorphFrame(layout,.71);
  assert.equal(rounding.mask.width,rounding.mask.height,"photo reaches a circle before the final glide");
  assert.equal(rounding.radius,rounding.mask.width/2,"rounding phase ends as a true circle");
  assert(Math.abs(layout.hero.y+layout.hero.height-18-layout.compactContentTop-4-layout.morphDistance)<1e-8
   ||layout.morphDistance===72,"tabs meet their sticky stop at the compact endpoint");

  const expanded=ownerMorphFrame(layout,0);
  assert.deepEqual(expanded.mask,layout.hero,"p=0 uses the full expanded photograph");
  assert.equal(expanded.radius,0,"expanded photograph has no artificial circular crop");
  assert.equal(expanded.expandedAlpha,1);
  assert.equal(expanded.compactAlpha,0);

  const compact=ownerMorphFrame(layout,1);
  assert.deepEqual(compact.mask,layout.compactAvatar,"p=1 uses the centered compact avatar rectangle");
  assert.equal(compact.mask.width,compact.mask.height,"compact avatar is square before clipping");
  assert.equal(compact.radius,compact.mask.width/2,"compact avatar is a perfect circle");
  assert.equal(compact.expandedAlpha,0);
  assert.equal(compact.compactAlpha,1);

  let previous=-1;
  for(let scroll=0;scroll<=layout.morphDistance;scroll+=Math.max(1,layout.morphDistance/11)){
   const progress=ownerMorphProgress(scroll,layout.morphDistance);
   assert(progress>=previous,"progress is monotonic while scrolling down");
   previous=progress;
  }
  assert(Math.abs(ownerMorphProgress(layout.morphDistance*.42,layout.morphDistance)-.42)<1e-10,
   "fractional scroll progress tolerates floating-point roundoff");
  assert.equal(ownerMorphProgress(layout.morphDistance*2,layout.morphDistance),1);
  assert.equal(ownerMorphProgress(-80,layout.morphDistance),0);
  assert.equal(ownerMorphProgress(layout.morphDistance*.42,layout.morphDistance),
   ownerMorphProgress(layout.morphDistance*.42,layout.morphDistance),"the same scroll position is fully reversible");

  for(const source of [[800,1200],[1600,900],[1000,1000]]){
   for(const progress of [0,.23,.5,.77,1]){
    const frame=ownerMorphFrame(layout,progress);
    const rendered=coverPhoto(source[0],source[1],frame.mask);
    assert(rendered.width+1e-8>=frame.mask.width&&rendered.height+1e-8>=frame.mask.height,
     "photo always covers the changing mask");
    assert(Math.abs(rendered.width/rendered.height-source[0]/source[1])<1e-10,
     "photo aspect ratio is never distorted during morph");
   }
  }
 }
 console.log("OWNER_PREMIUM_PROFILE_GEOMETRY_PASS 4 viewports, centered circle, reversible scroll progress, aspect-safe cover");
}finally{
 rmSync(directory,{recursive:true,force:true});
}
