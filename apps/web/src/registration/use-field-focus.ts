import {useCallback,useEffect,useRef,useState} from "react";
import type {CSSProperties} from "react";

/**
 * Dock an editor immediately above the visible keyboard/footer.
 * The position never depends on an already moved input, so repeated Android
 * WebView resize events cannot accumulate movement and push a field away.
 */
export function useFieldFocusDock(active:boolean){
 const shellRef=useRef<HTMLElement|null>(null);
 const [top,setTop]=useState(120);
 const update=useCallback(()=>{
  if(!active)return;
  const shell=shellRef.current;
  if(!shell)return;
  const viewport=window.visualViewport;
  const viewportTop=viewport?.offsetTop??0;
  const viewportBottom=viewport?viewport.offsetTop+viewport.height:window.innerHeight;
  const footer=shell.closest<HTMLElement>(".v2-device")?.querySelector<HTMLElement>(".v2-footer");
  const footerTop=footer?.getBoundingClientRect().top;
  const usableBottom=footerTop!==undefined&&footerTop>viewportTop&&footerTop<=viewportBottom+8?
   footerTop:viewportBottom;
  const height=Math.max(64,shell.getBoundingClientRect().height);
  setTop(Math.round(Math.max(viewportTop+18,usableBottom-height-18)));
 },[active]);
 useEffect(()=>{
  if(!active)return;
  const viewport=window.visualViewport;
  let frame=window.requestAnimationFrame(()=>{
   update();
   frame=window.requestAnimationFrame(update);
  });
  const refresh=()=>{window.cancelAnimationFrame(frame);frame=window.requestAnimationFrame(update);};
  viewport?.addEventListener("resize",refresh);
  viewport?.addEventListener("scroll",refresh);
  window.addEventListener("resize",refresh);
  return()=>{
   window.cancelAnimationFrame(frame);
   viewport?.removeEventListener("resize",refresh);
   viewport?.removeEventListener("scroll",refresh);
   window.removeEventListener("resize",refresh);
  };
 },[active,update]);
 return {shellRef,style:{"--field-focus-top":`${top}px`} as CSSProperties};
}
