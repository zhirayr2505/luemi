/** REM-03C / LU-04 · math only; single image transform owner.
 * Coordinates are measured in the actual untransformed viewer surface CSS pixels.
 * Object-fit:contain places the media center at C (the local viewport center).
 * CSS transform is translate3d(tx,ty,0) scale(s), transform-origin:center.
 */
export type Point={x:number;y:number};
export type Viewport={width:number;height:number};
export type MediaTransform={scale:number;x:number;y:number};
export type FitRect={x:number;y:number;width:number;height:number;cx:number;cy:number};
export type PinchAnchor={q:Point;startDistance:number;startScale:number;ids:readonly [number,number]};
const MIN_SCALE=1;
const MAX_SCALE=3.2;
export const identityMedia=():MediaTransform=>({scale:1,x:0,y:0});
export function finite(value:number,fallback=0):number{return Number.isFinite(value)?value:fallback;}
export function clampScale(s:number):number{return Math.min(MAX_SCALE,Math.max(MIN_SCALE,finite(s,1)));}
export function contentFit(view:Viewport,natural:Viewport):FitRect{
 const width=Math.max(1,finite(view.width,1)),height=Math.max(1,finite(view.height,1));
 const nw=Math.max(1,finite(natural.width,1)),nh=Math.max(1,finite(natural.height,1));
 const ratio=Math.min(width/nw,height/nh);
 const w=nw*ratio,h=nh*ratio;
 return {x:(width-w)/2,y:(height-h)/2,width:w,height:h,cx:width/2,cy:height/2};
}
/** Bind client CSS pixels to the actual transformed surface rect. During an
 * interrupted opening the surface rect may not equal viewport coordinates.
 * Local geometry is in the untransformed surface's own layout units. */
export function localFromClient(client:Point,rect:{left:number;top:number;width:number;height:number},
 layout:Viewport):Point{
 return {
  x:(client.x-finite(rect.left))*Math.max(1,layout.width)/Math.max(1,rect.width),
  y:(client.y-finite(rect.top))*Math.max(1,layout.height)/Math.max(1,rect.height)
 };
}
export function midpoint(a:Point,b:Point):Point{return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
export function distance(a:Point,b:Point):number{return Math.hypot(b.x-a.x,b.y-a.y);}
export function clampPan(t:MediaTransform,view:Viewport,natural:Viewport):MediaTransform{
 const fit=contentFit(view,natural),scale=clampScale(t.scale);
 // The object-fit image is centered, so x/y are offsets of its true center.
 // When scaled content fits a dimension, zero the offset on that dimension.
 const extentX=Math.max(0,(fit.width*scale-view.width)/2);
 const extentY=Math.max(0,(fit.height*scale-view.height)/2);
 return {scale,
  x:Math.max(-extentX,Math.min(extentX,finite(t.x))),
  y:Math.max(-extentY,Math.min(extentY,finite(t.y)))};
}
export function beginPinch(ids:readonly [number,number],a:Point,b:Point,
 t:MediaTransform,view:Viewport):PinchAnchor{
 const f=midpoint(a,b),C={x:view.width/2,y:view.height/2},s=clampScale(t.scale);
 return {ids,startDistance:Math.max(1,distance(a,b)),startScale:s,
  q:{x:(f.x-C.x-t.x)/s,y:(f.y-C.y-t.y)/s}};
}
/** Unconstrained focal solve exactly preserves q under moving midpoint. */
export function focalSolve(anchor:PinchAnchor,a:Point,b:Point,view:Viewport):MediaTransform{
 const f=midpoint(a,b),s=clampScale(anchor.startScale*distance(a,b)/anchor.startDistance);
 return {scale:s,x:f.x-view.width/2-anchor.q.x*s,y:f.y-view.height/2-anchor.q.y*s};
}
export function pinchFrame(anchor:PinchAnchor,a:Point,b:Point,view:Viewport,
 natural:Viewport):MediaTransform{
 return clampPan(focalSolve(anchor,a,b,view),view,natural);
}
export function panFrame(origin:MediaTransform,delta:Point,view:Viewport,natural:Viewport):MediaTransform{
 return clampPan({scale:origin.scale,x:origin.x+delta.x,y:origin.y+delta.y},view,natural);
}
export function matrixTransform(css:string):MediaTransform{
 if(css==="none"||!css)return identityMedia();
 try{
  const m=new DOMMatrixReadOnly(css);
  const s=Math.hypot(m.m11,m.m12);
  return {scale:clampScale(s),x:finite(m.m41),y:finite(m.m42)};
 }catch{return identityMedia();}
}
export function focalContentAt(f:Point,t:MediaTransform,view:Viewport):Point{
 return {x:(f.x-view.width/2-t.x)/t.scale,y:(f.y-view.height/2-t.y)/t.scale};
}
