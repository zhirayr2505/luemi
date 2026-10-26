export type Insets = {top:number;right:number;bottom:number;left:number};
export type Viewport = {width:number;height:number;insets?:Partial<Insets>;chromeBottom?:number};
export type Rect = {x:number;y:number;width:number;height:number};
export type MorphLayout = {
 width:number;height:number;safe:Insets;logo:Rect;avatar:Rect;
 compactTop:number;expandedTop:number;span:number;heroBleed:number;photo:Rect;
 compactIdentity:Rect;expandedIdentity:Rect;tabs:Rect;scroll:Rect;
};
const finite=(v:number,fallback=0)=>Number.isFinite(v)?v:fallback;
export const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,finite(v,min)));
export const lerp=(a:number,b:number,p:number)=>a+(b-a)*clamp(p,0,1);
export function createProfileLayout(v:Viewport):MorphLayout {
 const width=Math.max(240,finite(v.width,390)),height=Math.max(260,finite(v.height,740));
 const safe={top:clamp(v.insets?.top??0,0,height*.22),right:clamp(v.insets?.right??0,0,width*.12),
  bottom:clamp(v.insets?.bottom??0,0,height*.18),left:clamp(v.insets?.left??0,0,width*.12)};
 const usable=width-safe.left-safe.right;
 const headerBottom=clamp(v.chromeBottom??safe.top+65,safe.top+46,Math.max(safe.top+46,height*.26));
 const short=height<540;
 const size=clamp(usable*(short?.205:.275),short?62:90,short?84:116);
 const avatarY=clamp(headerBottom+(short?8:24),safe.top+52,Math.max(safe.top+52,height-(short?165:270)));
 const avatar={x:safe.left+18,y:avatarY,width:size,height:size};
 const compactTop=clamp(avatarY+size+(short?10:24),safe.top+130,height-Math.min(140,height*.23));
 const available=Math.max(0,height-safe.bottom-compactTop);
 // On a small WebView do not promote a full-viewport portrait layer. The
 // expanded hero is capped to a portrait-sized area above the content sheet.
 const heroLimit=clamp(height*.435,short?215:280,short?290:395);
 const span=Math.max(0,Math.min(available*(short?.38:.59),available-96,heroLimit-compactTop));
 const expandedTop=compactTop+span;
 // The hero remains behind the sheet's 31px rounded corners, including
 // a small allowance for the bounded elastic pull past expanded.
 const heroBleed=36;
 const logoWidth=Math.min(128,usable*.36);
 const logo={x:(width-logoWidth)/2,y:safe.top+8,width:logoWidth,height:40};
 const compactIdentity={x:avatar.x+size+14,y:avatarY+6,width:Math.max(0,width-safe.right-avatar.x-size-26),height:size};
 const expandedIdentity={x:safe.left+18,y:Math.max(headerBottom,expandedTop-114),width:usable-36,height:90};
 const tabs={x:0,y:compactTop+40,width,height:50};
 const scroll={x:0,y:tabs.y+tabs.height,width,height:Math.max(0,height-safe.bottom-tabs.y-tabs.height)};
 return {width,height,safe,logo,avatar,compactTop,expandedTop,span,heroBleed,
  photo:{x:0,y:0,width,height:expandedTop+heroBleed},compactIdentity,expandedIdentity,tabs,scroll};
}
export function photoMask(layout:MorphLayout,p:number):Rect {
 return {x:lerp(layout.avatar.x,0,p),y:lerp(layout.avatar.y,0,p),
  width:lerp(layout.avatar.width,layout.width,p),height:lerp(layout.avatar.height,layout.expandedTop+layout.heroBleed,p)};
}
/** Expanded cover dimensions provide the stable base for a uniformly scaled image. */
export function coverSize(sourceWidth:number,sourceHeight:number,box:Rect){
 const w=Math.max(1,finite(sourceWidth,box.width)),h=Math.max(1,finite(sourceHeight,box.height));
 const scale=Math.max(box.width/w,box.height/h);
 return {width:w*scale,height:h*scale,scale};
}
export function photoOffset(layout:MorphLayout,p:number,sourceWidth:number,sourceHeight:number){
 const cover=coverSize(sourceWidth,sourceHeight,layout.photo);
 // Interpolate ONE uniform scale. Interpolating width and height separately
 // changes the aspect ratio between the endpoints, visibly warping faces.
 const w=Math.max(1,finite(sourceWidth,layout.avatar.width));
 const h=Math.max(1,finite(sourceHeight,layout.avatar.height));
 // Inscribe the entire rectangular source inside the circular viewport.
 // Fitting to the square's edges would still clip its corners at the circle.
 const portraitScale=Math.min(layout.avatar.width,layout.avatar.height)/Math.hypot(w,h);
 const portraitW=w*portraitScale,portraitH=h*portraitScale;
 const compactX=(layout.avatar.width-portraitW)/2;
 const compactY=(layout.avatar.height-portraitH)/2;
 const expandedX=(layout.width-cover.width)/2;
 // Keep the approved crop when it already covers the bleed; shift only when
 // a landscape image would otherwise leave its lower edge exposed.
 const expandedY=Math.min((layout.expandedTop-cover.height)*.3,layout.photo.height-cover.height);
 const scale=lerp(portraitScale,cover.scale,p);
 return {x:lerp(compactX,expandedX,p),y:lerp(compactY,expandedY,p),
  width:w*scale,height:h*scale,scale:scale/cover.scale,
  baseWidth:cover.width,baseHeight:cover.height};
}
