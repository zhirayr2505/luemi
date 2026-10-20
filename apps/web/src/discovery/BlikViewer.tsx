import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {X,Volume2,VolumeX} from "lucide-react";
import type {ActiveBlik} from "./ProfileModel";

type Props={blik:ActiveBlik;name:string;onClose:()=>void};
/** Single published Blik viewer. Multi-story timelines/replies belong to Bliki stage. */
export function BlikViewer({blik,name,onClose}:Props){
 const [muted,setMuted]=useState(true),[progress,setProgress]=useState(0);
 const video=useRef<HTMLVideoElement>(null);
 const duration=Math.max(2500,Math.min(30000,blik.durationMs||6000));
 const paused=useRef(false);
 const closeRef=useRef(onClose);
 useEffect(()=>{closeRef.current=onClose;},[onClose]);
 useEffect(()=>{
  if(blik.kind==="video")return;
  const start=performance.now();let raf=0;
  const tick=(now:number)=>{
   if(paused.current){raf=requestAnimationFrame(tick);return;}
   const value=Math.min(1,(now-start)/duration);
   setProgress(value);if(value>=1)closeRef.current();else raf=requestAnimationFrame(tick);
  };
  raf=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(raf);
 },[blik.kind,duration]);
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();onClose();}};
  window.addEventListener("keydown",key,true);
  return ()=>window.removeEventListener("keydown",key,true);
 },[onClose]);
 return createPortal(<section className="pm-blik-viewer" role="dialog" aria-modal="true"
  aria-label={"Блик пользователя "+name}>
  {blik.kind==="video"?
   <video ref={video} className="pm-blik-media" src={blik.src} autoPlay playsInline muted={muted}
    onTimeUpdate={e=>{const el=e.currentTarget;if(el.duration)setProgress(el.currentTime/el.duration);}}
    onEnded={onClose}/>:
   <img className="pm-blik-media" src={blik.src} alt={"Блик пользователя "+name}/>}
  <div className="pm-blik-scrim"/>
  <div className="pm-blik-controls">
   <div className="pm-blik-progress"><span style={{transform:`scaleX(${progress})`}}/></div>
   <div className="pm-blik-row"><strong>{name}</strong>
    {blik.kind==="video"&&<button type="button" aria-label={muted?"Включить звук":"Выключить звук"}
     onClick={()=>setMuted(x=>!x)}>{muted?<VolumeX size={20}/>:<Volume2 size={20}/>}</button>}
    <button type="button" aria-label="Закрыть блик" onClick={onClose}><X size={23}/></button>
   </div>
  </div>
 </section>,document.body);
}
