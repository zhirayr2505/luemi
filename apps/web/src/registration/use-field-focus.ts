import {useLayoutEffect,useRef} from "react";

/* Native keyboards are not part of the registration layout. The editor lands
 * once at a device-relative anchor measured against the stable registration
 * canvas, not VisualViewport.height or the moving confirmation footer.
 * Only a genuine width/orientation change may recalculate that anchor. */
export const FOCUS_RELEASE_DELAY_MS=160;
const KEYBOARD_CLOSE_TIMEOUT_MS=980;

function fullViewportBottom(){
 const viewport=window.visualViewport;
 return viewport?viewport.offsetTop+viewport.height:window.innerHeight;
}

/** Wait for the native IME to finish hiding, with a bounded fallback for
 * hardware keyboards and WebViews that do not expose visualViewport changes.
 * The returned cleanup cancels pending release when a different input focuses.
 */
export function releaseAfterKeyboardSettles(done:()=>void):()=>void{
 const viewport=window.visualViewport;
 const root=document.querySelector<HTMLElement>(".v2-runtime");
 const registeredHeight=root?Number.parseFloat(
  getComputedStyle(root).getPropertyValue("--registration-layout-height")):NaN;
 const baseline=Number.isFinite(registeredHeight)&&registeredHeight>0?
  registeredHeight:Math.max(window.innerHeight,fullViewportBottom());
 const threshold=Math.max(96,baseline*.13);
 let cancelled=false;
 let settleTimer:number|null=null;
 const began=performance.now();
 const keyboardVisible=()=>baseline-fullViewportBottom()>threshold;
 const cleanup=()=>{
  viewport?.removeEventListener("resize",check);
  viewport?.removeEventListener("scroll",check);
  window.removeEventListener("resize",check);
  if(settleTimer!==null)window.clearTimeout(settleTimer);
  window.clearInterval(poll);
  window.clearTimeout(maxTimer);
 };
 const finish=()=>{
  if(cancelled)return;
  cancelled=true;cleanup();done();
 };
 const check=()=>{
  if(cancelled)return;
  // Do not collapse the glass/dock while IME is still opening or closing.
  if(performance.now()-began<FOCUS_RELEASE_DELAY_MS||keyboardVisible()){
   if(settleTimer!==null){window.clearTimeout(settleTimer);settleTimer=null;}
   return;
  }
  if(settleTimer===null)settleTimer=window.setTimeout(finish,FOCUS_RELEASE_DELAY_MS);
 };
 const poll=window.setInterval(check,40);
 const maxTimer=window.setTimeout(finish,KEYBOARD_CLOSE_TIMEOUT_MS);
 viewport?.addEventListener("resize",check);
 viewport?.addEventListener("scroll",check);
 window.addEventListener("resize",check);
 check();
 return()=>{if(cancelled)return;cancelled=true;cleanup();};
}

/** Stable anchor computed once per focus, independent of IME visibility.
 * Larger tablets don't push the field excessively down; short phones keep it
 * close to the progress bar and remain above the keyboard when space exists.
 */
