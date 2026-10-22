/** REM-03D / LU-06. Pure, CSS-viewport-pixel image morph geometry.
 * Source is the visible object-fit content, not the element's stretched box.
 * Destination is the real object-fit:contain image rectangle.
 */
export type Rect={left:number;top:number;width:number;height:number};
export type Natural={width:number;height:number};
export type Position={x:number;y:number};
export type CropMorph={sourceClip:Rect;sourceImage:Rect;destination:Rect;
 uniformScale:number;translateX:number;translateY:number};
const finite=(n:number)=>Number.isFinite(n)?n:0;
export function intersect(a:Rect,b:Rect):Rect|null{
 const l=Math.max(a.left,b.left),t=Math.max(a.top,b.top);
 const r=Math.min(a.left+a.width,b.left+b.width),d=Math.min(a.top+a.height,b.top+b.height);
 return r>l&&d>t?{left:l,top:t,width:r-l,height:d-t}:null;
}
export function fitImage(rect:Rect,natural:Natural,fit:"cover"|"contain"|"fill",
 position:Position={x:.5,y:.5}):Rect|null{
 if(rect.width<=0||rect.height<=0||natural.width<=0||natural.height<=0)return null;
 const scale=fit==="cover"?Math.max(rect.width/natural.width,rect.height/natural.height):
  fit==="contain"?Math.min(rect.width/natural.width,rect.height/natural.height):null;
 // Fill would distort pixels for mismatched aspects, so source morph must fade.
 if(scale===null)return Math.abs(rect.width/natural.width-rect.height/natural.height)<1e-5?rect:null;
 const w=natural.width*scale,h=natural.height*scale;
 return {left:rect.left+(rect.width-w)*position.x,top:rect.top+(rect.height-h)*position.y,width:w,height:h};
}
/** The object-position grammar supports percentages and pixel lengths.
 * A pixel offset is relative to the start edge, not available free space.
 * Unrecognized calc/keywords produce null, and we use a safe fade. */
export function objectPosition(value:string,container:Rect,paint:Rect):Position|null{
 const tokens=value.trim().toLowerCase().replace(/\bcenter\b/g,"50%")
  .replace(/\bleft\b/g,"0%").replace(/\bright\b/g,"100%")
  .replace(/\btop\b/g,"0%").replace(/\bbottom\b/g,"100%").split(/\s+/);
 const parsed=tokens.length===1?[tokens[0],"50%"]:tokens;
 if(parsed.length!==2)return null;
 const axis=(token:string,available:number):number|null=>{
  if(/^-?\d+(?:\.\d+)?%$/.test(token))return Number.parseFloat(token)/100;
  if(/^-?\d+(?:\.\d+)?px$/.test(token))
   return Math.abs(available)<.001?0:Number.parseFloat(token)/available;
  return null;
 };
 const x=axis(parsed[0],container.width-paint.width);
 const y=axis(parsed[1],container.height-paint.height);
 return x===null||y===null?null:{x,y};
}
export function calculateMorph(sourceBox:Rect,natural:Natural,fit:"cover"|"contain"|"fill",
 objectPos:string,clip:Rect,viewport:Rect):CropMorph|null{
 const provisional=fitImage(sourceBox,natural,fit);
 if(!provisional)return null;
 const position=objectPosition(objectPos,sourceBox,provisional);
 if(!position)return null;
 const sourceImage=fitImage(sourceBox,natural,fit,position);
 const destination=fitImage(viewport,natural,"contain");
 const sourceClip=intersect(sourceBox,clip);
 if(!sourceImage||!destination||!sourceClip||sourceClip.width<8||sourceClip.height<8)return null;
 const sx=sourceImage.width/destination.width,sy=sourceImage.height/destination.height;
 if(!Number.isFinite(sx)||Math.abs(sx-sy)>.001||sx<=0)return null;
 return {sourceClip,sourceImage,destination,uniformScale:sx,
  translateX:sourceImage.left-destination.left,
  translateY:sourceImage.top-destination.top};
}
export function validInViewport(r:Rect,viewport:Rect):boolean{
 return r.width>8&&r.height>8&&!!intersect(r,viewport)&&
  (intersect(r,viewport)!.width*intersect(r,viewport)!.height>=.12*r.width*r.height);
}
/** Ancestor clipping is determined by CSS overflow, never by profile scroll writes. */
export function visibleElementRect(node:HTMLElement,viewport:Rect):Rect|null{
 if(!node.isConnected)return null;
 const box=node.getBoundingClientRect();
 let visible=intersect({left:box.left,top:box.top,width:box.width,height:box.height},viewport);
 if(!visible)return null;
 let parent=node.parentElement;
 while(parent){
  const style=getComputedStyle(parent);
  if(["hidden","clip","scroll","auto"].some(v=>
    style.overflowX===v||style.overflowY===v)){
   const b=parent.getBoundingClientRect();
   visible=intersect(visible,{left:b.left,top:b.top,width:b.width,height:b.height});
   if(!visible)return null;
  }
  parent=parent.parentElement;
 }
 return visible;
}
export function isUnoccluded(node:HTMLElement,visible:Rect):boolean{
 const x=visible.left+visible.width/2,y=visible.top+visible.height/2;
 const stack=document.elementsFromPoint(x,y);
 const background=stack.find(el=>!el.closest(".pm-viewer"));
 return !!background&&(background===node||node.contains(background)||background.contains(node));
}
export function currentSource(node:HTMLElement|null,photoSrc:string,fallback?:string):boolean{
 if(!(node instanceof HTMLImageElement)||!node.isConnected||!node.complete||
  node.naturalWidth<=0||node.naturalHeight<=0)return false;
 const href=(uri:string)=>{try{return new URL(uri,document.baseURI).href;}catch{return uri;}};
 const actual=href(node.currentSrc||node.src);
 return actual===href(photoSrc)||(!!fallback&&actual===href(fallback));
}
export function insetClip(rect:Rect,viewport:Rect):string{
 const top=Math.max(0,rect.top-viewport.top);
 const right=Math.max(0,viewport.left+viewport.width-rect.left-rect.width);
 const bottom=Math.max(0,viewport.top+viewport.height-rect.top-rect.height);
 const left=Math.max(0,rect.left-viewport.left);
 return `inset(${top}px ${right}px ${bottom}px ${left}px)`;
}
export const morphTransform=(m:CropMorph):string=>
 `translate3d(${m.translateX}px,${m.translateY}px,0) scale(${m.uniformScale})`;
