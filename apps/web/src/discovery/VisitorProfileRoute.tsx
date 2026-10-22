import {useLayoutEffect,useRef} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {ProfileMaster} from "./ProfileMaster";
import {GlobalHeader} from "./GlobalHeader";
import {createProfileMotionAuthority,PROFILE_MOTION_WRITER_TABLE} from "./profile-motion";
import {GestureArbiter,gestureCapabilities,fractionalTrack} from "../ui/gesture-arbiter";
import type {HeaderMotion} from "./GlobalHeader";
import type {ProfileMasterData} from "./ProfileModel";

type Props={
 data:ProfileMasterData;theme:"light"|"dark";onTheme:()=>void;onExit:()=>void;
 registerBack:(handler:(()=>boolean)|null)=>void;
};
type RouteDrag={
 id:number;startX:number;startY:number;started:number;origin:number;claimed:boolean;serial:number;
 source:"photo"|"pages"|"tabs"|"sheet";
};
const OPEN_DURATION=260;
const CLOSE_DURATION=230;
const EASING="cubic-bezier(.2,.82,.24,1)";

/** One navigation layer; the profile sheet and its vertical scroll do not translate. */
export function VisitorProfileRoute({data,theme,onTheme,onExit,registerBack}:Props){
 const route=useRef<HTMLDivElement>(null);
 const motionAuthority=useRef(createProfileMotionAuthority());
 const gestures=useRef(new GestureArbiter()).current;
 const detachSuppression=useRef<()=>void>(()=>{});
 const attachSuppression=useRef<()=>void>(()=>{});
 const header=useRef<HeaderMotion>(null);
 const gesture=useRef<RouteDrag|null>(null);
 const cancelProfileGesture=useRef<(()=>void)|null>(null);
 const closing=useRef(false);
 const timer=useRef<number|null>(null);
 const entranceFrame=useRef<number|null>(null);
 const finishMotion=useRef<(()=>void)|null>(null);

 const revealUnderlay=(visible:boolean)=>{
  motionAuthority.current.run("route",PROFILE_MOTION_WRITER_TABLE.route,()=>{
   const app=route.current?.closest<HTMLElement>(".discovery-app");
   if(visible)app?.setAttribute("data-route-revealing","true");
   else app?.removeAttribute("data-route-revealing");
  });
 };
 const clearTimer=()=>{
  if(timer.current!==null){window.clearTimeout(timer.current);timer.current=null;}
  finishMotion.current=null;
 };
 const currentX=()=>{
  const el=route.current;
  if(!el)return 0;
  const transform=getComputedStyle(el).transform;
  const match=transform.match(/matrix(3d)?\(([^)]+)\)/);
  if(!match)return 0;
  const values=match[2].split(",").map(Number);
  const x=match[1]?values[12]:values[4];
  return Number.isFinite(x)?x:0;
 };
 const width=()=>route.current?.clientWidth||window.innerWidth;
 const setX=(x:number)=>{
  motionAuthority.current.run("route",PROFILE_MOTION_WRITER_TABLE.route,()=>{
   if(route.current)route.current.style.transform="translate3d("+x+"px,0,0)";
  });
 };
 const finish=()=>{
  const callback=finishMotion.current;
  clearTimer();
  callback?.();
 };
 const moveTo=(target:number,done:()=>void)=>{
  const el=route.current;if(!el)return;
  const start=currentX();
  clearTimer();
  el.style.transition="none";
  setX(start);
  // One layout flush only on navigation boundaries, never on pointer movement.
  void el.offsetWidth;
  const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const full=target===0?OPEN_DURATION:CLOSE_DURATION;
  const duration=reduce?0:Math.max(85,Math.round(full*Math.abs(target-start)/Math.max(1,width())));
  finishMotion.current=done;
  if(!duration){setX(target);finish();return;}
  el.style.transition="transform "+duration+"ms "+EASING;
  setX(target);
  timer.current=window.setTimeout(finish,duration+55);
 };
 const close=()=>{
  if(closing.current)return;
  closing.current=true;
  gesture.current=null;
  revealUnderlay(true);
  moveTo(width(),onExit);
 };
 const reportMotion=(progress:number,dragging:boolean)=>{
  header.current?.setProfileProgress(progress,dragging);
 };

 useLayoutEffect(()=>{
  revealUnderlay(true);
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
   if(!closing.current)moveTo(0,()=>revealUnderlay(false));
  });
  return ()=>{
   if(entranceFrame.current!==null)cancelAnimationFrame(entranceFrame.current);
   clearTimer();
   detachSuppression.current();attachSuppression.current=()=>{};
   gestures.dispose();
   revealUnderlay(false);
  };
 },[gestures]);

 // Expanded: only gestures originating on the white sheet may close.
 // Collapsed: the complete profile is a back-swipe surface. The photo hero
 // never becomes a back-swipe surface while expanded, even on photo #1.
 const down=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(!e.isPrimary){gestures.secondFinger();gesture.current=null;detachSuppression.current();return;}
  if(closing.current||(e.pointerType==="mouse"&&e.button!==0))return;
  const target=e.target as HTMLElement;
  if(target.closest(".pm-viewer,.pm-blik-viewer,.pm-preview-toolbar"))return;
  const capabilities=gestureCapabilities(target,true);
  if(capabilities.modalBlocked||capabilities.canScrollY)return;
  const shell=route.current?.querySelector<HTMLElement>(".pm-shell");
  const collapsed=shell?.dataset.sheetState==="collapsed";
  if(!collapsed&&!target.closest(".pm-profile-sheet"))return;
  const source:RouteDrag["source"]=target.closest(".pm-hero")?"photo":
   target.closest(".pm-tabs")?"tabs":target.closest(".pm-pages")?"pages":"sheet";
  const serial=gestures.begin("pointer",e.pointerId,"route");
  if(serial===null)return;
  gesture.current={id:e.pointerId,startX:e.clientX,startY:e.clientY,started:performance.now(),
   origin:currentX(),claimed:false,source,serial};
 };
 const move=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const g=gesture.current;if(!g||g.id!==e.pointerId)return;
  const dx=e.clientX-g.startX,dy=e.clientY-g.startY;
  if(!g.claimed){
   if(Math.abs(dy)>11&&Math.abs(dy)>Math.abs(dx)){gesture.current=null;return;}
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
   cancelProfileGesture.current?.();
   // Read the interpolated position BEFORE disabling CSS transition:
   // doing it in the opposite order can snap a mid-entry gesture to zero.
   const frozenX=currentX();
   clearTimer();
   if(route.current){route.current.style.transition="none";setX(frozenX);g.origin=frozenX;}
   revealUnderlay(true);
   try{route.current?.setPointerCapture(e.pointerId);}catch{/* older WebView */}
  }
  if(!gestures.owns("route",g.serial))return;
  if(e.cancelable)e.preventDefault();
  e.stopPropagation();
  setX(Math.max(0,Math.min(width(),g.origin+dx)));
 };
 const end=(e:ReactPointerEvent<HTMLDivElement>,cancelled=false)=>{
  const g=gesture.current;if(!g||g.id!==e.pointerId)return;
  gesture.current=null;
  if(!g.claimed){gestures.finishCandidate(g.serial);return;}
  if(!gestures.finish("route",g.serial))return;
  detachSuppression.current();
  if(e.cancelable)e.preventDefault();
  e.stopPropagation();
  try{if(route.current?.hasPointerCapture(e.pointerId))route.current.releasePointerCapture(e.pointerId);}catch{/* old WebView */}
  const dx=Math.max(0,e.clientX-g.startX);
  const dt=Math.max(1,performance.now()-g.started);
  const x=currentX();
  if(!cancelled&&(x>width()*.32||(dx>35&&dx/dt>.58)))close();
  else moveTo(0,()=>revealUnderlay(false));
 };
 return <div className="discovery-visitor-route" ref={route}
    onTransitionEnd={e=>{if(e.target===e.currentTarget&&e.propertyName==="transform")finish();}}
    onPointerDownCapture={down} onPointerMoveCapture={move}
    onPointerUpCapture={e=>end(e)} onPointerCancelCapture={e=>end(e,true)}
    onLostPointerCapture={e=>end(e,true)}>
   <ProfileMaster data={data} mode="visitor" onClose={close}
     registerBack={registerBack} gestureArbiter={gestures}
     registerRouteGestureCancel={cb=>{cancelProfileGesture.current=cb;}}
     onMotionProgress={reportMotion}/>
   <GlobalHeader ref={header} mode="profile" theme={theme} onTheme={onTheme}
     onFilters={()=>{}} onSaved={()=>{}}/>
  </div>;
}
