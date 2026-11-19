export type OwnerProfileViewport={width:number;height:number;topInset?:number;bottomInset?:number};
export type OwnerProfileRect={x:number;y:number;width:number;height:number};
export type OwnerProfileLayout={
 width:number;height:number;topInset:number;bottomInset:number;
 hero:OwnerProfileRect;compactAvatar:OwnerProfileRect;
 compactContentTop:number;expandedTabsTop:number;morphDistance:number;contentOffset:number;
};
export type OwnerMorphFrame={
 /** The original square remains mounted: never expose a rounded rectangle. */
 mask:OwnerProfileRect;avatar:OwnerProfileRect;radius:number;
 squareAlpha:number;circleAlpha:number;expandedAlpha:number;compactAlpha:number;
 actionsAlpha:number;photoShadeAlpha:number;contentOffset:number;
};
const finite=(value:number,fallback:number)=>Number.isFinite(value)?value:fallback;
export const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,finite(value,min)));
const mix=(from:number,to:number,progress:number)=>from+(to-from)*clamp(progress,0,1);
const soften=(p:number)=>p*p*(3-2*p);

/** Telegram-style two-stage profile:
 * a 30%-ish sheet climb in front of the full rectangular image, followed by
 * a SHORT square-to-always-round image handoff. The circle, name and tabs fit
 * in the compact header without the previous oversized 120-150px avatar. */
export function createOwnerProfileLayout(viewport:OwnerProfileViewport):OwnerProfileLayout{
 const width=Math.max(280,finite(viewport.width,393));
 const height=Math.max(360,finite(viewport.height,852));
 const topInset=clamp(viewport.topInset??0,0,height*.2);
 const bottomInset=clamp(viewport.bottomInset??0,0,height*.16);
 const landscape=width>height;
 const hero={x:0,y:0,width,height:width};
 const avatarSize=landscape?clamp(height*.245,84,108):clamp(width*.26,94,112);
 const avatarY=Math.min(topInset+42,Math.max(topInset+20,width-avatarSize-100));
 const compactAvatar={x:(width-avatarSize)/2,y:avatarY,width:avatarSize,height:avatarSize};
 // Keep the compact title/city and the 52px tab rail underneath the avatar.
 const expandedTabsTop=width-22;
 const contentMinimum=avatarY+avatarSize+58;
 const contentMaximum=Math.max(contentMinimum,expandedTabsTop-20);
 const compactContentTop=clamp(avatarY+avatarSize+68,contentMinimum,contentMaximum);
 const tabTravel=expandedTabsTop-compactContentTop;
 // The panel finishes climbing BEFORE the photo switches shape. The remainder
 // of the virtual scroll interval is absorbed by the internal content offset.
 const morphDistance=Math.max(tabTravel+84,clamp(width*.49,168,242));
 const contentOffset=Math.max(0,morphDistance-tabTravel);
 return {width,height,topInset,bottomInset,hero,compactAvatar,
  compactContentTop,expandedTabsTop,morphDistance,contentOffset};
}
export function ownerMorphProgress(scrollTop:number,morphDistance:number):number{
 const distance=Math.max(1,finite(morphDistance,1));
 const scroll=Math.max(0,finite(scrollTop,0));
 if(scroll>=distance-.75)return 1;
 return clamp(scroll/distance,0,1);
}
/** Positive velocity shrinks toward compact, negative expands. */
export function ownerMorphEndpoint(scrollTop:number,morphDistance:number,velocity=0):number{
 const distance=Math.max(1,finite(morphDistance,1));
 const current=clamp(scrollTop,0,distance),speed=finite(velocity,0);
 if(speed>=.38)return distance;
 if(speed<=-.38)return 0;
 return current>=distance*.5?distance:0;
}
/** A held pointer crosses the threshold: snap WITHOUT waiting for pointerup. */
export function ownerAutoSnapTarget(start:number,current:number,distance:number):number|null{
 const travel=Math.max(1,finite(distance,1));
 if(start<=travel*.12&&current>=travel*.61)return travel;
 if(start>=travel*.88&&current<=travel*.39)return 0;
 return null;
}
export function ownerMorphFrame(layout:OwnerProfileLayout,progress:number):OwnerMorphFrame{
 const p=clamp(progress,0,1),from=layout.hero,to=layout.compactAvatar;
 // Never interpolate border-radius through pill/oval/rounded-square shapes.
 // The original large photo stays exactly square and fades out as an already
 // circular, independently clipped image fades into the same photograph.
 const circleTravel=soften(clamp((p-.62)/.17,0,1));
 const startDiameter=to.width*1.25,diameter=mix(startDiameter,to.width,circleTravel);
 const avatar={x:(layout.width-diameter)/2,y:to.y+(1-circleTravel)*18,
  width:diameter,height:diameter};
 const squareAlpha=1-soften(clamp((p-.60)/.105,0,1));
 const circleAlpha=soften(clamp((p-.61)/.13,0,1));
 const tabTravel=layout.expandedTabsTop-layout.compactContentTop;
 return {mask:from,avatar,radius:diameter/2,squareAlpha,circleAlpha,
  expandedAlpha:1-soften(clamp((p-.59)/.14,0,1)),
  compactAlpha:soften(clamp((p-.63)/.14,0,1)),
  actionsAlpha:clamp((.38-p)/.20,0,1),
  photoShadeAlpha:1-clamp((p-.20)/.56,0,1)*.65,
  // Until sticky activates, cards stay bonded to the tab bar. After that
  // offset exactly compensates the remaining virtual morph scroll distance.
  contentOffset:clamp(p*layout.morphDistance-tabTravel,0,layout.contentOffset)};
}
/** Aspect-safe cover dimensions for both the hero and circle image planes. */
export function coverPhoto(sourceWidth:number,sourceHeight:number,mask:OwnerProfileRect){
 const width=Math.max(1,finite(sourceWidth,mask.width));
 const height=Math.max(1,finite(sourceHeight,mask.height));
 const scale=Math.max(mask.width/width,mask.height/height);
 return {width:width*scale,height:height*scale,scale};
}
