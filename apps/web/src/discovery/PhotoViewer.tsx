import {useCallback,useEffect,useLayoutEffect,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {createPortal} from "react-dom";
import {X,MoreHorizontal,ChevronLeft,ChevronRight,Lock,Star,Share2,Link2,Flag as ReportIcon} from "lucide-react";
import type {ProfilePhoto,ProfileView} from "./ProfileModel";
import {canMakeMain,displayPhotoDate} from "./ProfileModel";
import {photoIndex,reconcilePhotoId,requestNavigation as navigatePhoto,resourceIdentity,
 sourceMatches,type ViewerSource,type NavigationRequest,type NavigationOrigin,type ViewerPhase} from "./photo-viewer-state";
import {PhotoReadiness} from "./photo-readiness";
import {trackWindow,allowedOffset,destination,recentVelocity,resizeOffset,viewportWidth} from "./photo-viewer-geometry";
import {PhotoViewerSlide} from "./PhotoViewerSlide";
import {GeometryMotion} from "./geometry-motion";
import {GestureArbiter} from "../ui/gesture-arbiter";
import {MotionController} from "../ui/motion-controller";
import {bindMotionLifecycle} from "../ui/motion-lifecycle";
import {beginPinch,pinchFrame,panFrame,clampPan,contentFit,identityMedia,matrixTransform,
 localFromClient,type Point,type PinchAnchor,type MediaTransform} from "./photo-viewer-zoom";

type Props={view:ProfileView;photos:ProfilePhoto[];initialPhotoId:string;source:ViewerSource|null;contextId:string;
 onClose:()=>void;onMain?:(id:string)=>boolean|Promise<boolean>;
 registerBack?:(handler:(()=>boolean)|null)=>void};
type EndPointer={pointerId:number;clientX:number;clientY:number;currentTarget:HTMLDivElement};
type Gesture={id:number;x:number;y:number;startX:number;startY:number;time:number;
 axis:""|"x"|"y";origin:number;serial:number|null;startPhotoId:string|null;
 pinch:boolean;captured:boolean;samples:{x:number;t:number}[];interruptedTarget:number|null};
const duration=240;
const easing=[.2,.8,.2,1] as const;
const scheduler={frame:(cb:()=>void)=>requestAnimationFrame(cb),cancelFrame:(id:number)=>cancelAnimationFrame(id)};
export function PhotoViewer({view,photos,initialPhotoId,source,contextId,onClose,onMain,registerBack}:Props){
 const [committedPhotoId,setCommittedPhotoId]=useState<string|null>(initialPhotoId);
 const previousIds=useRef(photos.map(p=>p.id));
 const photoId=reconcilePhotoId(committedPhotoId,previousIds.current,photos);
 const index=photoIndex(photos,photoId);
 const show=index>=0?photos[index]:null;
 const slots=trackWindow(photos,photoId);
 const mediaRef=useRef<PhotoReadiness|null>(null);
 const [,refreshMedia]=useState(0);
 if(!mediaRef.current||mediaRef.current.isDisposed())
  mediaRef.current=new PhotoReadiness(()=>refreshMedia(v=>v+1));
 const media=mediaRef.current.read(show);
 const readyKey=media?.phase==="ready"?media.key+"|"+media.src+"|"+media.generation:null;
 const [decoded,setDecoded]=useState<Record<string,string>>({});
 const displayReady=!!readyKey&&decoded[show?.id??""]===readyKey;
 const [menu,setMenu]=useState(false);
 const [message,setMessage]=useState("");
 const stage=useRef<HTMLDivElement>(null);
 const surface=useRef<HTMLDivElement>(null);
 const track=useRef<HTMLDivElement>(null);
 const image=useRef<HTMLImageElement|null>(null);
 const pointer=useRef(new Map<number,{x:number;y:number}>());
 const pendingCaptureLoss=useRef(new Map<number,number>());
 const gesture=useRef<Gesture|null>(null);
 const mediaPose=useRef<MediaTransform>(identityMedia());
 const pinchSession=useRef(false);
 const pinch=useRef<PinchAnchor|null>(null);
 const pan=useRef<{id:number;at:Point;pose:MediaTransform}|null>(null);
 const closing=useRef(false);
 const sourceRef=useRef(source);
 const contextRef=useRef(contextId);contextRef.current=contextId;
 const width=useRef(viewportWidth(window.innerWidth));
 const geometryRevision=useRef(0);
 const trackX=useRef(0);
 const pendingCommit=useRef<{id:string;shift:-1|1}|null>(null);
 const phase=useRef<ViewerPhase>("opening");
 const gestureArbiter=useRef<GestureArbiter|null>(null);
 if(!gestureArbiter.current)gestureArbiter.current=new GestureArbiter();
 const runner=useRef<GeometryMotion|null>(null);
 if(!runner.current||runner.current.isDisposed())
  runner.current=new GeometryMotion("hero",()=>performance.now(),cb=>requestAnimationFrame(cb),id=>cancelAnimationFrame(id),0);
 const surfaceOwner=useRef<MotionController|null>(null);
 if(!surfaceOwner.current||surfaceOwner.current.snapshot().disposed)
  surfaceOwner.current=new MotionController("route",scheduler);
 const commitCount=useRef(0);
 const latest=useRef({photoId,photos,show,index,displayReady,view,onMain,onClose});
 latest.current={photoId,photos,show,index,displayReady,view,onMain,onClose};
 const handlers=useRef<{close:(force?:boolean)=>void;navigate:(target:NavigationRequest,origin:NavigationOrigin)=>boolean}>({
  close:()=>{},navigate:()=>false
 });
 const viewSize=()=>({
  width:Math.max(1,surface.current?.clientWidth??stage.current?.clientWidth??width.current),
  height:Math.max(1,surface.current?.clientHeight??stage.current?.clientHeight??window.innerHeight)
 });
 const naturalSize=()=>({
  width:Math.max(1,image.current?.naturalWidth??1),
  height:Math.max(1,image.current?.naturalHeight??1)
 });
 const localPoint=(p:Point):Point=>{
  const box=(surface.current??stage.current)?.getBoundingClientRect();
  return box?localFromClient(p,box,viewSize()):p;
 };
 const paintMedia=(pose:MediaTransform)=>{
  mediaPose.current=pose;
  if(image.current){
   image.current.style.transition="none";
   image.current.style.transform="translate3d("+pose.x+"px,"+pose.y+"px,0) scale("+pose.scale+")";
  }
 };
 const freezeMedia=():MediaTransform=>{
  if(!image.current)return mediaPose.current;
  const pose=matrixTransform(getComputedStyle(image.current).transform);
  paintMedia(pose);
  return pose;
 };
 const resetMedia=(animate=true)=>{
  mediaPose.current=identityMedia();
  if(image.current){
   image.current.style.transition=animate?
    "transform 230ms cubic-bezier(.2,.75,.2,1)":"none";
   image.current.style.transform="none";
  }
 };
 const restoreVertical=(animate=true)=>{
  if(surface.current){
   surface.current.style.transition=animate?
    "transform 230ms cubic-bezier(.2,.75,.2,1)":"none";
   surface.current.style.transform="none";
  }
  if(stage.current){
   stage.current.style.transition=animate?
    "opacity 230ms cubic-bezier(.2,.75,.2,1)":"none";
   stage.current.style.opacity="1";
  }
 };
 const releasePointers=()=>{
  for(const timer of pendingCaptureLoss.current.values())clearTimeout(timer);
  pendingCaptureLoss.current.clear();
  gesture.current=null;pointer.current.clear();
  pinch.current=null;pan.current=null;pinchSession.current=false;
  gestureArbiter.current?.cancel();
 };
 const cancelPinchSession=(animate=false)=>{
  const wasTracking=pinchSession.current||pointer.current.size>0;
  releasePointers();resetMedia(animate);restoreVertical(animate);
  if(wasTracking&&!closing.current&&Math.abs(trackX.current)>.1){
   const motion=runner.current;
   const frozen=motion?.cancel()??trackX.current;
   // A cancelled pinch cannot leave a half-visible neighboring slide.
   motion?.start(frozen,0,duration,easing,paintTrack,()=>{},geometryRevision.current);
  }
  if(!closing.current&&phase.current!=="settling")phase.current="idle";
 };
 const beginPair=(target:HTMLElement)=>{
  const ids=[...pointer.current.keys()];
  if(ids.length<2)return;
  const first=ids[0],second=ids[1];
  const a=pointer.current.get(first),b=pointer.current.get(second);
  if(!a||!b)return;
  gestureArbiter.current?.secondFinger();
  if(gesture.current)gesture.current.pinch=true;
  pinchSession.current=true;pan.current=null;
  const pose=freezeMedia();
  pinch.current=beginPinch([first,second],localPoint(a),localPoint(b),pose,viewSize());
  phase.current="pinching";
  for(const id of [first,second]){
   try{if(!target.hasPointerCapture(id))target.setPointerCapture(id);}catch{/* WebView fallback */}
  }
 };
 // Effects attach just once; their handlers resolve the current render's
 // geometry and gesture callbacks via this stable ref (StrictMode-safe).
 const lifecycleActions=useRef<{
  cancel:(animate?:boolean)=>void;
  freeze:()=>MediaTransform;
  local:(point:Point)=>Point;
  reset:()=>void;
 }>({cancel:()=>{},freeze:identityMedia,local:point=>point,reset:()=>{}});
 const paintTrack=(x:number)=>{
  trackX.current=x;
  if(track.current){
   track.current.style.transform="translate3d(calc(-100% + "+x+"px),0,0)";
   track.current.dataset.offset=String(x);
  }
 };
 const stopSurface=(interrupted=true)=>{
  const layer=surface.current,outer=stage.current,owner=surfaceOwner.current;
  // Freeze actual on-screen matrix before cancelling the CSS transition.
  if(layer){
   const computed=getComputedStyle(layer).transform;
   layer.style.transition="none";
   layer.style.transform=computed==="none"?"none":computed;
  }
  if(outer){
   const opacity=getComputedStyle(outer).opacity;
   outer.style.transition="none";outer.style.opacity=opacity;
  }
  const t=owner?.token();
  if(t&&interrupted)owner?.interrupt(t,"interrupted");
 };
 const morphTransform=():string=>{
  const current=latest.current.show,valid=sourceMatches(sourceRef.current,latest.current.photoId,
   contextRef.current,current?resourceIdentity(current):null);
  const from=valid?sourceRef.current?.resolveElement()?.getBoundingClientRect():null;
  if(!from||from.width<=8||from.height<=8||from.top>=innerHeight||from.bottom<=0)return "none";
  const w=innerWidth,h=innerHeight;
  return "translate3d("+(from.left+(from.width-w)/2)+"px,"+(from.top+(from.height-h)/2)+"px,0) scale("+(from.width/w)+","+(from.height/h)+")";
 };
 /** One completion gate for opening/closing: transitionend and timeout
  * race on the SAME MotionController generation; old callbacks cannot commit.
  */
 const surfaceTransition=(closingPhase:boolean)=>{
  const layer=surface.current,outer=stage.current,owner=surfaceOwner.current;
  if(!layer||!outer||!owner)return;
  const start=owner.begin(closingPhase?1:0);
  if(!start)return;
  if(!owner[closingPhase?"close":"settle"](start,closingPhase?0:1))return;
  const token=owner.token();
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const target=closingPhase?morphTransform():"none";
  const completed=()=>{
   owner.finish(token,{paint:()=>{
    if(closingPhase){phase.current="disposed";latest.current.onClose();}
    else if(!closing.current)phase.current="idle";
   }});
  };
  if(reduce){
   layer.style.transition="none";outer.style.transition="none";
   layer.style.transform=target;outer.style.opacity=closingPhase?"0":"1";
   completed();return;
  }
  const startTransition=()=>{
   if(!owner.owns(token))return;
   layer.style.transition="transform "+duration+"ms cubic-bezier(.2,.8,.2,1)";
   outer.style.transition="opacity "+duration+"ms ease";
   layer.style.transform=target;outer.style.opacity=closingPhase?"0":"1";
  };
  const onEnd=(event:TransitionEvent)=>{
   if((event.target===layer&&event.propertyName==="transform")||
    (event.target===outer&&event.propertyName==="opacity"))completed();
  };
  layer.addEventListener("transitionend",onEnd);
  outer.addEventListener("transitionend",onEnd);
  const timer=window.setTimeout(completed,duration+40);
  const frame=requestAnimationFrame(startTransition);
  owner.track(token,()=>{
   layer.removeEventListener("transitionend",onEnd);
   outer.removeEventListener("transitionend",onEnd);
   clearTimeout(timer);cancelAnimationFrame(frame);
  });
 };
 const surfaceHandler=useRef<(closingPhase:boolean)=>void>(()=>{});
 surfaceHandler.current=surfaceTransition;
 useLayoutEffect(()=>{
  const outer=stage.current,layer=surface.current;
  if(!outer||!layer)return;
  // React StrictMode may run setup again after a provisional cleanup.
  if(!runner.current||runner.current.isDisposed())
   runner.current=new GeometryMotion("hero",()=>performance.now(),cb=>requestAnimationFrame(cb),id=>cancelAnimationFrame(id),0);
  if(!surfaceOwner.current||surfaceOwner.current.snapshot().disposed)
   surfaceOwner.current=new MotionController("route",scheduler);
  if(!gestureArbiter.current)gestureArbiter.current=new GestureArbiter();
  width.current=viewportWidth(outer.getBoundingClientRect().width);
  paintTrack(0);
  // StrictMode provisional cleanup cancels the first terminal timer. If that
  // first effect already requested close (e.g. zero photos), restart its
  // terminal motion on the freshly reconstructed owner, never reopen.
  const terminal=closing.current;
  outer.style.opacity=terminal?"1":"0";outer.style.transition="none";
  layer.style.transition="none";layer.style.transform=terminal?"none":morphTransform();
  phase.current=terminal?"closing":"opening";
  surfaceHandler.current(terminal);
  const captureLossTimers=pendingCaptureLoss.current;
  return ()=>{
   // Capture this exact timer map at effect setup; no stale ref cleanup and
   // no timer can terminate a later StrictMode viewer generation.
   for(const timer of captureLossTimers.values())clearTimeout(timer);
   captureLossTimers.clear();
   runner.current?.dispose();gestureArbiter.current?.dispose();
   surfaceOwner.current?.dispose();
  };
 },[]);
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.stopImmediatePropagation();event.preventDefault();handlers.current.close();}
   else if(event.key==="ArrowRight"||event.key==="ArrowLeft"){
    event.stopImmediatePropagation();event.preventDefault();
    handlers.current.navigate({direction:event.key==="ArrowRight"?1:-1},"keyboard");
   }
  };
  window.addEventListener("keydown",key,true);
  return ()=>window.removeEventListener("keydown",key,true);
 },[]);
 useEffect(()=>{
  const old=document.body.style.overflow;document.body.style.overflow="hidden";
  return ()=>{document.body.style.overflow=old;mediaRef.current?.dispose();};
 },[]);
 useEffect(()=>{
  let cache=mediaRef.current;
  if(!cache||cache.isDisposed()){cache=new PhotoReadiness(()=>refreshMedia(v=>v+1));mediaRef.current=cache;}
  cache.updateWindow(photos,photoId);
 },[photos,photoId]);
 const signature=photos.map(p=>resourceIdentity(p)).join("|");
 const priorSignature=useRef(signature);
 useLayoutEffect(()=>{
  const committed=pendingCommit.current;
  if(committed&&committed.id===photoId){
   // React reconciles slots by resource key, so the arriving DOM img is MOVED,
   // not recreated. Shift track by an equivalent viewport width before paint.
   pendingCommit.current=null;
   // New window is translated by exactly one viewport relative to old window.
   // Rebase the SAME motion runner to zero too, not only the DOM matrix:
   // otherwise the next pointerdown would sample stale ±W and jump.
   runner.current?.start(0,0,0,easing,paintTrack,()=>{},geometryRevision.current);
   phase.current="idle";
  }else if(priorSignature.current!==signature||photoId!==committedPhotoId){
   runner.current?.start(0,0,0,easing,paintTrack,()=>{},geometryRevision.current);
   pendingCommit.current=null;
   if(phase.current==="settling"||phase.current==="draggingX")phase.current="idle";
  }
  priorSignature.current=signature;
  previousIds.current=photos.map(p=>p.id);
  if(photoId!==committedPhotoId){sourceRef.current=null;setCommittedPhotoId(photoId);}
 },[signature,photoId,committedPhotoId,photos]);
 useEffect(()=>{if(photoId===null)handlers.current.close(true);},[photoId,menu]);
 const decodedCallback=useCallback((id:string,key:string,ok:boolean)=>{
  setDecoded(old=>{
   if(ok)return old[id]===key?old:{...old,[id]:key};
   if(old[id]!==key)return old;
   const next={...old};delete next[id];return next;
  });
 },[]);
 const currentRef=useCallback((node:HTMLImageElement|null)=>{image.current=node;},[]);
 // A switched/removed/resource-replaced photo must not inherit the previous
 // DOM image's zoom matrix or live pointer ownership.
 const activeMediaKey=show?resourceIdentity(show):null;
 useLayoutEffect(()=>{
  if(pinchSession.current)lifecycleActions.current.cancel(false);
  else mediaPose.current=identityMedia();
 },[activeMediaKey]);
 const imageError=useCallback((photo:ProfilePhoto)=>{
  mediaRef.current?.reportDisplayFailure(photo,"display-decode-failed");
 },[]);
 useLayoutEffect(()=>{
  const outer=stage.current;if(!outer)return;
  const observer=new ResizeObserver(()=>{
   const measured=viewportWidth(outer.getBoundingClientRect().width),old=width.current;
   if(Math.abs(old-measured)<.1)return;
   width.current=measured;geometryRevision.current++;
   const motion=runner.current;
   if(motion?.snapshot().phase==="settling"){
    const snap=motion.snapshot();
    const x=resizeOffset(snap.current,old,measured);
    const target=resizeOffset(snap.target,old,measured);
    paintTrack(x);motion.rebase(geometryRevision.current,x,target);
   }else{
    const x=resizeOffset(trackX.current,old,measured);
    paintTrack(x);
    if(gesture.current){gesture.current.origin=resizeOffset(gesture.current.origin,old,measured);}
   }
   if(mediaPose.current.scale>1.0001||pinchSession.current){
    const view=viewSize(),natural=naturalSize();
    const pose=clampPan(lifecycleActions.current.freeze(),view,natural);
    // Keep the legacy maxY assertion meaningful, now based on the actual
    // object-fit:contain content height, not a viewport-only approximation.
    const fit=contentFit(view,natural);
    const maxY=Math.max(0,(fit.height*pose.scale-view.height)/2);
    paintMedia({...pose,y:Math.max(-maxY,Math.min(maxY,pose.y))});
    if(pinch.current){
     const [a,b]=pinch.current.ids.map(id=>pointer.current.get(id));
     if(a&&b)pinch.current=beginPinch(pinch.current.ids,
      lifecycleActions.current.local(a),lifecycleActions.current.local(b),pose,viewSize());
    }
    if(pan.current){
     const at=pointer.current.get(pan.current.id);
     if(at)pan.current={id:pan.current.id,at:lifecycleActions.current.local(at),pose};
    }
   }
  });
  observer.observe(outer);return ()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  // Window focus loss is not necessarily accompanied by visibilitychange.
  // End only this viewer's pointer session, using the same lifecycle contract.
  const blur=()=>lifecycleActions.current.cancel(false);
  window.addEventListener("blur",blur);
  return ()=>window.removeEventListener("blur",blur);
 },[]);
 useEffect(()=>bindMotionLifecycle(()=>{
  // Background and Telegram deactivation terminate all active pointer IDs;
  // a late lostpointercapture cannot reopen a previously disposed session.
  lifecycleActions.current.cancel(false);
  const motion=runner.current;
  if(motion?.snapshot().phase==="settling")motion.suspend();
  const stageNode=stage.current,layer=surface.current;
  if(stageNode&&layer&&phase.current==="opening"){
   stopSurface();phase.current="idle";
  }
 },()=>{
  const motion=runner.current;
  if(motion?.snapshot().phase==="suspended"){
   const snap=motion.snapshot();
   motion.reveal(snap.revision+1,snap.current,snap.target);
  }
  if(gesture.current===null&&phase.current==="draggingY")lifecycleActions.current.reset();
 }),[]);
 const settle=(target:0|-1|1,settleMs=duration)=>{
  const motion=runner.current;if(!motion||closing.current)return;
  const start=motion.cancel(),w=width.current;
  const hasTarget=target===0||!!latest.current.photos[latest.current.index-target];
  if(!hasTarget)return settle(0);
  phase.current="settling";
  const selected=latest.current;
  const targetPhoto=target===0?null:selected.photos[selected.index-target];
  motion.start(start,target*w,settleMs,easing,paintTrack,()=>{
   if(closing.current)return;
   if(!targetPhoto||target===0){phase.current="idle";return;}
   // One semantic commit per settle generation, after painting its endpoint.
   const valid=navigatePhoto(latest.current.photoId,latest.current.photos,{photoId:targetPhoto.id});
   if(!valid||valid!==targetPhoto.id){paintTrack(0);phase.current="idle";return;}
   sourceRef.current=null;setMenu(false);setMessage("");commitCount.current++;
   pendingCommit.current={id:targetPhoto.id,shift:target===-1?-1:1};
   setCommittedPhotoId(targetPhoto.id);
  },geometryRevision.current);
 };
 const requestNavigation=(request:NavigationRequest,_origin:NavigationOrigin):boolean=>{
  if(closing.current||pinchSession.current)return false;
  const selected=latest.current,target=navigatePhoto(selected.photoId,selected.photos,request);
  if(!target||target===selected.photoId)return false;
  if(gesture.current){gesture.current=null;pointer.current.clear();gestureArbiter.current?.cancel();}
  resetMedia(false);
  const nextIndex=photoIndex(selected.photos,target),shift=nextIndex-selected.index;
  if(Math.abs(shift)!==1){
   // Nonadjacent internal navigation is a non-animated, explicit rebase.
   runner.current?.cancel();paintTrack(0);sourceRef.current=null;
   setMenu(false);setMessage("");setCommittedPhotoId(target);return true;
  }
  if(phase.current==="opening"){stopSurface();phase.current="idle";}
  settle(shift===1?-1:1,_origin==="swipe"?duration:0);return true;
 };
 const requestClose=(force=false)=>{
  if(menu&&!force){setMenu(false);return;}
  if(closing.current)return;
  closing.current=true;phase.current="closing";
  releasePointers();resetMedia(false);
  const motion=runner.current;
  if(motion){
   const x=motion.cancel();
   if(Math.abs(x)>.1)motion.start(x,0,duration,easing,paintTrack,()=>{},geometryRevision.current);
  }
  stopSurface();surfaceTransition(true);
 };
 handlers.current={close:requestClose,navigate:requestNavigation};
 useEffect(()=>{
  if(!registerBack)return;
  const handle=()=>{handlers.current.close();return true;};
  registerBack(handle);return ()=>registerBack(null);
 },[registerBack]);
 const resetGesture=()=>{
  releasePointers();resetMedia(true);restoreVertical(true);
  if(!closing.current&&phase.current!=="settling")phase.current="idle";
 };
 lifecycleActions.current={
  cancel:cancelPinchSession,freeze:freezeMedia,local:localPoint,reset:resetGesture
 };
 const down=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(closing.current||menu||(e.pointerType==="mouse"&&e.button!==0))return;
  pointer.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointer.current.size===1){
   if(phase.current==="opening"){stopSurface();phase.current="idle";}
   const snap=runner.current?.snapshot();
   const frozen=runner.current?.cancel()??trackX.current;
   paintTrack(frozen);
   const pose=freezeMedia();
   if(pose.scale>1.0001){
    // Re-touch mid media-reset transition: sample current DOMMatrix.
    pinchSession.current=true;phase.current="pinching";
    pan.current={id:e.pointerId,at:localPoint({x:e.clientX,y:e.clientY}),pose};
    gesture.current=null;gestureArbiter.current?.cancel();
    try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* WebView fallback */}
    return;
   }
   const serial=gestureArbiter.current?.begin("pointer",e.pointerId,"hero")??null;
   gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,
    startX:e.clientX,startY:e.clientY,time:performance.now(),axis:"",
    origin:frozen,serial,startPhotoId:latest.current.photoId,pinch:false,captured:false,
    samples:[{x:e.clientX,t:performance.now()}],
    interruptedTarget:snap?.phase==="settling"?snap.target:null};
  }else if(pointer.current.size===2){
   const wasVertical=gesture.current?.axis==="y";
   beginPair(e.currentTarget);
   if(wasVertical)restoreVertical(true);
  }
  // Third+ contact is recorded for deterministic release, never selected
  // over the first two while those active pair IDs both exist.
 };
 const move=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(!pointer.current.has(e.pointerId)||closing.current||menu)return;
  pointer.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinchSession.current){
   if(e.cancelable)e.preventDefault();
   const pair=pinch.current;
   if(pair){
    const a=pointer.current.get(pair.ids[0]),b=pointer.current.get(pair.ids[1]);
    if(a&&b&&(pair.ids[0]===e.pointerId||pair.ids[1]===e.pointerId))
     paintMedia(pinchFrame(pair,localPoint(a),localPoint(b),viewSize(),naturalSize()));
   }else if(pan.current?.id===e.pointerId){
    const current=localPoint({x:e.clientX,y:e.clientY}),anchor=pan.current;
    paintMedia(panFrame(anchor.pose,{x:current.x-anchor.at.x,y:current.y-anchor.at.y},
     viewSize(),naturalSize()));
   }
   return;
  }
  const g=gesture.current;if(!g||g.id!==e.pointerId)return;
  const dx=e.clientX-g.startX,dy=e.clientY-g.startY;
  if(!g.axis){
   if(Math.max(Math.abs(dx),Math.abs(dy))<9)return;
   g.axis=Math.abs(dx)>Math.abs(dy)*1.18?"x":"y";
   if(g.serial!==null)gestureArbiter.current?.claim("hero",g.serial);
   try{e.currentTarget.setPointerCapture(e.pointerId);g.captured=true;}catch{/* WebView fallback */}
   phase.current=g.axis==="x"?"draggingX":"draggingY";
   if(g.axis==="y"&&Math.abs(trackX.current)>.1)settle(0);
  }
  if(e.cancelable)e.preventDefault();
  if(g.axis==="x"){
   const hasPrev=latest.current.index>0,hasNext=latest.current.index<latest.current.photos.length-1;
   paintTrack(allowedOffset(g.origin+dx,width.current,hasPrev,hasNext));
   const t=performance.now();g.samples.push({x:e.clientX,t});
   if(g.samples.length>10)g.samples.shift();
  }else{
   // LU-03: same pointer frame writes surface Y and correlated opacity.
   const y=dy*.78,scale=Math.max(.85,1-Math.abs(dy)/2300);
   if(surface.current){
    surface.current.style.transition="none";
    surface.current.style.transform="translate3d(0,"+y+"px,0) scale("+scale+")";
   }
   if(stage.current){
    stage.current.style.transition="none";
    stage.current.style.opacity=String(Math.max(.35,1-Math.abs(dy)/700));
   }
  }
 };
 const finish=(e:EndPointer,cancel:boolean)=>{
  const deferred=pendingCaptureLoss.current.get(e.pointerId);
  if(deferred!==undefined){clearTimeout(deferred);pendingCaptureLoss.current.delete(e.pointerId);}
  if(!pointer.current.has(e.pointerId))return;
  pointer.current.delete(e.pointerId);
  if(pinchSession.current){
   // A pair cannot change merely because a third finger is added; it is
   // replaced only when an existing pair member actually releases.
   if(pinch.current?.ids.includes(e.pointerId))pinch.current=null;
   if(pointer.current.size>=2){
    if(!pinch.current)beginPair(e.currentTarget);
   }else if(pointer.current.size===1){
    const [id,position]=[...pointer.current.entries()][0];
    const pose=freezeMedia();
    pan.current={id,at:localPoint(position),pose};
    phase.current="pinching";
    try{if(!e.currentTarget.hasPointerCapture(id))e.currentTarget.setPointerCapture(id);}catch{/* WebView fallback */}
   }else{
    releasePointers();resetMedia(!cancel);restoreVertical(!cancel);
    if(Math.abs(trackX.current)>.1)settle(0);
    else if(!closing.current)phase.current="idle";
   }
   return;
  }
  const g=gesture.current;
  if(pointer.current.size)return;
  if(!g){resetGesture();return;}
  gesture.current=null;gestureArbiter.current?.cancel();
  const dx=e.clientX-g.startX,dy=e.clientY-g.startY;
  const elapsed=Math.max(1,performance.now()-g.time);
  // Vertical dismiss is allowed only in pure 1x single-pointer mode.
  if(!cancel&&g.axis==="y"&&mediaPose.current.scale<=1.0001&&
   (Math.abs(dy)>110||Math.abs(dy)/elapsed>.8)){
   requestClose();return;
  }
  if(g.axis==="x"){
   const t=performance.now(),samples=[...g.samples,{x:e.clientX,t}];
   const v=recentVelocity(samples);
   const target=cancel?0:destination(trackX.current,width.current,v,
    latest.current.index>0,latest.current.index<latest.current.photos.length-1);
   const continueTarget=!cancel&&Math.abs(dx)<8&&g.interruptedTarget!==null?
    (g.interruptedTarget<0?-1:g.interruptedTarget>0?1:0):target;
   settle(continueTarget);return;
  }
  if(Math.abs(trackX.current)>.1)settle(0);
  resetGesture();
 };
 const action=(kind:"main"|"link"|"share"|"report")=>{
  const selected=latest.current;setMenu(false);
  if(kind==="main"){
   if(!selected.show||!selected.displayReady||!selected.onMain||
    !canMakeMain(selected.view,selected.show.id)){
    setMessage("Для изменения главной фотографии требуется подтверждённое сохранение.");return;
   }
   const id=selected.show.id,originalKey=resourceIdentity(selected.show);
   Promise.resolve(selected.onMain(id)).then(saved=>{
    if(closing.current||latest.current.photoId!==id||!latest.current.show||
     resourceIdentity(latest.current.show)!==originalKey)return;
    setMessage(saved?"Главная фотография сохранена":"Сохранение главной фотографии не подтверждено.");
   }).catch(()=>{
    if(!closing.current&&latest.current.photoId===id)setMessage("Не удалось сохранить главную фотографию.");
   });return;
  }
  setMessage(kind==="report"?"Жалобы станут доступны после запуска модерации. Ничего не отправлено.":
   kind==="link"?"Постоянная ссылка пока недоступна":"Публикация и отправка ссылки пока недоступны");
 };
 const onLostPointer=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(!pointer.current.has(e.pointerId))return;
  if(e.buttons!==0){finish(e,true);return;}
  // Chromium may dispatch lostpointercapture BEFORE the ordinary pointerup
  // for the same released touch. A synchronous cancel would erase the legal
  // 110px/.8px-ms vertical exit (also the normal x settle).
  // Defer terminal classification one browser task. pointerup clears the
  // timer; genuinely lost capture still cancels and cannot commit a swipe.
  const id=e.pointerId,x=e.clientX,y=e.clientY,target=e.currentTarget;
  if(pendingCaptureLoss.current.has(id))return;
  const timer=window.setTimeout(()=>{
   pendingCaptureLoss.current.delete(id);
   if(pointer.current.has(id)&&!closing.current)
    finish({pointerId:id,clientX:x,clientY:y,currentTarget:target},true);
  },0);
  pendingCaptureLoss.current.set(id,timer);
 };
 const phaseKey=phase.current;
 return createPortal(<section className="pm-viewer" role="dialog" aria-modal="true" aria-label="Просмотр фото"
   data-motion-phase={phaseKey} data-semantic-commits={commitCount.current}>
  <div className="pm-viewer-stage" ref={stage} onPointerDown={down} onPointerMove={move}
   onPointerUp={e=>finish(e,false)} onPointerCancel={e=>finish(e,true)}
   onLostPointerCapture={onLostPointer}
   onTouchCancel={()=>cancelPinchSession(false)}>
   <div className="pm-viewer-surface" ref={surface}>
    <div className="pm-viewer-track" ref={track} data-offset="0">
     {slots.map(slot=><PhotoViewerSlide key={slot.photo?resourceIdentity(slot.photo):"empty-"+slot.role}
      photo={slot.photo} role={slot.role} media={mediaRef.current?.read(slot.photo)??null}
      onDecoded={decodedCallback} onError={imageError} currentRef={currentRef}/>)}
    </div>
   </div>
   {!displayReady&&show&&<div className="pm-viewer-media-status" role="status"
     data-photo-id={photoId??undefined} data-media-phase={media?.phase??"idle"}>
     {media?.phase==="error"?<>
      <span>Не удалось загрузить фотографию</span>
      <button type="button" className="pm-viewer-retry" onClick={()=>mediaRef.current?.retry(show)}>Повторить</button>
     </>:null}
   </div>}
  </div>
  <header className="pm-viewer-top">
   <span className="pm-viewer-topspacer"/><span>{index>=0?index+1:0} / {photos.length}</span>
   <button type="button" onClick={()=>handlers.current.close()} aria-label="Закрыть просмотр"><X size={22}/></button>
  </header>
  <footer className="pm-viewer-bottom">
   <span>{show?displayPhotoDate(show):"Дата не указана"}</span>
   <div className="pm-viewer-actions">
    <button type="button" disabled={index<=0||closing.current} onClick={()=>handlers.current.navigate({direction:-1},"button")}
     aria-label="Предыдущее фото"><ChevronLeft size={21}/></button>
    <button type="button" disabled={index<0||index===photos.length-1||closing.current}
     onClick={()=>handlers.current.navigate({direction:1},"button")}
     aria-label="Следующее фото"><ChevronRight size={21}/></button>
    <button type="button" onClick={()=>setMenu(v=>!v)} aria-label="Действия с фото"><MoreHorizontal size={23}/></button>
   </div>
  </footer>
  {menu&&<div className="pm-viewer-menu-backdrop" onClick={()=>setMenu(false)}>
    <div className="pm-viewer-menu" role="menu" onClick={e=>e.stopPropagation()}>
     {view.mode==="owner"&&<button type="button" role="menuitem" disabled={!show||!displayReady||!onMain||!canMakeMain(view,show.id)}
      onClick={()=>action("main")}><Star size={18}/> Сделать главным {!view.published&&<Lock size={14}/>}</button>}
     <button type="button" role="menuitem" disabled={!displayReady} onClick={()=>action("link")}><Link2 size={18}/> Скопировать ссылку</button>
     <button type="button" role="menuitem" disabled={!displayReady} onClick={()=>action("share")}><Share2 size={18}/> Поделиться</button>
     {view.mode==="visitor"&&<button type="button" role="menuitem" onClick={()=>action("report")}><ReportIcon size={18}/> Пожаловаться</button>}
     <button type="button" onClick={()=>setMenu(false)}>Отмена</button>
    </div>
   </div>}
  {message&&<div className="pm-viewer-message" role="status" onClick={()=>setMessage("")}>{message}</div>}
 </section>,document.body);
}
