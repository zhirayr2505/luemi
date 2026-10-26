export type Insets = {top:number;right:number;bottom:number;left:number};
export type Viewport = {width:number;height:number;insets?:Partial<Insets>;chromeBottom?:number};
export type Rect = {x:number;y:number;width:number;height:number};
export type MorphLayout = {
 width:number;height:number;safe:Insets;logo:Rect;avatar:Rect;
 compactTop:number;expandedTop:number;span:number;photo:Rect;
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
 const span=clamp(available*(short?.38:.59),0,Math.max(0,available-96));
 const expandedTop=compactTop+span;
 const logoWidth=Math.min(128,usable*.36);
 const logo={x:(width-logoWidth)/2,y:safe.top+8,width:logoWidth,height:40};
 const compactIdentity={x:avatar.x+size+14,y:avatarY+6,width:Math.max(0,width-safe.right-avatar.x-size-26),height:size};
 const expandedIdentity={x:safe.left+18,y:Math.max(headerBottom,expandedTop-114),width:usable-36,height:90};
 const tabs={x:0,y:compactTop+40,width,height:50};
 const scroll={x:0,y:tabs.y+tabs.height,width,height:Math.max(0,height-safe.bottom-tabs.y-tabs.height)};
 return {width,height,safe,logo,avatar,compactTop,expandedTop,span,photo:{x:0,y:0,width,height:expandedTop},compactIdentity,expandedIdentity,tabs,scroll};
}
export function photoMask(layout:MorphLayout,p:number):Rect {
 return {x:lerp(layout.avatar.x,0,p),y:lerp(layout.avatar.y,0,p),
  width:lerp(layout.avatar.width,layout.width,p),height:lerp(layout.avatar.height,layout.expandedTop,p)};
}
/** Intrinsic cover dimensions are constant throughout morph; only the crop translates. */
export function coverSize(sourceWidth:number,sourceHeight:number,box:Rect){
 const w=Math.max(1,finite(sourceWidth,box.width)),h=Math.max(1,finite(sourceHeight,box.height));
 const scale=Math.max(box.width/w,box.height/h);
 return {width:w*scale,height:h*scale,scale};
}
export function photoOffset(layout:MorphLayout,p:number,sourceWidth:number,sourceHeight:number){
 const mask=photoMask(layout,p),cover=coverSize(sourceWidth,sourceHeight,layout.photo);
 // The compact crop uses the same decoded pixels as expanded. Keep the focal
 // center near the upper third of a portrait; no nonuniform scaling is applied.
 const compactX=mask.width/2-cover.width*.5;
 const compactY=mask.height/2-cover.height*.32;
 const expandedX=(layout.width-cover.width)/2;
 const expandedY=(layout.expandedTop-cover.height)*.3;
 return {x:lerp(compactX,expandedX,p),y:lerp(compactY,expandedY,p),width:cover.width,height:cover.height};
}
