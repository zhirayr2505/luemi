import {useLayoutEffect,useRef} from "react";

/**
 * Dock an editor immediately above the visible keyboard/footer.
 * The position never depends on an already moved input, so repeated Android
 * WebView resize events cannot accumulate movement and push a field away.
 */
export function useFieldFocusDock(active:boolean){
 const shellRef=useRef<HTMLElement|null>(null);
 useLayoutEffect(()=>{
  if(!active)return;
  const shell=shellRef.current;
  if(!shell)return;
  const viewport=window.visualViewport;
  let frame=0,readyFrame=0;
  shell.dataset.dockReady="false";
  const update=()=>{
   frame=0;
   const viewportTop=viewport?.offsetTop??0;
   const viewportBottom=viewport?viewport.offsetTop+viewport.height:window.innerHeight;
   const footer=shell.closest<HTMLElement>(".v2-device")?.querySelector<HTMLElement>(".v2-footer");
   const footerRect=footer?.getBoundingClientRect();
   const footerInside=footerRect&&footerRect.top>viewportTop&&footerRect.top<=viewportBottom+8;
   const usableBottom=footerInside?footerRect.top:
    viewportBottom-Math.min(footerRect?.height??88,112);
   const height=Math.max(64,shell.getBoundingClientRect().height);
   const top=Math.round(Math.max(viewportTop+16,usableBottom-height-14));
   shell.style.setProperty("--field-focus-top",`${top}px`);
   if(shell.dataset.dockReady!=="true"){
    window.cancelAnimationFrame(readyFrame);
    readyFrame=window.requestAnimationFrame(()=>{shell.dataset.dockReady="true";});
   }
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
  const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(refresh):null;
  observer?.observe(shell);
  return()=>{
   if(frame)window.cancelAnimationFrame(frame);
   window.cancelAnimationFrame(readyFrame);
   observer?.disconnect();
   viewport?.removeEventListener("resize",refresh);
   viewport?.removeEventListener("scroll",refresh);
   window.removeEventListener("resize",refresh);
   delete shell.dataset.dockReady;
   shell.style.removeProperty("--field-focus-top");
  };
 },[active]);
 return {shellRef};
}
