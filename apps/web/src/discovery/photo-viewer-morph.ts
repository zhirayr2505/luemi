/** LU-06 · single-scale media morph: crop is clip geometry, never scaleY.
 * Measurements are viewport CSS pixels. An overlay img is laid out at the
 * destination contain rect then moved with a UNIFORM transform to the
 * source's rendered object-fit image box.
 */
export type Rect={left:number;top:number;width:number;height:number};
export type Dimensions={width:number;height:number};
export type MediaBox=Rect;
export type MorphGeometry={
 source:MediaBox;destination:MediaBox;visibleSource:Rect;
 scale:number;translateX:number;translateY:number;clipInsets:[number,number,number,number];
};
const finite=(x:number)=>Number.isFinite(x)?x:0;
const max=(x:number)=>Math.max(1,finite(x));
export function positionUnit(token:string,axis:"x"|"y"):number{
 const p=token.trim().toLowerCase();
 if(p==="center")return .5;
 if(p==="left"||p==="top")return 0;
 if(p==="right"||p==="bottom")return 1;
 if(p.endsWith("%"))return Math.min(1,Math.max(0,finite(parseFloat(p))/100));
 return axis==="x"?.5:.5;
}
export function objectPosition(position:string):{x:number;y:number}{
 const terms=position.trim().split(/\s+/).filter(Boolean);
 if(!terms.length)return {x:.5,y:.5};
 const [a,b]=terms;
 if(!b){
  if(a==="top"||a==="bottom")return {x:.5,y:positionUnit(a,"y")};
  return {x:positionUnit(a,"x"),y:.5};
 }
 if(a==="top"||a==="bottom")return {x:positionUnit(b,"x"),y:positionUnit(a,"y")};
 return {x:positionUnit(a,"x"),y:positionUnit(b,"y")};
}
export function renderedMedia(rect:Rect,natural:Dimensions,
 fit:"cover"|"contain"|"fill"|"none"|"scale-down",position:string):MediaBox{
 const nw=max(natural.width),nh=max(natural.height),w=max(rect.width),h=max(rect.height);
 const scale=fit==="cover"?Math.max(w/nw,h/nh):
  fit==="none"?1:fit==="scale-down"?Math.min(1,Math.min(w/nw,h/nh)):Math.min(w/nw,h/nh);
 const mw=fit==="fill"?w:nw*scale,mh=fit==="fill"?h:nh*scale;
 const at=objectPosition(position);
 return {left:rect.left+(w-mw)*at.x,top:rect.top+(h-mh)*at.y,width:mw,height:mh};
}
export function containRect(viewport:Rect,natural:Dimensions):Rect{
 return renderedMedia(viewport,natural,"contain","center center");
}
export function computeMorph(sourceRect:Rect,natural:Dimensions,fit:"cover"|"contain"|"none"|"scale-down",position:string,
 viewport:Rect):MorphGeometry{
 const src=renderedMedia(sourceRect,natural,fit,position);
 const dst=containRect(viewport,natural);
 const scale=src.width/max(dst.width);
 const epsilon=Math.abs(src.height/max(dst.height)-scale);
 if(epsilon>1e-4)throw Error("non-uniform image morph is forbidden");
 const top=Math.max(0,(sourceRect.top-src.top)/scale);
 const right=Math.max(0,(src.left+src.width-sourceRect.left-sourceRect.width)/scale);
 const bottom=Math.max(0,(src.top+src.height-sourceRect.top-sourceRect.height)/scale);
 const left=Math.max(0,(sourceRect.left-src.left)/scale);
 return {source:src,destination:dst,visibleSource:sourceRect,scale,
  translateX:src.left-dst.left,translateY:src.top-dst.top,
  clipInsets:[top,right,bottom,left]};
}
export function isVisibleSource(el:HTMLElement,viewport:Dimensions):boolean{
 if(!el.isConnected||el.dataset.photoId===undefined)return false;
 const r=el.getBoundingClientRect();
 if(!Number.isFinite(r.width)||r.width<=8||r.height<=8||
  r.right<=0||r.bottom<=0||r.left>=viewport.width||r.top>=viewport.height)return false;
 let node:HTMLElement|null=el;
 while(node){
  const style=getComputedStyle(node);
  if(style.visibility==="hidden"||style.display==="none"||Number(style.opacity)<=.01)return false;
  if(node.classList.contains("pm-viewer"))return false;
  node=node.parentElement;
 }
 return true;
}
export function geometryStyles(morph:MorphGeometry){
 const {destination:d,scale,translateX,translateY,clipInsets:c}=morph;
 return {
  left:d.left+"px",top:d.top+"px",width:d.width+"px",height:d.height+"px",
  transform:"translate3d("+translateX+"px,"+translateY+"px,0) scale("+scale+")",
  clipPath:"inset("+c.map(v=>v+"px").join(" ")+")"
 };
}
