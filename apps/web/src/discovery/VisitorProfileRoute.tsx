import {memo,useLayoutEffect,useRef} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {ProfileMaster} from "./ProfileMaster";
import {GlobalHeader} from "./GlobalHeader";
import {createProfileMotionAuthority,PROFILE_MOTION_WRITER_TABLE} from "./profile-motion";
import {GestureArbiter,isGestureModalBlocked,fractionalTrack,computedTranslation} from "../ui/gesture-arbiter";
import {MotionController,type MotionToken} from "../ui/motion-controller";
import {bindMotionLifecycle} from "../ui/motion-lifecycle";
import {useModalLayer} from "../ui/modal-layer";
import type {ProfileRouteMotionHandle} from "./ProfileMaster";
import type {HeaderMotion} from "./GlobalHeader";
import type {ProfileMasterData} from "./ProfileModel";
import {QaProfiler} from "./qa-profiler";

type Props={
 data:ProfileMasterData;theme:"light"|"dark";onTheme:()=>void;onExit:()=>void;
 registerBack:(handler:(()=>boolean)|null)=>void;
};
type RouteDrag={
 id:number;startX:number;startY:number;started:number;origin:number;span:number;claimed:boolean;serial:number;
 source:"photo"|"pages"|"tabs"|"sheet";
};
const OPEN_DURATION=260;
const CLOSE_DURATION=230;
const EASING="cubic-bezier(.2,.82,.24,1)";

