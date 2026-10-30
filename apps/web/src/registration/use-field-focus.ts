import {useLayoutEffect,useRef} from "react";

/**
 * Anchor the editor to the visible viewport's bottom edge. Its own height
 * (including async search results) must never feed back into its position.
 */
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
   if(from!==null&&!reduced){
    const distance=from-shell.getBoundingClientRect().top;
    if(Math.abs(distance)>4)motion.current=shell.animate([
     {transform:`translate3d(0,${distance}px,0)`},{transform:"translate3d(0,0,0)"}
    ],{duration:320,easing:"cubic-bezier(.22,.8,.25,1)"});
   }
   return()=>motion.current?.cancel();
  }
  const viewport=window.visualViewport;
  let frame=0;
  const update=()=>{
   frame=0;
   lastScreenTop.current=shell.getBoundingClientRect().top;
   // Reserve the logo/progress and the input itself before sizing the upward
   // city list. Search results never affect this measurement.
   if(shell.classList.contains("city-focus-shell")){
    const device=shell.closest<HTMLElement>(".v2-device");
    const usableBottom=device?.querySelector<HTMLElement>(".v2-footer")?.getBoundingClientRect().top??
     (viewport?viewport.offsetTop+viewport.height-104:window.innerHeight-104);
    const headerBottom=device?.querySelector<HTMLElement>(".v2-progress")?.getBoundingClientRect().bottom??140;
    const editorHeight=shell.querySelector<HTMLElement>(".glass-field")?.getBoundingClientRect().height??86;
    const available=Math.max(48,Math.min(230,Math.floor(usableBottom-headerBottom-editorHeight-30)));
    shell.style.setProperty("--field-suggestions-max-height",`${available}px`);
   }
  };
  const refresh=()=>{
   if(frame)window.cancelAnimationFrame(frame);
   frame=window.requestAnimationFrame(update);
  };
  update();
  const slotTop=shell.parentElement?.getBoundingClientRect().top;
  const dockTop=shell.getBoundingClientRect().top;
  if(slotTop!==undefined&&!reduced&&Math.abs(slotTop-dockTop)>4){
   motion.current=shell.animate([
    {transform:`translate3d(0,${slotTop-dockTop}px,0)`},
    {transform:"translate3d(0,0,0)"}
   ],{duration:390,easing:"cubic-bezier(.18,.82,.24,1)"});
   motion.current.onfinish=()=>{lastScreenTop.current=shell.getBoundingClientRect().top;};
  }
  // The CSS dock follows the same viewport variable as the footer. This
  // listener only tracks the exit animation and city result height.
  viewport?.addEventListener("resize",refresh);
  viewport?.addEventListener("scroll",refresh);
  window.addEventListener("resize",refresh);
  return()=>{
   if(frame)window.cancelAnimationFrame(frame);
   motion.current?.cancel();
   viewport?.removeEventListener("resize",refresh);
   viewport?.removeEventListener("scroll",refresh);
   window.removeEventListener("resize",refresh);
   shell.style.removeProperty("--field-suggestions-max-height");
  };
 },[active]);
 return {shellRef};
}
