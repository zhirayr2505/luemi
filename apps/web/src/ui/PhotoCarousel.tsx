import {forwardRef,memo,useEffect,useImperativeHandle,useLayoutEffect,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
interface Slide {id:string;src:string;fallback?:string}
interface Props {photos:Slide[];name:string;age?:number;externalGesture?:boolean;dots?:boolean}
interface Tracking {x:number;y:number;t:number;id:number;horizontal:boolean;startIndex:number;width:number}
export interface PhotoCarouselHandle {
 begin:(id:number,x:number,y:number,at:number)=>void;
 move:(id:number,x:number,y:number)=>void;
 finish:(id:number,x:number,cancelled:boolean)=>void;
 cancel:()=>void;
}
const PhotoCarouselImpl=forwardRef<PhotoCarouselHandle,Props>(function PhotoCarouselImpl({photos,name,age,externalGesture=false,dots=false},ref) {
 const [index,setIndex]=useState(0);
 const tracking=useRef<Tracking|null>(null);
 const frame=useRef<HTMLDivElement>(null);
 const photoTrack=useRef<HTMLDivElement>(null);
 const frameId=useRef<number|null>(null);
 const active=Math.min(index,Math.max(0,photos.length-1));
 const indicatorStart=Math.max(0,Math.min(active-3,photos.length-7));
 const indicators=photos.length>7?photos.slice(indicatorStart,indicatorStart+7):photos;
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
 const startAt=(id:number,x:number,y:number,at:number,horizontal=false)=>{
   // Capture the displayed position once; interrupted settling follows the finger.
   const width=frame.current?.clientWidth??320;
   let startIndex=activeRef.current;
   const track=photoTrack.current;
   if(track){
     const matrix=getComputedStyle(track).transform;
     if(matrix!=="none")startIndex=-new DOMMatrixReadOnly(matrix).m41/Math.max(1,width);
     track.style.transition="none";renderOffset(startIndex,0);
   }
   tracking.current={id,x,y,t:at,horizontal,startIndex,width};
 };
 const moveAt=(id:number,x:number,y:number,capture?:()=>void)=>{
   const t=tracking.current;
   if(!t||t.id!==id)return false;
   const delta=x-t.x,vertical=y-t.y;
   if(!t.horizontal&&Math.abs(delta)>7&&Math.abs(delta)>Math.abs(vertical)*1.15){
     t.horizontal=true;
     if(photoTrack.current)photoTrack.current.style.transition="none";
     capture?.();
   }
   if(!t.horizontal)return false;
   const atEdge=(t.startIndex===0&&delta>0)||(t.startIndex===photos.length-1&&delta<0);
   const offset=atEdge?delta*.2:Math.max(-t.width,Math.min(t.width,delta));
   flush();
   // Finger tracking bypasses React renders and never queues several old frames.
   frameId.current=window.requestAnimationFrame(()=>{
     frameId.current=null;
     renderOffset(t.startIndex,offset);
   });
   return true;
 };
 const finishAt=(id:number,x:number,canceled:boolean)=>{
   const t=tracking.current;if(!t||t.id!==id)return;
   tracking.current=null;
   flush();
   let target=activeRef.current;
   if(t.horizontal&&!canceled){
     const delta=x-t.x;
     const velocity=Math.abs(delta)/Math.max(1,performance.now()-t.t);
     if(Math.abs(delta)>t.width*.18||velocity>.52)
       target=Math.max(0,Math.min(photos.length-1,Math.round(t.startIndex)+(delta<0?1:-1)));
   }
   if(photoTrack.current)
     photoTrack.current.style.transition="transform .31s cubic-bezier(.22,.77,.23,1)";
   renderOffset(target,0);
   if(target!==activeRef.current){activeRef.current=target;setIndex(target);}
 };
 useImperativeHandle(ref,()=>({
  begin:(id,x,y,at)=>startAt(id,x,y,at,true),
  move:(id,x,y)=>{moveAt(id,x,y);},
  finish:(id,x,cancelled)=>finishAt(id,x,cancelled),
  cancel:()=>{const t=tracking.current;if(t)finishAt(t.id,t.x,true);}
 }));
 const start=(e:ReactPointerEvent)=>{
  if(externalGesture||(e.pointerType==="mouse"&&e.button!==0))return;
  startAt(e.pointerId,e.clientX,e.clientY,performance.now());
 };
 const move=(e:ReactPointerEvent)=>{
  if(externalGesture)return;
  const claimed=moveAt(e.pointerId,e.clientX,e.clientY,()=>{
   try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* older Telegram WebView */}
  });
  if(claimed&&e.cancelable)e.preventDefault();
 };
 const end=(e:ReactPointerEvent)=>{if(!externalGesture)finishAt(e.pointerId,e.clientX,false);};
 const cancel=(e:ReactPointerEvent)=>{if(!externalGesture)finishAt(e.pointerId,e.clientX,true);};
 const choose=(i:number)=>{
   flush();tracking.current=null;
   if(photoTrack.current)photoTrack.current.style.transition="transform .31s cubic-bezier(.22,.77,.23,1)";
   renderOffset(i,0);activeRef.current=i;setIndex(i);
 };
 return <div className="carousel-frame" ref={frame} onPointerDown={start} onPointerMove={move} onPointerUp={end}
     onPointerCancel={cancel} onContextMenu={e=>e.preventDefault()}>
   {photos.length>0?<div className="carousel-track" ref={photoTrack}>
     {photos.map((p,i)=><img key={p.id} src={p.src} alt={"Фото "+(i+1)} draggable={false}
       loading={dots?(Math.abs(i-active)<=1?"eager":"lazy"):(i===0?"eager":"lazy")} decoding="async"
       onError={event=>{const fallback=p.fallback;if(fallback&&event.currentTarget.src!==fallback)event.currentTarget.src=fallback;}}/>)}
   </div>:<div className="profile-placeholder">Здесь будет твоё главное фото</div>}
   <div className={"photo-progress"+(dots?" is-dots":"")} aria-label="Фотографии">{indicators.map((p,slot)=>{
     const i=photos.length>7?indicatorStart+slot:slot;
     return <button key={p.id} type="button"
       className={i===active?"current":""} aria-label={"Показать фото "+(i+1)} aria-current={i===active?"true":undefined} onClick={()=>choose(i)}/>;})}</div>
   <div className="carousel-caption">{name||"Твоё имя"}{age!==undefined?", "+age:""}</div>
 </div>;
});

/** Keep loaded images and swipe progress mounted across unrelated tab/theme updates. */
export const PhotoCarousel=memo(PhotoCarouselImpl);
