import {useEffect,useLayoutEffect,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {Bookmark,ChevronDown,ChevronUp,Crown,Heart,Sparkles,X,Undo2,MoreHorizontal} from "lucide-react";
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
type CardGesture={id:number;x:number;y:number;at:number;axis:"pending"|"photo"|"info"|"scroll";
 info:boolean;zone:"photo"|"browse";nativeScroll:boolean;startProgress:number;resumeTarget:0|1;
 scrollStart:number;samples:{y:number;t:number}[]};
type CardRun={from:number;target:0|1;start:number;duration:number;velocity:number;frame:number|null};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const position=(run:CardRun,now:number)=>{
 const t=clamp((now-run.start)/run.duration,0,1);
 const delta=run.target-run.from;
 return clamp(run.from+run.velocity*run.duration*(t-2*t*t+t*t*t)+
  delta*(3*t*t-2*t*t*t),0,1);
};

/** The keyed complete card remains mounted as it moves through the deck. */
export function FeedCard({person,saved,canUndo,active,busy,onAction,onOpenProfile,onInterests,real=false,onMore}:{
 person:DemoPerson;saved:boolean;canUndo:boolean;active:boolean;busy:boolean;
 onAction:(kind:DemoKind|"undo")=>void;onOpenProfile:()=>void;onInterests:()=>void;
 /** The same approved card can render verified server users with no demo badges. */
 real?:boolean;onMore?:()=>void;
}){
 const goal=person.goal==="undecided"?null:goals.find(g=>g.id===person.goal);
 const [expanded,setExpanded]=useState(false);
 const card=useRef<HTMLElement>(null);
 const details=useRef<HTMLDivElement>(null);
 const dim=useRef<HTMLDivElement>(null);
 const scroll=useRef<HTMLDivElement>(null);
 const content=useRef<HTMLDivElement>(null);
 const about=useRef<HTMLDivElement>(null);
 const interests=useRef<HTMLDivElement>(null);
 const photo=useRef<PhotoCarouselHandle>(null);
 const gesture=useRef<CardGesture|null>(null);
 const blockClickUntil=useRef(0);
 const multiTouch=useRef(false);
 const progress=useRef(0),target=useRef<0|1>(0);
 const metrics=useRef({closed:174,open:430,reveal:0});
 const run=useRef<CardRun|null>(null);
 const fingerFrame=useRef<number|null>(null);
 const fingerValue=useRef(0);
 const suspend=useRef<()=>void>(()=>{});
 const measureLive=useRef<()=>void>(()=>{});
 const paint=(value:number)=>{
  const p=progress.current=clamp(value,0,1),m=metrics.current;
  // A single small text surface moves behind the fixed information viewport.
  // Its layout, clipping rectangle, photograph and action buttons stay fixed.
  if(content.current)content.current.style.transform=
   `translate3d(0,${m.reveal*(1-p)}px,0)`;
  if(dim.current)dim.current.style.opacity=String(p);
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
 const settle=(next:0|1,releaseVelocity=0)=>{
  freeze();target.current=next;
  if(scroll.current)scroll.current.style.overflowY="hidden";
  if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){
   paint(next);setExpanded(next===1);
   if(scroll.current)scroll.current.style.overflowY=next?"auto":"hidden";return;
  }
  if(Math.abs(progress.current-next)<.002){
   paint(next);setExpanded(next===1);
   if(scroll.current)scroll.current.style.overflowY=next?"auto":"hidden";return;
  }
  const distance=Math.abs(next-progress.current);
  const duration=Math.max(160,Math.min(320,220+distance*90-Math.abs(releaseVelocity)*45));
  // Limit the release slope to the remaining travel so a fast flick cannot
  // overshoot the edge and then snap back on the terminal frame.
  const velocity=Math.sign(next-progress.current)*
   Math.min(Math.max(0,releaseVelocity*Math.sign(next-progress.current)),distance*2/duration);
  const motion:CardRun={from:progress.current,target:next,duration,
   velocity,start:performance.now(),frame:null};
  run.current=motion;
  const tick=(now:number)=>{
   if(run.current!==motion)return;
   const value=position(motion,now);paint(value);
   if(now-motion.start>=motion.duration){
    run.current=null;paint(next);setExpanded(next===1);
    if(scroll.current)scroll.current.style.overflowY=next?"auto":"hidden";
   }else motion.frame=requestAnimationFrame(tick);
  };
  motion.frame=requestAnimationFrame(tick);
 };
 const measure=()=>{
  const element=card.current;if(!element)return;
  const height=element.clientHeight;
  const size=height<320?"tiny":height<420?"compact":"regular";
  if(element.dataset.size!==size)element.dataset.size=size;
  const style=getComputedStyle(element);
  const closed=Number.parseFloat(style.getPropertyValue("--feed-closed-height"))||174;
  const actions=Number.parseFloat(style.getPropertyValue("--feed-actions-height"))||79;
  const aboutClosed=Number.parseFloat(style.getPropertyValue("--feed-about-closed-height"))||40;
  const open=Math.max(closed,Math.min(height*.72,430,height-actions));
  details.current?.style.setProperty("height",open+"px");
  const full=content.current?.scrollHeight??0;
  const collapsed=full-Math.max(0,(about.current?.clientHeight??0)-aboutClosed)-
   (interests.current?.clientHeight??0);
  metrics.current={closed,open,reveal:Math.max(0,Math.min(full,scroll.current?.clientHeight??0)-collapsed)};
  paint(progress.current);
 };
 measureLive.current=measure;
 useLayoutEffect(()=>{
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
  const zone=info?"browse":rect?cardGestureZone(event.clientY,rect.top,rect.height):null;
  if(!zone||(!info&&zone!=="photo"))return;
  const now=performance.now();
  gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,at:now,
   axis:"pending",info,nativeScroll:!!element.closest(".feed-v2-scroll"),
   zone,
   startProgress:progress.current,resumeTarget:target.current,
   scrollStart:scroll.current?.scrollTop??0,samples:[{y:event.clientY,t:now}]};
 };
 const move=(event:ReactPointerEvent<HTMLElement>)=>{
  const g=gesture.current;
  if(!g||g.id!==event.pointerId||multiTouch.current)return;
  let dy=event.clientY-g.y;const dx=event.clientX-g.x;
  if(g.axis==="pending"){
   // Capture an in-range photo swipe before the parent tab pager's 6px claim.
   if(Math.max(Math.abs(dx),Math.abs(dy))<6)return;
   if(Math.abs(dx)>Math.abs(dy)*1.15){
    // A rightward gesture from the OS edge belongs to Telegram.
    if(dx>0&&g.x<26){gesture.current=null;return;}
    if(g.zone!=="photo"||!photo.current?.canAdvance(dx<0?1:-1)){
     gesture.current=null;return;
    }
    g.axis="photo";photo.current?.begin(g.id,g.x,g.y,g.at);
   }else if(Math.abs(dy)>Math.abs(dx)*1.15&&g.info){
    freeze();g.startProgress=progress.current;
    const canScroll=!!scroll.current&&scroll.current.scrollHeight>scroll.current.clientHeight+1;
    g.axis=g.startProgress>.99&&g.nativeScroll&&canScroll&&
     (dy<0||g.scrollStart>0)?"scroll":"info";
    if(g.axis==="info"){g.y=event.clientY;dy=0;}
   }else return;
   blockClickUntil.current=performance.now()+350;
   try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* older WebView */}
  }
  if(g.axis==="photo")event.stopPropagation();
  if(event.cancelable)event.preventDefault();
  if(g.axis==="photo")photo.current?.move(g.id,event.clientX,event.clientY);
  else if(g.axis==="scroll"){
   if(scroll.current)scroll.current.scrollTop=Math.max(0,g.scrollStart-dy);
   if(dy>g.scrollStart){
    g.axis="info";g.y+=g.scrollStart;g.startProgress=progress.current;
    dy=event.clientY-g.y;
   }else return;
  }
  if(g.axis==="info"){
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
   settle((Math.abs(velocity)>.45?velocity<0:projected>=.5)?1:0,-velocity/travel);
  }
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
       {!real&&<span className="discovery-demo-label">Демо</span>}
       {real?<button type="button" disabled={!available} className="discovery-save-control"
         aria-label="Действия с анкетой" onClick={onMore}>
         <MoreHorizontal size={21} strokeWidth={1.9}/>
       </button>:<button type="button" disabled={!available} className={"discovery-save-control"+(saved?" is-saved":"")}
         aria-label={saved?"Убрать из сохранённых":"Сохранить анкету"}
         aria-pressed={saved} title="Сохранить · демо" onClick={()=>onAction("save")}>
         <Bookmark size={19} fill={saved?"currentColor":"none"} strokeWidth={1.9}/>
       </button>}
     </div>
     <div className="feed-v2-dim" ref={dim} aria-hidden="true"/>
     <div className="feed-v2-information">
       <div className="feed-v2-details" ref={details}>
         <div className="feed-v2-scroll" ref={scroll}>
          <div className="feed-v2-content" ref={content}>
           <button className="feed-v2-expand" type="button" disabled={!available}
             aria-label={expanded?"Свернуть информацию":"Раскрыть информацию"} aria-expanded={expanded}
             onClick={()=>updateExpanded(target.current!==1)}>
             <ChevronDown size={15} className="feed-v2-collapse-icon"/>
             <ChevronUp size={15} className="feed-v2-expand-icon"/>
           </button>
           <div className="discovery-name-row">
             <button className="discovery-name-button" type="button" onClick={onOpenProfile} disabled={!available}
               aria-label={"Посмотреть профиль "+person.name+", "+person.age}>
               <span>{person.name}, {person.age}</span>
             </button>
             {!real&&person.premium&&<span className="discovery-premium" title="Демо Premium" aria-label="Premium">
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
             <div className="discovery-interests">
               {person.interests.slice(0,6).map(id=><InterestChip key={id} id={id}/>)}
               {person.interests.length>6&&<button type="button" className="discovery-more"
                 onClick={onInterests} disabled={!available} aria-label={"Показать все интересы "+person.name}>
                 +{person.interests.length-6}
               </button>}
             </div>
           </div>}
          </div>
         </div>
       </div>
       <div className="discovery-actions" aria-label={real?"Действия с анкетой":"Демо-действия с анкетой"}>
         {buttons.filter(([kind])=>!real||kind!=="undo").map(([kind,label,Icon])=><button type="button" key={kind}
           className={"discovery-action discovery-"+kind} aria-label={label} title={label}
           onClick={()=>onAction(kind)} disabled={!available||(kind==="undo"&&!canUndo)}>
           <Icon size={kind==="like"?28:kind==="special"?24:20} strokeWidth={1.85}/>
         </button>)}
       </div>
     </div>
   </article>
 </div>;
}
