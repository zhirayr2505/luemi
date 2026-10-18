import {useLayoutEffect,type RefObject} from 'react';
import {morphFrame,morphTravel,snapTarget} from './profileMorph';

/**
 * Motion controller v3. Photo is in a stable overlay OUTSIDE the native scroller:
 * no compensate-translateY, no coupled scrolling/floating geometry.
 * Snap runs only after the browser emits scrollend (native momentum complete).
 * No requestAnimationFrame scrollTop writer, no oscillating debounce timers.
 */
export function useProfilePhotoMorph(
 scrollerRef:RefObject<HTMLElement|null>,frameRef:RefObject<HTMLDivElement|null>,
 photoRef:RefObject<HTMLDivElement|null>,compactRef:RefObject<HTMLDivElement|null>,
 captionRef:RefObject<HTMLDivElement|null>,barsRef:RefObject<HTMLDivElement|null>,
 profileId:string,reducedMotion:boolean,
){
 useLayoutEffect(()=>{
  const scroller=scrollerRef.current,frame=frameRef.current,photo=photoRef.current;
  const compact=compactRef.current,caption=captionRef.current,bars=barsRef.current;
  if(!scroller||!frame||!photo||!compact||!caption||!bars)return;
  const system=window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduce=()=>reducedMotion||system.matches;
  let width=frame.clientWidth,raf=0,disposed=false;
  let lastClosed=false,snapping=false,dragging=false;
  let touchY=0,touchAt=0,velocity=0;
  let fallback:ReturnType<typeof setTimeout>|undefined;
  const hasScrollEnd='onscrollend' in scroller;
  const cancelFallback=()=>{if(fallback!==undefined){clearTimeout(fallback);fallback=undefined;}};
  const draw=()=>{
   raf=0;if(disposed||width<=0)return;
   const raw=morphFrame(scroller.scrollTop,width);
   const f=reduce()?morphFrame(raw.progress>=.5?morphTravel(width):0,width):raw;
   photo.style.transform=`translate3d(${f.x.toFixed(2)}px,0,0) scale(${f.scale.toFixed(6)})`;
   photo.style.borderRadius=`${f.radius.toFixed(2)}px`;
   photo.style.setProperty('--profile-rim',`${f.rimWidth.toFixed(2)}px`);
   caption.style.opacity=String(f.captionOpacity);
   compact.style.opacity=String(f.compactOpacity);
   bars.style.opacity=String(f.barsOpacity);
   frame.dataset.galleryActive=String(f.expanded);
   frame.dataset.collapsed=String(f.progress>=.995);
  };
  const queue=()=>{if(!disposed&&!raf)raf=requestAnimationFrame(draw);};
  const settle=()=>{
   if(disposed||dragging||snapping)return;
   const y=scroller.scrollTop,target=snapTarget(y,width,lastClosed,velocity);
   velocity=0;
   if(target===null){lastClosed=true;return;}
   if(Math.abs(target-y)<1){lastClosed=target>0;return;}
   snapping=true;lastClosed=target>0;
   // ONE browser-native smooth scroll; browser owns deceleration and cancellation.
   scroller.scrollTo({top:target,behavior:reduce()?'auto':'smooth'});
   // No timeout-driven competing animator. scrollend ends the native motion.
  };
  const onScrollEnd=()=>{
   cancelFallback();
   if(snapping){snapping=false;velocity=0;lastClosed=scroller.scrollTop>=morphTravel(width)*.92;return;}
   settle();
  };
  const scheduleFallback=()=>{
   if(hasScrollEnd||dragging||snapping)return;
   cancelFallback();fallback=setTimeout(onScrollEnd,200);
  };
  const onScroll=()=>{queue();scheduleFallback();};
  const onDown=(e:PointerEvent)=>{
   dragging=true;cancelFallback();
   if(snapping){snapping=false;scroller.scrollTo({top:scroller.scrollTop,behavior:'instant' as ScrollBehavior});}
   touchY=e.clientY;touchAt=performance.now();velocity=0;
  };
  const onUp=(e:PointerEvent)=>{
   if(!dragging)return;dragging=false;
   const pixels=touchY-e.clientY,dt=Math.max(30,performance.now()-touchAt);
   velocity=Math.abs(pixels)>15?pixels/dt:0;
   scheduleFallback();
  };
  const onWheel=()=>{velocity=0;if(snapping){snapping=false;scroller.scrollTo({top:scroller.scrollTop,behavior:'instant' as ScrollBehavior});}};
  const resize=()=>{const next=frame.clientWidth;if(width!==next){width=next;queue();}};
  const ro=new ResizeObserver(resize);ro.observe(frame);
  scroller.scrollTop=0;draw();
  scroller.addEventListener('scroll',onScroll,{passive:true});
  scroller.addEventListener('pointerdown',onDown,{passive:true});
  window.addEventListener('pointerup',onUp,{passive:true});
  window.addEventListener('pointercancel',onUp,{passive:true});
  scroller.addEventListener('wheel',onWheel,{passive:true});
  if(hasScrollEnd)scroller.addEventListener('scrollend',onScrollEnd,{passive:true});
  system.addEventListener('change',queue);
  return()=>{
   disposed=true;cancelFallback();if(raf)cancelAnimationFrame(raf);ro.disconnect();
   scroller.removeEventListener('scroll',onScroll);scroller.removeEventListener('pointerdown',onDown);
   window.removeEventListener('pointerup',onUp);window.removeEventListener('pointercancel',onUp);
   scroller.removeEventListener('wheel',onWheel);
   if(hasScrollEnd)scroller.removeEventListener('scrollend',onScrollEnd);
   system.removeEventListener('change',queue);
   photo.style.transform='';photo.style.borderRadius='';photo.style.removeProperty('--profile-rim');
   compact.style.opacity='';caption.style.opacity='';bars.style.opacity='';
  };
 },[scrollerRef,frameRef,photoRef,compactRef,captionRef,barsRef,profileId,reducedMotion]);
}