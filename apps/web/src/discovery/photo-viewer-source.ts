import {computeMorph,intersection,objectPixels,validMorphSource,
 type MorphGeometry,type Rect} from "./photo-viewer-morph";
import {sourceMatches,type ViewerSource,resourceIdentity} from "./photo-viewer-state";
import type {ProfilePhoto} from "./ProfileModel";

const asRect=(r:DOMRect):Rect=>({left:r.left,top:r.top,width:r.width,height:r.height});
/** Resolve only a live, matching, visible source. Never scroll the profile.
 * Skip the portal when hit-testing underlying source occlusion.
 */
export function captureSource(source:ViewerSource|null,photo:ProfilePhoto|null,
 contextId:string,doc:Document):{geometry:MorphGeometry;node:HTMLImageElement;url:string}|null{
 if(!source||!photo||!sourceMatches(source,photo.id,contextId,resourceIdentity(photo)))return null;
 const raw=source.resolveElement();
 if(!(raw instanceof HTMLImageElement)||!raw.isConnected||!raw.complete||
  raw.naturalWidth<=0||raw.naturalHeight<=0)return null;
 const viewport={width:doc.defaultView?.innerWidth??window.innerWidth,
  height:doc.defaultView?.innerHeight??window.innerHeight};
 const rect=asRect(raw.getBoundingClientRect());
 if(rect.width<8||rect.height<8)return null;
 let visible:Rect|null=intersection(rect,{left:0,top:0,...viewport});
 if(!visible)return null;
 for(let parent=raw.parentElement;parent;parent=parent.parentElement){
  const style=getComputedStyle(parent);
  if(style.display==="none"||style.visibility==="hidden"||Number(style.opacity)===0)return null;
  if(["hidden","clip","scroll","auto"].includes(style.overflow)||style.overflowX==="hidden"||style.overflowY==="hidden"){
   const crop=asRect(parent.getBoundingClientRect());
   visible=visible&&intersection(visible,crop);
   if(!visible)return null;
  }
 }
 const style=getComputedStyle(raw);
 if(style.display==="none"||style.visibility==="hidden"||Number(style.opacity)===0)return null;
 const fit=style.objectFit;
 if(fit!=="cover"&&fit!=="contain")return null;
 // A modal overlays the source; ignore nodes belonging to this viewer when
 // checking whether another foreground UI actually occludes the thumbnail.
 const center={x:visible.left+visible.width/2,y:visible.top+visible.height/2};
 const layers=doc.elementsFromPoint(center.x,center.y).filter(el=>!el.closest(".pm-viewer"));
 const front=layers[0];
 if(front&&front!==raw&&!raw.contains(front)&&!front.contains(raw))return null;
 const media=objectPixels(rect,{width:raw.naturalWidth,height:raw.naturalHeight},
  fit,style.objectPosition);
 const geometry=computeMorph(rect,media,
  {width:raw.naturalWidth,height:raw.naturalHeight},viewport,visible);
 if(!geometry||!validMorphSource(photo,source,contextId,raw.dataset.photoId,visible,viewport))return null;
 return {geometry,node:raw,url:raw.currentSrc||raw.src};
}