export function registrationDockTop(deviceTop:number,screenHeight:number,headerBottom:number,reservedHeight:number){
 const minTop=headerBottom+12;
 const preferred=Math.min(headerBottom+54,deviceTop+screenHeight*.245);
 const maximum=deviceTop+screenHeight-Math.min(reservedHeight,screenHeight*.4)-24;
 return Math.round(Math.max(minTop,Math.min(preferred,maximum)));
}

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
  const viewport=window.visualViewport;
  const device=shell.closest<HTMLElement>(".v2-device");
  const slotTop=shell.parentElement?.getBoundingClientRect().top??shell.getBoundingClientRect().top;
  const reserved=shell.classList.contains("about-focus-shell")?174:
   shell.classList.contains("language-focus-shell")?242:88;
  let width=window.innerWidth;
  let frame=0;
  let pinnedTop=0;
  const computeAnchor=()=>{
   const bounds=device?.getBoundingClientRect();
   const progress=device?.querySelector<HTMLElement>(".v2-progress")?.getBoundingClientRect();
   pinnedTop=registrationDockTop(bounds?.top??0,bounds?.height??window.innerHeight,
    progress?.bottom??140,reserved);
   shell.style.setProperty("--focused-dock-top",`${pinnedTop}px`);
   lastScreenTop.current=pinnedTop;
  };
  const resizeSuggestions=()=>{
   frame=0;
   const footerTop=device?.querySelector<HTMLElement>(".v2-footer")?.getBoundingClientRect().top??
    fullViewportBottom()-86;
   const headerBottom=device?.querySelector<HTMLElement>(".v2-progress")?.getBoundingClientRect().bottom??140;
   if(shell.classList.contains("city-focus-shell")){
    const available=Math.max(48,Math.min(230,Math.floor(pinnedTop-headerBottom-20)));
    shell.style.setProperty("--field-suggestions-max-height",`${available}px`);
   }
   if(shell.classList.contains("language-focus-shell")){
    const list=shell.querySelector<HTMLElement>(".language-results");
    if(list){
     const remaining=Math.floor(footerTop-list.getBoundingClientRect().top-12);
     const rows=Math.max(1,Math.min(8,Math.floor((remaining+8)/52)));
     shell.style.setProperty("--language-results-max-height",`${rows*52-8}px`);
    }
   }
  };
  const refresh=()=>{
   // IME height/offset changes are never allowed to move the focused editor.
   // Genuine orientation changes change width considerably and are allowed.
   if(Math.abs(window.innerWidth-width)>24){
    width=window.innerWidth;
    computeAnchor();
   }
   if(frame)window.cancelAnimationFrame(frame);
   frame=window.requestAnimationFrame(resizeSuggestions);
  };
  computeAnchor();
  resizeSuggestions();
  if(!reduced){
   motion.current=shell.animate([
    {transform:`translate3d(0,${slotTop-pinnedTop}px,0) scale(.985)`,offset:0},
    {transform:"translate3d(0,-5px,0) scale(1.012)",offset:.76},
    {transform:"translate3d(0,0,0) scale(1)",offset:1}
   ],{duration:480,easing:"cubic-bezier(.16,.84,.2,1)"});
   motion.current.onfinish=()=>{lastScreenTop.current=pinnedTop;};
  }
  viewport?.addEventListener("resize",refresh);
  viewport?.addEventListener("scroll",refresh);
  window.addEventListener("resize",refresh);
  const isLanguages=shell.classList.contains("language-focus-shell");
  const flagsResize=isLanguages&&typeof ResizeObserver!=="undefined"?
   new ResizeObserver(refresh):null;
  let watchedFlags:HTMLElement|null=null;
  const observeFlags=()=>{
   const next=shell.querySelector<HTMLElement>(".language-selected");
   if(watchedFlags===next)return;
   if(watchedFlags)flagsResize?.unobserve(watchedFlags);
   watchedFlags=next;
   if(watchedFlags)flagsResize?.observe(watchedFlags);
  };
  const flagsMutation=isLanguages&&typeof MutationObserver!=="undefined"?
   new MutationObserver(()=>{observeFlags();refresh();}):null;
  flagsMutation?.observe(shell,{childList:true});
  observeFlags();
  return()=>{
   if(frame)window.cancelAnimationFrame(frame);
   lastScreenTop.current=pinnedTop;
   motion.current?.cancel();
   viewport?.removeEventListener("resize",refresh);
   viewport?.removeEventListener("scroll",refresh);
   window.removeEventListener("resize",refresh);
   flagsMutation?.disconnect();
   flagsResize?.disconnect();
   shell.style.removeProperty("--field-suggestions-max-height");
   shell.style.removeProperty("--language-results-max-height");
  };
 },[active]);
 return {shellRef};
}
