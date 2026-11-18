import {forwardRef,memo,useCallback,useEffect,useImperativeHandle,useLayoutEffect,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {noteFeedImageDecoded,preloadFeedImage} from "../discovery/feed-image-preload";
interface Slide {id:string;src:string;fallback?:string}
interface Props {photos:Slide[];name:string;age?:number;externalGesture?:boolean;dots?:boolean;
 prioritize?:boolean;gpuSafe?:boolean;adaptive?:boolean;loop?:boolean;onIndexChange?:(index:number)=>void;
 onCoverReady?:()=>void}
interface Tracking {x:number;y:number;t:number;id:number;horizontal:boolean;startIndex:number;width:number}
export interface PhotoCarouselHandle {
 canAdvance:(direction:-1|1)=>boolean;
 begin:(id:number,x:number,y:number,at:number)=>void;
 move:(id:number,x:number,y:number)=>void;
 finish:(id:number,x:number,cancelled:boolean)=>void;
 cancel:()=>void;
}
const atmosphereCache=new Map<string,string>();
const ATMOSPHERE_CACHE_LIMIT=32;
/* Low-resolution atmospheric cover: preserve the photograph's actual
 * shapes and colors instead of stretching a 16x26 blurred color block.
 * It runs only when an image decodes, never in the pointer/animation path. */
function photoAtmosphere(image:HTMLImageElement,frameRatio:number):string|null{
 const source=image.currentSrc||image.src;
 const cacheKey=source+"::"+frameRatio.toFixed(2);
 const saved=atmosphereCache.get(cacheKey);if(saved)return saved;
 try{
  const canvas=document.createElement("canvas");
  canvas.width=72;
  canvas.height=Math.max(88,Math.min(192,Math.round(72/Math.max(.25,frameRatio))));
  const context=canvas.getContext("2d");if(!context)return null;
  context.imageSmoothingEnabled=true;context.imageSmoothingQuality="high";
  const width=image.naturalWidth,height=image.naturalHeight;
  const targetRatio=canvas.width/canvas.height;
  let sampleWidth=width,sampleHeight=height;
  if(width/height>targetRatio)sampleWidth=height*targetRatio;
  else sampleHeight=width/targetRatio;
  context.filter="blur(2.2px)";
  context.drawImage(image,(width-sampleWidth)/2,(height-sampleHeight)/2,
   sampleWidth,sampleHeight,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL("image/webp",.72);
  atmosphereCache.delete(cacheKey);atmosphereCache.set(cacheKey,data);
  while(atmosphereCache.size>ATMOSPHERE_CACHE_LIMIT){
   const oldest=atmosphereCache.keys().next().value;
   if(typeof oldest!=="string")break;atmosphereCache.delete(oldest);
  }
  return data;
 }catch{return null;} // Cross-origin photos can still use the CSS fallback.
}
const PhotoCarouselImpl=forwardRef<PhotoCarouselHandle,Props>(function PhotoCarouselImpl({photos,name,age,externalGesture=false,dots=false,prioritize=true,gpuSafe=false,adaptive=false,loop=false,onIndexChange,onCoverReady},ref) {
 const [index,setIndex]=useState(0);
 const tracking=useRef<Tracking|null>(null);
 const frame=useRef<HTMLDivElement>(null);
 const photoTrack=useRef<HTMLDivElement>(null);
 const frameId=useRef<number|null>(null);
 const pendingPhoto=useRef<number|null>(null);
 const onCoverReadyRef=useRef(onCoverReady);
 onCoverReadyRef.current=onCoverReady;
 // Use the image identities rather than a new array reference from card
 // re-renders. A parent state update must never cancel a finger swipe.
 const photoSignature=photos.map(photo=>photo.id+"::"+photo.src).join("|");
 const active=Math.min(index,Math.max(0,photos.length-1));
 const cyclic=loop&&photos.length>1;
 const visualOffset=cyclic?1:0;
 const slides=cyclic?[photos.length-1,...photos.map((_,i)=>i),0]:photos.map((_,i)=>i);
 const wrappedTo=useRef<number|null>(null);
 const wrapTimer=useRef<number|null>(null);
 const indicatorStart=Math.max(0,Math.min(active-3,photos.length-7));
 const indicators=photos.length>7?photos.slice(indicatorStart,indicatorStart+7):photos;
 const activeRef=useRef(active);activeRef.current=active;
 const flush=()=>{
   if(frameId.current!==null){window.cancelAnimationFrame(frameId.current);frameId.current=null;}
 };
 useEffect(()=>()=>{flush();pendingPhoto.current=null;
  if(wrapTimer.current!==null)window.clearTimeout(wrapTimer.current);
 },[]);
 const renderOffset=useCallback((baseIndex:number,dx:number)=>{
   const el=photoTrack.current;if(!el)return;
   // Feed uses a 2D slide translation on Android instead of forcing a wide
  // RGBA 3D texture (three decks times six full-height pictures).
  el.style.transform=gpuSafe?
   "translateX(calc(-"+baseIndex*100+"% + "+dx+"px))":
   "translate3d(calc(-"+baseIndex*100+"% + "+dx+"px),0,0)";
 },[gpuSafe]);
 const finishWrappedTransition=()=>{
  const position=wrappedTo.current;if(position===null)return;
  wrappedTo.current=null;
  if(wrapTimer.current!==null){window.clearTimeout(wrapTimer.current);wrapTimer.current=null;}
  if(photoTrack.current)photoTrack.current.style.transition="none";
  // The edge clone and real photo have the same pixels: instantaneous rebase.
  renderOffset(position,0);
 };
 useLayoutEffect(()=>{
   flush();tracking.current=null;wrappedTo.current=null;
   if(wrapTimer.current!==null){window.clearTimeout(wrapTimer.current);wrapTimer.current=null;}
   photoTrack.current?.classList.remove("is-dragging");
   if(photoTrack.current)photoTrack.current.style.transition="none";
   renderOffset(Math.min(activeRef.current,Math.max(0,photos.length-1))+visualOffset,0);
 },[photoSignature,photos.length,renderOffset,visualOffset]);
 const imageAtVisual=(position:number):HTMLImageElement|null=>{
  const child=photoTrack.current?.children.item(position);
  return child?.querySelector<HTMLImageElement>("img.feed-carousel-photo")??null;
 };
 const photoElement=(i:number):HTMLImageElement|null=>
  i<0||i>=photos.length?null:imageAtVisual(i+visualOffset);
 const paintedVisual=(position:number):boolean=>{
  const image=imageAtVisual(position);
  return !!image?.isConnected&&(image.classList.contains("is-unavailable")||
   (image.complete&&image.naturalWidth>0&&image.classList.contains("is-ready")));
 };
 const painted=(i:number):boolean=>{
  const image=photoElement(i);
  return !!image?.isConnected&&(image.classList.contains("is-unavailable")||
   (image.complete&&image.naturalWidth>0&&image.classList.contains("is-ready")));
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
 const warmNeighbors=(i:number)=>{
  if(photos.length<2)return;
  warmPhoto(cyclic?(i+photos.length-1)%photos.length:i-1);
  warmPhoto(cyclic?(i+1)%photos.length:i+1);
 };
 const startAt=(id:number,x:number,y:number,at:number,horizontal=false)=>{
   finishWrappedTransition();
   pendingPhoto.current=null;photoTrack.current?.classList.remove("is-dragging");
   // Capture the displayed position once; interrupted settling follows the finger.
   const width=frame.current?.clientWidth??320;
   let startIndex=activeRef.current+visualOffset;
   const track=photoTrack.current;
   if(track){
     const matrix=getComputedStyle(track).transform;
     if(matrix!=="none")try{
      startIndex=-new DOMMatrixReadOnly(matrix).m41/Math.max(1,width);
     }catch{
      // Older Telegram Android WebViews may reject computed matrix parsing.
      startIndex=activeRef.current+visualOffset;
     }
     track.style.transition="none";renderOffset(startIndex,0);
   }
   tracking.current={id,x,y,t:at,horizontal,startIndex,width};
 };
 const dragOffset=(t:Tracking,delta:number)=>{
   const next=Math.round(t.startIndex)+(delta<0?1:-1);
   const maxVisual=photos.length-1+(cyclic?2:0);
   const atEdge=next<0||next>maxVisual;
   const unpainted=!atEdge&&!paintedVisual(next);
   return atEdge||unpainted?delta*.16:Math.max(-t.width,Math.min(t.width,delta));
 };
 const moveAt=(id:number,x:number,y:number,capture?:()=>void)=>{
   const t=tracking.current;
   if(!t||t.id!==id)return false;
   const delta=x-t.x,vertical=y-t.y;
   if(!t.horizontal&&Math.abs(delta)>7&&Math.abs(delta)>Math.abs(vertical)*1.15){
     t.horizontal=true;
     photoTrack.current?.classList.add("is-dragging");
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
   photoTrack.current?.classList.remove("is-dragging");
   flush();
   // A final pointer sample may arrive after the last scheduled RAF. Commit
   // its position before re-enabling CSS easing, including a quick flick.
   if(t.horizontal){
     renderOffset(t.startIndex,dragOffset(t,x-t.x));
     void photoTrack.current?.offsetWidth;
   }
   let target=activeRef.current;
   let visualTarget=target+visualOffset;
   if(t.horizontal&&!canceled){
     const delta=x-t.x;
     const velocity=Math.abs(delta)/Math.max(1,performance.now()-t.t);
     if(Math.abs(delta)>t.width*.18||velocity>.52){
       const nextVisual=Math.round(t.startIndex)+(delta<0?1:-1);
       const maxVisual=photos.length-1+(cyclic?2:0);
       if(nextVisual>=0&&nextVisual<=maxVisual){
        const next=cyclic?
         (nextVisual===0?photos.length-1:nextVisual===photos.length+1?0:nextVisual-1):
         nextVisual;
        if(next!==activeRef.current&&(!painted(next)||!paintedVisual(nextVisual)))warmPhoto(next);
        else {target=next;visualTarget=nextVisual;}
       }
     }
   }
   if(photoTrack.current)
     photoTrack.current.style.transition="transform .31s cubic-bezier(.22,.77,.23,1)";
   renderOffset(visualTarget,0);
   if(target!==activeRef.current){
    activeRef.current=target;setIndex(target);onIndexChange?.(target);
    warmNeighbors(target);
    if(cyclic&&(visualTarget===0||visualTarget===photos.length+1)){
     wrappedTo.current=target+1;
     // A fallback timer handles Android WebViews that omit transitionend.
     wrapTimer.current=window.setTimeout(finishWrappedTransition,370);
    }
   }
 };
 useImperativeHandle(ref,()=>({
  canAdvance:(direction:-1|1)=>cyclic?photos.length>1:activeRef.current+direction>=0&&activeRef.current+direction<photos.length,
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
   finishWrappedTransition();
   flush();tracking.current=null;photoTrack.current?.classList.remove("is-dragging");
   // Distant dot jumps cannot animate across unloaded intermediate images;
   // do an atomic 2D move to the fully decoded destination instead.
   const farJump=gpuSafe&&Math.abs(i-activeRef.current)>1;
   if(photoTrack.current)photoTrack.current.style.transition=farJump?
    "none":"transform .31s cubic-bezier(.22,.77,.23,1)";
   renderOffset(i+visualOffset,0);activeRef.current=i;setIndex(i);onIndexChange?.(i);
   // Once a slide has been requested its DOM src is retained. Warm only the
   // next neighbor so repeated back/forward swipes never detach and reload an
   // already painted image (the source of the Android white/grey flash).
   warmNeighbors(i);
 };
 const choose=(i:number)=>{
  if(i!==activeRef.current&&!painted(i)){queuePhoto(i);return;}
  pendingPhoto.current=null;selectPhoto(i);
 };
 // The last decoded cover remains visible behind the slider until a new
 // image finishes decoding. Never expose a grey GPU tile mid-swipe in WebView.
 const revealDecoded=(image:HTMLImageElement,photoIndex:number,isClone=false)=>{
  image.classList.remove("is-unavailable");
  const source=image.currentSrc||image.src;
  const reveal=()=>{
   if(image.isConnected&&(image.currentSrc||image.src)===source&&image.naturalWidth>0){
    // One-way readiness class. Re-rendering a queued card can no longer reset
    // inline opacity to zero and replay the photo entrance on promotion.
    noteFeedImageDecoded(source);
    image.classList.add("is-ready");
    if(adaptive){
     const slide=image.closest<HTMLElement>(".carousel-slide-adaptive");
     if(slide){
      const ratio=image.naturalWidth/Math.max(1,image.naturalHeight);
      const frameRatio=(frame.current?.clientWidth??1)/Math.max(1,frame.current?.clientHeight??1);
      const full=Math.abs(Math.log(ratio/frameRatio))<.075;
      slide.dataset.photoFit=full?"full":ratio>frameRatio?"letterbox":"pillarbox";
      if(!full&&!slide.style.getPropertyValue("--photo-atmosphere")){
       const colors=photoAtmosphere(image,frameRatio);
       if(colors)slide.style.setProperty("--photo-atmosphere",'url("'+colors+'")');
       else{
        // Only cross-origin legacy sources need a CSS-filter fallback.
        slide.style.setProperty("--photo-atmosphere",'url('+JSON.stringify(source)+')');
        slide.classList.add("is-photo-atmosphere-fallback");
       }
      }
     }
    }
    if(photoIndex===0&&!isClone)onCoverReadyRef.current?.();
    if(!isClone&&pendingPhoto.current===photoIndex){
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
    <div className={"carousel-track"+(gpuSafe?" is-gpu-safe":"")} ref={photoTrack}
     onTransitionEnd={event=>{if(event.target===event.currentTarget&&event.propertyName==="transform")finishWrappedTransition();}}>
     {slides.map((i,visualIndex)=>{
       const p=photos[i];
       const isClone=cyclic&&(visualIndex===0||visualIndex===photos.length+1);
       // Three mounted cards never decode all distant slides. On the active
       // card, warm both edge clones to make the wrap physically continuous.
       const load=!gpuSafe||i===0||(i===1&&prioritize)||
        (cyclic&&prioritize&&(isClone||i===photos.length-1));
       const picture=<img
         src={load?p.src:undefined}
         data-fallback={p.fallback||undefined}
         alt={"Фото "+(i+1)} draggable={false}
         loading={i===0||(prioritize&&(isClone||Math.abs(i-activeRef.current)<=1))?"eager":"lazy"}
         decoding="async" className="feed-carousel-photo"
         onLoad={event=>revealDecoded(event.currentTarget,i,isClone)}
         onError={event=>{const image=event.currentTarget,fallback=p.fallback;
          if(fallback&&image.src!==fallback){
           image.classList.remove("is-ready");image.src=fallback;
           void preloadFeedImage(fallback);return;
          }
          image.classList.remove("is-ready");image.classList.add("is-unavailable");
          if(i===0&&!isClone)onCoverReadyRef.current?.();
          if(!isClone&&pendingPhoto.current===i){pendingPhoto.current=null;selectPhoto(i);}
         }}/>;
       return adaptive?
        <div key={p.id+"::"+visualIndex} className="carousel-slide carousel-slide-adaptive"
         aria-hidden={isClone} data-photo-fit="pending">{picture}</div>:
        <div key={p.id+"::"+visualIndex} className="carousel-slide" aria-hidden={isClone}>{picture}</div>;
      })}
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
