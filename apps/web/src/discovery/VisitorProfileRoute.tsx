import {useLayoutEffect,useRef} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {ProfileMaster} from "./ProfileMaster";
import {GlobalHeader} from "./GlobalHeader";
import type {HeaderMotion} from "./GlobalHeader";
import type {ProfileMasterData} from "./ProfileModel";

type Props={
 data:ProfileMasterData;theme:"light"|"dark";onTheme:()=>void;onExit:()=>void;
 registerBack:(handler:(()=>boolean)|null)=>void;
};
type EdgeDrag={id:number;startX:number;started:number;origin:number;claimed:boolean};
const DURATION=305;
const EASING="cubic-bezier(.22,.77,.23,1)";

/** One navigational layer; the stable ProfileMaster sheet never moves itself. */
export function VisitorProfileRoute({data,theme,onTheme,onExit,registerBack}:Props){
 const route=useRef<HTMLDivElement>(null);
 const header=useRef<HeaderMotion>(null);
 const gesture=useRef<EdgeDrag|null>(null);
 const closing=useRef(false);
 const timer=useRef<number|null>(null);
 const entranceFrame=useRef<number|null>(null);
 const finishMotion=useRef<(()=>void)|null>(null);

 const revealUnderlay=(visible:boolean)=>{
  const app=route.current?.closest<HTMLElement>(".discovery-app");
  if(visible)app?.setAttribute("data-route-revealing","true");
  else app?.removeAttribute("data-route-revealing");
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
  if(route.current)route.current.style.transform="translate3d("+x+"px,0,0)";
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
  // A single geometry flush at navigation boundaries, never during dragging.
  void el.offsetWidth;
  const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration=reduce?0:Math.max(105,Math.round(DURATION*Math.abs(target-start)/Math.max(1,width())));
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
  entranceFrame.current=requestAnimationFrame(()=>{
   entranceFrame.current=null;
   if(!closing.current)moveTo(0,()=>revealUnderlay(false));
  });
  return ()=>{
   if(entranceFrame.current!==null)cancelAnimationFrame(entranceFrame.current);
   clearTimer();
   revealUnderlay(false);
  };
 // One route lifetime: launch once, clean when route unmounts.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);

 const down=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(closing.current||(e.pointerType==="mouse"&&e.button!==0))return;
  const start=currentX();
  clearTimer();
  if(route.current){route.current.style.transition="none";setX(start);}
  gesture.current={id:e.pointerId,startX:e.clientX,started:performance.now(),origin:start,claimed:false};
  try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* older Telegram WebView */}
 };
 const move=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const g=gesture.current;if(!g||g.id!==e.pointerId)return;
  const dx=e.clientX-g.startX;
  if(!g.claimed){
   if(dx<8)return;
   g.claimed=true;
   revealUnderlay(true);
  }
  if(e.cancelable)e.preventDefault();
  setX(Math.max(0,Math.min(width(),g.origin+dx)));
 };
 const end=(e:ReactPointerEvent<HTMLDivElement>,cancelled=false)=>{
  const g=gesture.current;if(!g||g.id!==e.pointerId)return;
  gesture.current=null;
  if(!g.claimed){
   moveTo(0,()=>revealUnderlay(false));
   return;
  }
  const dx=Math.max(0,e.clientX-g.startX);
  const dt=Math.max(1,performance.now()-g.started);
  const x=currentX();
  const shouldClose=!cancelled&&(x>width()*.32||(dx>35&&dx/dt>.58));
  if(shouldClose)close();
  else moveTo(0,()=>revealUnderlay(false));
 };
 return <div className="discovery-visitor-route" ref={route}
    onTransitionEnd={e=>{if(e.target===e.currentTarget&&e.propertyName==="transform")finish();}}>
   <ProfileMaster data={data} mode="visitor" onClose={close}
     registerBack={registerBack} onMotionProgress={reportMotion}/>
   <GlobalHeader ref={header} mode="profile" theme={theme} onTheme={onTheme}
     onFilters={()=>{}} onSaved={()=>{}}/>
   <div className="discovery-visitor-back-edge" aria-hidden="true"
     onPointerDown={down} onPointerMove={move}
     onPointerUp={e=>end(e)} onPointerCancel={e=>end(e,true)}/>
 </div>;
}
