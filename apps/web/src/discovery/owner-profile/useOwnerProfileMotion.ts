import {useLayoutEffect,useRef} from "react";
import {impactHaptic} from "../../ui/haptic";
import {GestureArbiter,type GestureOwner} from "../../ui/gesture-arbiter";
import {bindMotionLifecycle} from "../../ui/motion-lifecycle";
import type {ProfileRouteMotionHandle} from "../profile-route-motion";
import {GeometryMotion,type Easing} from "../geometry-motion";
import {
 clamp,createOwnerProfileLayout,ownerAutoSnapTarget,ownerMorphEndpoint,
 interpolateOwnerPhotoPose,ownerMorphFrame,ownerMorphProgress,ownerRubberPosition,ownerSnapFrom,ownerUnresistedPosition,
 type OwnerPhotoPose
} from "./OwnerProfileGeometry";

type Endpoint=0|1;
type Source="photo"|"tabs"|"cards"|"sheet";
type Point={x:number;y:number};
type Press={
 id:number;serial:number;source:Source;owner:GestureOwner|null;
 start:Point;last:Point;distance:number;origin:number;startedCompact:boolean;
 startScroll:number;velocity:number;sampleTime:number;
 remainder:number;scrollCards:boolean;captured:boolean;
};
type Horizontal={
 startPhoto:(visibleWidth:number,fullWidth:number)=>void;
 movePhoto:(delta:number)=>void;
 endPhoto:(direction:-1|0|1)=>void;
 cancelPhoto:()=>void;
};
type Options={
 active:boolean;profileId:string|null;gestureArbiter?:GestureArbiter;
 tabIndex:number;onTabChange:(index:number)=>void;
 registerRouteMotion?:(handle:ProfileRouteMotionHandle|null)=>void;
 onMotionProgress?:(progress:number,dragging:boolean)=>void;
 horizontal:Horizontal;
};

const translate=(x:number,y:number)=>`translate3d(${x}px,${y}px,0)`;
const atTop=(scrollTop:number)=>scrollTop<=.5;

