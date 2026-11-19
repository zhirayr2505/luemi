import {useLayoutEffect,useRef} from "react";
import {impactHaptic} from "../../ui/haptic";
import {GestureArbiter,type GestureOwner} from "../../ui/gesture-arbiter";
import {bindMotionLifecycle} from "../../ui/motion-lifecycle";
import type {ProfileRouteMotionHandle} from "../profile-route-motion";
import {GeometryMotion,type Easing} from "../geometry-motion";
import {
 clamp,createOwnerProfileLayout,ownerAutoSnapTarget,ownerMorphEndpoint,
 ownerMorphFrame,ownerMorphProgress,ownerRubberPosition,ownerUnresistedPosition
} from "./OwnerProfileGeometry";

type Endpoint=0|1;
type Source="photo"|"tabs"|"cards"|"sheet";
type Point={x:number;y:number};
type Press={
 id:number;serial:number;source:Source;owner:GestureOwner|null;
 start:Point;last:Point;distance:number;origin:number;startedCompact:boolean;
 startScroll:number;velocity:number;sampleTime:number;
 auto:Endpoint|null;remainder:number;scrollCards:boolean;captured:boolean;
};
type Horizontal={
 startPhoto:(visibleWidth:number,fullWidth:number)=>void;
 movePhoto:(delta:number)=>void;
 endPhoto:(direction:-1|0|1)=>void;
 cancelPhoto:()=>void;
 pageTab:(direction:-1|1)=>void;
};
type Options={
 active:boolean;profileId:string|null;gestureArbiter?:GestureArbiter;
 registerRouteMotion?:(handle:ProfileRouteMotionHandle|null)=>void;
 onMotionProgress?:(progress:number,dragging:boolean)=>void;
 horizontal:Horizontal;
};

const translate=(x:number,y:number)=>`translate3d(${x}px,${y}px,0)`;
const atTop=(scrollTop:number)=>scrollTop<=.5;

