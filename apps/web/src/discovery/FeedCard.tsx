import {useEffect,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {Bookmark,ChevronDown,ChevronUp,Crown,Heart,Sparkles,X,Undo2} from "lucide-react";
import {goals} from "../registration/model";
import {PhotoCarousel} from "../ui/PhotoCarousel";
import type {PhotoCarouselHandle} from "../ui/PhotoCarousel";
import {Flag} from "../ui/Flag";
import {InterestChip} from "../ui/InterestCatalog";
import type {DemoKind,DemoPerson} from "./model";
import {cardGestureZone} from "./card-gesture-zone";

const buttons=[
 ["undo","Отменить",Undo2],["pass","Пропустить",X],
 ["special","Особенная симпатия",Sparkles],["like","Нравится",Heart]
] as const;
type CardGesture={id:number;x:number;y:number;at:number;axis:"pending"|"photo"|"info";
 info:boolean;zone:"photo"|"browse";nativeScroll:boolean;startProgress:number;resumeTarget:0|1;
 samples:{y:number;t:number}[]};
type CardRun={from:number;target:0|1;start:number;duration:number;frame:number|null};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const position=(run:CardRun,now:number)=>{
 const t=clamp((now-run.start)/run.duration,0,1);
 return run.from+(run.target-run.from)*(1-(1-t)*(1-t)*(1-t));
};

/** The keyed complete card remains mounted as it moves through the deck. */
export function FeedCard({person,saved,canUndo,active,busy,onAction,onOpenProfile,onInterests}:{
 person:DemoPerson;saved:boolean;canUndo:boolean;active:boolean;busy:boolean;
 onAction:(kind:DemoKind|"undo")=>void;onOpenProfile:()=>void;onInterests:()=>void;
}){
 const goal=person.goal==="undecided"?null:goals.find(g=>g.id===person.goal);
 const [expanded,setExpanded]=useState(false);
 const card=useRef<HTMLElement>(null);
 const details=useRef<HTMLDivElement>(null);
 const scroll=useRef<HTMLDivElement>(null);
 const about=useRef<HTMLDivElement>(null);
 const interests=useRef<HTMLDivElement>(null);
 const interestBody=useRef<HTMLDivElement>(null);
 const photo=useRef<PhotoCarouselHandle>(null);
 const gesture=useRef<CardGesture|null>(null);
 const blockClickUntil=useRef(0);
 const multiTouch=useRef(false);
 const progress=useRef(0),target=useRef<0|1>(0);
 const metrics=useRef({closed:174,open:430,aboutClosed:40,about:40,interests:120});
 const run=useRef<CardRun|null>(null);
 const fingerFrame=useRef<number|null>(null);
 const fingerValue=useRef(0);
 const suspend=useRef<()=>void>(()=>{});
 const measureLive=useRef<()=>void>(()=>{});
 const paint=(value:number)=>{
  const p=progress.current=clamp(value,0,1),m=metrics.current;
  if(details.current)details.current.style.height=(m.closed+(m.open-m.closed)*p)+"px";
  if(about.current)about.current.style.maxHeight=(m.aboutClosed+(m.about-m.aboutClosed)*p)+"px";
  if(interests.current)interests.current.style.maxHeight=(m.interests*p)+"px";
  card.current?.style.setProperty("--feed-progress",String(p));
 };
 const flushFinger=()=>{
  if(fingerFrame.current!==null){cancelAnimationFrame(fingerFrame.current);fingerFrame.current=null;}
  paint(fingerValue.current);
 };
 const scheduleFinger=(value:number)=>{
  fingerValue.current=value;
  if(fingerFrame.current!==null)return;
  fingerFrame.current=requestAnimationFrame(()=>{fingerFrame.current=null;paint(fingerValue.current);});
 };
 const freeze=()=>{
  const current=run.current;
  if(!current)return;
  if(current.frame!==null)cancelAnimationFrame(current.frame);
  run.current=null;paint(position(current,performance.now()));
 };
 const settle=(next:0|1)=>{
  freeze();target.current=next;setExpanded(next===1);
  if(scroll.current)scroll.current.style.overflowY="hidden";
  if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){
   paint(next);if(scroll.current)scroll.current.style.overflowY=next?"auto":"hidden";return;
  }
  if(Math.abs(progress.current-next)<.002){
   paint(next);if(scroll.current)scroll.current.style.overflowY=next?"auto":"hidden";return;
  }
  const motion:CardRun={from:progress.current,target:next,
   duration:Math.max(110,Math.round(270*Math.abs(next-progress.current))),
   start:performance.now(),frame:null};
  run.current=motion;
  const tick=(now:number)=>{
   if(run.current!==motion)return;
   const value=position(motion,now);paint(value);
   if(now-motion.start>=motion.duration){
    run.current=null;paint(next);
    if(scroll.current)scroll.current.style.overflowY=next?"auto":"hidden";
   }else motion.frame=requestAnimationFrame(tick);
  };
  motion.frame=requestAnimationFrame(tick);
 };
 const measure=()=>{
  const element=card.current;if(!element)return;
  const height=element.clientHeight;
  element.dataset.size=height<320?"tiny":height<420?"compact":"regular";
  const style=getComputedStyle(element);
  const closed=Number.parseFloat(style.getPropertyValue("--feed-closed-height"))||174;
  const actions=Number.parseFloat(style.getPropertyValue("--feed-actions-height"))||79;
  const aboutClosed=Number.parseFloat(style.getPropertyValue("--feed-about-closed-height"))||40;
  metrics.current={closed,open:Math.max(closed,Math.min(height*.72,430,height-actions)),
   aboutClosed,about:Math.max(aboutClosed,about.current?.firstElementChild?.scrollHeight??aboutClosed),
   interests:Math.min(120,(interestBody.current?.scrollHeight??0)+10)};
  paint(progress.current);
 };
 measureLive.current=measure;
 useEffect(()=>{
  const element=card.current;
  if(!element)return;
  const resize=new ResizeObserver(()=>measureLive.current());
  resize.observe(element);
  measureLive.current();
  const carousel=photo.current;
  return ()=>{resize.disconnect();carousel?.cancel();
   if(fingerFrame.current!==null){cancelAnimationFrame(fingerFrame.current);fingerFrame.current=null;}
   const current=run.current;if(current?.frame!=null)
    cancelAnimationFrame(current.frame);
   run.current=null;};
 },[]);
 useEffect(()=>{
  const stop=()=>suspend.current();
  const hidden=()=>{if(document.hidden)stop();};
  window.addEventListener("blur",stop);
  document.addEventListener("visibilitychange",hidden);
  return ()=>{window.removeEventListener("blur",stop);document.removeEventListener("visibilitychange",hidden);};
 },[]);
 const updateExpanded=(next:boolean)=>{
  if(!active||busy)return;
  settle(next?1:0);
 };
 const down=(event:ReactPointerEvent<HTMLElement>)=>{
  if(!event.isPrimary){
   multiTouch.current=true;
   blockClickUntil.current=performance.now()+350;
   const old=gesture.current;gesture.current=null;
   if(old?.axis==="photo")photo.current?.finish(old.id,old.x,true);
   if(old?.axis==="info"){flushFinger();settle(old.resumeTarget);}
   return;
  }
  multiTouch.current=false;
  if(!active||busy||(event.pointerType==="mouse"&&event.button!==0))return;
  const element=event.target as Element;
  const interactive=element.closest("button,a,input,textarea,select,[contenteditable]");
  if(interactive&&!interactive.matches(".discovery-name-button,.feed-v2-expand"))return;
  const info=!!element.closest(".feed-v2-details");
  const rect=card.current?.getBoundingClientRect();
  const zone=rect?cardGestureZone(event.clientY,rect.top,rect.height):null;
  if(!zone||(!info&&zone!=="photo"))return;
  if(info)freeze();
  const now=performance.now();
  gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,at:now,
   axis:"pending",info,nativeScroll:!!element.closest(".feed-v2-scroll"),
   zone,
   startProgress:progress.current,resumeTarget:target.current,samples:[{y:event.clientY,t:now}]};
 };
 const move=(event:ReactPointerEvent<HTMLElement>)=>{
  const g=gesture.current;
  if(!g||g.id!==event.pointerId||multiTouch.current)return;
  const dy=event.clientY-g.y,dx=event.clientX-g.x;
  if(g.axis==="pending"){
   if(Math.max(Math.abs(dx),Math.abs(dy))<9)return;
   if(Math.abs(dx)>Math.abs(dy)*1.15){
    // A rightward gesture from the OS edge belongs to Telegram.
    if(dx>0&&g.x<26){gesture.current=null;return;}
    if(g.zone!=="photo"){gesture.current=null;return;}
    g.axis="photo";photo.current?.begin(g.id,g.x,g.y,g.at);
   }else if(Math.abs(dy)>Math.abs(dx)*1.15&&g.info){
    if(progress.current>.99&&g.nativeScroll&&(dy<0||(scroll.current?.scrollTop??0)>0)){
     gesture.current=null;return;
    }
    g.axis="info";
   }else return;
   blockClickUntil.current=performance.now()+350;
   try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* older WebView */}
  }
  if(event.cancelable)event.preventDefault();
  if(g.axis==="photo")photo.current?.move(g.id,event.clientX,event.clientY);
  else{
   const travel=Math.max(1,metrics.current.open-metrics.current.closed);
   scheduleFinger(g.startProgress-dy/travel);
   const t=performance.now();g.samples.push({y:event.clientY,t});
   if(g.samples.length>10)g.samples.shift();
  }
 };
 const finish=(event:ReactPointerEvent<HTMLElement>,cancel=false)=>{
  const g=gesture.current;
  if(!g||g.id!==event.pointerId)return;
  gesture.current=null;
  if(g.axis==="photo")photo.current?.finish(g.id,event.clientX,cancel);
  if(g.axis==="info"){
   flushFinger();
   if(cancel){settle(g.resumeTarget);return;}
   const t=performance.now(),samples=[...g.samples,{y:event.clientY,t}];
   let recent=samples[samples.length-1];
   for(let i=samples.length-2;i>=0;i--){
    if(t-samples[i].t>80)break;
    recent=samples[i];
   }
   const velocity=t-recent.t>0?(event.clientY-recent.y)/(t-recent.t):0;
   const travel=Math.max(1,metrics.current.open-metrics.current.closed);
   paint(g.startProgress-(event.clientY-g.y)/travel);
   const projected=progress.current-velocity*125/travel;
   settle((Math.abs(velocity)>.45?velocity<0:projected>=.5)?1:0);
  }else if(g.axis==="pending"&&g.info)settle(g.resumeTarget);
 };
 suspend.current=()=>{
  const g=gesture.current;gesture.current=null;multiTouch.current=false;
  if(g?.axis==="photo")photo.current?.finish(g.id,g.x,true);
  if(g?.axis==="info")flushFinger();
  freeze();const resting=g?.axis==="info"?g.resumeTarget:target.current;
  target.current=resting;setExpanded(resting===1);paint(resting);
  if(scroll.current)scroll.current.style.overflowY=resting?"auto":"hidden";
 };
 const available=active&&!busy;
 return <div className="discovery-deck-current feed-v2" aria-hidden={!active}>
   <article className="discovery-card feed-v2-card" ref={card} data-expanded={expanded}
     onPointerDownCapture={down} onPointerMoveCapture={move}
     onPointerUpCapture={event=>finish(event)} onPointerCancelCapture={event=>finish(event,true)}
     onLostPointerCapture={event=>{if(event.target===event.currentTarget)finish(event,true);}}
     onClickCapture={event=>{if(performance.now()<blockClickUntil.current){event.preventDefault();event.stopPropagation();}}}>
     <div className="discovery-photo feed-v2-photo">
       <PhotoCarousel ref={photo} photos={person.photos} name={person.name} age={person.age}
         externalGesture dots/>
       <span className="discovery-demo-label">Демо</span>
       <button type="button" disabled={!available} className={"discovery-save-control"+(saved?" is-saved":"")}
         aria-label={saved?"Убрать из сохранённых":"Сохранить анкету"}
         aria-pressed={saved} title="Сохранить · демо" onClick={()=>onAction("save")}>
         <Bookmark size={19} fill={saved?"currentColor":"none"} strokeWidth={1.9}/>
       </button>
     </div>
     <div className="feed-v2-information">
       <div className="feed-v2-details" ref={details}>
         <button className="feed-v2-expand" type="button" disabled={!available}
           aria-label={expanded?"Свернуть информацию":"Раскрыть информацию"} aria-expanded={expanded}
           onClick={()=>updateExpanded(target.current!==1)}>
           {expanded?<ChevronDown size={15}/>:<ChevronUp size={15}/>}
         </button>
         <div className="feed-v2-scroll" ref={scroll}>
           <div className="discovery-name-row">
             <button className="discovery-name-button" type="button" onClick={onOpenProfile} disabled={!available}
               aria-label={"Посмотреть профиль "+person.name+", "+person.age}>
               <span>{person.name}, {person.age}</span>
             </button>
             {person.premium&&<span className="discovery-premium" title="Демо Premium" aria-label="Premium">
               <Crown size={19} strokeWidth={2} fill="#ffd878" color="#e8af35"/>
             </span>}
           </div>
           <div className="discovery-place"><Flag code={person.countryCode} size={19}/>
             <span>{person.city}{person.country?", "+person.country:""}</span>
           </div>
           {goal&&<div className="feed-v2-goal"><Heart size={13}/>{goal.label}</div>}
           {person.about&&<div className="feed-v2-about" ref={about}>
             <p className="discovery-short-about">{person.about}</p>
           </div>}
           {person.interests.length>0&&<div className="feed-v2-interests" ref={interests} aria-hidden={!expanded} inert={!expanded}>
             <div className="discovery-interests" ref={interestBody}>
               {person.interests.slice(0,6).map(id=><InterestChip key={id} id={id}/>)}
               {person.interests.length>6&&<button type="button" className="discovery-more"
                 onClick={onInterests} disabled={!available} aria-label={"Показать все интересы "+person.name}>
                 +{person.interests.length-6}
               </button>}
             </div>
           </div>}
         </div>
       </div>
       <div className="discovery-actions" aria-label="Демо-действия с анкетой">
         {buttons.map(([kind,label,Icon])=><button type="button" key={kind}
           className={"discovery-action discovery-"+kind} aria-label={label} title={label}
           onClick={()=>onAction(kind)} disabled={!available||(kind==="undo"&&!canUndo)}>
           <Icon size={kind==="like"?28:kind==="special"?24:20} strokeWidth={1.85}/>
         </button>)}
       </div>
     </div>
   </article>
 </div>;
}
