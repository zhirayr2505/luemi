import {forwardRef,useCallback,useLayoutEffect,useImperativeHandle,useRef} from "react";
import "./global-header.css";

const logo="/assets/brand/wordmark_original_raster_alpha_W06.webp";
export type HeaderMode="browse"|"profile";
export type HeaderMotion={
  setScrollTop:(top:number)=>void;
  setProfileProgress:(progress:number,_dragging:boolean)=>void;
  reset:()=>void;
};
type Props={
  mode:HeaderMode;theme:"light"|"dark";onTheme:()=>void;
  onFilters:()=>void;onSaved:()=>void;
};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(p:number)=>p*p*(3-2*p);

export const GlobalHeader=forwardRef<HeaderMotion,Props>(function GlobalHeader(
 {mode},ref
){
 // Avoid a second filtered logo raster on Android Telegram WebView.
 const androidClient=typeof navigator!=="undefined"&&/Android/i.test(navigator.userAgent);
 const androidProfileChrome=mode==="profile"&&androidClient;
 const host=useRef<HTMLElement>(null);
 const island=useRef<HTMLButtonElement>(null);
 const lastScroll=useRef(0);
 const manual=useRef(false);
 const pendingTop=useRef(0),toolsFrame=useRef<number|null>(null);
 const lastControlsValue=useRef(Number.NaN);
 // Cancel queued browsing paints before switching to profile chrome.
 // Layout-effect cleanup executes before the next visual frame.
 useLayoutEffect(()=>()=>{if(toolsFrame.current!==null){
  cancelAnimationFrame(toolsFrame.current);toolsFrame.current=null;
 }},[mode]);
 const paintTools=useCallback((top:number)=>{
  if(mode==="profile")return;
  const p=smooth(clamp(top/105));
  const v=manual.current?0:p,el=host.current;
  if(Math.abs(v-lastControlsValue.current)<.001)return;
  lastControlsValue.current=v;
  el?.style.setProperty("--lh-p",String(v));
  el?.style.setProperty("--lh-control-opacity",String(1-v));
  el?.style.setProperty("--lh-control-scale",String(1-.84*v));
  el?.style.setProperty("--lh-control-y",(-31*v)+"px");
  el?.style.setProperty("--lh-left-x",(38*v)+"px");
  el?.style.setProperty("--lh-right-x",(-38*v)+"px");
  el?.style.setProperty("--lh-control-stretch",String(1+.24*Math.sin(Math.PI*v)));
  el?.style.setProperty("--lh-impact",String(.036*Math.sin(Math.PI*clamp((v-.66)/.34))));
  host.current?.setAttribute("data-tools-merged",!manual.current&&p>.96?"true":"false");
 },[mode]);
 useImperativeHandle(ref,()=>({
  setScrollTop:(top:number)=>{
   if(Math.abs(top-lastScroll.current)>.5)manual.current=false;
   lastScroll.current=top;pendingTop.current=top;
   if(toolsFrame.current!==null)return;
   toolsFrame.current=requestAnimationFrame(()=>{
    toolsFrame.current=null;
    paintTools(pendingTop.current);
   });
  },
  setProfileProgress:(progress:number,_dragging:boolean)=>{
   if(mode!=="profile"||androidProfileChrome||!host.current)return;
   const p=clamp(progress);
   host.current.style.setProperty("--lh-contrast",String(p*.83));
  },
  reset:()=>{
   if(toolsFrame.current!==null){cancelAnimationFrame(toolsFrame.current);toolsFrame.current=null;}
   lastControlsValue.current=Number.NaN;
   pendingTop.current=0;
   lastScroll.current=0;manual.current=false;
   host.current?.style.setProperty("--lh-contrast","0");
   if(host.current){host.current.style.setProperty("--lh-p","0");host.current.style.setProperty("--lh-impact","0");host.current.style.setProperty("--lh-control-opacity","1");host.current.style.setProperty("--lh-control-scale","1");host.current.style.setProperty("--lh-control-y","0px");host.current.style.setProperty("--lh-left-x","0px");host.current.style.setProperty("--lh-right-x","0px");host.current.style.setProperty("--lh-control-stretch","1");host.current.setAttribute("data-tools-merged","false");}
  }
 }),[mode,androidProfileChrome,paintTools]);
 const toggleIsland=()=>{
  if(mode==="profile")return;
  if(lastScroll.current<12)return;
  manual.current=!manual.current;
  if(toolsFrame.current!==null){cancelAnimationFrame(toolsFrame.current);toolsFrame.current=null;}
  lastControlsValue.current=Number.NaN;paintTools(lastScroll.current);
 };
 return <header ref={host} className={"lh-header lh-"+mode+(androidProfileChrome?" lh-profile-android":"")}>
  
  <div className="lh-center">
   <button className="lh-island" type="button" ref={island} onClick={toggleIsland}
     aria-label="LUEMI" title="LUEMI">
    <img src={logo} alt="luemi" decoding="async" fetchPriority="high"/>
    {!androidClient&&<img src={logo} alt="" aria-hidden="true" className="lh-logo-contrast" decoding="async"/>}
   </button>
  </div>
 </header>;
});
