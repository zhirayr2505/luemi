import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {BadgeCheck,ChevronRight,ChevronUp,Heart,MapPin,MoreHorizontal,Star,X} from "lucide-react";
import {goals} from "../registration/model";
import {goalLabel} from "../ui/PersonalizedCopy";
import {PhotoCarousel} from "../ui/PhotoCarousel";
import type {PhotoCarouselHandle} from "../ui/PhotoCarousel";
import {InterestChip} from "../ui/InterestCatalog";
import {languages} from "../ui/Languages";
import {impactHaptic,selectionHaptic} from "../ui/haptic";
import type {DemoKind,DemoPerson} from "./model";

const clamp=(value:number,min=0,max=1)=>Math.max(min,Math.min(max,value));
const revealStage=(p:number,start:number,end:number)=>clamp((p-start)/(end-start));
const countryName=(code:string,fallback:string)=>{
 if(fallback)return fallback;
 try{return new Intl.DisplayNames(["ru"],{type:"region"}).of(code.toUpperCase())??code.toUpperCase();}
 catch{return code.toUpperCase();}
};
const distanceLabel=(distance:number|null|undefined,real:boolean)=>{
 if(typeof distance!=="number"||!Number.isFinite(distance)||distance<0)return "";
 const value=distance<1?"< 1":Math.round(distance).toLocaleString("ru");
 return `${real?"":"≈ "}${value} км${real?"":" · демо"}`;
};

type ExpandGesture={id:number;x:number;y:number;started:number;axis:"pending"|"photo"|"info"|"scroll";
 startProgress:number;scrollStart:number;samples:Array<{y:number;t:number}>};
type SettleRun={from:number;to:0|1;started:number;duration:number;frame:number|null};
type PhotoHold={id:number;x:number;y:number;timer:number|null;active:boolean;host:HTMLElement|null};
type ActionFeedback={kind:"pass"|"like"|"special";token:number};

