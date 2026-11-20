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
 const {createOwnerProfileLayout,ownerAutoSnapTarget,ownerMorphEndpoint,ownerMorphFrame,
  ownerMorphProgress,ownerRubberPosition,ownerUnresistedPosition,interpolateOwnerPhotoPose}=await import(pathToFileURL(output));

 const viewports=[
  {width:360,height:640,brandBottom:65},
  {width:393,height:852,brandBottom:74},
  {width:430,height:932,brandBottom:86},
  {width:852,height:393,brandBottom:65}
 ];
 for(const viewport of viewports){
  const layout=createOwnerProfileLayout(viewport),distance=layout.morphDistance;
  const expanded=ownerMorphFrame(layout,0),compact=ownerMorphFrame(layout,1);
  assert.deepEqual(expanded.mask,{x:0,y:0,width:viewport.width,height:viewport.width},
   "expanded photo is a full-width square");
  assert.equal(expanded.sheetTop,viewport.width-22,"the rounded sheet overlaps the expanded photo");
  assert.equal(expanded.radius,0);


  const pull=distance*.56,tracking=ownerMorphFrame(layout,pull/distance);
  assert(Math.abs(expanded.sheetTop-tracking.sheetTop-pull)<1e-8,"the sheet tracks the finger 1:1");
  assert.equal(tracking.mask.width,expanded.mask.width,"photo remains full-width in the first phase");
  assert.equal(tracking.radius,0,"photo stays square until the sheet has climbed");
  assert.deepEqual(tracking.mask,expanded.mask,"the square stays in the expanded position while the sheet rises");
  assert(tracking.mask.height>=tracking.sheetTop,"the rising sheet continues to overlap the photo");

  assert.deepEqual(compact.mask,layout.compactAvatar);
  assert.equal(compact.mask.x,(layout.width-compact.mask.width)/2,"compact photo is centered");
  assert(compact.mask.y>=viewport.brandBottom+10,"the circle clears the actual wordmark");
  assert(compact.mask.width<=(viewport.width>viewport.height?108:112));
  assert(compact.mask.width>=(viewport.width>viewport.height?84:94));
  assert.equal(compact.radius,compact.mask.width/2,"the compact photo is a perfect circle");
  assert(compact.identityTop>=compact.mask.y+compact.mask.height+8,"the name clears the avatar");
  assert.equal(compact.sheetTop-compact.identityTop,56,"the city and name clear the tabs");

  for(let step=0;step<=100;step++){
   const frame=ownerMorphFrame(layout,step/100);
   assert.equal(frame.mask.width,frame.mask.height,"the same mask always scales uniformly");
   assert(frame.radius===0||frame.radius===frame.mask.width/2,"no intermediate rounded square");
   if(frame.mask.width<expanded.mask.width)
    assert.equal(frame.radius,frame.mask.width/2,`${viewport.width}px: the mask is circular as soon as the photo shrinks (progress ${step/100})`);
  }
  const opening=ownerMorphFrame(layout,.91);
  assert(opening.mask.width>compact.mask.width,"reverse visibly grows the circle before it opens");
  const round=ownerMorphFrame(layout,.64);
  assert(round.mask.width>=compact.mask.width*1.28,"the medium circle is larger than the docked avatar");
  if(viewport.width<viewport.height)
   assert(Math.abs(round.mask.width/viewport.width-.41)<.005,"the medium circle matches the reference diameter");
  assert(round.identityTop>=round.mask.y+round.mask.height+7,"the larger circle clears the name");
  assert(compact.haloOpacity>0,"the docked avatar has a photo-colored halo");
  assert.equal(opening.radius,opening.mask.width/2);
  assert(opening.mask.y>=viewport.brandBottom);

  const stretch=ownerRubberPosition(-150);
  const stretched=ownerMorphFrame(layout,stretch/distance);
  assert(Math.abs(ownerUnresistedPosition(stretch)+150)<1e-8,"a new drag can catch the rubber without resetting its position");
  assert(stretched.sheetTop>expanded.sheetTop&&stretched.sheetTop<expanded.sheetTop+26);
  assert(stretched.mask.width>expanded.mask.width*1.01&&stretched.mask.width<expanded.mask.width*1.03);
  assert(stretched.mask.y+stretched.mask.height>=stretched.sheetTop,"overpull leaves no uncovered stripe");

  assert.equal(ownerAutoSnapTarget(0,distance*.62,distance),null);
  assert.equal(ownerAutoSnapTarget(0,distance*.65,distance),1,"crossing the threshold allows release to compact");
  assert.equal(ownerAutoSnapTarget(1,distance*.90,distance),null);
  assert.equal(ownerAutoSnapTarget(1,distance*.86,distance),0,"crossing the threshold allows release to expand");
  const before=ownerMorphFrame(layout,.64-.00001);
  assert.deepEqual(before.mask,expanded.mask,"the final square frame still fills the header");
  assert.equal(before.radius,0);
  assert.equal(before.haloOpacity,0);
  assert.equal(round.radius,round.mask.width/2,"the first round frame has the reference diameter");
  assert(round.haloOpacity>0,"the photo glow appears on the same frame as the circle");
  const initialPhoto={mask:before.mask,radius:before.radius,haloOpacity:before.haloOpacity};
  const roundPhoto={mask:round.mask,radius:round.radius,haloOpacity:round.haloOpacity};
  for(const [from,to] of [[initialPhoto,roundPhoto],[roundPhoto,initialPhoto]]){
   assert.deepEqual(interpolateOwnerPhotoPose(from,to,0),from);
   assert.deepEqual(interpolateOwnerPhotoPose(from,to,1),to);
   const middle=interpolateOwnerPhotoPose(from,to,.5);
   assert(middle.mask.width>round.mask.width&&middle.mask.width<before.mask.width,
    "the visible photo eases its size between both geometries");
   assert.equal(middle.radius/middle.mask.width,.25,"shape rounds proportionally as its size changes");
   assert.equal(middle.haloOpacity,round.haloOpacity/2,"the photo glow fades with the shape");
  }
  assert(Math.abs(round.sheetTop-before.sheetTop)<.1,"the sheet continues smoothly across the snap");
  const after=ownerMorphFrame(layout,.65);
  assert(after.mask.width<round.mask.width&&after.mask.width>compact.mask.width,
   "the circle shrinks smoothly from the snap diameter toward the dock");
  assert.equal(ownerMorphProgress(-80,distance),0);
  assert.equal(ownerMorphProgress(distance*2,distance),1);
  assert.equal(ownerMorphEndpoint(distance*.49,distance),0);
  assert.equal(ownerMorphEndpoint(distance*.51,distance),distance);
  assert.equal(ownerMorphEndpoint(distance*.18,distance,.7),distance);
  assert.equal(ownerMorphEndpoint(distance*.82,distance,-.7),0);
 }

 const short=createOwnerProfileLayout({width:393,height:640,brandBottom:65});
 const tall=createOwnerProfileLayout({width:393,height:932,brandBottom:65});
 assert.deepEqual(short,tall,"portrait height alone cannot change photos or translate the tabs");
 console.log("OWNER_PREMIUM_PROFILE_GEOMETRY_PASS 4 viewports, snap diameter, single square mask, safe area and reversible morph thresholds");
}finally{
 rmSync(directory,{recursive:true,force:true});
}
