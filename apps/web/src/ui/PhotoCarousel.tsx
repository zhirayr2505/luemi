import {forwardRef,memo,useCallback,useEffect,useImperativeHandle,useLayoutEffect,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {noteFeedImageDecoded,preloadFeedImage} from "../discovery/feed-image-preload";
import {needsAdaptiveFeedPhoto,prepareAdaptiveFeedPhoto} from "../discovery/adaptive-feed-photo";
interface Slide {id:string;src:string;fallback?:string}
interface Props {photos:Slide[];name:string;age?:number;externalGesture?:boolean;dots?:boolean;
 prioritize?:boolean;gpuSafe?:boolean;adaptiveFullscreen?:boolean;onIndexChange?:(index:number)=>void;
 onResolvedSource?:(index:number,source:string)=>void;onCoverReady?:()=>void}
interface Tracking {x:number;y:number;t:number;id:number;horizontal:boolean;startIndex:number;width:number}
export interface PhotoCarouselHandle {
 canAdvance:(direction:-1|1)=>boolean;
 begin:(id:number,x:number,y:number,at:number)=>void;
 move:(id:number,x:number,y:number)=>void;
 finish:(id:number,x:number,cancelled:boolean)=>void;
 cancel:()=>void;
}
const PhotoCarouselImpl=forwardRef<PhotoCarouselHandle,Props>(function PhotoCarouselImpl({photos,name,age,externalGesture=false,dots=false,prioritize=true,gpuSafe=false,adaptiveFullscreen=false,onIndexChange,onResolvedSource,onCoverReady},ref) {
 const [index,setIndex]=useState(0);
 const tracking=useRef<Tracking|null>(null);
 const frame=useRef<HTMLDivElement>(null);
 const photoTrack=useRef<HTMLDivElement>(null);
 const frameId=useRef<number|null>(null);
 const pendingPhoto=useRef<number|null>(null);
 const adaptiveUrls=useRef(new Map<number,string>());
 const onCoverReadyRef=useRef(onCoverReady);
 const onResolvedSourceRef=useRef(onResolvedSource);
 onCoverReadyRef.current=onCoverReady;
 onResolvedSourceRef.current=onResolvedSource;
 // Use the image identities rather than a new array reference from card
 // re-renders. A parent state update must never cancel a finger swipe.
 const photoSignature=photos.map(photo=>photo.id+"::"+photo.src).join("|");
 const active=Math.min(index,Math.max(0,photos.length-1));
 const indicatorStart=Math.max(0,Math.min(active-3,photos.length-7));
 const indicators=photos.length>7?photos.slice(indicatorStart,indicatorStart+7):photos;
 const activeRef=useRef(active);activeRef.current=active;
 const flush=()=>{
   if(frameId.current!==null){window.cancelAnimationFrame(frameId.current);frameId.current=null;}
 };
 const releaseAdaptiveUrls=()=>{for(const url of adaptiveUrls.current.values())URL.revokeObjectURL(url);adaptiveUrls.current.clear();};
 useEffect(()=>()=>{flush();pendingPhoto.current=null;releaseAdaptiveUrls();},[]);
 useEffect(()=>()=>releaseAdaptiveUrls(),[photoSignature]);
 const renderOffset=useCallback((baseIndex:number,dx:number)=>{
   const el=photoTrack.current;if(!el)return;
   // Feed uses a 2D slide translation on Android instead of forcing a wide
  // RGBA 3D texture (three decks times six full-height pictures).
  el.style.transform=gpuSafe?
   "translateX(calc(-"+baseIndex*100+"% + "+dx+"px))":
   "translate3d(calc(-"+baseIndex*100+"% + "+dx+"px),0,0)";
 },[gpuSafe]);
 useLayoutEffect(()=>{
   flush();tracking.current=null;
   renderOffset(Math.min(activeRef.current,Math.max(0,photos.length-1)),0);
 },[photoSignature,photos.length,renderOffset]);
 const photoElement=(i:number):HTMLImageElement|null=>
  (photoTrack.current?.children.item(i) as HTMLImageElement|null)??null;
 const painted=(i:number):boolean=>{
  const image=photoElement(i);
  return !!image?.isConnected&&(
   image.classList.contains("is-unavailable")||
   (image.complete&&image.naturalWidth>0&&image.classList.contains("is-ready"))
  );
 };
 const requestPhoto=(i:number,selectWhenReady:boolean)=>{
  if(i<0||i>=photos.length)return;
  if(selectWhenReady)pendingPhoto.current=i;
  const image=photoElement(i);
  if(!image)return;
  image.loading="eager";
  // Far slides have no src in GPU-safe feed mode until requested. Attaching
  // only the needed image prevents adjacent full-size bitmap allocation.
  if(gpuSafe&&!image.getAttribute("src"))image.src=photos[i].src;
  void preloadFeedImage(photos[i].src);
  if(image.complete&&image.naturalWidth>0)revealDecoded(image,i);
 };
 const queuePhoto=(i:number)=>requestPhoto(i,true);
 const warmPhoto=(i:number)=>requestPhoto(i,false);
 const startAt=(id:number,x:number,y:number,at:number,horizontal=false)=>{
   pendingPhoto.current=null;
   // Capture the displayed position once; interrupted settling follows the finger.
   const width=frame.current?.clientWidth??320;
   let startIndex=activeRef.current;
   const track=photoTrack.current;
   if(track){
     const matrix=getComputedStyle(track).transform;
     if(matrix!=="none")try{
      startIndex=-new DOMMatrixReadOnly(matrix).m41/Math.max(1,width);
     }catch{
      // Older Telegram Android WebViews may reject computed matrix parsing.
      startIndex=activeRef.current;
     }
     track.style.transition="none";renderOffset(startIndex,0);
   }
   tracking.current={id,x,y,t:at,horizontal,startIndex,width};
 };
 const dragOffset=(t:Tracking,delta:number)=>{
   const atEdge=(t.startIndex<=0&&delta>0)||(t.startIndex>=photos.length-1&&delta<0);
   const next=Math.round(t.startIndex)+(delta<0?1:-1);
   const unpainted=next>=0&&next<photos.length&&!painted(next);
   // Finger feels slight resistance rather than exposing an empty slide.
   return atEdge||unpainted?delta*.16:Math.max(-t.width,Math.min(t.width,delta));
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
   const offset=dragOffset(t,delta);
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
   // A final pointer sample may arrive after the last scheduled RAF. Commit
   // its position before re-enabling CSS easing, including a quick flick.
   if(t.horizontal){
     renderOffset(t.startIndex,dragOffset(t,x-t.x));
     void photoTrack.current?.offsetWidth;
   }
   let target=activeRef.current;
   if(t.horizontal&&!canceled){
     const delta=x-t.x;
     const velocity=Math.abs(delta)/Math.max(1,performance.now()-t.t);
     if(Math.abs(delta)>t.width*.18||velocity>.52){
       const next=Math.max(0,Math.min(photos.length-1,Math.round(t.startIndex)+(delta<0?1:-1)));
       if(next!==activeRef.current&&!painted(next))warmPhoto(next);
       else target=next;
     }
   }
   if(photoTrack.current)
     photoTrack.current.style.transition="transform .31s cubic-bezier(.22,.77,.23,1)";
   renderOffset(target,0);
   if(target!==activeRef.current){activeRef.current=target;setIndex(target);onIndexChange?.(target);
    warmPhoto(target-1);warmPhoto(target+1);}
 };
 useImperativeHandle(ref,()=>({
  canAdvance:(direction:-1|1)=>activeRef.current+direction>=0&&activeRef.current+direction<photos.length,
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
 const selectPhoto=(i:number)=>{
   flush();tracking.current=null;
   // Distant dot jumps cannot animate across unloaded intermediate images;
   // do an atomic 2D move to the fully decoded destination instead.
   const farJump=gpuSafe&&Math.abs(i-activeRef.current)>1;
   if(photoTrack.current)photoTrack.current.style.transition=farJump?
    "none":"transform .31s cubic-bezier(.22,.77,.23,1)";
   renderOffset(i,0);activeRef.current=i;setIndex(i);onIndexChange?.(i);
   // Once a slide has been requested its DOM src is retained. Warm only the
   // next neighbor so repeated back/forward swipes never detach and reload an
   // already painted image (the source of the Android white/grey flash).
   warmPhoto(i-1);warmPhoto(i+1);
 };
 const choose=(i:number)=>{
  if(i!==activeRef.current&&!painted(i)){queuePhoto(i);return;}
  pendingPhoto.current=null;selectPhoto(i);
 };
 // The last decoded cover remains visible behind the slider until a new
 // image finishes decoding. Never expose a grey GPU tile mid-swipe in WebView.
 const revealDecoded=(image:HTMLImageElement,photoIndex:number)=>{
  image.classList.remove("is-unavailable");
  const source=image.currentSrc||image.src;
  if(adaptiveFullscreen&&image.dataset.adaptiveReady!=="true"&&
   needsAdaptiveFeedPhoto(image.naturalWidth,image.naturalHeight)){
   if(image.dataset.adaptivePreparing==="true")return;
   image.dataset.adaptivePreparing="true";
   void prepareAdaptiveFeedPhoto(source,image.naturalWidth,image.naturalHeight).then(blob=>{
    delete image.dataset.adaptivePreparing;
    if(!blob||!image.isConnected||(image.currentSrc||image.src)!==source){
     if(image.isConnected&&(image.currentSrc||image.src)===source)revealDecoded(image,photoIndex);
     return;
    }
    const previous=adaptiveUrls.current.get(photoIndex);if(previous)URL.revokeObjectURL(previous);
    const resolved=URL.createObjectURL(blob);adaptiveUrls.current.set(photoIndex,resolved);
    image.dataset.adaptiveReady="true";image.dataset.adaptiveOrigin=source;
    image.classList.remove("is-ready");image.src=resolved;
    onResolvedSourceRef.current?.(photoIndex,resolved);
   });
   return;
  }
  const reveal=()=>{
   if(image.isConnected&&(image.currentSrc||image.src)===source&&image.naturalWidth>0){
    // One-way readiness class. Re-rendering a queued card can no longer reset
    // inline opacity to zero and replay the photo entrance on promotion.
    noteFeedImageDecoded(source);
    image.classList.add("is-ready");
    if(photoIndex===0)onCoverReadyRef.current?.();
    if(pendingPhoto.current===photoIndex){
     pendingPhoto.current=null;selectPhoto(photoIndex);
    }
   }
  };
  if(typeof image.decode==="function")void image.decode().then(reveal,()=>{
   if(image.naturalWidth>0)reveal();
  });
  else reveal();
 };
 return <div className="carousel-frame" ref={frame} onPointerDown={start} onPointerMove={move} onPointerUp={end}
     onPointerCancel={cancel} onContextMenu={e=>e.preventDefault()}>
   {photos.length>0?<><div className="feed-carousel-fallback" aria-hidden="true"><span>{name.trim().slice(0,1).toUpperCase()||"L"}</span></div>
    <div className={"carousel-track"+(gpuSafe?" is-gpu-safe":"")} ref={photoTrack}>
     {photos.map((p,i)=><img key={p.id+"::"+p.src}
       src={!gpuSafe||i<=1?p.src:undefined}
       data-fallback={p.fallback||undefined}
       alt={"Фото "+(i+1)} draggable={false}
       loading={i===0||(prioritize&&Math.abs(i-activeRef.current)<=1)?"eager":"lazy"} decoding="async"
       className="feed-carousel-photo"
       onLoad={event=>revealDecoded(event.currentTarget,i)}
       onError={event=>{const image=event.currentTarget,fallback=p.fallback;
        const origin=image.dataset.adaptiveOrigin;
        if(origin&&image.src!==origin){delete image.dataset.adaptiveOrigin;delete image.dataset.adaptiveReady;image.src=origin;return;}
        if(fallback&&image.src!==fallback){
         image.classList.remove("is-ready");image.src=fallback;
         void preloadFeedImage(fallback);
         return;
        }
        image.classList.remove("is-ready");image.classList.add("is-unavailable");
        if(i===0)onCoverReadyRef.current?.();
        if(pendingPhoto.current===i){pendingPhoto.current=null;selectPhoto(i);}
       }}/>)}
   </div></>:<div className="profile-placeholder">Здесь будет твоё главное фото</div>}
   <div className={"photo-progress"+(dots?" is-dots":"")} aria-label="Фотографии">{indicators.map((p,slot)=>{
     const i=photos.length>7?indicatorStart+slot:slot;
     return <button key={p.id} type="button"
       className={i===active?"current":""} aria-label={"Показать фото "+(i+1)} aria-current={i===active?"true":undefined} onClick={()=>choose(i)}/>;})}</div>
   <div className="carousel-caption">{name||"Твоё имя"}{age!==undefined?", "+age:""}</div>
 </div>;
});

/** Keep loaded images and swipe progress mounted across unrelated tab/theme updates. */
export const PhotoCarousel=memo(PhotoCarouselImpl);
