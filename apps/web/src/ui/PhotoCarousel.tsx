import {memo,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
interface Slide {id:string;src:string;fallback?:string}
interface Props {photos:Slide[];name:string;age?:number}
interface Tracking {x:number;y:number;t:number;id:number;horizontal:boolean;startIndex:number}
function PhotoCarouselImpl({photos,name,age}:Props) {
 const [index,setIndex]=useState(0);
 const [dx,setDx]=useState(0);
 const track=useRef<Tracking|null>(null);
 const frame=useRef<HTMLDivElement>(null);
 const active=Math.min(index,Math.max(0,photos.length-1));
 const start=(e:ReactPointerEvent)=>{
   if(e.pointerType==="mouse"&&e.button!==0)return;
   track.current={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now(),horizontal:false,startIndex:active};
 };
 const move=(e:ReactPointerEvent)=>{
   const t=track.current;
   if(!t||t.id!==e.pointerId)return;
   const delta=e.clientX-t.x,vertical=e.clientY-t.y;
   if(!t.horizontal&&Math.abs(delta)>7&&Math.abs(delta)>Math.abs(vertical)*1.15){
     t.horizontal=true;try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* older webview */}
   }
   if(!t.horizontal)return;
   e.preventDefault();
   const width=frame.current?.clientWidth??320;
   const atEdge=(t.startIndex===0&&delta>0)||(t.startIndex===photos.length-1&&delta<0);
   setDx(atEdge?delta*.2:Math.max(-width,Math.min(width,delta)));
 };
 const end=(e:ReactPointerEvent)=>{
   const t=track.current;
   if(!t||t.id!==e.pointerId)return;
   track.current=null;
   if(t.horizontal){
     const distance=e.clientX-t.x;
     const velocity=Math.abs(distance)/Math.max(1,performance.now()-t.t);
     const threshold=(frame.current?.clientWidth??320)*.18;
     if(Math.abs(distance)>threshold||velocity>.52){
       setIndex(Math.max(0,Math.min(photos.length-1,t.startIndex+(distance<0?1:-1))));
     }
   }
   setDx(0);
 };
 return <div className="carousel-frame" ref={frame} onPointerDown={start} onPointerMove={move} onPointerUp={end}
     onPointerCancel={end} onContextMenu={e=>e.preventDefault()}>
   {photos.length>0?<div className="carousel-track" style={{transform:"translate3d(calc(-"+active*100+"% + "+dx+"px),0,0)",transition:track.current?.horizontal?"none":"transform .31s cubic-bezier(.22,.77,.23,1)"}}>
     {photos.map((p,i)=><img key={p.id} src={p.src} alt={"Фото "+(i+1)} draggable={false}
       onError={event=>{const fallback=p.fallback;if(fallback&&event.currentTarget.src!==fallback)event.currentTarget.src=fallback;}}/>)}
   </div>:<div className="profile-placeholder">Здесь будет твоё главное фото</div>}
   <div className="photo-progress" aria-label="Фотографии">{photos.map((p,i)=><button key={p.id} type="button"
       className={i===active?"current":""} aria-label={"Показать фото "+(i+1)} aria-current={i===active?"true":undefined} onClick={()=>{setIndex(i);setDx(0);}}/>)}</div>
   <div className="carousel-caption">{name||"Твоё имя"}{age!==undefined?", "+age:""}</div>
 </div>;
}

/** Keep loaded images and swipe progress mounted across unrelated tab/theme updates. */
export const PhotoCarousel=memo(PhotoCarouselImpl);
