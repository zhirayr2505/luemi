import {useLayoutEffect,useRef} from "react";

/**
 * One registration-wide focus policy across mobile Telegram, WKWebView,
 * Android WebView and desktop.
 *
 * The docking point is chosen ONCE using the stable registration canvas and
 * safe header. A keyboard opening or closing changes only the footer and the
 * height of search results, never the editor's top position.
 */
export const FOCUS_RELEASE_DELAY_MS=160;

/** Return the dock to the page only when a closing virtual keyboard has
 * settled. No fixed Android timing or fixed phone dimensions. Cancel whenever
 * another input gains focus or the screen unmounts. */
export function releaseAfterKeyboardSettles(onReleased:()=>void,
 delay=FOCUS_RELEASE_DELAY_MS):()=>void {
 const device=document.querySelector<HTMLElement>(".v2-runtime .v2-device");
 const stableHeight=device?.clientHeight??window.innerHeight;
 const viewport=window.visualViewport;
 const visibleBottom=()=>viewport?viewport.offsetTop+viewport.height:window.innerHeight;
 const keyboardGap=()=>Math.max(0,stableHeight-visibleBottom());
 const keyboardInitiallyOpen=keyboardGap()>Math.max(90,stableHeight*.16);
 const started=performance.now();
 let lastBottom=visibleBottom(),lastChange=started,frame=0,done=false;
 let timeout=0;
 const complete=()=>{
  if(done)return;
  done=true;
  if(frame)window.cancelAnimationFrame(frame);
  window.clearTimeout(timeout);
  onReleased();
 };
 const tick=(now:number)=>{
  if(done)return;
  const bottom=visibleBottom();
  if(Math.abs(bottom-lastBottom)>1.5){lastBottom=bottom;lastChange=now;}
  const recovered=keyboardGap()<Math.max(85,stableHeight*.13);
  if(now-started>=1100 ||
     (!keyboardInitiallyOpen&&now-started>=delay) ||
     (keyboardInitiallyOpen&&recovered&&now-lastChange>=110&&now-started>=delay)){
   complete();return;
  }
  frame=window.requestAnimationFrame(tick);
 };
 frame=window.requestAnimationFrame(tick);
 // When WebKit throttles RAF during native keyboard dismissal, still release.
 timeout=window.setTimeout(complete,1250);
 return()=>{done=true;if(frame)window.cancelAnimationFrame(frame);window.clearTimeout(timeout);};
}

/** Stable responsive position: no visualViewport resize/scroll feedback to top. */
export function useFieldFocusDock(active:boolean){
 const shellRef=useRef<HTMLElement|null>(null);
 const lastScreenTop=useRef<number|null>(null);
 const motion=useRef<Animation|null>(null);
 useLayoutEffect(()=>{
  const shell=shellRef.current;
  if(!shell||!shell.closest(".v2-runtime"))return;
  motion.current?.cancel();
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(!active){
   const from=lastScreenTop.current;
   lastScreenTop.current=null;
   shell.style.removeProperty("--focused-dock-top");
   if(from!==null&&!reduced){
    const distance=from-shell.getBoundingClientRect().top;
    if(Math.abs(distance)>4)motion.current=shell.animate([
     {transform:`translate3d(0,${distance}px,0) scale(.995)`,offset:0},
     {transform:"translate3d(0,-2px,0) scale(1.006)",offset:.8},
     {transform:"translate3d(0,0,0) scale(1)",offset:1}
    ],{duration:440,easing:"cubic-bezier(.17,.79,.22,1)"});
   }
   return()=>motion.current?.cancel();
  }
  const device=shell.closest<HTMLElement>(".v2-device");
  const viewport=window.visualViewport;
  const slotTop=shell.parentElement?.getBoundingClientRect().top??shell.getBoundingClientRect().top;
  const isCity=shell.classList.contains("city-focus-shell");
  const isAbout=shell.classList.contains("about-focus-shell");
  let frame=0;
  let measuredWidth=window.innerWidth;
  let pinnedTop=slotTop;

  const calculateAnchor=()=>{
   const box=device?.getBoundingClientRect();
   const origin=box?.top??0;
   const stableHeight=device?.clientHeight??window.innerHeight;
   const headerBottom=device?.querySelector<HTMLElement>(".v2-progress")?.getBoundingClientRect().bottom??origin+120;
   const minimum=headerBottom+12;
   const reserved=isAbout?Math.min(180,stableHeight*.22):isCity?70:86;
   // City suggestions open above the input: make room for several short rows.
   // Keep a stable IME-safe anchor; never chase keyboard resize events.
   const ideal=origin+stableHeight*(isCity?.44:.23);
   const safeUpper=origin+stableHeight*.53-reserved;
   pinnedTop=Math.round(Math.max(minimum,Math.min(ideal,safeUpper)));
   shell.style.setProperty("--focused-dock-top",`${pinnedTop}px`);
   lastScreenTop.current=pinnedTop;
  };
  calculateAnchor();

  // Only suggestions follow the visual viewport. The focused editor never does.
  const updateResults=()=>{
   frame=0;
   if(!shell.isConnected)return;
   const headerBottom=device?.querySelector<HTMLElement>(".v2-progress")?.getBoundingClientRect().bottom??120;
   if(isCity){
    const available=Math.max(44,Math.min(232,Math.floor(pinnedTop-headerBottom-12)));
    shell.style.setProperty("--field-suggestions-max-height",`${available}px`);
   }
  };
  const refresh=()=>{if(!frame)frame=window.requestAnimationFrame(updateResults);};
  updateResults();
  const dockTop=shell.getBoundingClientRect().top;
  if(!reduced){
   motion.current=shell.animate([
    {transform:`translate3d(0,${slotTop-dockTop}px,0) scale(.985)`,offset:0},
    {transform:"translate3d(0,-5px,0) scale(1.012)",offset:.76},
    {transform:"translate3d(0,0,0) scale(1)",offset:1}
   ],{duration:480,easing:"cubic-bezier(.16,.84,.2,1)"});
  }
  viewport?.addEventListener("resize",refresh);
  viewport?.addEventListener("scroll",refresh);
  const onResize=()=>{
   // A genuine orientation/width change gets a new responsive anchor once.
   // Height-only changes during IME movement must NEVER reposition the field.
   if(Math.abs(window.innerWidth-measuredWidth)>2){
    measuredWidth=window.innerWidth;
    calculateAnchor();
   }
   refresh();
  };
  window.addEventListener("resize",onResize);
  return()=>{
   if(frame)window.cancelAnimationFrame(frame);
   motion.current?.cancel();
   viewport?.removeEventListener("resize",refresh);
   viewport?.removeEventListener("scroll",refresh);
   window.removeEventListener("resize",onResize);
   shell.style.removeProperty("--field-suggestions-max-height");
  };
 },[active]);
 return {shellRef};
}
