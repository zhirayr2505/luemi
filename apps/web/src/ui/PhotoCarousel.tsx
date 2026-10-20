import {memo,useEffect,useLayoutEffect,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
interface Slide {id:string;src:string;fallback?:string}
interface Props {photos:Slide[];name:string;age?:number}
interface Tracking {x:number;y:number;t:number;id:number;horizontal:boolean;startIndex:number;width:number}
function PhotoCarouselImpl({photos,name,age}:Props) {
 const [index,setIndex]=useState(0);
 const tracking=useRef<Tracking|null>(null);
 const frame=useRef<HTMLDivElement>(null);
 const photoTrack=useRef<HTMLDivElement>(null);
 const frameId=useRef<number|null>(null);
 const active=Math.min(index,Math.max(0,photos.length-1));
 const activeRef=useRef(active);activeRef.current=active;
 const flush=()=>{
   if(frameId.current!==null){window.cancelAnimationFrame(frameId.current);frameId.current=null;}
 };
 useEffect(()=>()=>flush(),[]);
 const renderOffset=(baseIndex:number,dx:number)=>{
   const el=photoTrack.current;if(!el)return;
   el.style.transform="translate3d(calc(-"+baseIndex*100+"% + "+dx+"px),0,0)";
 };
 useLayoutEffect(()=>{
   flush();tracking.current=null;
   renderOffset(Math.min(activeRef.current,Math.max(0,photos.length-1)),0);
 },[photos]);
 const start=(e:ReactPointerEvent)=>{
   if(e.pointerType==="mouse"&&e.button!==0)return;
   // Capture the displayed position once; interrupted settling follows the finger.
   const width=frame.current?.clientWidth??320;
   let startIndex=active;
   const track=photoTrack.current;
   if(track){
     const matrix=getComputedStyle(track).transform;
     if(matrix!=="none")startIndex=-new DOMMatrixReadOnly(matrix).m41/Math.max(1,width);
     track.style.transition="none";renderOffset(startIndex,0);
   }
   tracking.current={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now(),
     horizontal:false,startIndex,width};
 };
 const move=(e:ReactPointerEvent)=>{
   const t=tracking.current;
   if(!t||t.id!==e.pointerId)return;
   const delta=e.clientX-t.x,vertical=e.clientY-t.y;
   if(!t.horizontal&&Math.abs(delta)>7&&Math.abs(delta)>Math.abs(vertical)*1.15){
     t.horizontal=true;
     if(photoTrack.current)photoTrack.current.style.transition="none";
     try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* older Telegram WebView */}
   }
   if(!t.horizontal)return;
   if(e.cancelable)e.preventDefault();
   const atEdge=(t.startIndex===0&&delta>0)||(t.startIndex===photos.length-1&&delta<0);
   const offset=atEdge?delta*.2:Math.max(-t.width,Math.min(t.width,delta));
   flush();
   // Finger tracking bypasses React renders and never queues several old frames.
   frameId.current=window.requestAnimationFrame(()=>{
     frameId.current=null;
     renderOffset(t.startIndex,offset);
   });
 };
 const finish=(e:ReactPointerEvent,canceled:boolean)=>{
   const t=tracking.current;if(!t||t.id!==e.pointerId)return;
   tracking.current=null;
   flush();
   let target=active;
   if(t.horizontal&&!canceled){
     const delta=e.clientX-t.x;
     const velocity=Math.abs(delta)/Math.max(1,performance.now()-t.t);
     if(Math.abs(delta)>t.width*.18||velocity>.52)
       target=Math.max(0,Math.min(photos.length-1,Math.round(t.startIndex)+(delta<0?1:-1)));
   }
   if(photoTrack.current)
     photoTrack.current.style.transition="transform .31s cubic-bezier(.22,.77,.23,1)";
   renderOffset(target,0);
   if(target!==active){activeRef.current=target;setIndex(target);}
 };
 const end=(e:ReactPointerEvent)=>finish(e,false);
 const cancel=(e:ReactPointerEvent)=>finish(e,true);
 const choose=(i:number)=>{
   flush();tracking.current=null;
   if(photoTrack.current)photoTrack.current.style.transition="transform .31s cubic-bezier(.22,.77,.23,1)";
   renderOffset(i,0);activeRef.current=i;setIndex(i);
 };
 return <div className="carousel-frame" ref={frame} onPointerDown={start} onPointerMove={move} onPointerUp={end}
     onPointerCancel={cancel} onContextMenu={e=>e.preventDefault()}>
   {photos.length>0?<div className="carousel-track" ref={photoTrack}>
     {photos.map((p,i)=><img key={p.id} src={p.src} alt={"Фото "+(i+1)} draggable={false} loading={i===0?"eager":"lazy"} decoding="async"
       onError={event=>{const fallback=p.fallback;if(fallback&&event.currentTarget.src!==fallback)event.currentTarget.src=fallback;}}/>)}
   </div>:<div className="profile-placeholder">Здесь будет твоё главное фото</div>}
   <div className="photo-progress" aria-label="Фотографии">{photos.map((p,i)=><button key={p.id} type="button"
       className={i===active?"current":""} aria-label={"Показать фото "+(i+1)} aria-current={i===active?"true":undefined} onClick={()=>choose(i)}/>)}</div>
   <div className="carousel-caption">{name||"Твоё имя"}{age!==undefined?", "+age:""}</div>
 </div>;
}

/** Keep loaded images and swipe progress mounted across unrelated tab/theme updates. */
export const PhotoCarousel=memo(PhotoCarouselImpl);
