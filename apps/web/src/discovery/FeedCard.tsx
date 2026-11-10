import {useEffect,useLayoutEffect,useMemo,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {BadgeCheck,ChevronDown,ChevronRight,ChevronUp,Heart,MapPin,MoreHorizontal,Star,X} from "lucide-react";
import {goals} from "../registration/model";
import {goalLabel} from "../ui/PersonalizedCopy";
import {PhotoCarousel} from "../ui/PhotoCarousel";
import type {PhotoCarouselHandle} from "../ui/PhotoCarousel";
import {InterestChip} from "../ui/InterestCatalog";
import {languages} from "../ui/Languages";
import {selectionHaptic} from "../ui/haptic";
import type {DemoKind,DemoPerson} from "./model";

const clamp=(value:number,min=0,max=1)=>Math.max(min,Math.min(max,value));
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

function LikeSuperButton({disabled,onAction}:{disabled:boolean;onAction:(kind:"like"|"special")=>void}){
 const button=useRef<HTMLButtonElement>(null);
 const gesture=useRef<null|{id:number;x:number;y:number;claimed:boolean;threshold:boolean;max:number}>(null);
 const frame=useRef<number|null>(null),pending=useRef(0),committed=useRef(false);
 useEffect(()=>{if(!disabled)committed.current=false;},[disabled]);
 useEffect(()=>()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);},[]);
 const paint=(value:number)=>button.current?.style.setProperty("--like-slide-p",String(clamp(value)));
 const schedule=(value:number)=>{pending.current=value;if(frame.current!==null)return;
  frame.current=requestAnimationFrame(()=>{frame.current=null;paint(pending.current);});};
 const reset=()=>{if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null;}paint(0);
  button.current?.classList.remove("is-dragging","is-armed");};
 const commit=(kind:"like"|"special")=>{if(committed.current||disabled)return;
  committed.current=true;selectionHaptic();onAction(kind);};
 const down=(event:ReactPointerEvent<HTMLButtonElement>)=>{
  if(disabled||committed.current||!event.isPrimary||(event.pointerType==="mouse"&&event.button!==0))return;
  const width=event.currentTarget.getBoundingClientRect().width;
  const max=Math.max(1,width-58);event.currentTarget.style.setProperty("--like-travel",max+"px");
  gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,claimed:false,threshold:false,max};
 };
 const move=(event:ReactPointerEvent<HTMLButtonElement>)=>{
  const current=gesture.current;if(!current||current.id!==event.pointerId)return;
  const dx=Math.max(0,event.clientX-current.x),dy=event.clientY-current.y;
  if(!current.claimed){
   if(Math.max(dx,Math.abs(dy))<7)return;
   if(Math.abs(dy)>dx*1.15){gesture.current=null;reset();return;}
   current.claimed=true;event.currentTarget.classList.add("is-dragging");
   try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* old WebView */}
  }
  if(event.cancelable)event.preventDefault();event.stopPropagation();
  const raw=clamp(dx/current.max),resisted=raw<.75?raw:Math.min(1,.75+(raw-.75)*.62);
  schedule(resisted);
  const armed=raw>=.75;
  if(armed!==current.threshold){current.threshold=armed;event.currentTarget.classList.toggle("is-armed",armed);if(armed)selectionHaptic();}
 };
 const finish=(event:ReactPointerEvent<HTMLButtonElement>,cancelled=false)=>{
  const current=gesture.current;if(!current||current.id!==event.pointerId)return;gesture.current=null;
  if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null;paint(pending.current);}
  const dx=event.clientX-current.x,dy=event.clientY-current.y;
  if(!cancelled&&current.claimed&&current.threshold)commit("special");
  else if(!cancelled&&!current.claimed&&Math.abs(dx)<8&&Math.abs(dy)<10)commit("like");
  reset();
 };
 return <button ref={button} type="button" className="moonstone-like-button" disabled={disabled}
  aria-label="Нравится. Проведи вправо для особенной симпатии"
  onPointerDown={down} onPointerMove={move} onPointerUp={event=>finish(event)}
  onPointerCancel={event=>finish(event,true)} onLostPointerCapture={event=>finish(event,true)}
  onClick={event=>{if(event.detail===0)commit("like");}}>
  <span className="moonstone-like-glint" aria-hidden="true"/>
  <span className="moonstone-like-thumb" aria-hidden="true"><Heart/><Star className="moonstone-super-star"/></span>
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
 const card=useRef<HTMLElement>(null),drawer=useRef<HTMLDivElement>(null),scroll=useRef<HTMLDivElement>(null);
 const photo=useRef<PhotoCarouselHandle>(null),gesture=useRef<ExpandGesture|null>(null);
 const progress=useRef(0),target=useRef<0|1>(0),travel=useRef(310),run=useRef<SettleRun|null>(null);
 const fingerFrame=useRef<number|null>(null),fingerValue=useRef(0),blockClickUntil=useRef(0);
 const available=active&&!busy;
 const location=useMemo(()=>[person.city,countryName(person.countryCode,person.country)].filter(Boolean).join(", "),[person.city,person.country,person.countryCode]);
 const distance=distanceLabel(real?person.distanceKm:demoDistanceKm,real);
 const currentPhoto=person.photos[Math.min(activePhotoIndex,Math.max(0,person.photos.length-1))]?.src;
 const languageNames=person.languages.map(id=>languages.find(item=>item.id===id)?.name??id).filter(Boolean);
 const paint=(next:number)=>{
  const value=progress.current=clamp(next);card.current?.style.setProperty("--profile-p",String(value));
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
  return()=>{observer.disconnect();photoController?.cancel();if(fingerFrame.current!==null)cancelAnimationFrame(fingerFrame.current);
   const motion=run.current;if(motion&&motion.frame!==null)cancelAnimationFrame(motion.frame);};
 },[person.id]);
 useEffect(()=>{paint(0);target.current=0;setExpanded(false);if(scroll.current)scroll.current.scrollTop=0;},[person.id]);
 const down=(event:ReactPointerEvent<HTMLElement>)=>{
  if(!available||!event.isPrimary||(event.pointerType==="mouse"&&event.button!==0))return;
  const element=event.target as Element;
  if(element.closest("button,a,input,textarea,select,[contenteditable]"))return;
  gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,started:performance.now(),axis:"pending",
   startProgress:progress.current,scrollStart:scroll.current?.scrollTop??0,samples:[{y:event.clientY,t:performance.now()}]};
 };
 const move=(event:ReactPointerEvent<HTMLElement>)=>{
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
    if(current.axis==="info"){current.y=event.clientY;dy=0;}
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
  const current=gesture.current;if(!current||current.id!==event.pointerId)return;gesture.current=null;
  if(current.axis==="photo")photo.current?.finish(current.id,event.clientX,cancelled);
  if(current.axis!=="info")return;flushFinger();
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
     prioritize={active} gpuSafe onCoverReady={onCoverReady} onIndexChange={setActivePhotoIndex}/>
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
      {expanded?<ChevronDown/>:<ChevronUp/>}
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
     <header><div><h2>{person.name}, {person.age}{person.verified&&<BadgeCheck/>}</h2>
      <p><MapPin/>{location}{distance?` · ${distance}`:""}</p></div>
      {onMore&&<button type="button" onClick={onMore} aria-label="Действия с анкетой"><MoreHorizontal/></button>}
     </header>
     {goal&&<div className="moonstone-drawer-goal"><Heart/>{goalLabel(goal.id,person.gender)}</div>}
     {person.about&&<div className="moonstone-detail-section"><h3>О себе</h3><p>{person.about}</p></div>}
     {person.interests.length>0&&<div className="moonstone-detail-section"><h3>Интересы</h3>
      <div className="moonstone-interest-list">{person.interests.map((id,index)=><InterestChip key={`${id}-${index}`} id={id}/>)}</div></div>}
     {languageNames.length>0&&<div className="moonstone-detail-section"><h3>Языки</h3><p>{languageNames.join(" · ")}</p></div>}
     {person.likedYouKind&&<p className="moonstone-liked-you">Ты уже понравился(ась) этому человеку</p>}
    </div>
   </section>
   <div className="moonstone-actions" aria-label="Действия с анкетой">
    <button type="button" className="moonstone-pass-button" disabled={!available} aria-label="Пропустить" onClick={()=>onAction("pass")}><X/></button>
    <LikeSuperButton disabled={!available} onAction={kind=>onAction(kind)}/>
   </div>
  </article>
 </div>;
}
