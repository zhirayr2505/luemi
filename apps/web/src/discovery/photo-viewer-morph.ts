/** REM-03D / LU-06 · source crop and aspect-preserving visual geometry.
 * No motion driver: existing PhotoViewer MotionController owns completion.
 */
import {resourceIdentity} from "./photo-viewer-state";
import type {ProfilePhoto} from "./ProfileModel";
export type Rect={left:number;top:number;width:number;height:number};
export type Size={width:number;height:number};
export type MorphGeometry={
 source:Rect;target:Rect;sourcePixels:Rect;
 initialClip:{top:number;right:number;bottom:number;left:number};
 finalClip:{top:number;right:number;bottom:number;left:number};
 mediaScale:number;mediaDx:number;mediaDy:number;
};
export const positive=(x:number)=>Number.isFinite(x)&&x>0;
export const bounded=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const rect=(r:Rect):Rect=>({left:r.left,top:r.top,width:r.width,height:r.height});
export function intersection(a:Rect,b:Rect):Rect|null {
 const left=Math.max(a.left,b.left),top=Math.max(a.top,b.top);
 const right=Math.min(a.left+a.width,b.left+b.width);
 const bottom=Math.min(a.top+a.height,b.top+b.height);
 return right-left>0&&bottom-top>0?{left,top,width:right-left,height:bottom-top}:null;
}
export function fitSize(natural:Size,box:Size,fit:"cover"|"contain"):Size{
 if(!positive(natural.width)||!positive(natural.height)||!positive(box.width)||!positive(box.height))
  return {width:0,height:0};
 const scale=(fit==="cover"?Math.max:Math.min)(box.width/natural.width,box.height/natural.height);
 return {width:natural.width*scale,height:natural.height*scale};
}
/** The browser positions replaced content within its content box using x/y
 * percentages or pixel lengths; a non-center hero object-position is valid. */
export function positionOffset(extra:number,token:string):number{
 const t=token.trim().toLowerCase();
 if(t==="left"||t==="top")return 0;
 if(t==="right"||t==="bottom")return extra;
 if(t==="center")return extra/2;
 if(t.endsWith("%")){const pct=Number.parseFloat(t);return Number.isFinite(pct)?extra*pct/100:extra/2;}
 if(t.endsWith("px")){const px=Number.parseFloat(t);return Number.isFinite(px)?px:extra/2;}
 return extra/2;
}
export function positionParts(css:string):[string,string]{
 const tokens=css.trim().split(/\s+/).filter(Boolean);
 if(tokens.length===1){
  if(tokens[0]==="top"||tokens[0]==="bottom")return ["center",tokens[0]];
  return [tokens[0]??"center","center"];
 }
 return [tokens[0]??"center",tokens[1]??"center"];
}
export function objectPixels(sourceBox:Rect,natural:Size,fit:"cover"|"contain",
 objectPosition:string):Rect {
 const size=fitSize(natural,sourceBox,fit),[px,py]=positionParts(objectPosition);
 return {left:sourceBox.left+positionOffset(sourceBox.width-size.width,px),
  top:sourceBox.top+positionOffset(sourceBox.height-size.height,py),
  width:size.width,height:size.height};
}
export function containTarget(natural:Size,viewport:Size):Rect{
 const target=fitSize(natural,viewport,"contain");
 return {left:(viewport.width-target.width)/2,top:(viewport.height-target.height)/2,
  width:target.width,height:target.height};
}
export function clipInsets(viewport:Size,crop:Rect){
 return {top:crop.top,right:viewport.width-crop.left-crop.width,
  bottom:viewport.height-crop.top-crop.height,left:crop.left};
}
export function computeMorph(sourceRect:Rect,sourcePixels:Rect,natural:Size,viewport:Size,
 visibleRect:Rect=sourceRect):MorphGeometry|null {
 if(!positive(sourceRect.width)||!positive(sourceRect.height)||
  !positive(sourcePixels.width)||!positive(sourcePixels.height))return null;
 const visible=intersection(sourceRect,visibleRect);
 if(!visible||visible.width<8||visible.height<8)return null;
 const target=containTarget(natural,viewport);
 if(!positive(target.width)||!positive(target.height))return null;
 const scale=target.width/sourcePixels.width;
 // Ratio for intrinsic pixels stays uniform. Independent scaleX/Y are forbidden.
 if(!Number.isFinite(scale)||scale<=0)return null;
 const scaleY=target.height/sourcePixels.height;
 if(Math.abs(scale-scaleY)>1e-5)return null;
 return {source:rect(visible),target,sourcePixels:rect(sourcePixels),
  initialClip:clipInsets(viewport,visible),
  finalClip:clipInsets(viewport,target),
  mediaScale:scale,mediaDx:target.left-sourcePixels.left,
  mediaDy:target.top-sourcePixels.top};
}
export function validMorphSource(photo:Pick<ProfilePhoto,"id"|"src"> & {version?:string},
 descriptor:{photoId:string;resourceKey:string;contextId:string}|null,
 contextId:string,domId:string|undefined,visible:Rect|null,viewport:Size):boolean {
 return !!descriptor&&descriptor.photoId===photo.id&&descriptor.contextId===contextId&&
  descriptor.resourceKey===resourceIdentity(photo)&&domId===photo.id&&!!visible&&
  positive(visible.width)&&positive(visible.height)&&
  !!intersection(visible,{left:0,top:0,width:viewport.width,height:viewport.height});
}
export function clipCss(c:{top:number;right:number;bottom:number;left:number}):string {
 return "inset("+c.top+"px "+c.right+"px "+c.bottom+"px "+c.left+"px)";
}
