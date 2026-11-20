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

const PHOTO_SNAP_PROGRESS=.64;
const REFERENCE_DIAMETER_RATIO=.41;
const EXPAND_THRESHOLD=.88;
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
 const preferredRoundDiameter=width>height?diameter*1.42:width*REFERENCE_DIAMETER_RATIO;
 const availableRoundDiameter=expandedTabsTop-(compactAvatar.y-7)-8-56;
 const roundDiameter=clamp(preferredRoundDiameter,diameter,Math.max(diameter,availableRoundDiameter));
 const roundTop=compactAvatar.y-Math.min(7,roundDiameter-diameter);
 const roundContentTop=roundTop+roundDiameter+8+56;
 const initialTravel=Math.max(0,expandedTabsTop-roundContentTop);
 return {
  width,hero:{x:0,y:0,width,height:width},compactAvatar,roundDiameter,roundTop,
  expandedTabsTop,compactContentTop,initialSheetTravel:initialTravel,morphDistance:Math.max(44,initialTravel/PHOTO_SNAP_PROGRESS)
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
 if(accepted===0&&position>=distance*PHOTO_SNAP_PROGRESS)return 1;
 if(accepted===1&&position<=distance*EXPAND_THRESHOLD)return 0;
 return null;
}

/** A coalesced move can skip past the boundary. Animate from the reached threshold. */
export function ownerSnapFrom(origin:number,target:0|1):number{
 return target===1?Math.max(origin,PHOTO_SNAP_PROGRESS):Math.min(origin,EXPAND_THRESHOLD);
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
 const circular=p>=PHOTO_SNAP_PROGRESS;
 const initialClimb=Math.min(p/PHOTO_SNAP_PROGRESS,1)*layout.initialSheetTravel;
 const dock=smooth((p-PHOTO_SNAP_PROGRESS)/(1-PHOTO_SNAP_PROGRESS));
 const sheetTop=mix(layout.expandedTabsTop-initialClimb,layout.compactContentTop,dock);
 const diameter=circular?mix(layout.roundDiameter,avatar.width,dock):layout.width;
 const avatarY=circular?mix(layout.roundTop,avatar.y,dock):layout.hero.y;
 const identityCenter=smooth(p/PHOTO_SNAP_PROGRESS);
 const stretch=clamp(-progress*layout.morphDistance,0,MAX_RUBBER);
 const rebound=clamp((progress-1)*layout.morphDistance,0,7);
 const size=diameter*(1+stretch*.001);
 // Both directions share the same discontinuity in photo shape and diameter.
 return {
  mask:{x:(layout.width-size)/2,y:avatarY-rebound,width:size,height:size},
  radius:circular?size/2:0,
  sheetTop:sheetTop+stretch-rebound,
  identityTop:sheetTop-mix(70,56,identityCenter)+stretch-rebound,
  identityCenter,
  haloOpacity:circular?.82:0
 };
}
