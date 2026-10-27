import {useEffect,useRef,useState} from "react";
import {X} from "lucide-react";

export function ChatPhotoViewer({src,onClose}:{src:string;onClose:()=>void}){
 const [scale,setScale]=useState(1);const [offset,setOffset]=useState({x:0,y:0});
 const pointers=useRef(new Map<number,{x:number;y:number}>());const start=useRef<{distance:number;scale:number;x:number;y:number;offset:{x:number;y:number}}|null>(null);
 const lastTap=useRef(0);
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[onClose]);
 const down=(e:React.PointerEvent)=>{e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const all=[...pointers.current.values()];
  if(all.length===2)start.current={distance:Math.hypot(all[0].x-all[1].x,all[0].y-all[1].y),scale,x:0,y:0,offset};
  else start.current={distance:0,scale,x:e.clientX,y:e.clientY,offset};};
 const move=(e:React.PointerEvent)=>{if(!pointers.current.has(e.pointerId)||!start.current)return;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const all=[...pointers.current.values()];
  if(all.length===2&&start.current.distance){const distance=Math.hypot(all[0].x-all[1].x,all[0].y-all[1].y);setScale(Math.min(4,Math.max(1,start.current.scale*distance/start.current.distance)));}
  else if(all.length===1)setOffset({x:start.current.offset.x+(e.clientX-start.current.x),y:start.current.offset.y+(e.clientY-start.current.y)});};
 const up=(e:React.PointerEvent)=>{pointers.current.delete(e.pointerId);if(!pointers.current.size){if(scale===1&&Math.abs(offset.y)>110)onClose();else if(scale===1)setOffset({x:0,y:0});start.current=null;}};
 const tap=()=>{const now=performance.now();if(now-lastTap.current<320){const next=scale>1?1:2.5;setScale(next);if(next===1)setOffset({x:0,y:0});}lastTap.current=now;};
 return <div className="lc-viewer" role="dialog" aria-modal="true" aria-label="Просмотр фотографии" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={tap}>
  <button type="button" className="lc-viewer-close" aria-label="Закрыть" onClick={e=>{e.stopPropagation();onClose();}}><X/></button>
  <img src={src} alt="Фотография из сообщения" draggable={false} style={{transform:`translate3d(${offset.x}px,${offset.y}px,0) scale(${scale})`}}/>
 </div>;
}
