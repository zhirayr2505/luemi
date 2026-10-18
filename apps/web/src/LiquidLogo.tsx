import {useEffect,useId,useRef} from 'react';
const WORDMARK='/assets/brand/derivatives/wordmark_original_raster_alpha_W06.webp';
/** Uses the original raster alpha as its silhouette. No retyping or vectorization. */
export function LiquidLogo(){
 const ref=useRef<HTMLSpanElement>(null),id=useId().replace(/:/g,'');
 useEffect(()=>{
  const logo=ref.current,frame=logo?.closest('.app-frame');if(!logo||!frame)return;
  let raf=0,x=50,y=25;
  const paint=()=>{raf=0;logo.style.setProperty('--light-x',`${x}%`);logo.style.setProperty('--light-y',`${y}%`);};
  const request=()=>{if(document.documentElement.dataset.reducedMotion==='true'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;if(!raf)raf=requestAnimationFrame(paint);};
  const pointer=(event:Event)=>{const e=event as PointerEvent,r=frame.getBoundingClientRect();x=15+(e.clientX-r.left)/Math.max(r.width,1)*70;y=8+(e.clientY-r.top)/Math.max(r.height,1)*55;request();};
  const scroll=(event:Event)=>{const el=event.target;if(el instanceof HTMLElement){x=50+Math.sin(el.scrollTop/220)*30;y=22+Math.sin(el.scrollTop/360)*12;request();}};
  frame.addEventListener('pointermove',pointer,{passive:true});frame.addEventListener('scroll',scroll,{passive:true,capture:true});
  return()=>{frame.removeEventListener('pointermove',pointer);frame.removeEventListener('scroll',scroll,true);cancelAnimationFrame(raf);};
 },[]);
 return <span className="logo-island" ref={ref} role="img" aria-label="luemi">
  <span className="logo-island-glass" aria-hidden="true"/>
  <span className="logo-island-light" aria-hidden="true"/>
  <span className="wordmark liquid-wordmark" aria-hidden="true">
  <span className="liquid-logo-body" aria-hidden="true"/>
  <img className="liquid-logo-pigment" src={WORDMARK} alt="" aria-hidden="true"/>
  <span className="liquid-logo-light" aria-hidden="true"/>
  <svg className="liquid-logo-rim" viewBox="0 0 995 345" aria-hidden="true" focusable="false">
   <defs><filter id={'rim-'+id} x="-3%" y="-8%" width="106%" height="116%" colorInterpolationFilters="sRGB"><feMorphology in="SourceAlpha" operator="erode" radius="4" result="core"/><feComposite in="SourceAlpha" in2="core" operator="out" result="edge"/><feFlood floodColor="white" floodOpacity=".8"/><feComposite in2="edge" operator="in"/></filter></defs>
   <image href={WORDMARK} width="995" height="345" filter={`url(#rim-${id})`}/>
  </svg>
  </span>
 </span>;
}