export function useOwnerProfileMotion(options:Options){
 const {active,profileId,gestureArbiter,tabIndex}=options;
 const latest=useRef(options);
 const root=useRef<HTMLElement>(null);
 const syncTab=useRef<((index:number)=>void)|null>(null);
 const commands=useRef<{compact:()=>void;cancelTabs:()=>void;allowClick:()=>boolean}>({
  compact:()=>{},cancelTabs:()=>{},allowClick:()=>true
 });

 useLayoutEffect(()=>{latest.current=options;});
 useLayoutEffect(()=>{
  const host=root.current;
  if(!active||!host)return;
  const brand=host.querySelector<HTMLElement>(".owner-profile-brand")!;
  const mask=host.querySelector<HTMLElement>(".owner-profile-photo-mask")!;
  const shade=host.querySelector<HTMLElement>(".owner-profile-photo-shade")!;
  const ambient=host.querySelector<HTMLElement>(".owner-profile-ambient")!;
  const halo=host.querySelector<HTMLElement>(".owner-profile-halo")!;
  const identity=host.querySelector<HTMLElement>(".owner-profile-identity")!;
  const name=identity.querySelector<HTMLElement>("h1")!;
  const location=identity.querySelector<HTMLElement>("p")!;
  const reactionIndicator=host.querySelector<HTMLElement>(".profile-reaction-indicator");
  const reactionLayers=identity.querySelectorAll<HTMLElement>("[data-reaction-layout]");
  const pager=host.querySelector<HTMLElement>(".owner-profile-photo-pager")!;
  const sheet=host.querySelector<HTMLElement>(".owner-profile-sheet")!;
  const panes=Array.from(host.querySelectorAll<HTMLElement>(".owner-profile-scroll"));
  let scroll=panes[latest.current.tabIndex];
  const tabRail=host.querySelector<HTMLElement>(".owner-profile-tabs")!;
  const tabInk=tabRail.querySelector<HTMLElement>(".owner-profile-tab-ink")!;
  const tabPages=host.querySelector<HTMLElement>(".owner-profile-pages")!;
  const tabCount=tabRail.querySelectorAll('[role="tab"]').length;
  const gestures=gestureArbiter??new GestureArbiter();
  const motion=new GeometryMotion("sheet",()=>performance.now(),
   callback=>requestAnimationFrame(callback),id=>cancelAnimationFrame(id),0);
  const photoMotion=new GeometryMotion("hero",()=>performance.now(),
   callback=>requestAnimationFrame(callback),id=>cancelAnimationFrame(id),0);
  const reducedMotion=matchMedia("(prefers-reduced-motion: reduce)");
  const tabMotion=new GeometryMotion("tabs",()=>performance.now(),
   callback=>requestAnimationFrame(callback),id=>cancelAnimationFrame(id),0);

  let geometry=createOwnerProfileLayout({width:393,height:852,brandBottom:65});
  let position=0,accepted:Endpoint=0,settling:Endpoint|null=null;
  let press:Press|null=null,blockedUntil=0,resizeRaf=0,paintRaf=0;
  let pendingPaint=0,routePaused=false,backgroundPaused=false;
  let wheelTimer:number|undefined;
  let wheel:{mode:"morph"|"native"|"cards";raw:number;auto:Endpoint|null;remainder:number}|null=null;
  const paused=()=>routePaused||backgroundPaused;
  const compact=()=>settling===null&&position===1;

  let selectedTab=latest.current.tabIndex,tabPosition=selectedTab,tabOrigin=selectedTab;
  let tabWidth=1,inkStep=0,tabDragWidth=1,tabPaintRaf=0,pendingTabPosition=selectedTab;
  const paintTabs=(position:number)=>{
   tabPosition=position;
   tabPages.style.transform=`translate3d(${-position*100}%,0,0)`;
   tabInk.style.transform=translate(position*inkStep,0);
  };
  const cancelTabPaint=()=>{
   if(tabPaintRaf)cancelAnimationFrame(tabPaintRaf);
   tabPaintRaf=0;
  };
  const resetTabs=(index:number)=>{
   cancelTabPaint();
   tabMotion.cancel();
   paintTabs(index);
   delete tabRail.dataset.paging;
   delete tabPages.dataset.paging;
  };
  syncTab.current=index=>{
   if(selectedTab===index)return;
   scroll.scrollTop=0;
   selectedTab=index;
   scroll=panes[index];
   resetTabs(index);
  };
  const startTabs=(scrollAtPress:number)=>{
   tabMotion.cancel();
   scroll.scrollTop=scrollAtPress;
   tabOrigin=tabPosition;
   tabDragWidth=tabWidth;
   tabRail.dataset.paging="";
   tabPages.dataset.paging="";
  };
  const moveTabs=(delta:number)=>{
   const position=tabOrigin-delta/tabDragWidth;
   pendingTabPosition=clamp(position,Math.max(0,selectedTab-1),Math.min(tabCount-1,selectedTab+1));
   if(tabPaintRaf)return;
   tabPaintRaf=requestAnimationFrame(()=>{
    tabPaintRaf=0;
    paintTabs(pendingTabPosition);
   });
  };
  const endTabs=(speed:number,cancelled:boolean)=>{
   // Include the last queued move before handing the track to the settle animation.
   const fingerPosition=tabPaintRaf?pendingTabPosition:tabPosition;
   cancelTabPaint();
   paintTabs(fingerPosition);
   const projected=fingerPosition-clamp(speed*120/tabDragWidth,-.25,.25);
   const shift=projected-selectedTab;
   const target=clamp(selectedTab+(!cancelled&&Math.abs(shift)>.29?Math.sign(shift):0),0,tabCount-1);
   const width=tabWidth,from=tabPosition;
   const duration=clamp(Math.abs(target-from)*235,145,235);
   tabMotion.start(from*width,target*width,duration,[.22,.76,.25,1],
    value=>paintTabs(value/width),()=>{
     if(target===selectedTab)resetTabs(selectedTab);
     else latest.current.onTabChange(target);
    });
  };

  let paintedCircle=false,photoChanging=false;
  let reactionOrigin:Endpoint=0,outgoingOpacity=1;
  let paintedRadius:number|undefined,paintedHalo:number|undefined,paintedOrigin:number|undefined;
  let visiblePhoto:OwnerPhotoPose=ownerMorphFrame(geometry,0),targetPhoto=visiblePhoto;
  let expandedReaction={x:0,y:0},compactReaction={x:0,y:0};
  const paintReactionIndicator=(value:number)=>{
   if(!reactionIndicator)return;
   const progress=clamp(value,0,1);
   const x=expandedReaction.x+(compactReaction.x-expandedReaction.x)*progress;
   const y=expandedReaction.y+(compactReaction.y-expandedReaction.y)*progress;
   reactionIndicator.style.transform=translate(x,y);
   reactionIndicator.style.setProperty("--profile-indicator-compact",String(progress));
  };
  const paintReactionLayers=(value:number)=>{
   if(!reactionLayers.length)return;
   const dragging=press?.owner==="sheet"&&!press.scrollCards;
   const settled=dragging||settling!==null||photoChanging?null:value===0||value===1?value:null;
   if(settled!==null){reactionOrigin=settled;outgoingOpacity=1;}
   const travel=reactionOrigin===0?value:1-value;
   const fade=clamp(1-travel*2,0,1);
   for(const layer of reactionLayers){
    const endpoint=layer.dataset.reactionLayout==="expanded"?0:1;
    const inactive=endpoint!==settled;
    if(layer.inert!==inactive){
     // A fast new gesture can interrupt the arrival fade. Continue from its visible opacity.
     if(inactive&&settled===null)outgoingOpacity=Number(getComputedStyle(layer).opacity);
     layer.inert=inactive;
     layer.setAttribute("aria-hidden",String(inactive));
    }
    // Only the departing pair follows the drag. The arriving pair fades in at rest.
    const opacity=inactive?settled===null&&endpoint===reactionOrigin?Math.min(outgoingOpacity,fade):0:1;
    if(layer.style.opacity!==String(opacity))layer.style.opacity=String(opacity);
   }
  };
  const paintPhoto=(frame:OwnerPhotoPose)=>{
   visiblePhoto=frame;
   const photo=frame.mask;
   const radiusRatio=frame.radius/photo.width;
   mask.style.transform=`${translate(photo.x,photo.y)} scale(${photo.width/geometry.width})`;
   if(paintedRadius!==radiusRatio){
    paintedRadius=radiusRatio;
    mask.style.borderRadius=`${radiusRatio*100}%`;
    shade.style.opacity=String(1-radiusRatio*2);
   }
   if(paintedHalo!==frame.haloOpacity){
    paintedHalo=frame.haloOpacity;
    halo.style.opacity=String(frame.haloOpacity);
   }
   if(frame.haloOpacity>0){
    const scale=(photo.width+34)/(geometry.roundDiameter+34);
    halo.style.transform=`translate3d(-50%,${photo.y-17}px,0) scale(${scale})`;
   }
  };
  const syncAvatarClass=()=>mask.classList.toggle("owner-profile-avatar-circle",
   host.dataset.morphState==="compact"&&!photoChanging);
  const stopPhotoMotion=()=>{
   photoMotion.cancel();
   photoChanging=false;
  };
  const paint=(value:number,feedback=false)=>{
   position=value;
   const distance=geometry.morphDistance;
   const progress=ownerMorphProgress(value*distance,distance);
   const frame=ownerMorphFrame(geometry,value);
   const center=frame.identityCenter,circular=frame.radius>0;
   const crossed=paintedCircle!==circular;
   paintedCircle=circular;
   targetPhoto=frame;
   if(crossed&&!reducedMotion.matches&&!paused()){
    const from=visiblePhoto;
    photoChanging=true;
    photoMotion.start(0,1,125,[.22,.64,.32,1],
     amount=>paintPhoto(interpolateOwnerPhotoPose(from,targetPhoto,amount)),
     ()=>{photoChanging=false;paintPhoto(targetPhoto);syncAvatarClass();paintReactionLayers(position);});
   }else if(!photoChanging){
    paintPhoto(targetPhoto);
   }
   sheet.style.transform=translate(0,frame.sheetTop);
   identity.style.transform=translate(0,frame.identityTop);
   const x=24+(geometry.width/2-24)*center;
   const align=`translateX(${x}px) translateX(${-50*center}%)`;
   name.style.transform=`${align} scale(${1-.25*center})`;
   if(paintedOrigin!==center){
    paintedOrigin=center;
    name.style.transformOrigin=`${50*center}% 0`;
   }
   location.style.transform=`translateY(${-12*center}px) ${align}`;
   pager.style.transform=translate(0,frame.sheetTop-24);
   const hideControls=circular;
   if(pager.inert!==hideControls)pager.inert=hideControls;
   const state=settling!==null?"transition":value===0?"expanded":value===1?"compact":"transition";
   paintReactionIndicator(value);
   paintReactionLayers(value);
   if(host.dataset.morphState!==state)host.dataset.morphState=state;
   syncAvatarClass();
   if(crossed&&feedback&&!paused())impactHaptic("light");
   latest.current.onMotionProgress?.(1-progress,settling!==null||(press?.owner==="sheet"&&!press.scrollCards));
  };
  const cancelPaint=()=>{
   if(paintRaf)cancelAnimationFrame(paintRaf);
   paintRaf=0;
  };
  const schedulePaint=(value:number)=>{
   pendingPaint=value;
   if(paintRaf)return;
   paintRaf=requestAnimationFrame(()=>{paintRaf=0;paint(pendingPaint,true);});
  };
  const flushPaint=()=>{
   if(!paintRaf)return;
   cancelPaint();
   paint(pendingPaint,true);
  };
  const interrupt=()=>{
   if(settling===null)return;
   // Keep the last pixels actually presented and hand control to the new press.
   motion.cancel();
   settling=null;
   paint(position);
  };
  const writeCards=(press:Press)=>{scroll.scrollTop=press.remainder;};
  const settleTo=(target:Endpoint,velocity=0,feedback=false,afterCompact?:()=>void)=>{
   flushPaint();
   accepted=target;
   if(settling===target)return;
   const from=position,distance=geometry.morphDistance;
   const finish=()=>{
    settling=null;
    paint(target,feedback);
    if(target===1)afterCompact?.();
   };
   const bounce=feedback&&!reducedMotion.matches&&from>=0&&from<=1&&!(target===1&&scroll.scrollTop>0);
   if(from===target&&!bounce){finish();return;}
   const landing=target+(bounce?(target===1?4:-5)/distance:0);
   const duration=clamp(110+Math.abs(target-from)*190,110,300);
   const slope=velocity*duration/(distance*(landing-from));
   const curve:Easing=[.22,clamp(slope*.22,.24,.85),.32,1];
   settling=target;
   paint(from);
   motion.start(from*distance,landing*distance,duration,curve,value=>paint(value/distance,feedback),()=>{
    if(!bounce){finish();return;}
    motion.start(landing*distance,target*distance,115,[.26,.72,.38,1],value=>paint(value/distance,feedback),finish);
   });
  };
  const settleRelease=(velocity:number,touch=false)=>{
   flushPaint();
   const distance=geometry.morphDistance;
   const crossed=touch?ownerAutoSnapTarget(accepted,position*distance,distance):null;
   const target=(Math.abs(velocity)>=.38?null:crossed)??(ownerMorphEndpoint(position*distance,distance,velocity)===0?0:1);
   // Rubber returns to expanded even if a small reversal ended the pull.
   settleTo(position<0?0:target,velocity,true);
  };

  const release=(current:Press)=>{
   if(current.owner)gestures.finish(current.owner,current.serial);
   else{
    gestures.finishCandidate(current.serial,current.source==="photo"?"hero":"tabs");
    gestures.finishCandidate(current.serial,"sheet");
    gestures.finishCandidate(current.serial,"native");
   }
   if(current.captured&&host.hasPointerCapture(current.id))host.releasePointerCapture(current.id);
  };
  const clearWheel=()=>{
   window.clearTimeout(wheelTimer);
   wheelTimer=undefined;wheel=null;
  };
  const cancelInput=()=>{
   const current=press;
   press=null;
   if(current)release(current);
   clearWheel();
   latest.current.horizontal.cancelPhoto();
   resetTabs(selectedTab);
   cancelPaint();
  };

  const start=(target:EventTarget|null,id:number,point:Point,kind:"pointer"|"touch")=>{
   if(paused()||press||!(target instanceof Element))return;
   const source:Source=target.closest(".owner-profile-photo-mask")?"photo":
    target.closest(".owner-profile-tabs")?"tabs":
    target.closest(".owner-profile-scroll")?"cards":"sheet";
   const candidate=source==="photo"?"hero":"tabs";
   const serial=gestures.begin(kind,id,candidate);
   if(serial===null)return;
   gestures.begin(kind,id,"sheet");
   gestures.begin(kind,id,"native");
   if(tabPages.dataset.paging!==undefined)tabMotion.cancel();
   clearWheel();
   blockedUntil=0;
   flushPaint();
   interrupt();
   const startScroll=Math.max(0,scroll.scrollTop);
   press={id,serial,source,owner:null,start:point,last:point,
    distance:geometry.morphDistance,origin:position,startedCompact:compact(),startScroll,
    velocity:0,sampleTime:performance.now(),remainder:0,scrollCards:false,captured:false};
  };

  const dragMorph=(current:Press,dy:number)=>{
   const from=ownerUnresistedPosition(current.origin*current.distance);
   const raw=from-dy;
   const previousRemainder=current.remainder;
   current.remainder=Math.max(0,raw-current.distance);
   if(raw>=current.distance){
    cancelPaint();
    paint(1,true);
    writeCards(current);
    return;
   }
   if(previousRemainder>0)scroll.scrollTop=0;
   const next=ownerRubberPosition(raw)/current.distance;
   schedulePaint(current.startedCompact?Math.max(0,next):next);
  };
  const sample=(current:Press,point:Point,horizontal:boolean)=>{
   const now=performance.now(),elapsed=now-current.sampleTime;
   if(elapsed>0){
    const delta=horizontal?point.x-current.last.x:current.last.y-point.y;
    const velocity=delta/elapsed;
    current.velocity=elapsed>75||!current.velocity?velocity:current.velocity*.38+velocity*.62;
   }
   current.last=point;
   current.sampleTime=now;
  };
  const move=(current:Press,point:Point,event:TouchEvent|PointerEvent)=>{
   const dx=point.x-current.start.x,dy=point.y-current.start.y;
   if(!current.owner){
    const horizontal=Math.abs(dx)>=9&&Math.abs(dx)>Math.abs(dy)*1.2;
    // Give a compact boundary pull the first cancellable touchmove, before
    // the WebView commits to native scrolling. Keep normal axis slop elsewhere.
    const boundaryPull=current.startedCompact&&atTop(current.startScroll)&&dy>0;
    const vertical=Math.abs(dy)>=(boundaryPull?2:6)&&Math.abs(dy)>Math.abs(dx)*1.2;
    if(!horizontal&&!vertical)return;
    current.scrollCards=vertical&&current.startedCompact&&(dy<0||!atTop(current.startScroll));
    const useNative=vertical&&event.type==="touchmove"&&current.startedCompact&&current.source==="cards"&&
     (current.scrollCards||!event.cancelable);
    const owner=horizontal?(current.source==="photo"?"hero":"tabs"):useNative?"native":"sheet";
    if(!gestures.claim(owner,current.serial)){
     press=null;
     release(current);
     return;
    }
    current.owner=owner;
    if(owner==="native"){
     if(tabPages.dataset.paging!==undefined)resetTabs(selectedTab);
     return;
    }
    if(event.type==="pointermove"){
     try{
      host.setPointerCapture(current.id);
      current.captured=true;
     }catch{/* The pointer may have already left the WebView. */}
    }
    if(owner==="hero")latest.current.horizontal.startPhoto(visiblePhoto.mask.width,geometry.width);
    if(owner==="tabs")startTabs(current.startScroll);
    else if(tabPages.dataset.paging!==undefined)resetTabs(selectedTab);
    // Freeze native inertia only once an exclusive gesture has taken over.
    if(owner==="sheet"&&current.startedCompact)scroll.scrollTop=current.startScroll;
   }
   if(current.owner==="native"||!gestures.owns(current.owner,current.serial))return;
   if(event.cancelable)event.preventDefault();
   blockedUntil=performance.now()+400;
   sample(current,point,current.owner!=="sheet");
   if(current.owner==="sheet"){
    if(current.scrollCards)scroll.scrollTop=current.startScroll-dy;
    else dragMorph(current,dy);
   }else if(current.owner==="hero")latest.current.horizontal.movePhoto(dx);
   else if(current.owner==="tabs")moveTabs(dx);
  };
  const end=(current:Press,cancelled:boolean)=>{
   press=null;
   release(current);
   const owner=current.owner;
   if(owner&&owner!=="native")blockedUntil=performance.now()+400;
   const speed=performance.now()-current.sampleTime<=76?current.velocity:0;
   if(owner==="sheet"&&!current.scrollCards){
    if(cancelled)settleTo(accepted);
    else if(current.remainder>0)settleTo(1,speed,true,()=>writeCards(current));
    else settleRelease(speed,true);
    return;
   }
   if(owner==="tabs")endTabs(speed,cancelled);
   else if(!owner&&tabPages.dataset.paging!==undefined)endTabs(0,true);
   if(owner==="hero"){
    const dx=current.last.x-current.start.x;
    const width=visiblePhoto.mask.width;
    const threshold=Math.max(24,width*.18);
    const direction=!cancelled&&(Math.abs(dx)>=threshold||(Math.abs(dx)>=12&&Math.abs(speed)>.48))?
     (dx<0?-1:1):0;
    latest.current.horizontal.endPhoto(direction);
   }
   if(settling===null&&position!==accepted)settleTo(accepted);
  };

  const touchStart=(event:TouchEvent)=>{
   if(event.touches.length!==1){
    if(press)end(press,true);
    return;
   }
   const point=event.changedTouches[0];
   if(point)start(event.target,point.identifier,{x:point.clientX,y:point.clientY},"touch");
  };
  const changedTouch=(event:TouchEvent,id:number)=>{
   for(let index=0;index<event.changedTouches.length;index++){
    const point=event.changedTouches[index];
    if(point.identifier===id)return point;
   }
   return null;
  };
  const touchMove=(event:TouchEvent)=>{
   if(!press)return;
   const point=changedTouch(event,press.id);
   if(point)move(press,{x:point.clientX,y:point.clientY},event);
  };
  const touchEnd=(event:TouchEvent)=>{
   if(press&&changedTouch(event,press.id))end(press,event.type==="touchcancel");
  };
  const pointerDown=(event:PointerEvent)=>{
   if(event.pointerType==="touch"||event.button!==0||!event.isPrimary)return;
   start(event.target,event.pointerId,{x:event.clientX,y:event.clientY},"pointer");
  };
  const pointerMove=(event:PointerEvent)=>{
   if(event.pointerType!=="touch"&&press?.id===event.pointerId)
    move(press,{x:event.clientX,y:event.clientY},event);
  };
  const pointerEnd=(event:PointerEvent)=>{
   if(event.pointerType!=="touch"&&press?.id===event.pointerId)end(press,event.type!=="pointerup");
  };
  const onWheel=(event:WheelEvent)=>{
   if(paused()||press||event.ctrlKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)||!event.deltaY)return;
   const distance=geometry.morphDistance;
   if(!wheel){
    interrupt();
    const overCards=event.target instanceof Element&&scroll.contains(event.target);
    const useCards=compact()&&(event.deltaY>0||!atTop(scroll.scrollTop));
    wheel={mode:useCards?(overCards?"native":"cards"):"morph",
     raw:ownerUnresistedPosition(position*distance),auto:null,remainder:Math.max(0,scroll.scrollTop)};
   }
   const current=wheel;
   window.clearTimeout(wheelTimer);
   wheelTimer=window.setTimeout(()=>{
    if(current.mode==="morph"&&current.auto===null&&settling===null)settleRelease(0);
    clearWheel();
   },130);
   if(current.mode==="native")return;
   if(event.cancelable)event.preventDefault();
   const delta=event.deltaY*(event.deltaMode===1?18:event.deltaMode===2?scroll.clientHeight:1);
   if(current.mode==="cards"){scroll.scrollTop+=delta;return;}
   current.raw+=delta;
   if(current.auto!==null){
    if(current.auto===1){
     current.remainder=Math.max(0,current.raw-distance);
     if(compact())scroll.scrollTop=current.remainder;
    }
    return;
   }
   const next=ownerRubberPosition(Math.min(current.raw,distance));
   const target=current.raw>=distance?1:ownerAutoSnapTarget(accepted,next,distance);
   if(target!==null){
    schedulePaint(ownerSnapFrom(paintRaf?pendingPaint:position,target));
    current.auto=target;
    current.remainder=Math.max(0,current.raw-distance);
    settleTo(target,0,true,()=>{scroll.scrollTop=current.remainder;});
   }else schedulePaint(next/distance);
  };

  const measure=()=>{
   const rect=host.getBoundingClientRect();
   if(!rect.width||!rect.height)return;
   const widthChanged=rect.width!==geometry.width;
   if(widthChanged)stopPhotoMotion();
   geometry=createOwnerProfileLayout({width:rect.width,height:rect.height,
    brandBottom:brand.getBoundingClientRect().bottom-rect.top});
   if(reactionIndicator){
    const expanded=ownerMorphFrame(geometry,0),avatar=ownerMorphFrame(geometry,1).mask;
    const rim=avatar.width*(.5+Math.SQRT1_2/2);
    expandedReaction={x:24+name.offsetWidth+19,y:expanded.identityTop+name.offsetHeight/2};
    compactReaction={x:avatar.x+rim,y:avatar.y+rim};
   }
   sheet.style.height=`calc(100% - ${geometry.compactContentTop}px)`;
   ambient.style.height=`${Math.max(geometry.width,geometry.roundTop+geometry.roundDiameter+108)}px`;
   halo.style.width=`${geometry.roundDiameter+34}px`;
   tabWidth=tabPages.clientWidth||rect.width;
   inkStep=tabRail.clientWidth/tabCount;
   paintTabs(tabPosition);
   if(paintRaf)flushPaint();
   else paint(position);
  };
  const resize=()=>{
   if(resizeRaf)return;
   resizeRaf=requestAnimationFrame(()=>{resizeRaf=0;measure();});
  };
  const observer=new ResizeObserver(resize);
  observer.observe(host);observer.observe(brand);
  if(reactionIndicator)observer.observe(name);
  const web=window.Telegram?.WebApp;
  const viewportChanged=(event?:{isStateStable?:boolean})=>{if(event?.isStateStable!==false)resize();};
  window.visualViewport?.addEventListener("resize",resize);
  web?.onEvent?.("viewportChanged",viewportChanged);
  web?.onEvent?.("safeAreaChanged",resize);
  web?.onEvent?.("contentSafeAreaChanged",resize);

  const pause=()=>{cancelInput();stopPhotoMotion();interrupt();};
  const resume=()=>{if(!paused())settleTo(accepted);};
  const suspendForBackground=()=>{if(!backgroundPaused){backgroundPaused=true;pause();}};
  const resumeFromBackground=()=>{if(backgroundPaused){backgroundPaused=false;resume();}};
  const disposeLifecycle=bindMotionLifecycle(suspendForBackground,resumeFromBackground);
  const routeHandle:ProfileRouteMotionHandle={
   suspendForRoute:()=>{routePaused=true;pause();},
   rollbackRoute:()=>{routePaused=false;resume();},
   commitRouteClose:()=>{routePaused=true;pause();},
   suspendForBackground,resumeFromBackground
  };

  commands.current={
   compact:()=>{if(!paused())settleTo(1,0,true);},
   cancelTabs:()=>{if(tabPages.dataset.paging!==undefined)resetTabs(selectedTab);},
   allowClick:()=>performance.now()>=blockedUntil
  };
  host.addEventListener("touchstart",touchStart,{passive:true});
  host.addEventListener("touchmove",touchMove,{passive:false});
  host.addEventListener("touchend",touchEnd,{passive:true});
  host.addEventListener("touchcancel",touchEnd,{passive:true});
  host.addEventListener("pointerdown",pointerDown);
  host.addEventListener("pointermove",pointerMove);
  host.addEventListener("lostpointercapture",pointerEnd);
  window.addEventListener("pointerup",pointerEnd);
  window.addEventListener("pointercancel",pointerEnd);
  host.addEventListener("wheel",onWheel,{passive:false});
  const register=latest.current.registerRouteMotion;
  register?.(routeHandle);
  scroll.scrollTop=0;
  measure();

  return()=>{
   register?.(null);
   disposeLifecycle();
   cancelInput();
   motion.dispose();
   photoMotion.dispose();
   tabMotion.dispose();
   syncTab.current=null;
   observer.disconnect();
   if(resizeRaf)cancelAnimationFrame(resizeRaf);
   window.visualViewport?.removeEventListener("resize",resize);
   web?.offEvent?.("viewportChanged",viewportChanged);
   web?.offEvent?.("safeAreaChanged",resize);
   web?.offEvent?.("contentSafeAreaChanged",resize);
   host.removeEventListener("touchstart",touchStart);
   host.removeEventListener("touchmove",touchMove);
   host.removeEventListener("touchend",touchEnd);
   host.removeEventListener("touchcancel",touchEnd);
   host.removeEventListener("pointerdown",pointerDown);
   host.removeEventListener("pointermove",pointerMove);
   host.removeEventListener("lostpointercapture",pointerEnd);
   window.removeEventListener("pointerup",pointerEnd);
   window.removeEventListener("pointercancel",pointerEnd);
   host.removeEventListener("wheel",onWheel);
   commands.current={compact:()=>{},cancelTabs:()=>{},allowClick:()=>true};
  };
 },[active,profileId,gestureArbiter]);
 useLayoutEffect(()=>{syncTab.current?.(tabIndex);},[tabIndex]);

 return {root,commands};
}
