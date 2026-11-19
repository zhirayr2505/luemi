export type OwnerProfileViewport={
 width:number;height:number;topInset?:number;bottomInset?:number;
};
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

export function createOwnerProfileLayout(viewport:OwnerProfileViewport):OwnerProfileLayout{
 const width=Math.max(280,finite(viewport.width,393));
 const height=Math.max(360,finite(viewport.height,852));
 const topInset=clamp(viewport.topInset??0,0,height*.2);
 const bottomInset=clamp(viewport.bottomInset??0,0,height*.16);
 const landscape=width>height;
 // The Telegram chrome/brand has a real reserved inset. Never start the
 // image at y=0 underneath the native controls.
 const heroY=clamp(topInset-24,36,Math.max(36,height*.18));
 const heroHeight=landscape?
  clamp(height*.70,238,Math.max(238,height-bottomInset-heroY-60)):
  clamp(height*.58,350,Math.max(350,height-bottomInset-heroY-158));
 const avatarSize=clamp(width*(landscape?.19:.235),78,104);
 const avatarY=clamp(topInset+52,84,Math.max(84,height-avatarSize-225));
 const compactAvatar={x:(width-avatarSize)/2,y:avatarY,width:avatarSize,height:avatarSize};
 // Leave enough room for name, city and a quiet gap before the content.
 const compactContentTop=clamp(avatarY+avatarSize+82,avatarY+avatarSize+75,height-bottomInset-112);
 const morphDistance=Math.max(96,heroY+heroHeight-28-compactContentTop);
 return {width,height,topInset,bottomInset,
  hero:{x:0,y:heroY,width,height:heroHeight},compactAvatar,compactContentTop,morphDistance};
}

export function ownerMorphProgress(scrollTop:number,morphDistance:number):number{
 return clamp(finite(scrollTop,0)/Math.max(1,finite(morphDistance,1)),0,1);
}

export function ownerMorphFrame(layout:OwnerProfileLayout,progress:number):OwnerMorphFrame{
 const p=clamp(progress,0,1),from=layout.hero,to=layout.compactAvatar;
 const mask=p===0?{...from}:p===1?{...to}:{
  x:mix(from.x,to.x,p),y:mix(from.y,to.y,p),
  width:mix(from.width,to.width,p),height:mix(from.height,to.height,p)
 };
 return {mask,radius:mix(0,to.width/2,p),
  expandedAlpha:clamp(1-p*1.7,0,1),compactAlpha:clamp((p-.58)/.42,0,1),
  actionsAlpha:clamp(1-p*2.15,0,1),photoShadeAlpha:clamp(1-p*.72,.28,1)};
}

/** Aspect-safe cover dimensions for the one foreground photo surface. */
export function coverPhoto(sourceWidth:number,sourceHeight:number,mask:OwnerProfileRect){
 const width=Math.max(1,finite(sourceWidth,mask.width));
 const height=Math.max(1,finite(sourceHeight,mask.height));
 const scale=Math.max(mask.width/width,mask.height/height);
 return {width:width*scale,height:height*scale,scale};
}