function LikeSuperButton({disabled,onAction}:{disabled:boolean;onAction:(kind:"like"|"special")=>void}){
 const button=useRef<HTMLButtonElement>(null);
 const gesture=useRef<null|{id:number;x:number;y:number;started:number;claimed:boolean;threshold:boolean;max:number;lastX:number;lastT:number;velocity:number}>(null);
 const frame=useRef<number|null>(null),pending=useRef(0),committed=useRef(false);
 useEffect(()=>{if(!disabled){committed.current=false;paint(0);
  button.current?.classList.remove("is-dragging","is-armed","is-bursting");}},[disabled]);
 useEffect(()=>()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);},[]);
 const paint=(value:number)=>button.current?.style.setProperty("--like-slide-p",String(clamp(value)));
 const schedule=(value:number)=>{pending.current=value;if(frame.current!==null)return;
  frame.current=requestAnimationFrame(()=>{frame.current=null;paint(pending.current);});};
 const reset=()=>{if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null;}paint(0);
  button.current?.classList.remove("is-dragging","is-armed");};
 const commit=(kind:"like"|"special")=>{if(committed.current||disabled)return;
  committed.current=true;
  if(kind==="special"){button.current?.classList.add("is-bursting");impactHaptic("heavy");}
  else selectionHaptic();
  onAction(kind);
 };
 const down=(event:ReactPointerEvent<HTMLButtonElement>)=>{
  if(disabled||committed.current||!event.isPrimary||(event.pointerType==="mouse"&&event.button!==0))return;
  const width=event.currentTarget.getBoundingClientRect().width;
  const max=Math.max(1,width-58);event.currentTarget.style.setProperty("--like-travel",max+"px");
  const now=performance.now();
  gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,started:now,claimed:false,threshold:false,max,lastX:event.clientX,lastT:now,velocity:0};
 };
 const move=(event:ReactPointerEvent<HTMLButtonElement>)=>{
  const current=gesture.current;if(!current||current.id!==event.pointerId)return;
  const dx=Math.max(0,event.clientX-current.x),dy=event.clientY-current.y;
  if(!current.claimed){
   if(Math.max(dx,Math.abs(dy))<7)return;
   if(event.clientX<current.x||Math.abs(dy)>Math.max(14,dx*1.55)){gesture.current=null;reset();return;}
   current.claimed=true;event.currentTarget.classList.add("is-dragging");
   try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* old WebView */}
  }
  if(event.cancelable)event.preventDefault();event.stopPropagation();
  const now=performance.now();
  current.velocity=(event.clientX-current.lastX)/Math.max(1,now-current.lastT);
  current.lastX=event.clientX;current.lastT=now;
  const raw=clamp(dx/current.max),resisted=raw<.72?raw:Math.min(1,.72+(raw-.72)*.7);
  schedule(resisted);
  const armed=raw>=.72;
  if(armed!==current.threshold){
   current.threshold=armed;event.currentTarget.classList.toggle("is-armed",armed);
   if(armed)impactHaptic("medium");
  }
 };
 const finish=(event:ReactPointerEvent<HTMLButtonElement>,cancelled=false)=>{
  const current=gesture.current;if(!current||current.id!==event.pointerId)return;gesture.current=null;
  if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null;paint(pending.current);}
  const dx=event.clientX-current.x,dy=event.clientY-current.y;
  const speed=Math.max(current.velocity,dx/Math.max(1,performance.now()-current.started));
  try{
   if(!cancelled&&current.claimed&&(dx>=current.max*.72||(dx>=current.max*.48&&speed>.72))){
    commit("special");paint(1);button.current?.classList.remove("is-dragging","is-armed");
   }else{
    if(!cancelled&&!current.claimed&&Math.abs(dx)<8&&Math.abs(dy)<10&&
     performance.now()-current.started<420)commit("like");
    reset();
   }
  }finally{
   try{if(event.currentTarget.hasPointerCapture(event.pointerId))
    event.currentTarget.releasePointerCapture(event.pointerId);}catch{/* implicit release */}
  }
 };
 return <button ref={button} type="button" className="moonstone-like-button" disabled={disabled}
  aria-label="Нравится. Проведи вправо для особенной симпатии"
  onPointerDown={down} onPointerMove={move} onPointerUp={event=>finish(event)}
  onPointerCancel={event=>finish(event,true)} onLostPointerCapture={event=>finish(event,true)}
  onAnimationEnd={event=>{if(event.animationName==="moonstone-button-star-burst")button.current?.classList.remove("is-bursting");}}
  onClick={event=>{if(event.detail===0)commit("like");}}>
  <span className="moonstone-like-glint" aria-hidden="true"/>
  <span className="moonstone-like-thumb" aria-hidden="true"><Heart/><Star className="moonstone-super-star"/>
   <span className="moonstone-super-particles">{Array.from({length:14},(_,index)=><i key={index}><Star/></i>)}</span>
  </span>
  <span className="moonstone-like-copy">Нравится</span>
  <span className="moonstone-like-arrows" aria-hidden="true"><ChevronRight/><ChevronRight/></span>
 </button>;
}