/** One navigation layer; the profile sheet and its vertical scroll do not translate. */
export const VisitorProfileRoute=memo(function VisitorProfileRoute({data,theme,onTheme,onExit,registerBack}:Props){
 const route=useRef<HTMLDivElement>(null);
 const escapeClose=useRef<()=>void>(()=>{});
 useModalLayer(true,route,()=>escapeClose.current());
 const motionAuthority=useRef(createProfileMotionAuthority());
 const gestures=useRef(new GestureArbiter()).current;
 const detachSuppression=useRef<()=>void>(()=>{});
 const attachSuppression=useRef<()=>void>(()=>{});
 const header=useRef<HeaderMotion>(null);
 const gesture=useRef<RouteDrag|null>(null);
 const childMotion=useRef<ProfileRouteMotionHandle|null>(null);
 const paused=useRef(false),intent=useRef<"opening"|"rollback"|"closing"|null>(null);
 const routeMotion=useRef(new MotionController("route",{
  frame:cb=>requestAnimationFrame(cb),cancelFrame:id=>cancelAnimationFrame(id)
 }));
 const liveToken=useRef<MotionToken|null>(null),liveTarget=useRef(0);
 const closing=useRef(false);
 const timer=useRef<number|null>(null);
 const entranceFrame=useRef<number|null>(null);
 const finishMotion=useRef<(()=>void)|null>(null);

 const clearTimer=()=>{
  if(timer.current!==null){window.clearTimeout(timer.current);timer.current=null;}
  finishMotion.current=null;
 };
 const currentX=()=>computedTranslation(route.current);
 const width=()=>route.current?.clientWidth||window.innerWidth;
 const setX=(x:number)=>{
  motionAuthority.current.run("route",PROFILE_MOTION_WRITER_TABLE.route,()=>{
   if(route.current)route.current.style.transform="translate3d("+x+"px,0,0)";
  });
 };
 const ensureRouteMotion=()=>{
  if(routeMotion.current.snapshot().disposed)
   routeMotion.current=new MotionController("route",{
    frame:cb=>requestAnimationFrame(cb),cancelFrame:id=>cancelAnimationFrame(id)
   });
  return routeMotion.current;
 };
 const finish=()=>{
  const token=liveToken.current;
  if(!token||paused.current||!routeMotion.current.owns(token)||
    Math.abs(currentX()-liveTarget.current)>1)return;
  liveToken.current=null;
  const callback=finishMotion.current;
  clearTimer();
  routeMotion.current.finish(token,{paint:n=>setX(n),onCommit:()=>{callback?.();}});
 };
 const moveTo=(target:number,done:()=>void,reason:"opening"|"rollback"|"closing"=target===0?"opening":"closing")=>{
  const el=route.current;if(!el)return;
  // Freeze the real CSS matrix; never jump to a logical open/closed integer.
  const start=currentX();
  const controller=ensureRouteMotion();
  clearTimer();
  const token=controller.begin(start);
  if(!token)return;
  if(reason==="closing")controller.close(token,target);
  else controller.settle(token,target);
  liveToken.current=token;liveTarget.current=target;intent.current=reason;
  finishMotion.current=done;
  el.style.transition="none";
  setX(start);
  void el.offsetWidth;
  const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const full=target===0?OPEN_DURATION:CLOSE_DURATION;
  const distance=Math.abs(target-start);
  const duration=reduce?0:Math.max(85,Math.round(full*distance/Math.max(1,width())));
  if(paused.current)return;
  if(!duration){setX(target);finish();return;}
  el.style.transition="transform "+duration+"ms "+EASING;
  setX(target);
  const id=window.setTimeout(()=>finish(),duration+55);
  timer.current=id;
  controller.track(token,()=>{window.clearTimeout(id);if(timer.current===id)timer.current=null;});
 };
 const rollback=()=>moveTo(0,()=>{
  childMotion.current?.rollbackRoute();
 },"rollback");
 const close=()=>{
  if(closing.current)return;
  closing.current=true;
  gesture.current=null;
  detachSuppression.current();
  if(entranceFrame.current!==null){cancelAnimationFrame(entranceFrame.current);entranceFrame.current=null;}
  childMotion.current?.commitRouteClose();
  gestures.cancel();
  moveTo(width(),onExit,"closing");
 };
 escapeClose.current=close;
 // Keep lifecycle listeners mounted once; resolve latest handlers through a
 // stable ref so a React render cannot detach/reinstall them mid-gesture.
 const motionActions=useRef({moveTo,rollback,onExit});
 motionActions.current={moveTo,rollback,onExit};
 const reportMotion=(progress:number,dragging:boolean)=>{
  header.current?.setProfileProgress(progress,dragging);
 };

 useLayoutEffect(()=>{
  const el=route.current;
  // No non-passive capture listeners during candidate/native scrolling.
  // Install route touch suppression only AFTER a valid exclusive claim.
  const suppressClaimedTouch=(event:TouchEvent)=>{
   if(!gesture.current?.claimed||gestures.owner()!=="route")return;
   if(event.cancelable)event.preventDefault();
   event.stopPropagation();
  };
  const suppress=()=>{
   if(!el)return;
   el.addEventListener("touchmove",suppressClaimedTouch,{capture:true,passive:false});
   el.addEventListener("touchend",suppressClaimedTouch,{capture:true,passive:false});
   el.addEventListener("touchcancel",suppressClaimedTouch,{capture:true,passive:false});
   detachSuppression.current=()=>{
    el.removeEventListener("touchmove",suppressClaimedTouch,true);
    el.removeEventListener("touchend",suppressClaimedTouch,true);
    el.removeEventListener("touchcancel",suppressClaimedTouch,true);
    detachSuppression.current=()=>{};
   };
  };
  attachSuppression.current=suppress;
  entranceFrame.current=requestAnimationFrame(()=>{
   entranceFrame.current=null;
   if(!closing.current)motionActions.current.moveTo(0,()=>{},"opening");
  });
  return ()=>{
   if(entranceFrame.current!==null)cancelAnimationFrame(entranceFrame.current);
   clearTimer();liveToken.current=null;
   routeMotion.current.dispose();
   detachSuppression.current();attachSuppression.current=()=>{};
   gestures.dispose();
  };
 },[gestures]);
 useLayoutEffect(()=>bindMotionLifecycle(()=>{
  if(paused.current)return;
  paused.current=true;
  // Terminal single-owner cancellation precedes any prospective new gestures.
  const wasDragging=!!gesture.current?.claimed,oldPointer=gesture.current?.id;
  gesture.current=null;detachSuppression.current();gestures.cancel();
  try{if(oldPointer!==undefined&&route.current?.hasPointerCapture(oldPointer))
   route.current.releasePointerCapture(oldPointer);}catch{/* WebView implicit loss */}
  if(entranceFrame.current!==null){cancelAnimationFrame(entranceFrame.current);entranceFrame.current=null;}
  childMotion.current?.suspendForBackground();
  const el=route.current;
  if(el){const x=currentX();el.style.transition="none";setX(x);}
  clearTimer();
  if(liveToken.current)routeMotion.current.cancel(liveToken.current,"external");
  liveToken.current=null;
  if(wasDragging&&!closing.current)intent.current="rollback";
 },()=>{
  if(!paused.current)return;
  // The layout/REM-02B geometry adapters are measured before any new tween.
  void route.current?.getBoundingClientRect();
  void window.visualViewport?.height;
  paused.current=false;
  if(closing.current||intent.current==="closing"){
   motionActions.current.moveTo(width(),motionActions.current.onExit,"closing");
  }else if(intent.current==="opening"){
   motionActions.current.moveTo(0,()=>childMotion.current?.resumeFromBackground(),"opening");
  }else motionActions.current.rollback();
 }),[gestures]);

 // Expanded: only gestures originating on the white sheet may close.
 // Collapsed: the complete profile is a back-swipe surface. The photo hero
 // never becomes a back-swipe surface while expanded, even on photo #1.
 const down=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(!e.isPrimary){
   const claimed=!!gesture.current?.claimed;
   gestures.secondFinger();gesture.current=null;detachSuppression.current();
   if(claimed)rollback();
   return;
  }
  if(paused.current||closing.current||(e.pointerType==="mouse"&&e.button!==0))return;
  const target=e.target as HTMLElement;
  // Guard only nested interactive layers, never stale scroll offsets. The
  // shared arbiter decides horizontal/vertical ownership from movement.
  if(isGestureModalBlocked(target))return;
  const shell=route.current?.querySelector<HTMLElement>(".pm-shell");
  const collapsed=shell?.dataset.sheetState==="collapsed";
  if(!collapsed&&!target.closest(".pm-profile-sheet"))return;
  const source:RouteDrag["source"]=target.closest(".pm-hero")?"photo":
   target.closest(".pm-tabs")?"tabs":target.closest(".pm-pages")?"pages":"sheet";
  const serial=gestures.begin("pointer",e.pointerId,"route");
  if(serial===null)return;
  gesture.current={id:e.pointerId,startX:e.clientX,startY:e.clientY,started:performance.now(),
   origin:currentX(),span:width(),claimed:false,source,serial};
 };
 const move=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const g=gesture.current;if(!g||g.id!==e.pointerId)return;
  const dx=e.clientX-g.startX,dy=e.clientY-g.startY;
  if(!g.claimed){
   if(Math.abs(dy)>11&&Math.abs(dy)>Math.abs(dx)){
    // Parent pointer capture precedes child touchmove on Android. If the
    // touch originated on the sheet/pages, leave the shared gesture session
    // alive so the sheet recognizer can claim the vertical movement.
    // Photo hero and independent tabs still release unclaimed candidates.
    gestures.finishCandidate(g.serial,"route");
    gesture.current=null;return;
   }
   if(dx<9||dx<Math.abs(dy)*1.28)return;
   // Preserve the existing gallery and tab pager until their first item;
   // a page with remaining content always owns its own right swipe.
   if(g.source==="photo"){
    const track=route.current?.querySelector<HTMLElement>(".pm-photo-track");
    const hero=route.current?.querySelector<HTMLElement>(".pm-hero");
    if(fractionalTrack(track??null,hero?.clientWidth??0,0)>.015)return;
   }
   if(g.source==="pages"){
    const page=route.current?.querySelector<HTMLElement>(".pm-pages");
    if(page&&page.scrollLeft>1)return;
   }
   const tabStrip=route.current?.querySelector<HTMLElement>(".pm-tabs");
   if(g.source==="tabs"&&tabStrip&&tabStrip.scrollLeft>1)return;
   if(!gestures.claim("route",g.serial))return;
   g.claimed=true;
   attachSuppression.current();
   childMotion.current?.suspendForRoute();
   // Read the interpolated position BEFORE disabling CSS transition:
   // doing it in the opposite order can snap a mid-entry gesture to zero.
   const frozenX=currentX();
   clearTimer();
   if(liveToken.current)routeMotion.current.cancel(liveToken.current,"interrupted");
   liveToken.current=null;intent.current="rollback";
   if(route.current){route.current.style.transition="none";setX(frozenX);g.origin=frozenX;}
   try{route.current?.setPointerCapture(e.pointerId);}catch{/* older WebView */}
  }
  if(!gestures.owns("route",g.serial))return;
  if(e.cancelable)e.preventDefault();
  e.stopPropagation();
  // Width stays stable for this gesture; avoid a clientWidth/layout read on every pointermove.
   setX(Math.max(0,Math.min(g.span,g.origin+dx)));
 };
 const end=(e:ReactPointerEvent<HTMLDivElement>,cancelled=false)=>{
  const g=gesture.current;if(!g||g.id!==e.pointerId)return;
  gesture.current=null;
  if(!g.claimed){gestures.finishCandidate(g.serial,"route");return;}
  if(!gestures.finish("route",g.serial))return;
  detachSuppression.current();
  if(e.cancelable)e.preventDefault();
  e.stopPropagation();
  try{if(route.current?.hasPointerCapture(e.pointerId))route.current.releasePointerCapture(e.pointerId);}catch{/* old WebView */}
  const dx=Math.max(0,e.clientX-g.startX);
  const dt=Math.max(1,performance.now()-g.started);
  const x=currentX();
  const willClose=!cancelled&&(x>g.span*.32||(dx>35&&dx/dt>.58));
  if(willClose)close();
  else rollback();
 };
 return <div className="discovery-visitor-route" ref={route}
    onTransitionEnd={e=>{if(e.target===e.currentTarget&&e.propertyName==="transform")finish();}}
    onPointerDownCapture={down} onPointerMoveCapture={move}
    onPointerUpCapture={e=>end(e)} onPointerCancelCapture={e=>end(e,true)}
    onLostPointerCapture={e=>{if(e.target===e.currentTarget)end(e,true);}}>
   <QaProfiler id="ProfileMaster"><ProfileMaster data={data} mode="visitor" onClose={close}
     registerBack={registerBack} gestureArbiter={gestures}
     registerRouteMotion={handle=>{childMotion.current=handle;}}
     onMotionProgress={reportMotion}/></QaProfiler>
   <GlobalHeader ref={header} mode="profile" theme={theme} onTheme={onTheme}
     onFilters={()=>{}} onSaved={()=>{}}/>
  </div>;
});