export function useOwnerProfileMotion(options:Options){
 const {active,profileId,gestureArbiter}=options;
 const latest=useRef(options);
 const root=useRef<HTMLElement>(null);
 const commands=useRef<{compact:()=>void;resetCards:()=>void;allowClick:()=>boolean}>({
  compact:()=>{},resetCards:()=>{},allowClick:()=>true
 });

 useLayoutEffect(()=>{latest.current=options;});
 useLayoutEffect(()=>{
  const host=root.current;
  if(!active||!host)return;
  const brand=host.querySelector<HTMLElement>(".owner-profile-brand")!;
  const mask=host.querySelector<HTMLElement>(".owner-profile-photo-mask")!;
  const shade=host.querySelector<HTMLElement>(".owner-profile-photo-shade")!;
  const identity=host.querySelector<HTMLElement>(".owner-profile-identity")!;
  const name=identity.querySelector<HTMLElement>("h1")!;
  const location=identity.querySelector<HTMLElement>("p")!;
  const pager=host.querySelector<HTMLElement>(".owner-profile-photo-pager")!;
  const sheet=host.querySelector<HTMLElement>(".owner-profile-sheet")!;
  const scroll=host.querySelector<HTMLElement>(".owner-profile-scroll")!;
  const gestures=gestureArbiter??new GestureArbiter();
  const motion=new GeometryMotion("sheet",()=>performance.now(),
   callback=>requestAnimationFrame(callback),id=>cancelAnimationFrame(id),0);

  let geometry=createOwnerProfileLayout({width:393,height:852,brandBottom:65});
  let position=0,accepted:Endpoint=0,settling:Endpoint|null=null;
  let press:Press|null=null,blockedUntil=0,resizeRaf=0,paintRaf=0;
  let pendingPaint=0,routePaused=false,backgroundPaused=false;
  let wheelTimer:number|undefined;
  let wheel:{mode:"morph"|"native"|"cards";raw:number;auto:Endpoint|null;remainder:number}|null=null;
  const paused=()=>routePaused||backgroundPaused;
  const compact=()=>settling===null&&position===1;

  const paint=(value:number)=>{
   position=value;
   const distance=geometry.morphDistance;
   const progress=ownerMorphProgress(value*distance,distance);
   const frame=ownerMorphFrame(geometry,value);
   const {mask:photo,identityCenter:center}=frame;
   mask.style.transform=`${translate(photo.x,photo.y)} scale(${photo.width/geometry.width})`;
   mask.style.borderRadius=`${frame.radius/photo.width*100}%`;
   shade.style.opacity=String(1-center);
   sheet.style.transform=translate(0,frame.sheetTop);
   identity.style.transform=translate(0,frame.identityTop);
   const x=24+(geometry.width/2-24)*center;
   const align=`translateX(${x}px) translateX(${-50*center}%)`;
   name.style.transform=`${align} scale(${1-.25*center})`;
   name.style.transformOrigin=`${50*center}% 0`;
   location.style.transform=`translateY(${-12*center}px) ${align}`;
   pager.style.transform=translate(0,frame.sheetTop-24);
   const hideControls=progress>=.64;
   if(pager.inert!==hideControls)pager.inert=hideControls;
   const state=settling!==null?"transition":value===0?"expanded":value===1?"compact":"transition";
   if(host.dataset.morphState!==state){
    host.dataset.morphState=state;
    mask.classList.toggle("owner-profile-avatar-circle",state==="compact");
   }
   latest.current.onMotionProgress?.(1-progress,settling!==null||(press?.owner==="sheet"&&press.auto===null&&!press.scrollCards));
  };
  const cancelPaint=()=>{
   if(paintRaf)cancelAnimationFrame(paintRaf);
   paintRaf=0;
  };
  const schedulePaint=(value:number)=>{
   pendingPaint=value;
   if(paintRaf)return;
   paintRaf=requestAnimationFrame(()=>{paintRaf=0;paint(pendingPaint);});
  };
  const flushPaint=()=>{
   if(!paintRaf)return;
   cancelPaint();
   paint(pendingPaint);
  };
  const interrupt=()=>{
   if(settling===null)return;
   // Keep the last pixels actually presented and hand control to the new press.
   motion.cancel();
   settling=null;
   paint(position);
  };
  const writeCards=(press:Press)=>{scroll.scrollTop=press.remainder;};
  const settleTo=(target:Endpoint,velocity=0,notify=false,afterCompact?:()=>void)=>{
   flushPaint();
   if(accepted!==target&&notify)impactHaptic("light");
   accepted=target;
   if(settling===target)return;
   if(settling===null&&position===target){
    if(target===1)afterCompact?.();
    paint(target);
    return;
   }
   const from=position;
   const duration=clamp(215+Math.abs(target-from)*120,215,325);
   const distance=geometry.morphDistance;
   const slope=velocity*duration/(distance*(target-from));
   const curve:Easing=[.21,clamp(slope*.21,.22,.9),.27,1.12];
   settling=target;
   paint(from);
   motion.start(from*distance,target*distance,duration,curve,value=>paint(value/distance),()=>{
    settling=null;
    paint(target);
    if(target===1)afterCompact?.();
   },undefined,true);
  };
  const settleRelease=(velocity:number)=>{
   flushPaint();
   const distance=geometry.morphDistance;
   const target=ownerMorphEndpoint(position*distance,distance,velocity)===0?0:1;
   // Rubber returns to expanded even if a small reversal ended the pull.
   settleTo(position<0?0:target,velocity,true);
  };

  const release=(current:Press)=>{
   if(current.owner)gestures.finish(current.owner,current.serial);
   else{
    gestures.finishCandidate(current.serial,current.source==="photo"?"hero":"tabs");
    gestures.finishCandidate(current.serial,"sheet");
    gestures.finishCandidate(current.serial,"native");
   }
   if(current.captured&&host.hasPointerCapture(current.id))host.releasePointerCapture(current.id);
  };
  const clearWheel=()=>{
   window.clearTimeout(wheelTimer);
   wheelTimer=undefined;wheel=null;
  };
  const cancelInput=()=>{
   const current=press;
   press=null;
   if(current)release(current);
   clearWheel();
   latest.current.horizontal.cancelPhoto();
   cancelPaint();
  };

  const start=(target:EventTarget|null,id:number,point:Point,kind:"pointer"|"touch")=>{
   if(paused()||press||!(target instanceof Element))return;
   const source:Source=target.closest(".owner-profile-photo-mask")?"photo":
    target.closest(".owner-profile-tabs")?"tabs":
    target.closest(".owner-profile-scroll")?"cards":"sheet";
   const candidate=source==="photo"?"hero":"tabs";
   const serial=gestures.begin(kind,id,candidate);
   if(serial===null)return;
   gestures.begin(kind,id,"sheet");
   gestures.begin(kind,id,"native");
   clearWheel();
   blockedUntil=0;
   flushPaint();
   interrupt();
   const startScroll=Math.max(0,scroll.scrollTop);
   press={id,serial,source,owner:null,start:point,last:point,
    distance:geometry.morphDistance,origin:position,startedCompact:compact(),startScroll,
    velocity:0,sampleTime:performance.now(),auto:null,remainder:0,scrollCards:false,captured:false};
  };

  const dragMorph=(current:Press,dy:number)=>{
    const from=ownerUnresistedPosition(current.origin*current.distance);
   const raw=from-dy;
   if(current.auto!==null){
    if(current.auto===1){
     current.remainder=Math.max(0,raw-current.distance);
     if(compact())writeCards(current);
    }
    return;
   }
   const next=ownerRubberPosition(Math.min(raw,Math.max(current.distance,from)));
   const auto=raw>=current.distance?1:ownerAutoSnapTarget(accepted,next,current.distance);
   const towardTarget=auto===1?raw>from:raw<from;
   schedulePaint(next/current.distance);
   if(auto!==null&&towardTarget){
    current.auto=auto;
    current.remainder=Math.max(0,raw-current.distance);
    settleTo(auto,current.velocity,true,()=>writeCards(current));
   }
  };
  const sample=(current:Press,point:Point,horizontal:boolean)=>{
   const now=performance.now(),elapsed=now-current.sampleTime;
   if(elapsed>0){
    const delta=horizontal?point.x-current.last.x:current.last.y-point.y;
    const velocity=delta/elapsed;
    current.velocity=elapsed>75||!current.velocity?velocity:current.velocity*.38+velocity*.62;
   }
   current.last=point;
   current.sampleTime=now;
  };
  const move=(current:Press,point:Point,event:TouchEvent|PointerEvent)=>{
   const dx=point.x-current.start.x,dy=point.y-current.start.y;
   if(!current.owner){
    const horizontal=Math.abs(dx)>=9&&Math.abs(dx)>Math.abs(dy)*1.2;
    // Give a compact boundary pull the first cancellable touchmove, before
    // the WebView commits to native scrolling. Keep normal axis slop elsewhere.
    const boundaryPull=current.startedCompact&&atTop(current.startScroll)&&dy>0;
    const vertical=Math.abs(dy)>=(boundaryPull?2:6)&&Math.abs(dy)>Math.abs(dx)*1.2;
    if(!horizontal&&!vertical)return;
    current.scrollCards=vertical&&current.startedCompact&&(dy<0||!atTop(current.startScroll));
    const useNative=vertical&&event.type==="touchmove"&&current.startedCompact&&current.source==="cards"&&
     (current.scrollCards||!event.cancelable);
    const owner=horizontal?(current.source==="photo"?"hero":"tabs"):useNative?"native":"sheet";
    if(!gestures.claim(owner,current.serial)){
     press=null;
     release(current);
     return;
    }
    current.owner=owner;
    if(owner==="native")return;
    if(event.type==="pointermove"){
     try{
      host.setPointerCapture(current.id);
      current.captured=true;
     }catch{/* The pointer may have already left the WebView. */}
    }
    if(owner==="hero")latest.current.horizontal.startPhoto(ownerMorphFrame(geometry,position).mask.width,geometry.width);
    // Freeze native inertia only once an exclusive gesture has taken over.
    if(owner==="sheet"&&current.startedCompact)scroll.scrollTop=current.startScroll;
   }
   if(current.owner==="native"||!gestures.owns(current.owner,current.serial))return;
   if(event.cancelable)event.preventDefault();
   blockedUntil=performance.now()+400;
   sample(current,point,current.owner!=="sheet");
   if(current.owner==="sheet"){
    if(current.scrollCards)scroll.scrollTop=current.startScroll-dy;
    else dragMorph(current,dy);
   }else if(current.owner==="hero")latest.current.horizontal.movePhoto(dx);
  };
  const end=(current:Press,cancelled:boolean)=>{
   press=null;
   release(current);
   const owner=current.owner;
   if(owner&&owner!=="native")blockedUntil=performance.now()+400;
   const speed=performance.now()-current.sampleTime<=76?current.velocity:0;
   if(owner==="sheet"&&!current.scrollCards&&current.auto===null){
    if(cancelled)settleTo(accepted);
    else settleRelease(speed);
    return;
   }
   if(owner==="hero"||owner==="tabs"){
    const dx=current.last.x-current.start.x;
    const width=owner==="hero"?ownerMorphFrame(geometry,position).mask.width:geometry.width;
    const threshold=owner==="hero"?Math.max(24,width*.18):48;
    const direction=!cancelled&&(Math.abs(dx)>=threshold||(Math.abs(dx)>=12&&Math.abs(speed)>.48))?
     (dx<0?-1:1):0;
    if(owner==="hero")latest.current.horizontal.endPhoto(direction);
    else if(direction!==0)latest.current.horizontal.pageTab(direction===-1?1:-1);
   }
   if(current.auto===null&&settling===null&&position!==accepted)settleTo(accepted);
  };

  const touchStart=(event:TouchEvent)=>{
   if(event.touches.length!==1){
    if(press)end(press,true);
    return;
   }
   const point=event.changedTouches[0];
   if(point)start(event.target,point.identifier,{x:point.clientX,y:point.clientY},"touch");
  };
  const changedTouch=(event:TouchEvent,id:number)=>{
   for(let index=0;index<event.changedTouches.length;index++){
    const point=event.changedTouches[index];
    if(point.identifier===id)return point;
   }
   return null;
  };
  const touchMove=(event:TouchEvent)=>{
   if(!press)return;
   const point=changedTouch(event,press.id);
   if(point)move(press,{x:point.clientX,y:point.clientY},event);
  };
  const touchEnd=(event:TouchEvent)=>{
   if(press&&changedTouch(event,press.id))end(press,event.type==="touchcancel");
  };
  const pointerDown=(event:PointerEvent)=>{
   if(event.pointerType==="touch"||event.button!==0||!event.isPrimary)return;
   start(event.target,event.pointerId,{x:event.clientX,y:event.clientY},"pointer");
  };
  const pointerMove=(event:PointerEvent)=>{
   if(event.pointerType!=="touch"&&press?.id===event.pointerId)
    move(press,{x:event.clientX,y:event.clientY},event);
  };
  const pointerEnd=(event:PointerEvent)=>{
   if(event.pointerType!=="touch"&&press?.id===event.pointerId)end(press,event.type!=="pointerup");
  };
  const onWheel=(event:WheelEvent)=>{
   if(paused()||press||event.ctrlKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)||!event.deltaY)return;
   const distance=geometry.morphDistance;
   if(!wheel){
    interrupt();
    const overCards=event.target instanceof Element&&scroll.contains(event.target);
    const useCards=compact()&&(event.deltaY>0||!atTop(scroll.scrollTop));
    wheel={mode:useCards?(overCards?"native":"cards"):"morph",
     raw:ownerUnresistedPosition(position*distance),auto:null,remainder:Math.max(0,scroll.scrollTop)};
   }
   const current=wheel;
   window.clearTimeout(wheelTimer);
   wheelTimer=window.setTimeout(()=>{
    if(current.mode==="morph"&&current.auto===null&&settling===null)settleRelease(0);
    clearWheel();
   },130);
   if(current.mode==="native")return;
   if(event.cancelable)event.preventDefault();
   const delta=event.deltaY*(event.deltaMode===1?18:event.deltaMode===2?scroll.clientHeight:1);
   if(current.mode==="cards"){scroll.scrollTop+=delta;return;}
   current.raw+=delta;
   if(current.auto!==null){
    if(current.auto===1){
     current.remainder=Math.max(0,current.raw-distance);
     if(compact())scroll.scrollTop=current.remainder;
    }
    return;
   }
   const next=ownerRubberPosition(Math.min(current.raw,distance));
   const target=current.raw>=distance?1:ownerAutoSnapTarget(accepted,next,distance);
   schedulePaint(next/distance);
   if(target!==null){
    current.auto=target;
    current.remainder=Math.max(0,current.raw-distance);
    settleTo(target,0,true,()=>{scroll.scrollTop=current.remainder;});
   }
  };

  const measure=()=>{
   const rect=host.getBoundingClientRect();
   if(!rect.width||!rect.height)return;
   geometry=createOwnerProfileLayout({width:rect.width,height:rect.height,
    brandBottom:brand.getBoundingClientRect().bottom-rect.top});
   sheet.style.height=`calc(100% - ${geometry.compactContentTop}px)`;
   if(paintRaf)flushPaint();
   else paint(position);
  };
  const resize=()=>{
   if(resizeRaf)return;
   resizeRaf=requestAnimationFrame(()=>{resizeRaf=0;measure();});
  };
  const observer=new ResizeObserver(resize);
  observer.observe(host);observer.observe(brand);
  const web=window.Telegram?.WebApp;
  const viewportChanged=(event?:{isStateStable?:boolean})=>{if(event?.isStateStable!==false)resize();};
  window.visualViewport?.addEventListener("resize",resize);
  web?.onEvent?.("viewportChanged",viewportChanged);
  web?.onEvent?.("safeAreaChanged",resize);
  web?.onEvent?.("contentSafeAreaChanged",resize);

  const pause=()=>{cancelInput();interrupt();};
  const resume=()=>{if(!paused())settleTo(accepted);};
  const suspendForBackground=()=>{if(!backgroundPaused){backgroundPaused=true;pause();}};
  const resumeFromBackground=()=>{if(backgroundPaused){backgroundPaused=false;resume();}};
  const disposeLifecycle=bindMotionLifecycle(suspendForBackground,resumeFromBackground);
  const routeHandle:ProfileRouteMotionHandle={
   suspendForRoute:()=>{routePaused=true;pause();},
   rollbackRoute:()=>{routePaused=false;resume();},
   commitRouteClose:()=>{routePaused=true;pause();},
   suspendForBackground,resumeFromBackground
  };

  commands.current={
   compact:()=>{if(!paused())settleTo(1,0,true);},
   resetCards:()=>{scroll.scrollTop=0;},
   allowClick:()=>performance.now()>=blockedUntil
  };
  host.addEventListener("touchstart",touchStart,{passive:true});
  host.addEventListener("touchmove",touchMove,{passive:false});
  host.addEventListener("touchend",touchEnd,{passive:true});
  host.addEventListener("touchcancel",touchEnd,{passive:true});
  host.addEventListener("pointerdown",pointerDown);
  host.addEventListener("pointermove",pointerMove);
  host.addEventListener("lostpointercapture",pointerEnd);
  window.addEventListener("pointerup",pointerEnd);
  window.addEventListener("pointercancel",pointerEnd);
  host.addEventListener("wheel",onWheel,{passive:false});
  const register=latest.current.registerRouteMotion;
  register?.(routeHandle);
  scroll.scrollTop=0;
  measure();

  return()=>{
   register?.(null);
   disposeLifecycle();
   cancelInput();
   motion.dispose();
   observer.disconnect();
   if(resizeRaf)cancelAnimationFrame(resizeRaf);
   window.visualViewport?.removeEventListener("resize",resize);
   web?.offEvent?.("viewportChanged",viewportChanged);
   web?.offEvent?.("safeAreaChanged",resize);
   web?.offEvent?.("contentSafeAreaChanged",resize);
   host.removeEventListener("touchstart",touchStart);
   host.removeEventListener("touchmove",touchMove);
   host.removeEventListener("touchend",touchEnd);
   host.removeEventListener("touchcancel",touchEnd);
   host.removeEventListener("pointerdown",pointerDown);
   host.removeEventListener("pointermove",pointerMove);
   host.removeEventListener("lostpointercapture",pointerEnd);
   window.removeEventListener("pointerup",pointerEnd);
   window.removeEventListener("pointercancel",pointerEnd);
   host.removeEventListener("wheel",onWheel);
   commands.current={compact:()=>{},resetCards:()=>{},allowClick:()=>true};
  };
 },[active,profileId,gestureArbiter]);

 return {root,commands};
}
