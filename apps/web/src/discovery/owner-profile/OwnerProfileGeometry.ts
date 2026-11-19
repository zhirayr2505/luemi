export type OwnerProfileViewport={width:number;height:number;topInset?:number;bottomInset?:number};
export type OwnerProfileRect={x:number;y:number;width:number;height:number};
export type OwnerProfileLayout={
 width:number;height:number;topInset:number;bottomInset:number;
 hero:OwnerProfileRect;compactAvatar:OwnerProfileRect;
 compactContentTop:number;morphDistance:number;
};
export type OwnerMorphFrame={
 mask:OwnerProfileRect;radius:number;expandedAlpha:number;compactAlpha:number;
 actionsAlpha:number;photoShadeAlpha:number;
};
const finite=(value:number,fallback:number)=>Number.isFinite(value)?value:fallback;
export const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,finite(value,min)));
const mix=(from:number,to:number,progress:number)=>from+(to-from)*clamp(progress,0,1);
const soften=(p:number)=>p*p*(3-2*p);

/** One native-scroll authority for photo, tabs and cards. The first 14% of
 * scroll belongs to the content: the full photograph must not shrink yet.
 * The photograph then rounds rapidly and finishes as a centered avatar.
 * The tabs reach their sticky stop at EXACTLY morphDistance. */
export const OWNER_TABS_OVERLAP=18;
export function createOwnerProfileLayout(viewport:OwnerProfileViewport):OwnerProfileLayout{
 const width=Math.max(280,finite(viewport.width,393));
 const height=Math.max(360,finite(viewport.height,852));
 const topInset=clamp(viewport.topInset??0,0,height*.2);
 const bottomInset=clamp(viewport.bottomInset??0,0,height*.16);
 const landscape=width>height;
 // A reserved Telegram inset keeps both the original wordmark and portrait
 // below the native close/menu chrome.
 const heroY=clamp(topInset-24,36,Math.max(36,height*.18));
 const heroHeight=landscape?
  clamp(height*.70,238,Math.max(238,height-bottomInset-heroY-60)):
  clamp(height*.58,350,Math.max(350,height-bottomInset-heroY-158));
 const avatarSize=landscape?clamp(width*.19,78,104):clamp(width*.31,108,136);
 const avatarY=clamp(topInset+55,topInset+36,Math.max(topInset+36,height-avatarSize-215));
 const compactAvatar={x:(width-avatarSize)/2,y:avatarY,width:avatarSize,height:avatarSize};
 const contentMinimum=avatarY+avatarSize+42;
 const contentMaximum=Math.max(contentMinimum,heroY+heroHeight-OWNER_TABS_OVERLAP-76);
 const compactContentTop=clamp(avatarY+avatarSize+92,contentMinimum,contentMaximum);
 // Four tabs begin exactly OWNER_TABS_OVERLAP above the expanded photo's end.
 // A 4px sticky gap is deliberately included in the single scroll distance.
 const morphDistance=Math.max(72,heroY+heroHeight-OWNER_TABS_OVERLAP-compactContentTop-4);
 return {width,height,topInset,bottomInset,
  hero:{x:0,y:heroY,width,height:heroHeight},compactAvatar,compactContentTop,morphDistance};
}
export function ownerMorphProgress(scrollTop:number,morphDistance:number):number{
 return clamp(finite(scrollTop,0)/Math.max(1,finite(morphDistance,1)),0,1);
}
export function ownerMorphFrame(layout:OwnerProfileLayout,progress:number):OwnerMorphFrame{
 const p=clamp(progress,0,1),from=layout.hero,to=layout.compactAvatar;
 // Phase A (0-.14): content moves over the unchanged full-bleed photograph.
 // Phase B (.14-.71): one continuous clipped photo rounds into a circle.
 // Phase C (.71-1): the circle glides to its final centered position.
 const rounding=soften(clamp((p-.14)/.57,0,1));
 const settling=soften(clamp((p-.71)/.29,0,1));
 const intermediateSize=Math.min(layout.width*.41,154);
 const intermediate={
  x:(layout.width-intermediateSize)/2,
  y:to.y+28,width:intermediateSize,height:intermediateSize
 };
 const mask=p<=.14?{...from}:p>=1?{...to}:p<.71?{
  x:mix(from.x,intermediate.x,rounding),y:mix(from.y,intermediate.y,rounding),
  width:mix(from.width,intermediate.width,rounding),
  height:mix(from.height,intermediate.height,rounding)
 }:{
  x:mix(intermediate.x,to.x,settling),y:mix(intermediate.y,to.y,settling),
  width:mix(intermediate.width,to.width,settling),
  height:mix(intermediate.height,to.height,settling)
 };
 const radius=p<=.14?0:p<.71?mix(0,intermediateSize/2,rounding):
  mix(intermediateSize/2,to.width/2,settling);
 return {mask,radius,
  expandedAlpha:clamp((.37-p)/.22,0,1),
  compactAlpha:clamp((p-.69)/.27,0,1),
  actionsAlpha:clamp((.34-p)/.19,0,1),
  photoShadeAlpha:1-clamp((p-.16)/.54,0,1)*.84};
}
/** Aspect-safe cover dimensions for the single foreground photo surface. */
export function coverPhoto(sourceWidth:number,sourceHeight:number,mask:OwnerProfileRect){
 const width=Math.max(1,finite(sourceWidth,mask.width));
 const height=Math.max(1,finite(sourceHeight,mask.height));
 const scale=Math.max(mask.width/width,mask.height/height);
 return {width:width*scale,height:height*scale,scale};
}
