import {useEffect,useRef,useState} from "react";
import type {ProfilePhoto} from "./ProfileModel";
import type {MediaState} from "./photo-readiness";
import type {SlideRole} from "./photo-viewer-geometry";
import {resourceIdentity} from "./photo-viewer-state";

type Props={photo:ProfilePhoto|null;role:SlideRole;media:MediaState|null;
 onDecoded:(id:string,key:string,ready:boolean)=>void;
 onError:(photo:ProfilePhoto)=>void;currentRef:(node:HTMLImageElement|null)=>void};
/** Keyed by photoId+resource version at the parent. React moves THIS SAME image
 * node from next/previous to current when the track is atomically recentered.
 * The cache's decode does not count as proof that this DOM image is decoded.
 */
export function PhotoViewerSlide({photo,role,media,onDecoded,onError,currentRef}:Props){
 const image=useRef<HTMLImageElement|null>(null);
 const [decoded,setDecoded]=useState<string|null>(null);
 const readyKey=media?.phase==="ready"?media.key+"|"+media.src+"|"+media.generation:null;
 const visible=!!readyKey&&decoded===readyKey;
 const token=useRef(0);
 const callbacks=useRef({onDecoded,onError,currentRef});
 callbacks.current={onDecoded,onError,currentRef};
 const mediaSrc=media?.phase==="ready"?media.src:photo?.src;
 const id=photo?.id??null;
 useEffect(()=>{
  if(!photo||!readyKey||!media?.src)return;
  const node=image.current;
  if(!node)return;
  let valid=true;
  const generation=++token.current;
  const complete=()=>{
   if(!valid||generation!==token.current||image.current!==node)return;
   if(node.naturalWidth<=0||node.naturalHeight<=0){
    callbacks.current.onError(photo);return;
   }
   setDecoded(readyKey);
   callbacks.current.onDecoded(photo.id,readyKey,true);
  };
  Promise.resolve().then(()=>node.decode()).then(complete).catch(()=>{
   if(valid&&generation===token.current&&image.current===node)
    callbacks.current.onError(photo);
  });
  return ()=>{valid=false;};
 },[readyKey,media?.src,photo]);
 useEffect(()=>{
  return ()=>{
   if(id&&readyKey)callbacks.current.onDecoded(id,readyKey,false);
  };
 },[id,readyKey]);
 const ref=(node:HTMLImageElement|null)=>{
  image.current=node;
  if(role==="current")callbacks.current.currentRef(node);
 };
 const photoKey=photo?resourceIdentity(photo):"empty-"+role;
 return <div className="pm-viewer-slide" data-slot={role} data-photo-id={id??undefined}
   data-resource-key={photoKey}>
   {photo&&<img ref={ref}
    className={role==="current"?"pm-viewer-image":"pm-viewer-neighbor-image"}
    data-photo-id={photo.id} data-media-key={readyKey??undefined}
    src={mediaSrc??undefined}
    alt={"Фото "+photo.id} draggable={false}
    style={{opacity:visible?1:0}}
    onError={()=>{if(media?.phase==="ready")callbacks.current.onError(photo);}}/>}
   {!!photo&&!visible&&<div className="pm-viewer-slide-placeholder"
     data-photo-id={id??undefined} data-media-phase={media?.phase??"idle"}
     aria-hidden={role!=="current"}>
     {media?.phase==="error"?"Не удалось загрузить фотографию":"Загрузка фотографии…"}
   </div>}
 </div>;
}
