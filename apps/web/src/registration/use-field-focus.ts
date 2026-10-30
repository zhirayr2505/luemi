import {useLayoutEffect,useRef} from "react";

/**
 * Anchor the editor to the visible viewport's bottom edge. Its own height
 * (including async search results) must never feed back into its position.
 */
export function useFieldFocusDock(active:boolean){
 const shellRef=useRef<HTMLElement|null>(null);
 useLayoutEffect(()=>{
  if(!active)return;
  const shell=shellRef.current;
  if(!shell)return;
  const viewport=window.visualViewport;
  let frame=0;
  const update=()=>{
   frame=0;
   const viewportBottom=viewport?viewport.offsetTop+viewport.height:window.innerHeight;
   const device=shell.closest<HTMLElement>(".v2-device");
   const footer=device?.querySelector<HTMLElement>(".v2-footer");
   const footerRect=footer?.getBoundingClientRect();
   const footerInside=footerRect&&footerRect.top>0&&footerRect.top<=viewportBottom+8;
   const usableBottom=footerInside?footerRect.top:viewportBottom-Math.min(footerRect?.height??88,112);
   shell.style.setProperty("--field-focus-bottom",`${Math.max(12,Math.round(window.innerHeight-usableBottom+14))}px`);
   // Reserve the logo/progress and the input itself before sizing the upward
   // city list. Search results never affect this measurement.
   if(shell.classList.contains("city-focus-shell")){
    const headerBottom=device?.querySelector<HTMLElement>(".v2-progress")?.getBoundingClientRect().bottom??140;
    const editorHeight=shell.querySelector<HTMLElement>(".glass-field")?.getBoundingClientRect().height??86;
    const available=Math.max(48,Math.min(230,Math.floor(usableBottom-headerBottom-editorHeight-30)));
    shell.style.setProperty("--field-suggestions-max-height",`${available}px`);
   }
   shell.dataset.dockReady="true";
  };
  const refresh=()=>{
   if(frame)window.cancelAnimationFrame(frame);
   frame=window.requestAnimationFrame(update);
  };
  update();
  // Android delivers several viewport sizes while the IME animates. Follow
  // those sizes through one coalesced writer instead of rendering React state
  // for every intermediate value (the old source of the visible double jump).
  viewport?.addEventListener("resize",refresh);
  viewport?.addEventListener("scroll",refresh);
  window.addEventListener("resize",refresh);
  return()=>{
   if(frame)window.cancelAnimationFrame(frame);
   viewport?.removeEventListener("resize",refresh);
   viewport?.removeEventListener("scroll",refresh);
   window.removeEventListener("resize",refresh);
   delete shell.dataset.dockReady;
   shell.style.removeProperty("--field-focus-bottom");
   shell.style.removeProperty("--field-suggestions-max-height");
  };
 },[active]);
 return {shellRef};
}
