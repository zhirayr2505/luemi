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
 const {createOwnerProfileLayout,ownerAutoSnapTarget,ownerMorphEndpoint,ownerMorphFrame,ownerMorphProgress,coverPhoto}=await import(pathToFileURL(output));

 const viewports=[
  {width:360,height:640,topInset:24,bottomInset:20},
  {width:393,height:852,topInset:32,bottomInset:24},
  {width:430,height:932,topInset:47,bottomInset:34},
  {width:852,height:393,topInset:18,bottomInset:16}
 ];
 for(const viewport of viewports){
  const layout=createOwnerProfileLayout(viewport);
  assert.equal(layout.hero.x,0,"expanded photo begins at the left content edge");
  assert.equal(layout.hero.y,0,"expanded photo begins at the top content edge");
  assert.equal(layout.hero.width,layout.width,"expanded photo uses the complete available width");
  assert.equal(layout.hero.height,layout.width,"expanded photo is always a 1:1 square");
  assert.equal(layout.expandedTabsTop,layout.hero.y+layout.hero.height-22,
   "rounded bottom sheet overlaps the hero by exactly 22 CSS pixels");
  assert(layout.compactAvatar.width>=84&&layout.compactAvatar.width<=112,
   "Telegram-style compact avatar is 84-112px, not the oversized V4.1 portrait");
  if(layout.width<=layout.height)assert(layout.compactAvatar.width>=94,
   "portrait avatar keeps a tappable, recognisable photograph");
  assert(layout.morphDistance>layout.expandedTabsTop-layout.compactContentTop+80,
   "photo handoff happens after the panel has already climbed");
  assert(layout.hero.height>layout.compactAvatar.height,"expanded photo must be materially larger than the avatar");
  assert(layout.morphDistance>0,"native scroll must have a positive morph range");
  assert(layout.compactAvatar.y>=viewport.topInset,"compact avatar stays below the Telegram safe area");
  assert.equal(layout.compactAvatar.x,(layout.width-layout.compactAvatar.width)/2,"compact avatar is horizontally centered");
  assert(layout.compactContentTop>layout.compactAvatar.y+layout.compactAvatar.height,"content starts below the compact identity");
  assert(layout.expandedTabsTop>layout.compactContentTop,"tabs travel upward before their sticky stop");
  assert.equal(layout.contentOffset,layout.morphDistance-(layout.expandedTabsTop-layout.compactContentTop),
   "one geometry value keeps cards below tabs after the longer morph travel");

  // V4.2: photo stays fully square while the sheet covers roughly a third
  // of it, then a separate ALWAYS circular image fades in quickly.
  const preMorph=ownerMorphFrame(layout,.58);
  assert.deepEqual(preMorph.mask,layout.hero,"the large photo stays square until after the sheet climbs");
  assert.equal(preMorph.squareAlpha,1,"no rounding during the sheet climb");
  assert.equal(preMorph.circleAlpha,0,"no circle appears before the Telegram handoff");
  const handoff=ownerMorphFrame(layout,.68);
  assert.deepEqual(handoff.mask,layout.hero,"square photo never turns into a rounded rectangle");
  assert(handoff.squareAlpha<1&&handoff.circleAlpha>0,"rapid two-plane switch crossfades photographs");
  assert.equal(handoff.avatar.width,handoff.avatar.height,"circle plane never becomes an oval");
  assert.equal(handoff.radius,handoff.avatar.width/2,"circle is geometrically perfect during handoff");
  const rounding=ownerMorphFrame(layout,.72);
  assert(rounding.avatar.y>layout.compactAvatar.y,
   "the round image glides gently upward at the end");

  const expanded=ownerMorphFrame(layout,0);
  assert.deepEqual(expanded.mask,layout.hero,"p=0 uses the full rectangular photograph");
  assert.equal(expanded.squareAlpha,1);
  assert.equal(expanded.circleAlpha,0);
  assert.equal(expanded.expandedAlpha,1);
  assert.equal(expanded.compactAlpha,0);

  const compact=ownerMorphFrame(layout,1);
  assert.deepEqual(compact.mask,layout.hero,"the same large hero image stays mounted throughout");
  assert.deepEqual(compact.avatar,layout.compactAvatar,"p=1 uses the centered Telegram-sized circular photo");
  assert.equal(compact.radius,compact.avatar.width/2,"the final photo is a perfect circle");
  assert.equal(compact.squareAlpha,0);
  assert.equal(compact.circleAlpha,1);
  assert.equal(compact.expandedAlpha,0);
  assert.equal(compact.compactAlpha,1);

  for(let step=0;step<=100;step++){
   const f=ownerMorphFrame(layout,step/100);
   assert(f.expandedAlpha+f.compactAlpha>=.49,"name cannot vanish during the morph");
   assert.deepEqual(f.mask,layout.hero,"never mutate the big rectangular photo into an oval");
   assert.equal(f.avatar.width,f.avatar.height,"photo circle is not an oval at any intermediate step");
   assert.equal(f.radius,f.avatar.width/2,"photo is circular at every visible intermediate frame");
   assert(f.contentOffset>=0&&f.contentOffset<=layout.contentOffset,
    "card compensation follows the same bounded normalized morph coordinate");
  }
  for(const progress of [0,.08,.18,.33,.5,.72,.86,1]){
   const frame=ownerMorphFrame(layout,progress);
   assert.equal(frame.mask.width,frame.mask.height,"the original large hero is square");
  }
  for(const [start,current,expected] of [
   [0,layout.morphDistance*.60,null],
   [0,layout.morphDistance*.62,layout.morphDistance],
   [layout.morphDistance,layout.morphDistance*.40,null],
   [layout.morphDistance,layout.morphDistance*.38,0]
  ]){
   assert.equal(ownerAutoSnapTarget(start,current,layout.morphDistance),expected,
    "held-finger Telegram threshold must fire without pointerup");
  }

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
  assert.equal(ownerMorphEndpoint(layout.morphDistance*.49,layout.morphDistance,0),0,
   "slow release below the midpoint settles expanded");
  assert.equal(ownerMorphEndpoint(layout.morphDistance*.51,layout.morphDistance,0),layout.morphDistance,
   "slow release above the midpoint settles compact");
  assert.equal(ownerMorphEndpoint(layout.morphDistance*.18,layout.morphDistance,.7),layout.morphDistance,
   "fast upward content motion settles compact even before the midpoint");
  assert.equal(ownerMorphEndpoint(layout.morphDistance*.82,layout.morphDistance,-.7),0,
   "fast downward content motion settles expanded even after the midpoint");

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

 const short=createOwnerProfileLayout({width:393,height:640,topInset:32,bottomInset:20});
 const tall=createOwnerProfileLayout({width:393,height:932,topInset:32,bottomInset:34});
 assert.deepEqual(short.hero,tall.hero,"tab content or viewport height cannot change square hero geometry");
 assert.deepEqual(short.compactAvatar,tall.compactAvatar,"tab content or viewport height cannot resize the compact avatar");
 assert.equal(short.morphDistance,tall.morphDistance,"tab content height cannot become a morph input");
 console.log("OWNER_PREMIUM_PROFILE_GEOMETRY_PASS 4 viewports, two-plane circle handoff, held-touch thresholds, spring geometry");
}finally{
 rmSync(directory,{recursive:true,force:true});
}
