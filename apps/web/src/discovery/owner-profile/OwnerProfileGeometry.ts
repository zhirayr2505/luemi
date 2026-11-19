export type OwnerProfileViewport={width:number;height:number;topInset?:number;bottomInset?:number};
export type OwnerProfileRect={x:number;y:number;width:number;height:number};
export type OwnerProfileLayout={
 width:number;height:number;topInset:number;bottomInset:number;
 hero:OwnerProfileRect;compactAvatar:OwnerProfileRect;
 compactContentTop:number;expandedTabsTop:number;morphDistance:number;contentOffset:number;
};
export type OwnerMorphFrame={
 mask:OwnerProfileRect;radius:number;expandedAlpha:number;compactAlpha:number;
 actionsAlpha:number;photoShadeAlpha:number;contentOffset:number;
};
const finite=(value:number,fallback:number)=>Number.isFinite(value)?value:fallback;
export const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,finite(value,min)));
const mix=(from:number,to:number,progress:number)=>from+(to-from)*clamp(progress,0,1);
const soften=(p:number)=>p*p*(3-2*p);

/** One geometry contract for the native scroll, photo, identity, tabs and cards.
 * The expanded photograph is always a full-width square at the content edge.
 * The rounded sheet begins 22px over the expanded square and may reach its
 * sticky stop before the longer visual morph ends;
 * contentOffset keeps the first card below that single tab element. */
export function createOwnerProfileLayout(viewport:OwnerProfileViewport):OwnerProfileLayout{
 const width=Math.max(280,finite(viewport.width,393));
 const height=Math.max(360,finite(viewport.height,852));
 const topInset=clamp(viewport.topInset??0,0,height*.2);
 const bottomInset=clamp(viewport.bottomInset??0,0,height*.16);
 const landscape=width>height;
 const hero={x:0,y:0,width,height:width};
 const avatarSize=landscape?clamp(Math.min(width,height)*.27,96,132):clamp(width*.35,120,150);
 const avatarY=Math.min(topInset+52,Math.max(topInset+42,width-avatarSize-100));
 const compactAvatar={x:(width-avatarSize)/2,y:avatarY,width:avatarSize,height:avatarSize};
 // The rounded content sheet covers the bottom 22px of the expanded photo.
 const expandedTabsTop=hero.height-22;
 const contentMinimum=avatarY+avatarSize+62;
 const contentMaximum=Math.max(contentMinimum,expandedTabsTop-20);
 const compactContentTop=clamp(avatarY+avatarSize+74,contentMinimum,contentMaximum);
 const tabTravel=Math.max(0,expandedTabsTop-compactContentTop);
 // A short visual travel makes the square-to-circle morph unreadable. Keep a
 // bounded motion interval that is independent of tab panel/scrollHeight.
 const morphDistance=Math.max(tabTravel,clamp(width*.24,88,112));
 const contentOffset=Math.max(0,morphDistance-tabTravel);
 return {width,height,topInset,bottomInset,
  hero,compactAvatar,compactContentTop,expandedTabsTop,morphDistance,contentOffset};
}
export function ownerMorphProgress(scrollTop:number,morphDistance:number):number{
 const distance=Math.max(1,finite(morphDistance,1));
 const scroll=Math.max(0,finite(scrollTop,0));
 // CSS pixel rounding in Android WebView can leave the scroll endpoint less
 // than a pixel short (e.g. 179px scroll against a 179.33px sticky target).
 // Treat that native endpoint as fully compact, rather than painting a nearly
 // circular image forever in the transient morph state.
 if(scroll>=distance-.75)return 1;
 return clamp(scroll/distance,0,1);
}
/** Velocity is native scroll velocity in CSS pixels per millisecond:
 * positive moves toward the compact endpoint, negative toward expanded. */
export function ownerMorphEndpoint(scrollTop:number,morphDistance:number,velocity=0):number{
 const distance=Math.max(1,finite(morphDistance,1));
 const current=clamp(scrollTop,0,distance);
 const speed=finite(velocity,0);
 if(speed>=.38)return distance;
 if(speed<=-.38)return 0;
 return current>=distance*.5?distance:0;
}
export function ownerMorphFrame(layout:OwnerProfileLayout,progress:number):OwnerMorphFrame{
 const p=clamp(progress,0,1),from=layout.hero,to=layout.compactAvatar;
 // Phase A (0-.18): content moves over the unchanged square photograph.
 // Phase B (.18-.72): the same square mask shrinks and becomes a circle.
 // Phase C (.72-1): the already circular mask glides into its final position.
 const rounding=soften(clamp((p-.18)/.54,0,1));
 const settling=soften(clamp((p-.72)/.28,0,1));
 const intermediateSize=clamp(to.width*1.18,to.width,Math.min(layout.width*.42,154));
 const intermediate={
  x:(layout.width-intermediateSize)/2,
  y:to.y+Math.max(14,to.height*.16),width:intermediateSize,height:intermediateSize
 };
 const mask=p<=.18?{...from}:p>=1?{...to}:p<.72?{
  x:mix(from.x,intermediate.x,rounding),y:mix(from.y,intermediate.y,rounding),
  width:mix(from.width,intermediate.width,rounding),
  height:mix(from.height,intermediate.height,rounding)
 }:{
  x:mix(intermediate.x,to.x,settling),y:mix(intermediate.y,to.y,settling),
  width:mix(intermediate.width,to.width,settling),
  height:mix(intermediate.height,to.height,settling)
 };
 // Radius tracks the live square width, avoiding a partially clipped GPU edge
 // as width/height change together during the Android WebView morph.
 const radius=p<=.18?0:p<.72?mask.width*rounding/2:mask.width/2;
 return {mask,radius,
  expandedAlpha:clamp((.54-p)/.24,0,1),
  compactAlpha:clamp((p-.66)/.20,0,1),
  actionsAlpha:clamp((.38-p)/.20,0,1),
  photoShadeAlpha:1-clamp((p-.20)/.56,0,1)*.65,
  contentOffset:mix(0,layout.contentOffset,soften(p))};
}
/** Aspect-safe cover dimensions for the single foreground photo surface. */
export function coverPhoto(sourceWidth:number,sourceHeight:number,mask:OwnerProfileRect){
 const width=Math.max(1,finite(sourceWidth,mask.width));
 const height=Math.max(1,finite(sourceHeight,mask.height));
 const scale=Math.max(mask.width/width,mask.height/height);
 return {width:width*scale,height:height*scale,scale};
}
