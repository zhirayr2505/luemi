import { useLayoutEffect, type RefObject } from 'react';
import { morphFrame, morphProgress, morphTravel, snapTarget } from './profileMorph';

/**
 * One physical photo, one native scroll owner. Compensate natural scrolling on
 * the *image itself*, never on the stage or content. No hidden sticky placeholder.
 * The native scroller owns Y gestures; the gallery owns X gestures separately.
 */
export function useProfilePhotoMorph(
 stageRef:RefObject<HTMLDivElement|null>,
 photoRef:RefObject<HTMLDivElement|null>,
 compactRef:RefObject<HTMLDivElement|null>,
 captionRef:RefObject<HTMLDivElement|null>,
 galleryRef:RefObject<HTMLDivElement|null>,
 profileId:string,
 reducedMotion:boolean,
){
 useLayoutEffect(()=>{
  const stage=stageRef.current,photo=photoRef.current,compact=compactRef.current,caption=captionRef.current,gallery=galleryRef.current;
  const scroller=stage?.closest<HTMLElement>('.profile-detail');
  if(!stage||!photo||!compact||!caption||!gallery||!scroller)return;
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  let width=stage.clientWidth,drawId=0,snapId=0,idleId:ReturnType<typeof setTimeout>|undefined;
  let disposed=false,down=false,snapping=false,wasCollapsed=false,gestureY=0,gestureStart=0,velocity=0;
  scroller.scrollTop=0;
  const motionReduced=()=>reducedMotion||media.matches;
  const draw=()=>{
   drawId=0;if(disposed)return;
   const y=Math.max(0,scroller.scrollTop),raw=morphFrame(y,width);
   const f=motionReduced()?morphFrame(raw.progress>=.5?morphTravel(width):0,width):raw;
   // translateY counteracts the natural scroll; image stays beneath logo.
   photo.style.transform=`translate3d(${f.x.toFixed(3)}px,${f.translateY.toFixed(3)}px,0) scale(${f.scale.toFixed(6)})`;
   photo.style.borderRadius=`${f.radius.toFixed(3)}px`;
   photo.style.setProperty('--profile-rim',`${f.rimSourceWidth.toFixed(3)}px`);
   caption.style.opacity=String(f.heroOpacity);
   const textOffset=f.translateY;
   compact.style.transform=`translate3d(0,${textOffset.toFixed(3)}px,0)`;
   compact.style.opacity=String(f.compactOpacity);
   compact.style.setProperty('--glass-light-x',`${(26+f.eased*36).toFixed(1)}%`);
   compact.style.setProperty('--glass-light-y',`${(15+f.eased*17).toFixed(1)}%`);
   gallery.style.opacity=String(Math.max(0,1-f.progress*4));
   stage.dataset.collapsed=String(f.progress>=.995);
   stage.dataset.galleryActive=String(f.progress<.025);
  };
  const queue=()=>{if(!disposed&&!drawId)drawId=requestAnimationFrame(draw);};
  const cancelSnap=()=>{if(snapId)cancelAnimationFrame(snapId);snapId=0;snapping=false;};
  const stopIdle=()=>{if(idleId!==undefined){clearTimeout(idleId);idleId=undefined;}};
  const runSnap=(destination:number)=>{
   const origin=scroller.scrollTop,dist=destination-origin;
   if(Math.abs(dist)<1){wasCollapsed=destination>1;return;}
   cancelSnap();snapping=true;stopIdle();
   const duration=motionReduced()?0:Math.min(340,Math.max(210,210+Math.abs(dist)*.3));
   if(duration===0){scroller.scrollTop=destination;wasCollapsed=destination>1;snapping=false;queue();return;}
   const start=performance.now();
   const tick=(now:number)=>{
    if(disposed||!snapping)return;
    const t=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-t,3);
    scroller.scrollTop=origin+dist*ease;
    queue();
    if(t<1){snapId=requestAnimationFrame(tick);}else{snapId=0;scroller.scrollTop=destination;snapping=false;wasCollapsed=destination>1;velocity=0;queue();}
   };
   snapId=requestAnimationFrame(tick);
  };
  const settle=()=>{
   if(disposed||down||snapping||!width)return;
   const y=scroller.scrollTop,travel=morphTravel(width);
   if(y>travel+20){wasCollapsed=true;velocity=0;return;}
   const target=snapTarget(y,width,wasCollapsed,velocity);
   velocity=0;
   if(target!==null)runSnap(target);
  };
  const schedule=()=>{stopIdle();if(!down&&!snapping)idleId=setTimeout(settle,110);};
  const onScroll=()=>{queue();schedule();};
  const onDown=()=>{down=true;stopIdle();cancelSnap();gestureY=scroller.scrollTop;gestureStart=performance.now();velocity=0;};
  const onUp=()=>{
   if(!down)return;down=false;
   const dt=Math.max(32,performance.now()-gestureStart);
   velocity=(scroller.scrollTop-gestureY)/dt;
   schedule();
  };
  const onWheel=()=>{cancelSnap();schedule();};
  const onScrollEnd=()=>{if(!down&&!snapping){stopIdle();settle();}};
  const onResize=()=>{width=stage.clientWidth;queue();};
  const observer=new ResizeObserver(onResize);
  observer.observe(stage);observer.observe(scroller);
  scroller.addEventListener('scroll',onScroll,{passive:true});
  scroller.addEventListener('pointerdown',onDown,{passive:true});
  window.addEventListener('pointerup',onUp,{passive:true});
  window.addEventListener('pointercancel',onUp,{passive:true});
  scroller.addEventListener('wheel',onWheel,{passive:true});
  scroller.addEventListener('scrollend',onScrollEnd,{passive:true});
  media.addEventListener('change',queue);
  onResize();
  return()=>{
   disposed=true;stopIdle();cancelSnap();if(drawId)cancelAnimationFrame(drawId);
   observer.disconnect();scroller.removeEventListener('scroll',onScroll);
   scroller.removeEventListener('pointerdown',onDown);window.removeEventListener('pointerup',onUp);
   window.removeEventListener('pointercancel',onUp);scroller.removeEventListener('wheel',onWheel);
   scroller.removeEventListener('scrollend',onScrollEnd);media.removeEventListener('change',queue);
   photo.style.transform='';photo.style.borderRadius='';photo.style.removeProperty('--profile-rim');
   compact.style.transform='';compact.style.opacity='';caption.style.opacity='';gallery.style.opacity='';
   delete stage.dataset.collapsed;delete stage.dataset.galleryActive;
  };
 },[stageRef,photoRef,compactRef,captionRef,galleryRef,profileId,reducedMotion]);
}