/** Moonstone V6 fullscreen discovery surface. The keyed card remains mounted during deck transitions. */
export function FeedCard({person,saved:_,canUndo:__,active,busy,onAction,onOpenProfile,onInterests:___,
 onExitDemo,onCoverReady,real=false,onMore,demoDistanceKm}:{
 person:DemoPerson;saved:boolean;canUndo:boolean;active:boolean;busy:boolean;
 onAction:(kind:DemoKind|"undo")=>void;onOpenProfile:()=>void;onInterests:()=>void;
 real?:boolean;onMore?:()=>void;onExitDemo?:()=>void;onCoverReady?:()=>void;demoDistanceKm?:number;
}){
 const goal=goals.find(item=>item.id===person.goal);
 const [expanded,setExpanded]=useState(false),[activePhotoIndex,setActivePhotoIndex]=useState(0);
 const [adaptiveSources,setAdaptiveSources]=useState<{personId:string;sources:Record<number,string>}>({personId:person.id,sources:{}});
 const [actionFeedback,setActionFeedback]=useState<ActionFeedback|null>(null);
 const card=useRef<HTMLElement>(null),drawer=useRef<HTMLDivElement>(null),scroll=useRef<HTMLDivElement>(null);
 const photo=useRef<PhotoCarouselHandle>(null),gesture=useRef<ExpandGesture|null>(null);
 const photoHold=useRef<PhotoHold|null>(null),actionLocked=useRef(false),feedbackTimer=useRef<number|null>(null);
 const progress=useRef(0),target=useRef<0|1>(0),travel=useRef(310),run=useRef<SettleRun|null>(null);
 const fingerFrame=useRef<number|null>(null),fingerValue=useRef(0),blockClickUntil=useRef(0);
 const available=active&&!busy;
 const location=useMemo(()=>[person.city,countryName(person.countryCode,person.country)].filter(Boolean).join(", "),[person.city,person.country,person.countryCode]);
 const distance=distanceLabel(real?person.distanceKm:demoDistanceKm,real);
 const rememberAdaptiveSource=useCallback((index:number,source:string)=>{
  setAdaptiveSources(current=>current.personId===person.id?
   {...current,sources:{...current.sources,[index]:source}}:{personId:person.id,sources:{[index]:source}});
 },[person.id]);
 const currentPhotoIndex=Math.min(activePhotoIndex,Math.max(0,person.photos.length-1));
 const currentPhoto=(adaptiveSources.personId===person.id?adaptiveSources.sources[currentPhotoIndex]:undefined)??person.photos[currentPhotoIndex]?.src;
 const languageNames=person.languages.map(id=>languages.find(item=>item.id===id)?.name??id).filter(Boolean);
 const releasePhotoHold=(pointerId?:number,keepCapture=false)=>{
  const hold=photoHold.current;if(!hold||(pointerId!==undefined&&hold.id!==pointerId))return false;
  if(hold.timer!==null)window.clearTimeout(hold.timer);
  if(hold.host)delete hold.host.dataset.photoFocus;
  if(hold.active&&!keepCapture)try{if(card.current?.hasPointerCapture(hold.id))card.current.releasePointerCapture(hold.id);}catch{/* implicit release */}
  photoHold.current=null;return hold.active;
 };
 const armPhotoHold=(event:ReactPointerEvent<HTMLElement>)=>{
  if(!(event.target as Element).closest(".moonstone-photo")||
   (event.target as Element).closest("button,a"))return;
  releasePhotoHold();
  const host=card.current?.closest<HTMLElement>(".discovery-app")??null;
  const hold:PhotoHold={id:event.pointerId,x:event.clientX,y:event.clientY,timer:null,active:false,host};
  hold.timer=window.setTimeout(()=>{
   if(photoHold.current!==hold||!available)return;
   hold.timer=null;hold.active=true;gesture.current=null;
   if(host)host.dataset.photoFocus="true";
   blockClickUntil.current=performance.now()+360;selectionHaptic();
   try{card.current?.setPointerCapture(event.pointerId);}catch{/* old WebView */}
  },210);
  photoHold.current=hold;
 };
 const performAction=(kind:"pass"|"like"|"special")=>{
  if(actionLocked.current||!available)return;
  actionLocked.current=true;
  const feedback={kind,token:performance.now()};setActionFeedback(feedback);
  if(feedbackTimer.current!==null)window.clearTimeout(feedbackTimer.current);
  feedbackTimer.current=window.setTimeout(()=>{
   setActionFeedback(current=>current?.token===feedback.token?null:current);
   actionLocked.current=false;feedbackTimer.current=null;
  },900);
  onAction(kind);
 };
 const paint=(next:number)=>{
  const value=progress.current=clamp(next),element=card.current;
  if(element){
   element.style.setProperty("--profile-p",String(value));
   element.style.setProperty("--profile-main-p",String(revealStage(value,.05,.30)));
   element.style.setProperty("--profile-goal-p",String(revealStage(value,.12,.42)));
   element.style.setProperty("--profile-about-p",String(revealStage(value,.22,.55)));
   element.style.setProperty("--profile-text-p",String(revealStage(value,.32,.70)));
   element.style.setProperty("--profile-interests-p",String(revealStage(value,.52,.85)));
   element.style.setProperty("--profile-extra-p",String(revealStage(value,.65,1)));
  }
  if(drawer.current)drawer.current.inert=value<.98;
 };
 const freeze=()=>{const current=run.current;if(!current)return;if(current.frame!==null)cancelAnimationFrame(current.frame);
  const t=clamp((performance.now()-current.started)/current.duration);run.current=null;
  paint(current.from+(current.to-current.from)*(1-Math.pow(1-t,3)));};
 const settle=(next:0|1)=>{
  freeze();target.current=next;
  if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches||Math.abs(progress.current-next)<.002){
   paint(next);setExpanded(next===1);if(scroll.current)scroll.current.style.overflowY=next?"auto":"hidden";return;
  }
  if(scroll.current)scroll.current.style.overflowY="hidden";
  const motion:SettleRun={from:progress.current,to:next,started:performance.now(),duration:230+Math.abs(next-progress.current)*90,frame:null};
  run.current=motion;
  const tick=(now:number)=>{if(run.current!==motion)return;const t=clamp((now-motion.started)/motion.duration);
   paint(motion.from+(motion.to-motion.from)*(1-Math.pow(1-t,3)));
   if(t>=1){run.current=null;paint(next);setExpanded(next===1);if(scroll.current)scroll.current.style.overflowY=next?"auto":"hidden";}
   else motion.frame=requestAnimationFrame(tick);};
  motion.frame=requestAnimationFrame(tick);
 };
 const scheduleFinger=(value:number)=>{fingerValue.current=value;if(fingerFrame.current!==null)return;
  fingerFrame.current=requestAnimationFrame(()=>{fingerFrame.current=null;paint(fingerValue.current);});};
 const flushFinger=()=>{if(fingerFrame.current!==null){cancelAnimationFrame(fingerFrame.current);fingerFrame.current=null;}paint(fingerValue.current);};
 useLayoutEffect(()=>{
  const element=card.current;if(!element)return;
  const photoController=photo.current;
  const measure=()=>{travel.current=Math.max(220,Math.min(420,element.clientHeight*.48));};measure();
  const observer=new ResizeObserver(measure);observer.observe(element);
  return()=>{observer.disconnect();photoController?.cancel();releasePhotoHold();
   if(feedbackTimer.current!==null)window.clearTimeout(feedbackTimer.current);
   if(fingerFrame.current!==null)cancelAnimationFrame(fingerFrame.current);
   const motion=run.current;if(motion&&motion.frame!==null)cancelAnimationFrame(motion.frame);};
 },[person.id]);
 useEffect(()=>{paint(0);target.current=0;actionLocked.current=false;setExpanded(false);setActionFeedback(null);
  releasePhotoHold();gesture.current=null;
  card.current?.classList.remove("is-profile-dragging");if(scroll.current)scroll.current.scrollTop=0;},[person.id]);
 useEffect(()=>{
  if(!available){releasePhotoHold();gesture.current=null;photo.current?.cancel();card.current?.classList.remove("is-profile-dragging");}
 },[available,person.id]);
 useEffect(()=>{
  const resetHold=()=>{releasePhotoHold();gesture.current=null;photo.current?.cancel();card.current?.classList.remove("is-profile-dragging");};
  const onVisibility=()=>{if(document.hidden)resetHold();};
  window.addEventListener("blur",resetHold);document.addEventListener("visibilitychange",onVisibility);
  return()=>{window.removeEventListener("blur",resetHold);document.removeEventListener("visibilitychange",onVisibility);};
 },[]);
 const down=(event:ReactPointerEvent<HTMLElement>)=>{
  if(!available||!event.isPrimary||(event.pointerType==="mouse"&&event.button!==0))return;
  const element=event.target as Element;
  if(element.closest("button,a,input,textarea,select,[contenteditable]"))return;
  armPhotoHold(event);
  gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,started:performance.now(),axis:"pending",
   startProgress:progress.current,scrollStart:scroll.current?.scrollTop??0,samples:[{y:event.clientY,t:performance.now()}]};
 };
 const move=(event:ReactPointerEvent<HTMLElement>)=>{
  const hold=photoHold.current;
  if(hold?.id===event.pointerId){
   const moved=Math.hypot(event.clientX-hold.x,event.clientY-hold.y);
   if(hold.active&&moved<=10){if(event.cancelable)event.preventDefault();event.stopPropagation();return;}
   if(moved>7){
    releasePhotoHold(event.pointerId,true);
    if(hold.active){
     const now=performance.now();
     gesture.current={id:event.pointerId,x:hold.x,y:hold.y,started:now,axis:"pending",
      startProgress:progress.current,scrollStart:scroll.current?.scrollTop??0,samples:[{y:hold.y,t:now}]};
    }
   }
  }
  const current=gesture.current;if(!current||current.id!==event.pointerId)return;
  let dy=event.clientY-current.y;const dx=event.clientX-current.x;
  if(current.axis==="pending"){
   if(Math.max(Math.abs(dx),Math.abs(dy))<7)return;
   const inInfo=!!(event.target as Element).closest(".moonstone-compact-info,.moonstone-profile-drawer,.moonstone-profile-gesture-zone");
   if(Math.abs(dx)>Math.abs(dy)*1.15){
    if(dx>0&&current.x<26){gesture.current=null;return;}
    const carousel=photo.current;
    if(!carousel?.canAdvance(dx<0?1:-1)){gesture.current=null;return;}
    current.axis="photo";carousel.begin(current.id,current.x,current.y,current.started);
   }else if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)*1.35&&(inInfo||progress.current>0)){
    freeze();current.startProgress=progress.current;
    current.axis=progress.current>.99&&!!(event.target as Element).closest(".moonstone-profile-scroll")&&
     (dy<0||current.scrollStart>0)?"scroll":"info";
    if(current.axis==="info"){current.y=event.clientY;dy=0;card.current?.classList.add("is-profile-dragging");}
   }else return;
   blockClickUntil.current=performance.now()+320;
   try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* old WebView */}
  }
  if(event.cancelable)event.preventDefault();event.stopPropagation();
  if(current.axis==="photo")photo.current?.move(current.id,event.clientX,event.clientY);
  else if(current.axis==="scroll"){
   if(scroll.current)scroll.current.scrollTop=Math.max(0,current.scrollStart-dy);
   if(dy>current.scrollStart){current.axis="info";current.y+=current.scrollStart;current.startProgress=progress.current;}
  }else if(current.axis==="info"){
   scheduleFinger(current.startProgress-dy/travel.current);const now=performance.now();current.samples.push({y:event.clientY,t:now});
   if(current.samples.length>8)current.samples.shift();
  }
 };
 const finish=(event:ReactPointerEvent<HTMLElement>,cancelled=false)=>{
  const held=releasePhotoHold(event.pointerId);
  if(held){gesture.current=null;if(event.cancelable)event.preventDefault();event.stopPropagation();return;}
  const current=gesture.current;if(!current||current.id!==event.pointerId)return;gesture.current=null;
  if(current.axis==="photo")photo.current?.finish(current.id,event.clientX,cancelled);
  if(current.axis!=="info")return;flushFinger();card.current?.classList.remove("is-profile-dragging");
  if(cancelled){settle(target.current);return;}
  const now=performance.now();let sample=current.samples[current.samples.length-1];
  for(let i=current.samples.length-2;i>=0&&now-current.samples[i].t<90;i--)sample=current.samples[i];
  const velocity=(event.clientY-sample.y)/Math.max(1,now-sample.t);
  paint(current.startProgress-(event.clientY-current.y)/travel.current);
  settle((Math.abs(velocity)>.42?velocity<0:progress.current-velocity*.16>=.5)?1:0);
 };
 return <div className="discovery-deck-current moonstone-feed" aria-hidden={!active}>
  <article ref={card} className="moonstone-feed-card" data-expanded={expanded}
   onPointerDownCapture={down} onPointerMoveCapture={move} onPointerUpCapture={event=>finish(event)}
   onPointerCancelCapture={event=>finish(event,true)} onLostPointerCapture={event=>{if(event.target===event.currentTarget)finish(event,true);}}
   onClickCapture={event=>{if(performance.now()<blockClickUntil.current){event.preventDefault();event.stopPropagation();}}}>
   <div className="moonstone-photo">
    <PhotoCarousel ref={photo} photos={person.photos} name={person.name} age={person.age} externalGesture
     prioritize={active} gpuSafe onCoverReady={onCoverReady} adaptiveFullscreen
     onResolvedSource={rememberAdaptiveSource} onIndexChange={setActivePhotoIndex}/>
    {currentPhoto&&<img className="moonstone-blur-photo" src={currentPhoto} alt="" aria-hidden="true" decoding="async"/>}
    <div className="moonstone-photo-shade" aria-hidden="true"/>
    {!real&&(onExitDemo?<button type="button" className="moonstone-demo-label" onClick={onExitDemo}>Демо</button>:<span className="moonstone-demo-label">Демо</span>)}
   </div>
   <div className="moonstone-compact-info">
    <div className="moonstone-indicator-row">
     <div className="moonstone-photo-indicator" aria-label={`Фото ${activePhotoIndex+1} из ${person.photos.length}`}>
      {person.photos.map((item,index)=><i key={item.id} className={index===activePhotoIndex?"active":""}/>) }
     </div>
     <button type="button" className="moonstone-profile-toggle" disabled={!available} aria-expanded={expanded}
      aria-label={expanded?"Свернуть анкету":"Раскрыть анкету"} onClick={()=>settle(target.current===1?0:1)}>
      <ChevronUp/>
     </button>
    </div>
    <button type="button" className="moonstone-name" disabled={!available} onClick={onOpenProfile}>
     <span>{person.name}, {person.age}</span>{person.verified&&<BadgeCheck aria-label="Профиль подтверждён"/>}
    </button>
    <div className="moonstone-location"><MapPin/><span>{location}</span>{distance&&<><b>·</b><span>{distance}</span></>}</div>
    {goal&&<div className="moonstone-goal"><Heart/>{goalLabel(goal.id,person.gender)}</div>}
   </div>
   <section ref={drawer} className="moonstone-profile-drawer" aria-label="Подробная информация" aria-hidden={!expanded}>
    <div className="moonstone-profile-gesture-zone"><span/><span/></div>
    <div ref={scroll} className="moonstone-profile-scroll">
     <header className="moonstone-reveal-main"><div><h2>{person.name}, {person.age}{person.verified&&<BadgeCheck/>}</h2>
      <p><MapPin/>{location}{distance?` · ${distance}`:""}</p></div>
      {onMore&&<button type="button" onClick={onMore} aria-label="Действия с анкетой"><MoreHorizontal/></button>}
     </header>
     {goal&&<div className="moonstone-drawer-goal moonstone-reveal-goal"><Heart/>{goalLabel(goal.id,person.gender)}</div>}
     {person.about&&<div className="moonstone-detail-section moonstone-reveal-about"><h3>О себе</h3><p className="moonstone-reveal-text">{person.about}</p></div>}
     {person.interests.length>0&&<div className="moonstone-detail-section moonstone-reveal-interests"><h3>Интересы</h3>
      <div className="moonstone-interest-list">{person.interests.map((id,index)=><InterestChip key={`${id}-${index}`} id={id}/>)}</div></div>}
     {languageNames.length>0&&<div className="moonstone-detail-section moonstone-reveal-extra"><h3>Языки</h3><p>{languageNames.join(" · ")}</p></div>}
     {person.likedYouKind&&<p className="moonstone-liked-you moonstone-reveal-extra">Ты уже понравился(ась) этому человеку</p>}
    </div>
   </section>
   {actionFeedback&&<div key={actionFeedback.token}
    className={`moonstone-action-feedback is-${actionFeedback.kind}`} aria-hidden="true">
    <span>{actionFeedback.kind==="pass"?<X/>:actionFeedback.kind==="like"?<Heart/>:<Star/>}</span>
   </div>}
   <div className="moonstone-actions" aria-label="Действия с анкетой">
    <button type="button" className="moonstone-pass-button" disabled={!available} aria-label="Пропустить" onClick={()=>performAction("pass")}><X/></button>
    <LikeSuperButton disabled={!available} onAction={performAction}/>
   </div>
  </article>
 </div>;
}
