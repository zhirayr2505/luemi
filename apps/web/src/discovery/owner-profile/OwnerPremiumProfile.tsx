import {useCallback,useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from "react";
import type {KeyboardEvent,PointerEvent as ReactPointerEvent} from "react";
import {ArrowLeft,CalendarDays,Eye,Gift,Heart,Images,MapPin,PenLine,Settings2,Sparkles,UserRound} from "lucide-react";
import {InterestChip} from "../../ui/InterestCatalog";
import {goals,type RegistrationDraft} from "../../registration/model";
import {goalLabel} from "../../ui/PersonalizedCopy";
import {GestureArbiter} from "../../ui/gesture-arbiter";
import {bindMotionLifecycle} from "../../ui/motion-lifecycle";
import type {ProfileView} from "../ProfileModel";
import {GeometryMotion} from "../geometry-motion";
import {resolvePhotoFocus} from "../profile-v3/geometry/ProfileGeometry";
import {createOwnerProfileLayout,ownerMorphEndpoint,ownerMorphFrame,ownerMorphProgress,type OwnerProfileLayout} from "./OwnerProfileGeometry";
import "./owner-premium-profile.css";

type OwnerTab="about"|"photos"|"bliki"|"gifts";
const tabs:[OwnerTab,string][]=[["about","О себе"],["photos","Фото"],["bliki","Блики"],["gifts","Подарки"]];

type Props={
 view:ProfileView;ownerDetails?:RegistrationDraft;active?:boolean;
 onBack:()=>void;onEdit:()=>void;onSettings:()=>void;onPreview:()=>void;
 onPhotoOpen:(id:string,element:HTMLImageElement|null)=>void;
 onMotionProgress?:(progress:number,dragging:boolean)=>void;
 gestureArbiter?:GestureArbiter;
};

type ProfileGesture={
 id:number;serial:number;source:"photo"|"pages";axis:"horizontal"|"vertical"|null;
 x:number;y:number;startScroll:number;width:number;captured:boolean;
 samples:{position:number;time:number}[];
};

const MORPH_EASING=[.2,.82,.24,1] as const;
const recentVelocity=(samples:readonly {position:number;time:number}[])=>{
 if(samples.length<2)return 0;
 const last=samples[samples.length-1];
 let first=samples[0];
 for(let index=samples.length-2;index>=0;index--){
  first=samples[index];if(last.time-first.time>=42)break;
 }
 const elapsed=Math.max(1,last.time-first.time);
 return (last.position-first.position)/elapsed;
};

const numericToken=(node:HTMLElement,name:string)=>{
 const value=Number.parseFloat(getComputedStyle(node).getPropertyValue(name));
 return Number.isFinite(value)?value:0;
};

export function OwnerPremiumProfile({view,ownerDetails,active=true,onBack,onEdit,onSettings,onPreview,
 onPhotoOpen,onMotionProgress,gestureArbiter}:Props){
 const p=view.profile,photos=view.photos,mainPhoto=photos[0]??null,isOwner=view.mode==="owner";
 const [tab,setTab]=useState<OwnerTab>("about");
 const [heroIndex,setHeroIndex]=useState(0);
 // The selected tab indicator changes immediately; the still-mounted hero image
 // only swaps its src once its adjacent photo has finished sliding into place.
 const [renderIndex,setRenderIndex]=useState(0);
 const heroPhoto=photos[Math.min(renderIndex,Math.max(0,photos.length-1))]??mainPhoto;
 const previousPhoto=photos[renderIndex-1]??null,nextPhoto=photos[renderIndex+1]??null;
 const photoSignature=photos.map(photo=>photo.id).join("\u0000");
 const selectedPhotoId=useRef(mainPhoto?.id??null);
 const gesture=useRef<ProfileGesture|null>(null);
 const suppressPhotoClick=useRef(false);
 const root=useRef<HTMLElement>(null),scroller=useRef<HTMLDivElement>(null);
 const mask=useRef<HTMLDivElement>(null),heroImage=useRef<HTMLImageElement>(null);
 const prevImage=useRef<HTMLDivElement>(null),nextImage=useRef<HTMLDivElement>(null);
 const photoSlideTimer=useRef<number|null>(null);
 const shade=useRef<HTMLDivElement>(null),expandedIdentity=useRef<HTMLDivElement>(null);
 const compactIdentity=useRef<HTMLDivElement>(null);
 const tablist=useRef<HTMLDivElement>(null),brandProbe=useRef<HTMLDivElement>(null);
 const compactBackdrop=useRef<HTMLDivElement>(null),pager=useRef<HTMLDivElement>(null);
 const topEdit=useRef<HTMLButtonElement>(null);
 const flow=useRef<HTMLDivElement>(null);
 const layout=useRef<OwnerProfileLayout>(createOwnerProfileLayout({width:393,height:852}));
 const layoutRevision=useRef(0),paintRaf=useRef(0),lastState=useRef("expanded"),lastPaintedProgress=useRef(0);
 const scrollEndTimer=useRef<number|null>(null),paused=useRef(false),nativeTouchActive=useRef(false);
 const settleTarget=useRef(0);
 const scrollSample=useRef({position:0,time:0,velocity:0});
 const latestSettleWrite=useRef<number|null>(null);
 const localArbiter=useRef<GestureArbiter|null>(null);
 if(!gestureArbiter&&!localArbiter.current)localArbiter.current=new GestureArbiter();
 const gestures=gestureArbiter??localArbiter.current!;
 const morphMotion=useRef<GeometryMotion|null>(null);
 if(!morphMotion.current||morphMotion.current.isDisposed())
  morphMotion.current=new GeometryMotion("sheet",()=>performance.now(),cb=>requestAnimationFrame(cb),id=>cancelAnimationFrame(id),0);
 const motionProgress=useRef(onMotionProgress);
 const tabPrefix=useId();
 const goal=p.goal&&p.goal!=="undecided"?goals.find(item=>item.id===p.goal):null;
 const goalText=goal?goalLabel(goal.id,ownerDetails?.gender??p.gender??""):"Цель не указана";
 const location=[p.city,p.country].filter(Boolean).join(", ")||"Город не указан";
 const details=useMemo(()=>{
  if(!ownerDetails)return [];
  return [
   ownerDetails.height?{label:"Рост",value:`${ownerDetails.height} см`}:null,
   ownerDetails.occupation?{label:"Работа",value:ownerDetails.occupation}:null,
   ownerDetails.education?{label:"Образование",value:ownerDetails.education}:null
  ].filter((item):item is {label:string;value:string}=>item!==null);
 },[ownerDetails]);

 useEffect(()=>{motionProgress.current=onMotionProgress;},[onMotionProgress]);

 const paint=useCallback((scrollTop:number)=>{
  const progress=ownerMorphProgress(scrollTop,layout.current.morphDistance);
  const frame=ownerMorphFrame(layout.current,progress);
  lastPaintedProgress.current=progress;
  const surface=mask.current;
  if(surface){
   surface.style.transform=`translate3d(${frame.mask.x}px,${frame.mask.y}px,0)`;
   surface.style.width=`${frame.mask.width}px`;
   surface.style.height=`${frame.mask.height}px`;
   surface.style.borderRadius=`${frame.radius}px`;
  }
  if(shade.current)shade.current.style.opacity=String(frame.photoShadeAlpha);
  if(expandedIdentity.current){
   expandedIdentity.current.style.opacity=String(frame.expandedAlpha);
   expandedIdentity.current.style.transform=`translate3d(0,${-progress*18}px,0)`;
   expandedIdentity.current.setAttribute("aria-hidden",progress>.58?"true":"false");
  }
  if(compactIdentity.current){
   compactIdentity.current.style.opacity=String(frame.compactAlpha);
   compactIdentity.current.style.transform=`translate3d(-50%,${(1-progress)*8}px,0)`;
   compactIdentity.current.setAttribute("aria-hidden",progress<=.58?"true":"false");
  }
  if(compactBackdrop.current)compactBackdrop.current.style.opacity=String(Math.max(0,Math.min(1,(progress-.40)/.36)));
  if(pager.current){
   pager.current.style.opacity=String(Math.max(0,Math.min(1,(.43-progress)/.23)));
   pager.current.style.pointerEvents=progress<.31?"auto":"none";
   pager.current.toggleAttribute("inert",progress>=.31);
  }
  if(topEdit.current){
   topEdit.current.style.opacity=String(frame.actionsAlpha);
   topEdit.current.style.pointerEvents=progress<.29?"auto":"none";
   topEdit.current.toggleAttribute("inert",progress>=.29);
  }
  if(flow.current)flow.current.style.transform=`translate3d(0,${frame.contentOffset}px,0)`;
  root.current?.style.setProperty("--owner-morph-progress",String(progress));
  const state=progress<=.001?"expanded":progress>=.999?"compact":"transition";
  if(root.current&&lastState.current!==state){root.current.dataset.morphState=state;lastState.current=state;}
  const moving=gesture.current?.axis==="vertical"||morphMotion.current?.snapshot().phase==="settling";
  motionProgress.current?.(1-progress,moving);
 },[]);
 const schedulePaint=useCallback(()=>{
  if(paintRaf.current)return;
  paintRaf.current=requestAnimationFrame(()=>{paintRaf.current=0;paint(scroller.current?.scrollTop??0);});
 },[paint]);

 const clearScrollEnd=useCallback(()=>{
  if(scrollEndTimer.current!==null){window.clearTimeout(scrollEndTimer.current);scrollEndTimer.current=null;}
 },[]);
 const interruptMorph=useCallback(()=>{
  clearScrollEnd();
  const motion=morphMotion.current;
  if(!motion||motion.snapshot().phase==="idle")return;
  latestSettleWrite.current=null;
  const position=motion.cancel();
  if(scroller.current){scroller.current.scrollTop=position;paint(position);}
 },[clearScrollEnd,paint]);
 const settleMorph=useCallback((velocity=scrollSample.current.velocity)=>{
  const scroll=scroller.current,motion=morphMotion.current;
  if(!scroll||!motion||paused.current)return;
  if(motion.snapshot().phase==="settling")return;
  clearScrollEnd();
  const distance=layout.current.morphDistance,current=scroll.scrollTop;
  // Once the compact endpoint is crossed, ordinary card scrolling is free.
  if(current>=distance-.75){paint(current);return;}
  if(current<=.75){scroll.scrollTop=0;paint(0);return;}
  const target=ownerMorphEndpoint(current,distance,velocity);
  settleTarget.current=target;
  const fraction=Math.abs(target-current)/Math.max(1,distance);
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration=reduce?0:Math.max(120,Math.min(290,150+fraction*140-Math.min(45,Math.abs(velocity)*48)));
  motion.start(current,target,duration,MORPH_EASING,value=>{
   if(!scroller.current)return;
   // Mark the RAF writer before its native scroll event.
   latestSettleWrite.current=value;
   scroller.current.scrollTop=value;paint(value);
  },()=>{
   if(!scroller.current)return;
   latestSettleWrite.current=null;
   scroller.current.scrollTop=target;paint(target);
  },layoutRevision.current);
 },[clearScrollEnd,paint]);

 useLayoutEffect(()=>{
  const host=root.current,scroll=scroller.current;if(!host||!scroll)return;
  if(!morphMotion.current||morphMotion.current.isDisposed())
   morphMotion.current=new GeometryMotion("sheet",()=>performance.now(),cb=>requestAnimationFrame(cb),id=>cancelAnimationFrame(id),scroll.scrollTop,layoutRevision.current);
  let resizeRaf=0;
  const measure=()=>{
   const rect=host.getBoundingClientRect();if(rect.width<280||rect.height<360)return;
   // Measure a real element: getComputedStyle(custom-property) may return
   // unevaluated max() on Android WebView, so parseFloat() would give NaN.
   const brandY=brandProbe.current?brandProbe.current.getBoundingClientRect().top-rect.top:84;
   const next=createOwnerProfileLayout({width:rect.width,height:rect.height,
    topInset:Math.max(44,brandY),bottomInset:numericToken(host,"--bottom-safe")});
   const previous=layout.current,previousTop=scroll.scrollTop;
   const previousProgress=lastPaintedProgress.current;
   const previousMotion=morphMotion.current?.snapshot();
   layout.current=next;
   layoutRevision.current++;
   host.style.setProperty("--owner-hero-height",`${next.hero.height}px`);
   host.style.setProperty("--owner-hero-bottom",`${next.hero.y+next.hero.height}px`);
   host.style.setProperty("--owner-expanded-tabs-top",`${next.expandedTabsTop}px`);
   host.style.setProperty("--owner-compact-top",`${next.compactContentTop}px`);
   host.style.setProperty("--owner-compact-name-top",`${next.compactAvatar.y+next.compactAvatar.height+8}px`);
   host.style.setProperty("--owner-morph-distance",`${next.morphDistance}px`);
   host.style.setProperty("--owner-content-shift",`${next.contentOffset}px`);
   const extra=Math.max(0,previousTop-previous.morphDistance);
   const nextTop=previousTop<=1?0:previousTop>=previous.morphDistance-.75?
    next.morphDistance+extra:previousProgress*next.morphDistance;
   scroll.scrollTop=nextTop;
   if(previousMotion&&previousMotion.phase!=="idle"){
    const previousTarget=previousMotion.phase==="suspended"?settleTarget.current:previousMotion.target;
    const target=previousTarget<=.75?0:next.morphDistance;
    settleTarget.current=target;
    if(previousMotion.phase==="settling")morphMotion.current?.rebase(layoutRevision.current,nextTop,target);
   }
   paint(scroll.scrollTop);
  };
  const resize=()=>{if(resizeRaf)return;resizeRaf=requestAnimationFrame(()=>{resizeRaf=0;measure();});};
  const onScroll=()=>{
   const now=performance.now(),position=scroll.scrollTop,previous=scrollSample.current;
   const elapsed=now-previous.time;
   const velocity=previous.time>0&&elapsed>0?(position-previous.position)/elapsed:0;
   scrollSample.current={position,time:now,velocity:Number.isFinite(velocity)?velocity:0};
   const settling=morphMotion.current?.snapshot().phase==="settling";
   if(settling){
    const expected=latestSettleWrite.current;
    if(expected!==null&&Math.abs(position-expected)<=1.5)return;
    // A native scroll, programmatic scroll, tab focus or inertia changed the
    // actual coordinate. Cancel stale RAF without restoring its old position.
    morphMotion.current?.cancel();
    latestSettleWrite.current=null;
    paint(position);
   }else schedulePaint();
   if(nativeTouchActive.current)return;
   clearScrollEnd();
   if(position>.75&&position<layout.current.morphDistance-.75)
    scrollEndTimer.current=window.setTimeout(()=>settleMorph(scrollSample.current.velocity),105);
  };
  const onScrollEnd=()=>{if(!nativeTouchActive.current)settleMorph(scrollSample.current.velocity);};
  const onTouchStart=()=>{
   nativeTouchActive.current=true;interruptMorph();
   scrollSample.current={position:scroll.scrollTop,time:performance.now(),velocity:0};
  };
  const onTouchEnd=()=>{nativeTouchActive.current=false;settleMorph(scrollSample.current.velocity);};
  const observer=new ResizeObserver(resize);observer.observe(host);
  scroll.addEventListener("scroll",onScroll,{passive:true});
  scroll.addEventListener("scrollend",onScrollEnd,{passive:true});
  scroll.addEventListener("touchstart",onTouchStart,{passive:true});
  scroll.addEventListener("touchend",onTouchEnd,{passive:true});
  scroll.addEventListener("touchcancel",onTouchEnd,{passive:true});
  window.visualViewport?.addEventListener("resize",resize);
  const web=window.Telegram?.WebApp;
  const viewportChanged=(event?:{isStateStable?:boolean})=>{if(event?.isStateStable!==false)resize();};
  web?.onEvent?.("viewportChanged",viewportChanged);web?.onEvent?.("safeAreaChanged",resize);web?.onEvent?.("contentSafeAreaChanged",resize);
  measure();
  return()=>{
   observer.disconnect();scroll.removeEventListener("scroll",onScroll);
   scroll.removeEventListener("scrollend",onScrollEnd);
   scroll.removeEventListener("touchstart",onTouchStart);
   scroll.removeEventListener("touchend",onTouchEnd);scroll.removeEventListener("touchcancel",onTouchEnd);
   window.visualViewport?.removeEventListener("resize",resize);
   web?.offEvent?.("viewportChanged",viewportChanged);web?.offEvent?.("safeAreaChanged",resize);web?.offEvent?.("contentSafeAreaChanged",resize);
   clearScrollEnd();morphMotion.current?.dispose();
   if(resizeRaf)cancelAnimationFrame(resizeRaf);if(paintRaf.current)cancelAnimationFrame(paintRaf.current);
   resizeRaf=0;paintRaf.current=0;
  };
 },[clearScrollEnd,interruptMorph,paint,schedulePaint,settleMorph]);
 useEffect(()=>bindMotionLifecycle(()=>{
  paused.current=true;clearScrollEnd();latestSettleWrite.current=null;gesture.current=null;gestures.cancel();
  const motion=morphMotion.current;
  if(motion?.snapshot().phase==="settling"){
   settleTarget.current=motion.snapshot().target;motion.suspend();
  }
 },()=>{
  paused.current=false;
  const motion=morphMotion.current;
  if(motion?.snapshot().phase==="suspended"){
   const snapshot=motion.snapshot();
   motion.reveal(layoutRevision.current+1,scroller.current?.scrollTop??snapshot.current,settleTarget.current);
   layoutRevision.current++;
  }else paint(scroller.current?.scrollTop??0);
 }),[clearScrollEnd,gestures,paint]);
 useEffect(()=>()=>{if(!gestureArbiter)localArbiter.current?.dispose();},[gestureArbiter]);
 useLayoutEffect(()=>{
  if(!active||!scroller.current)return;
  interruptMorph();
  scroller.current.scrollTop=0;lastState.current="expanded";
  scrollSample.current={position:0,time:performance.now(),velocity:0};
  selectedPhotoId.current=mainPhoto?.id??null;
  root.current?.setAttribute("data-morph-state","expanded");setHeroIndex(0);setRenderIndex(0);paint(0);
 },[active,interruptMorph,p.id,mainPhoto?.id,paint]);
 useEffect(()=>{
  if(!heroPhoto||!heroImage.current)return;
  const image=heroImage.current;
  image.loading="eager";
  void image.decode?.().catch(()=>{/* onLoad/onError keeps the visible surface authoritative */});
 },[heroPhoto]);

 const selectTab=(next:OwnerTab,focus=false)=>{
  setTab(next);
  requestAnimationFrame(()=>{
   const button=tablist.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(tabPrefix+"-"+next+"-tab")}`);
   if(focus)button?.focus({preventScroll:true});
   // Do not scroll the entire native viewport when moving between tabs.
   if(button&&tablist.current){const r=button.getBoundingClientRect(),t=tablist.current.getBoundingClientRect();
    if(r.left<t.left||r.right>t.right)button.scrollIntoView({block:"nearest",inline:"nearest"});}
  });
 };
 const tabKey=(event:KeyboardEvent<HTMLButtonElement>,index:number)=>{
  const next=event.key==="ArrowRight"?Math.min(tabs.length-1,index+1):
   event.key==="ArrowLeft"?Math.max(0,index-1):event.key==="Home"?0:event.key==="End"?tabs.length-1:-1;
  if(next<0)return;event.preventDefault();selectTab(tabs[next][0],true);
 };
 // Photo swipes keep the existing image element alive. Adjacent photographs
 // are already mounted, so the finger drags real pixels rather than triggering
 // a hard src replacement or a second carousel/morph authority.
 const resetPhotoTrack=()=>{
  for(const el of [heroImage.current,prevImage.current,nextImage.current]){
   if(!el)continue;el.style.removeProperty("transition");el.style.removeProperty("transform");
  }
 };
 const stopPhotoTimer=()=>{
  if(photoSlideTimer.current!==null){window.clearTimeout(photoSlideTimer.current);photoSlideTimer.current=null;}
 };
 const movePhotoTrack=(delta:number,width:number,animated:boolean)=>{
  const transition=animated?"transform 250ms cubic-bezier(.20,.82,.24,1)":"none";
  for(const [el,x] of [[heroImage.current,delta],[prevImage.current,delta-width],
   [nextImage.current,delta+width]] as const){
   if(!el)continue;el.style.transition=transition;
   el.style.transform="translate3d("+x+"px,0,0)";
  }
 };
 useLayoutEffect(()=>{resetPhotoTrack();},[renderIndex]);
 // Preload the neighboring images without adding duplicate <img> nodes:
 // accessibility, the photo viewer, and GPU/image identity still see one hero.
 const preloadPrevious=previousPhoto?.src,preloadNext=nextPhoto?.src;
 useEffect(()=>{
  let cancelled=false;
  for(const [photo,target] of [[previousPhoto,prevImage],[nextPhoto,nextImage]] as const){
   if(!photo)continue;
   const image=new Image();
   const applyFocus=()=>{
    if(cancelled||!target.current)return;
    const point=resolvePhotoFocus(image.naturalWidth,image.naturalHeight,photo.focalPoint);
    target.current.style.backgroundPosition=(point.x*100)+"% "+(point.y*100)+"%";
   };
   image.onload=applyFocus;image.src=photo.src;
   void image.decode?.().then(applyFocus).catch(()=>{/* the visible hero retains its own fallback */});
  }
  return()=>{cancelled=true;};
 },[preloadPrevious,preloadNext,previousPhoto,nextPhoto]);
 useEffect(()=>()=>{if(photoSlideTimer.current!==null)window.clearTimeout(photoSlideTimer.current);},[]);
 const choosePhoto=(index:number)=>{
  stopPhotoTimer();resetPhotoTrack();
  selectedPhotoId.current=photos[index]?.id??null;
  setHeroIndex(index);setRenderIndex(index);
 };
 useLayoutEffect(()=>{
  stopPhotoTimer();resetPhotoTrack();
  const selected=selectedPhotoId.current;
  const preserved=selected?photos.findIndex(photo=>photo.id===selected):-1;
  const next=preserved>=0?preserved:0;
  selectedPhotoId.current=photos[next]?.id??null;
  setHeroIndex(next);setRenderIndex(next);
 },[photoSignature,photos]);
 const finishCandidates=(current:ProfileGesture)=>{
  if(current.source==="photo"){
   gestures.finishCandidate(current.serial,"hero");gestures.finishCandidate(current.serial,"sheet");
  }else{
   gestures.finishCandidate(current.serial,"tabs");gestures.finishCandidate(current.serial,"native");
  }
 };
 const profileDown=(source:ProfileGesture["source"])=>(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(!event.isPrimary){
   gestures.secondFinger();gesture.current=null;stopPhotoTimer();resetPhotoTrack();settleMorph(0);return;
  }
  if(event.pointerType==="mouse"&&event.button!==0)return;
  if(source==="pages"&&(event.target as HTMLElement).closest("button,a,input,textarea,select"))return;
  interruptMorph();
  if(source==="photo"&&photoSlideTimer.current!==null){stopPhotoTimer();setRenderIndex(heroIndex);resetPhotoTrack();}
  const primary=source==="photo"?"hero":"tabs";
  const secondary=source==="photo"?"sheet":"native";
  const serial=gestures.begin("pointer",event.pointerId,primary);
  if(serial===null)return;
  gestures.begin("pointer",event.pointerId,secondary);
  const position=scroller.current?.scrollTop??0,time=performance.now();
  gesture.current={id:event.pointerId,serial,source,axis:null,x:event.clientX,y:event.clientY,
   startScroll:position,width:mask.current?.clientWidth??393,captured:false,
   samples:[{position,time}]};
 };
 const profileMove=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const current=gesture.current;if(!current||current.id!==event.pointerId)return;
  const dx=event.clientX-current.x,dy=event.clientY-current.y;
  if(!current.axis){
   if(Math.max(Math.abs(dx),Math.abs(dy))<9)return;
   current.axis=Math.abs(dx)>Math.abs(dy)*1.2?"horizontal":
    Math.abs(dy)>Math.abs(dx)*1.2?"vertical":null;
   if(!current.axis)return;
   const owner=current.axis==="horizontal"?(current.source==="photo"?"hero":"tabs"):
    (current.source==="photo"?"sheet":"native");
   const claimed=owner==="native"?gestures.nativeScroll(current.serial):gestures.claim(owner,current.serial);
   if(!claimed){gesture.current=null;return;}
   current.samples=[{position:current.axis==="horizontal"?event.clientX:current.startScroll,time:performance.now()}];
   if(owner!=="native"){
    try{event.currentTarget.setPointerCapture(event.pointerId);current.captured=true;}catch{/* older WebView */}
   }
  }
  if(current.axis==="vertical"&&current.source==="pages")return;
  if(event.cancelable)event.preventDefault();
  if(current.axis==="vertical"&&scroller.current){
   const position=Math.max(0,current.startScroll-dy);
   scroller.current.scrollTop=position;paint(position);
   current.samples.push({position,time:performance.now()});
  }else if(current.axis==="horizontal"){
   current.samples.push({position:event.clientX,time:performance.now()});
   if(current.source==="photo"){
    const available=dx<0?renderIndex<photos.length-1:renderIndex>0;
    movePhotoTrack(available?dx:dx*.2,current.width,false);
   }
  }
  if(current.samples.length>10)current.samples.shift();
 };
 const profileEnd=(event:ReactPointerEvent<HTMLDivElement>,cancelled=false)=>{
  const current=gesture.current;if(!current||current.id!==event.pointerId)return;
  gesture.current=null;
  const dx=event.clientX-current.x,dy=event.clientY-current.y;
  if(current.captured){
   try{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}catch{/* old WebView */}
  }
  if(current.axis==="vertical"&&current.source==="photo"){
   suppressPhotoClick.current=true;
   const position=Math.max(0,current.startScroll-dy);
   if(scroller.current)scroller.current.scrollTop=position;
   gestures.finish("sheet",current.serial);
   settleMorph(cancelled?0:recentVelocity([...current.samples,{position,time:performance.now()}]));
  }else if(current.axis==="horizontal"&&current.source==="photo"){
   suppressPhotoClick.current=true;
   gestures.finish("hero",current.serial);
   const velocity=recentVelocity([...current.samples,{position:event.clientX,time:performance.now()}]);
   const direction=dx<0||(!dx&&velocity<0)?-1:1;
   const target=renderIndex+(direction<0?1:-1);
   const valid=!cancelled&&target>=0&&target<photos.length&&
    (Math.abs(dx)>Math.max(38,current.width*.18)||Math.abs(velocity)>.55);
   if(valid){selectedPhotoId.current=photos[target]?.id??null;setHeroIndex(target);}
   movePhotoTrack(valid?direction*current.width:0,current.width,true);
   stopPhotoTimer();
   photoSlideTimer.current=window.setTimeout(()=>{
    photoSlideTimer.current=null;if(valid)setRenderIndex(target);else resetPhotoTrack();
   },250);
  }else if(current.axis==="horizontal"&&current.source==="pages"){
   gestures.finish("tabs",current.serial);
   if(!cancelled&&Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.2){
    const index=tabs.findIndex(item=>item[0]===tab);
    selectTab(tabs[Math.max(0,Math.min(tabs.length-1,index+(dx<0?1:-1)))][0]);
   }
  }else if(current.axis==="vertical"){
   gestures.finish("native",current.serial);settleMorph(scrollSample.current.velocity);
  }else finishCandidates(current);
  if(suppressPhotoClick.current)requestAnimationFrame(()=>{suppressPhotoClick.current=false;});
 };
 const showPhotos=()=>{
  selectTab("photos");
  const target=layout.current.morphDistance+110;
  if(scroller.current){interruptMorph();scroller.current.scrollTop=target;paint(target);}
 };

 return <section ref={root} className="owner-premium-profile" data-morph-state="expanded"
  data-mode={isOwner?"owner":"visitor"} aria-label={isOwner?"Мой профиль":"Профиль"}>
  <div className="owner-profile-backdrop" aria-hidden="true"/>
  <div ref={brandProbe} className="owner-profile-brand-probe" aria-hidden="true"/>
  <div ref={compactBackdrop} className="owner-profile-compact-backdrop" aria-hidden="true">
   {heroPhoto&&<img src={heroPhoto.src} alt="" draggable={false} decoding="async"/>}
   <div className="owner-profile-compact-tint"/>
  </div>
  <div ref={mask} className="owner-profile-photo-mask" role={heroPhoto?"button":undefined}
    tabIndex={heroPhoto?0:-1} aria-label={heroPhoto?"Открыть фотографию профиля":undefined}
    onKeyDown={event=>{if(heroPhoto&&(event.key==="Enter"||event.key===" ")){
     event.preventDefault();onPhotoOpen(heroPhoto.id,heroImage.current);
    }}}
    onPointerDown={profileDown("photo")} onPointerMove={profileMove}
    onPointerUp={event=>profileEnd(event)} onPointerCancel={event=>profileEnd(event,true)}
    onLostPointerCapture={event=>profileEnd(event,true)}>
   {heroPhoto?<img ref={heroImage} data-photo-id={heroPhoto.id} src={heroPhoto.src}
    alt={"Фото профиля "+p.name} draggable={false} loading="eager" decoding="async" fetchPriority="high"
    style={{objectPosition:(resolvePhotoFocus(1,2,heroPhoto.focalPoint).x*100)+"% "+(resolvePhotoFocus(1,2,heroPhoto.focalPoint).y*100)+"%"}}
    onLoad={event=>{const point=resolvePhotoFocus(event.currentTarget.naturalWidth,event.currentTarget.naturalHeight,heroPhoto.focalPoint);
     event.currentTarget.style.objectPosition=(point.x*100)+"% "+(point.y*100)+"%";}}
    onClick={()=>{if(!suppressPhotoClick.current)onPhotoOpen(heroPhoto.id,heroImage.current);}}
    onError={event=>{if(heroPhoto.fallback&&event.currentTarget.src!==heroPhoto.fallback)event.currentTarget.src=heroPhoto.fallback;}}/>:
    <div className="owner-profile-photo-empty"><UserRound size={42}/><span>Фото пока нет</span></div>}
   {previousPhoto&&<div ref={prevImage} className="owner-profile-photo-adjacent previous" aria-hidden="true"
    style={{backgroundImage:"url("+JSON.stringify(previousPhoto.src)+")",
     backgroundPosition:(resolvePhotoFocus(1,2,previousPhoto.focalPoint).x*100)+"% "+(resolvePhotoFocus(1,2,previousPhoto.focalPoint).y*100)+"%"}}/>}
   {nextPhoto&&<div ref={nextImage} className="owner-profile-photo-adjacent next" aria-hidden="true"
    style={{backgroundImage:"url("+JSON.stringify(nextPhoto.src)+")",
     backgroundPosition:(resolvePhotoFocus(1,2,nextPhoto.focalPoint).x*100)+"% "+(resolvePhotoFocus(1,2,nextPhoto.focalPoint).y*100)+"%"}}/>}
   <div ref={shade} className="owner-profile-photo-shade" aria-hidden="true"/>
  </div>
  {photos.length>1&&<div ref={pager} className="owner-profile-photo-pager" aria-label="Фотографии">
   {photos.map((photo,index)=><button key={photo.id} type="button" className={index===heroIndex?"active":""}
    aria-label={"Показать фото "+(index+1)} aria-current={index===heroIndex?"true":undefined}
    onClick={()=>choosePhoto(index)}/>)}
  </div>}
  <div className="owner-profile-brand" translate="no">
   <img src="/assets/brand/wordmark_original_raster_alpha_W06.webp" alt="LUEMI" decoding="async"/>
  </div>
  <header className="owner-profile-topbar">
   <button type="button" className="owner-profile-glass owner-profile-back" onClick={onBack} aria-label="Назад"><ArrowLeft/></button>
   {isOwner&&<button ref={topEdit} type="button" className="owner-profile-glass owner-profile-edit-top" onClick={onEdit} aria-label="Редактировать профиль">
    <PenLine size={18}/>
   </button>}
  </header>
  <div ref={expandedIdentity} className="owner-profile-expanded-identity">
   <h1>{p.name||"Имя не указано"}{p.age!==null?", "+p.age:""}</h1>
   <p><MapPin size={15} aria-hidden="true"/>{location}</p>
  </div>

  <div ref={compactIdentity} className="owner-profile-compact-identity" aria-hidden="true">
   <strong>{p.name||"Имя не указано"}{p.age!==null?", "+p.age:""}</strong>
   <span><MapPin size={13} aria-hidden="true"/>{location}</span>
  </div>
  <div ref={scroller} className="owner-profile-scroll">
   <div className="owner-profile-hero-spacer" aria-hidden="true"/>
   <main className="owner-profile-content">
    <div ref={tablist} className="owner-profile-tabs" role="tablist" aria-label="Разделы профиля">
     {tabs.map(([id,label],index)=><button type="button" role="tab" key={id}
      id={tabPrefix+"-"+id+"-tab"} aria-controls={tabPrefix+"-"+id+"-panel"}
      aria-selected={tab===id} tabIndex={tab===id?0:-1}
      onClick={()=>selectTab(id)} onKeyDown={event=>tabKey(event,index)}>{label}</button>)}
    </div>
    <div ref={flow} className="owner-profile-flow">
    <div className="owner-profile-pages" onPointerDown={profileDown("pages")} onPointerMove={profileMove}
      onPointerUp={event=>profileEnd(event)} onPointerCancel={event=>profileEnd(event,true)}
      onLostPointerCapture={event=>profileEnd(event,true)}>
     <section id={tabPrefix+"-about-panel"} role="tabpanel" aria-labelledby={tabPrefix+"-about-tab"}
      aria-label="О себе" hidden={tab!=="about"} className="owner-profile-panel owner-profile-about">
      <article><h2>О себе</h2><p>{p.about||"Описание пока не заполнено."}</p></article>
      <article><h2>Основное</h2><div className="owner-profile-basics">
       {p.age!==null&&<div><CalendarDays size={18} aria-hidden="true"/><span>{p.age} лет</span></div>}
       <div><MapPin size={18} aria-hidden="true"/><span>{location}</span></div>
      </div>
      {goal&&<div className="owner-profile-goal"><Heart size={16} aria-hidden="true"/>{goalText}</div>}
      {details.length>0&&<dl>{details.map(item=><div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>}</article>
      {p.interests.length>0&&<article><h2>Интересы</h2><div className="owner-profile-interests">{p.interests.map(id=><InterestChip key={id} id={id}/>)}</div></article>}

      {p.source==="fixture"&&<p className="owner-profile-disclaimer">Демонстрационный профиль, не реальный пользователь.</p>}
     </section>
     <section id={tabPrefix+"-photos-panel"} role="tabpanel" aria-labelledby={tabPrefix+"-photos-tab"}
      aria-label="Фото" hidden={tab!=="photos"} className="owner-profile-panel">
      {photos.length?<div className="owner-profile-gallery">{photos.map((photo,index)=><button type="button" key={photo.id}
       className="owner-profile-photo-tile" aria-label={"Открыть фото "+(index+1)}
       onClick={event=>onPhotoOpen(photo.id,event.currentTarget.querySelector("img"))}>
       <img data-photo-id={photo.id} src={photo.src} alt="" draggable={false} loading="lazy" decoding="async"
        onError={event=>{if(photo.fallback&&event.currentTarget.src!==photo.fallback)event.currentTarget.src=photo.fallback;}}/>
       {index===0&&<span>Главное</span>}
      </button>)}</div>:<div className="owner-profile-empty"><Images/><p>Фотографии ещё не добавлены</p></div>}
     </section>
     <section id={tabPrefix+"-bliki-panel"} role="tabpanel" aria-labelledby={tabPrefix+"-bliki-tab"}
      aria-label="Блики" hidden={tab!=="bliki"} className="owner-profile-panel">
      <div className="owner-profile-empty"><Sparkles size={34}/><h2>Пока нет бликов</h2><p>Здесь появятся моменты из жизни.</p></div>
     </section>
     <section id={tabPrefix+"-gifts-panel"} role="tabpanel" aria-labelledby={tabPrefix+"-gifts-tab"}
      aria-label="Подарки" hidden={tab!=="gifts"} className="owner-profile-panel">
      <div className="owner-profile-empty"><Gift size={34}/><h2>Подарков пока нет</h2><p>Здесь будут отображаться полученные подарки.</p></div>
     </section>
    </div>
      {isOwner&&<div className="owner-profile-actions" aria-label="Действия профиля">
       <button type="button" className="owner-profile-glass" onClick={onEdit} aria-label="Изменить данные"><PenLine/></button>
       <button type="button" className="owner-profile-glass" onClick={onPreview} aria-label="Посмотреть анкету глазами других"><Eye/></button>
       <button type="button" className="owner-profile-glass" onClick={showPhotos} aria-label="Управлять фотографиями"><Images/></button>
       <button type="button" className="owner-profile-glass" onClick={onSettings} aria-label="Настройки профиля"><Settings2/></button>
      </div>}
    </div>
   </main>
  </div>
 </section>;
}
