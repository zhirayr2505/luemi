import {useLayoutEffect,useRef} from "react";

/**
 * Pin the focused editor above the keyboard. Its anchor may travel upward as
 * the viewport shrinks, but never drops when Android dismisses the keyboard.
 * Suggestion rows never participate in the editor's position measurement.
 */
export const FOCUS_RELEASE_DELAY_MS=160;
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
  let frame=0;
  const slotTop=shell.parentElement?.getBoundingClientRect().top??shell.getBoundingClientRect().top;
  let pinnedTop=slotTop;
  const update=()=>{
   frame=0;
   const device=shell.closest<HTMLElement>(".v2-device");
   const footerTop=device?.querySelector<HTMLElement>(".v2-footer")?.getBoundingClientRect().top??
    (viewport?viewport.offsetTop+viewport.height-86:window.innerHeight-86);
   const headerBottom=device?.querySelector<HTMLElement>(".v2-progress")?.getBoundingClientRect().bottom??140;
   const reserved=shell.classList.contains("about-focus-shell")?174:
    shell.classList.contains("language-focus-shell")?242:88;
   pinnedTop=Math.max(headerBottom+12,Math.min(pinnedTop,footerTop-reserved-10));
   shell.style.setProperty("--focused-dock-top",`${Math.round(pinnedTop)}px`);
   lastScreenTop.current=shell.getBoundingClientRect().top;
   // Reserve the logo/progress and the input itself before sizing the upward
   // city list. Search results never affect this measurement.
   if(shell.classList.contains("city-focus-shell")){
     const available=Math.max(48,Math.min(230,Math.floor(pinnedTop-headerBottom-20)));
     shell.style.setProperty("--field-suggestions-max-height",`${available}px`);
    }
    if(shell.classList.contains("language-focus-shell")){
     const list=shell.querySelector<HTMLElement>(".language-results");
     if(list){
      // Align the visible list to complete 44px rows plus 8px gaps, so
      // no half row is painted below the native IME or confirm button.
      const remaining=Math.floor(footerTop-list.getBoundingClientRect().top-12);
      const rows=Math.max(1,Math.min(8,Math.floor((remaining+8)/52)));
      shell.style.setProperty("--language-results-max-height",`${rows*52-8}px`);
     }
    }
  };
  const refresh=()=>{
   if(frame)window.cancelAnimationFrame(frame);
   frame=window.requestAnimationFrame(update);
  };
  update();
  const dockTop=shell.getBoundingClientRect().top;
  if(!reduced){
   // One subtle lift-and-settle shared by all editor types.
   motion.current=shell.animate([
    {transform:`translate3d(0,${slotTop-dockTop}px,0) scale(.985)`,offset:0},
    {transform:"translate3d(0,-5px,0) scale(1.012)",offset:.76},
    {transform:"translate3d(0,0,0) scale(1)",offset:1}
   ],{duration:480,easing:"cubic-bezier(.16,.84,.2,1)"});
   motion.current.onfinish=()=>{lastScreenTop.current=shell.getBoundingClientRect().top;};
  }
  // The CSS dock follows the same viewport variable as the footer. This
  // listener only tracks the exit animation and city result height.
  viewport?.addEventListener("resize",refresh);
   viewport?.addEventListener("scroll",refresh);
   window.addEventListener("resize",refresh);
   // Adding or wrapping selected flags changes the list's top edge.
   // Observe only flags, never the suggestions list, to avoid resize loops.
   const isLanguages=shell.classList.contains("language-focus-shell");
   const flagsResize=isLanguages&&typeof ResizeObserver!=="undefined"?new ResizeObserver(refresh):null;
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
   lastScreenTop.current=shell.getBoundingClientRect().top;
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
