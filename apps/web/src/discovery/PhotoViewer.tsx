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

type Props={view:ProfileView;photos:ProfilePhoto[];initialPhotoId:string;source:ViewerSource|null;contextId:string;
 onClose:()=>void;onMain?:(id:string)=>boolean|Promise<boolean>;
 registerBack?:(handler:(()=>boolean)|null)=>void};
type Gesture={id:number;x:number;y:number;startX:number;startY:number;time:number;
 axis:""|"x"|"y";origin:number;serial:number|null;startPhotoId:string|null;
 pinch:boolean;samples:{x:number;t:number}[];interruptedTarget:number|null};
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
 const gesture=useRef<Gesture|null>(null);
 const zoom=useRef(1);
 const closing=useRef(false);
 const pinch=useRef<{distance:number;cx:number;cy:number}|null>(null);
 const sourceRef=useRef(source);
 const contextRef=useRef(contextId);contextRef.current=contextId;
 const cleanup=useRef<number|null>(null);
 const width=useRef(viewportWidth(window.innerWidth));
 const geometryRevision=useRef(0);
 const trackX=useRef(0);
 const pendingCommit=useRef<{id:string;shift:-1|1}|null>(null);
 const phase=useRef<ViewerPhase>("opening");
 const gestureArbiter=useRef<GestureArbiter|null>(null);
 if(!gestureArbiter.current)gestureArbiter.current=new GestureArbiter();
 const runner=useRef<GeometryMotion|null>(null);
 if(!runner.current||runner.current.isDisposed())
  runner.current=new GeometryMotion("hero",()=>performance.now(),requestAnimationFrame,cancelAnimationFrame,0);
 const surfaceOwner=useRef<MotionController|null>(null);
 if(!surfaceOwner.current||surfaceOwner.current.snapshot().disposed)
  surfaceOwner.current=new MotionController("route",scheduler);
 const commitCount=useRef(0);
 const latest=useRef({photoId,photos,show,index,displayReady,view,onMain,onClose});
 latest.current={photoId,photos,show,index,displayReady,view,onMain,onClose};
 const handlers=useRef<{close:(force?:boolean)=>void;navigate:(target:NavigationRequest,origin:NavigationOrigin)=>boolean}>({
  close:()=>{},navigate:()=>false
 });
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
   if(event.target===layer&&event.propertyName==="transform")completed();
  };
  layer.addEventListener("transitionend",onEnd);
  const timer=window.setTimeout(completed,duration+40);
  const frame=requestAnimationFrame(startTransition);
  owner.track(token,()=>{
   layer.removeEventListener("transitionend",onEnd);
   clearTimeout(timer);cancelAnimationFrame(frame);
  });
 };
 useLayoutEffect(()=>{
  const outer=stage.current,layer=surface.current;
  if(!outer||!layer)return;
  // React StrictMode may run setup again after a provisional cleanup.
  if(!runner.current||runner.current.isDisposed())
   runner.current=new GeometryMotion("hero",()=>performance.now(),requestAnimationFrame,cancelAnimationFrame,0);
  if(!surfaceOwner.current||surfaceOwner.current.snapshot().disposed)
   surfaceOwner.current=new MotionController("route",scheduler);
  if(!gestureArbiter.current)gestureArbiter.current=new GestureArbiter();
  width.current=viewportWidth(outer.getBoundingClientRect().width);
  paintTrack(0);
  outer.style.opacity="0";outer.style.transition="none";
  layer.style.transition="none";layer.style.transform=morphTransform();
  phase.current="opening";
  surfaceTransition(false);
  return ()=>{
   runner.current?.dispose();gestureArbiter.current?.dispose();
   surfaceOwner.current?.dispose();if(cleanup.current!==null)clearTimeout(cleanup.current);
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
   paintTrack(0);
   phase.current="idle";
  }else if(priorSignature.current!==signature||photoId!==committedPhotoId){
   runner.current?.cancel();paintTrack(0);
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
  });
  observer.observe(outer);return ()=>observer.disconnect();
 },[]);
 useEffect(()=>bindMotionLifecycle(()=>{
  const g=gesture.current;
  if(g){pointer.current.clear();gesture.current=null;gestureArbiter.current?.cancel();}
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
  if(gesture.current===null&&phase.current==="draggingY")resetGesture();
 }),[]);
 const settle=(target:0|-1|1)=>{
  const motion=runner.current;if(!motion||closing.current)return;
  const start=motion.cancel(),w=width.current;
  const hasTarget=target===0||!!latest.current.photos[latest.current.index-target];
  if(!hasTarget)return settle(0);
  phase.current="settling";
  const selected=latest.current;
  const targetPhoto=target===0?null:selected.photos[selected.index-target];
  motion.start(start,target*w,duration,easing,paintTrack,()=>{
   if(closing.current)return;
   if(!targetPhoto||target===0){phase.current="idle";return;}
   // One semantic commit per settle generation, after painting its endpoint.
   const valid=navigatePhoto(latest.current.photoId,latest.current.photos,{photoId:targetPhoto.id});
   if(!valid||valid!==targetPhoto.id){paintTrack(0);phase.current="idle";return;}
   sourceRef.current=null;setMenu(false);setMessage("");commitCount.current++;
   pendingCommit.current={id:targetPhoto.id,shift:target};
   setCommittedPhotoId(targetPhoto.id);
  },geometryRevision.current);
 };
 const requestNavigation=(request:NavigationRequest,_origin:NavigationOrigin):boolean=>{
  if(closing.current)return false;
  const selected=latest.current,target=navigatePhoto(selected.photoId,selected.photos,request);
  if(!target||target===selected.photoId)return false;
  if(gesture.current){gesture.current=null;pointer.current.clear();gestureArbiter.current?.cancel();}
  const nextIndex=photoIndex(selected.photos,target),shift=nextIndex-selected.index;
  if(Math.abs(shift)!==1){
   // Nonadjacent internal navigation is a non-animated, explicit rebase.
   runner.current?.cancel();paintTrack(0);sourceRef.current=null;
   setMenu(false);setMessage("");setCommittedPhotoId(target);return true;
  }
  if(phase.current==="opening"){stopSurface();phase.current="idle";}
  settle(shift===1?-1:1);return true;
 };
 const requestClose=(force=false)=>{
  if(menu&&!force){setMenu(false);return;}
  if(closing.current)return;
  closing.current=true;phase.current="closing";
  gesture.current=null;pointer.current.clear();pinch.current=null;zoom.current=1;
  gestureArbiter.current?.cancel();
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
  gesture.current=null;pointer.current.clear();pinch.current=null;zoom.current=1;
  gestureArbiter.current?.cancel();
  if(image.current){image.current.style.transition="transform 230ms cubic-bezier(.2,.75,.2,1)";image.current.style.transform="none";}
  if(surface.current){
   surface.current.style.transition="transform 230ms cubic-bezier(.2,.75,.2,1)";
   surface.current.style.transform="none";
  }
  if(stage.current){
   stage.current.style.transition="opacity 230ms cubic-bezier(.2,.75,.2,1)";
   stage.current.style.opacity="1";
  }
  if(!closing.current&&phase.current!=="settling")phase.current="idle";
 };
 const down=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(closing.current||menu||(e.pointerType==="mouse"&&e.button!==0))return;
  pointer.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointer.current.size===1){
   if(phase.current==="opening"){stopSurface();phase.current="idle";}
   const snap=runner.current?.snapshot();
   const frozen=runner.current?.cancel()??trackX.current;
   paintTrack(frozen);
   const serial=gestureArbiter.current?.begin("pointer",e.pointerId,"hero")??null;
   gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,
    startX:e.clientX,startY:e.clientY,time:performance.now(),axis:"",
    origin:frozen,serial,startPhotoId:latest.current.photoId,pinch:false,
    samples:[{x:e.clientX,t:performance.now()}],
    interruptedTarget:snap?.phase==="settling"?snap.target:null};
  }else if(pointer.current.size===2){
   gestureArbiter.current?.secondFinger();
   const g=gesture.current;if(g)g.pinch=true;
   const [a,b]=[...pointer.current.values()];
   pinch.current={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),
    cx:(a.x+b.x)/2,cy:(a.y+b.y)/2};phase.current="pinching";
  }
 };
 const move=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(!pointer.current.has(e.pointerId)||closing.current||menu)return;
  pointer.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const active=[...pointer.current.values()];
  if(active.length>=2){
   const g=gesture.current;if(g)g.pinch=true;
   const origin=pinch.current;if(!origin)return;
   const dist=Math.hypot(active[0].x-active[1].x,active[0].y-active[1].y);
   const cx=(active[0].x+active[1].x)/2,cy=(active[0].y+active[1].y)/2;
   zoom.current=Math.max(1,Math.min(3.2,dist/origin.distance));
   const maxX=(zoom.current-1)*innerWidth/2,maxY=(zoom.current-1)*innerHeight/2;
   const x=Math.max(-maxX,Math.min(maxX,cx-origin.cx)),y=Math.max(-maxY,Math.min(maxY,cy-origin.cy));
   if(image.current){
    image.current.style.transition="none";
    image.current.style.transform="translate3d("+x+"px,"+y+"px,0) scale("+zoom.current+")";
   }
   return;
  }
  const g=gesture.current;if(!g||g.id!==e.pointerId||g.pinch)return;
  const dx=e.clientX-g.startX,dy=e.clientY-g.startY;
  if(!g.axis){
   if(Math.max(Math.abs(dx),Math.abs(dy))<9)return;
   g.axis=Math.abs(dx)>Math.abs(dy)*1.18?"x":"y";
   if(g.serial!==null)gestureArbiter.current?.claim("hero",g.serial);
   phase.current=g.axis==="x"?"draggingX":"draggingY";
   if(g.axis==="y"&&Math.abs(trackX.current)>.1)settle(0);
  }
  if(e.cancelable)e.preventDefault();
  try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* Android WebView fallback */}
  if(g.axis==="x"){
   // No global 0.55 factor; CSS-pixel equality until first/last edge overscroll.
   const hasPrev=latest.current.index>0,hasNext=latest.current.index<latest.current.photos.length-1;
   const x=allowedOffset(g.origin+dx,width.current,hasPrev,hasNext);
   paintTrack(x);
   const t=performance.now();g.samples.push({x:e.clientX,t});
   if(g.samples.length>10)g.samples.shift();
  }else{
   // Same vertical baseline; surface and opacity write in the same pointer frame.
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
 const finish=(e:ReactPointerEvent<HTMLDivElement>,cancel:boolean)=>{
  if(!pointer.current.has(e.pointerId))return;
  pointer.current.delete(e.pointerId);
  const g=gesture.current;if(pointer.current.size)return;
  pinch.current=null;
  if(!g){resetGesture();return;}
  gesture.current=null;gestureArbiter.current?.cancel();
  if(g.pinch||zoom.current!==1){resetGesture();return;}
  const dx=e.clientX-g.startX,dy=e.clientY-g.startY;
  const elapsed=Math.max(1,performance.now()-g.time);
  if(!cancel&&g.axis==="y"&&(Math.abs(dy)>110||Math.abs(dy)/elapsed>.8)){requestClose();return;}
  if(g.axis==="x"){
   const t=performance.now(),samples=[...g.samples,{x:e.clientX,t}];
   const v=recentVelocity(samples);
   const x=trackX.current;
   const target=cancel?0:destination(x,width.current,v,latest.current.index>0,
    latest.current.index<latest.current.photos.length-1);
   const continueTarget=g.axis==="x"&&Math.abs(dx)<8&&g.interruptedTarget!==null?
    (g.interruptedTarget<0?-1:g.interruptedTarget>0?1:0):target;
   settle(continueTarget);
   return;
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
  if(pointer.current.has(e.pointerId))finish(e,true);
 };
 const phaseKey=phase.current;
 return createPortal(<section className="pm-viewer" role="dialog" aria-modal="true" aria-label="Просмотр фото"
   data-motion-phase={phaseKey} data-semantic-commits={commitCount.current}>
  <div className="pm-viewer-stage" ref={stage} onPointerDown={down} onPointerMove={move}
   onPointerUp={e=>finish(e,false)} onPointerCancel={e=>onLostPointer(e)}
   onLostPointerCapture={onLostPointer}>
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
