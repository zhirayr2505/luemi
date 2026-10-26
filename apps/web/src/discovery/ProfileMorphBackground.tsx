import {memo,useEffect,useRef,useState} from "react";
import type {ProfilePhoto} from "./ProfileModel";
/** Bounded two-slot backdrop. Data is already authorized by projectProfile().
 * A new image is decoded before changing visible pixels; never reallocates on
 * sheet progress frames. No canvas, ImageBitmap cache, or cross-origin reads.
 */
type Layer=Pick<ProfilePhoto,"id"|"src"|"fallback">;
const same=(a:Layer|null,b:Layer|null)=>a?.id===b?.id&&a?.src===b?.src;
export const ProfileMorphBackground=memo(function ProfileMorphBackground({photo}:{photo:Layer|null}){
 const [front,setFront]=useState<Layer|null>(photo);
 const [incoming,setIncoming]=useState<Layer|null>(null);
 const [visible,setVisible]=useState(false);
 const revision=useRef(0);
 useEffect(()=>{
  if(same(front,photo)){return;}
  let disposed=false;
  const generation=++revision.current;
  if(!photo){setFront(null);setIncoming(null);setVisible(false);return;}
  const next=photo;
  const img=new Image();
  img.decoding="async";img.src=next.src;
  const decoded=img.decode?img.decode():new Promise<void>((ok,bad)=>{
   img.onload=()=>ok();img.onerror=()=>bad(new Error("photo failed"));
  });
  void decoded.then(()=>true,async()=>{
   if(!next.fallback)return false;
   img.src=next.fallback;
   try{if(img.decode)await img.decode();return true;}catch{return false;}
  }).then(success=>{
   if(!success||disposed||generation!==revision.current)return;
   setIncoming(next);setVisible(false);
  });
  return ()=>{disposed=true;revision.current++};
 },[front,photo]);
 useEffect(()=>{
  if(!incoming)return;
  let second:number|null=null;
  const first=requestAnimationFrame(()=>{
   second=requestAnimationFrame(()=>setVisible(true));
  });
  return ()=>{cancelAnimationFrame(first);if(second!==null)cancelAnimationFrame(second);};
 },[incoming]);
 useEffect(()=>{
  if(!incoming||!visible)return;
  const timer=window.setTimeout(()=>{
   setFront(incoming);setIncoming(null);setVisible(false);
  },210);
  return ()=>window.clearTimeout(timer);
 },[incoming,visible]);
 const render=(layer:Layer|null,extra:string)=>layer?
  <img key={layer.id+"|"+layer.src} className={extra} src={layer.src} alt="" decoding="async"
   onError={event=>{if(layer.fallback&&event.currentTarget.src!==layer.fallback)event.currentTarget.src=layer.fallback;}}/>:null;
 return <div className="pm-a2-background" aria-hidden="true">
  {render(front,"pm-a2-bg-front")}
  {render(incoming,"pm-a2-bg-incoming"+(visible?" is-ready":""))}
  <div className="pm-a2-background-tone"/>
 </div>;
});
