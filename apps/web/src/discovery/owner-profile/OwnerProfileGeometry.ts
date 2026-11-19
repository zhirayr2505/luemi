export type OwnerProfileViewport={width:number;height:number;brandBottom:number};
export type OwnerProfileRect={x:number;y:number;width:number;height:number};
export type OwnerProfileLayout={
 width:number;
 hero:OwnerProfileRect;
 compactAvatar:OwnerProfileRect;
 roundDiameter:number;
 roundTop:number;
 expandedTabsTop:number;
 compactContentTop:number;
 initialSheetTravel:number;
 morphDistance:number;
};
export type OwnerMorphFrame={
 mask:OwnerProfileRect;
 radius:number;
 sheetTop:number;
 identityTop:number;
 identityCenter:number;
 haloOpacity:number;
};

const COLLAPSE_THRESHOLD=.64;
const ROUND_PHOTO=.85;
const EXPAND_THRESHOLD=.88;
const PHOTO_PARALLAX=.42;
const MAX_RUBBER=26;
const RUBBER_RESISTANCE=50;

const finite=(value:number,fallback:number)=>Number.isFinite(value)?value:fallback;
export const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,finite(value,min)));
const mix=(from:number,to:number,p:number)=>from*(1-p)+to*p;
const smooth=(p:number)=>{
 const t=clamp(p,0,1);
 return t*t*(3-2*t);
};

export function createOwnerProfileLayout(viewport:OwnerProfileViewport):OwnerProfileLayout{
 const width=Math.max(1,finite(viewport.width,393));
 const height=Math.max(1,finite(viewport.height,852));
 const brandBottom=Math.max(0,finite(viewport.brandBottom,65));
 const expandedTabsTop=width-22;
 const preferredDiameter=width>height?clamp(height*.245,84,108):clamp(width*.26,94,112);
 const diameter=Math.min(preferredDiameter,Math.max(60,expandedTabsTop-brandBottom-10-8-56-10));
 const compactAvatar={x:(width-diameter)/2,y:brandBottom+10,width:diameter,height:diameter};
 const compactContentTop=compactAvatar.y+diameter+8+56;
 const roundTop=compactAvatar.y-7;
 const roundDiameter=diameter+Math.min(diameter*.42,Math.max(0,expandedTabsTop-compactContentTop)*.44);
 const roundContentTop=roundTop+roundDiameter+8+56;
 const panelTravel=Math.max(0,expandedTabsTop-Math.max(roundContentTop,compactContentTop));
 // The first part of the gesture moves the sheet by the same number of pixels.
 // Leave room for the sheet to glide into its compact position during rounding.
 const initialTravel=Math.min(width*.30,panelTravel*.90);
 return {
  width,hero:{x:0,y:0,width,height:width},compactAvatar,roundDiameter,roundTop,
  expandedTabsTop,compactContentTop,initialSheetTravel:initialTravel,morphDistance:Math.max(44,initialTravel/COLLAPSE_THRESHOLD)
 };
}

export function ownerMorphProgress(position:number,distance:number):number{
 return clamp(position/Math.max(1,distance),0,1);
}

export function ownerMorphEndpoint(position:number,distance:number,velocity=0):number{
 if(velocity>=.38)return distance;
 if(velocity<=-.38)return 0;
 return position>=distance*.5?distance:0;
}

/** Choose the endpoint when a touch is released or a wheel gesture crosses a threshold. */
export function ownerAutoSnapTarget(accepted:0|1,position:number,distance:number):0|1|null{
 if(accepted===0&&position>=distance*COLLAPSE_THRESHOLD)return 1;
 if(accepted===1&&position<=distance*EXPAND_THRESHOLD)return 0;
 return null;
}

/** A coalesced move can skip past the boundary. Animate from the reached threshold. */
export function ownerSnapFrom(origin:number,target:0|1):number{
 return target===1?Math.max(origin,COLLAPSE_THRESHOLD):Math.min(origin,EXPAND_THRESHOLD);
}

export function ownerRubberPosition(position:number):number{
 if(position>=0)return position;
 const pull=-position;
 return -MAX_RUBBER*pull/(pull+RUBBER_RESISTANCE);
}

/** Reconstruct the finger coordinate when grabbing an ongoing rubber settle. */
export function ownerUnresistedPosition(position:number):number{
 if(position>=0)return position;
 const stretch=clamp(-position,0,MAX_RUBBER-.01);
 return -RUBBER_RESISTANCE*stretch/(MAX_RUBBER-stretch);
}

export function ownerMorphFrame(layout:OwnerProfileLayout,progress:number):OwnerMorphFrame{
 const p=clamp(progress,0,1),avatar=layout.compactAvatar;
 const initialClimb=Math.min(p/COLLAPSE_THRESHOLD,1)*layout.initialSheetTravel;
 const photoMorph=smooth((p-COLLAPSE_THRESHOLD)/(ROUND_PHOTO-COLLAPSE_THRESHOLD));
 const finalSettle=smooth((p-ROUND_PHOTO)/(1-ROUND_PHOTO));
 const roundContentTop=layout.roundTop+layout.roundDiameter+8+56;
 const sheetToCircle=clamp((p-COLLAPSE_THRESHOLD)/(ROUND_PHOTO-COLLAPSE_THRESHOLD),0,1);
 const sheetTop=mix(mix(layout.expandedTabsTop-initialClimb,roundContentTop,sheetToCircle),
  layout.compactContentTop,finalSettle);
 // Match the slope on both sides of the shape switch. The final segment
 // decelerates to rest at the compact endpoint.
 const t=sheetToCircle;
 const u=clamp((p-ROUND_PHOTO)/(1-ROUND_PHOTO),0,1);
 const throughCircle=(start:number,medium:number,end:number)=>{
  const slope=2*(end-medium)/(1-ROUND_PHOTO);
  if(p<ROUND_PHOTO)return mix(start,medium,photoMorph)
   +t*t*(t-1)*(ROUND_PHOTO-COLLAPSE_THRESHOLD)*slope;
  return mix(medium,end,u*(2-u));
 };
 const diameter=throughCircle(layout.width,layout.roundDiameter,avatar.width);
 const avatarY=throughCircle(-initialClimb*PHOTO_PARALLAX,layout.roundTop,avatar.y);
 const stretch=clamp(-progress*layout.morphDistance,0,MAX_RUBBER);
 const rebound=clamp((progress-1)*layout.morphDistance,0,7);
 const size=diameter*(1+stretch*.001);
 // One square mask, scaled uniformly. Once circular, its radius is exactly
 // half its diameter, and both the avatar and the text clear the actual brand.
 return {
  mask:{x:(layout.width-size)/2,y:avatarY-rebound,width:size,height:size},
  radius:p>=ROUND_PHOTO?size/2:0,
  sheetTop:sheetTop+stretch-rebound,
  identityTop:sheetTop-mix(70,56,photoMorph)+stretch-rebound,
  identityCenter:photoMorph,
  haloOpacity:finalSettle
 };
}
