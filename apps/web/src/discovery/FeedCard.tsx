import {useEffect,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {Bookmark,ChevronDown,ChevronUp,Crown,Heart,Sparkles,X,Undo2} from "lucide-react";
import {goals} from "../registration/model";
import {PhotoCarousel} from "../ui/PhotoCarousel";
import type {PhotoCarouselHandle} from "../ui/PhotoCarousel";
import {Flag} from "../ui/Flag";
import {InterestChip} from "../ui/InterestCatalog";
import type {DemoKind,DemoPerson} from "./model";

const buttons=[
 ["undo","Отменить",Undo2],["pass","Пропустить",X],
 ["special","Особенная симпатия",Sparkles],["like","Нравится",Heart]
] as const;
type CardGesture={id:number;x:number;y:number;at:number;axis:"pending"|"photo"|"info";info:boolean;nativeScroll:boolean};

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
 const photo=useRef<PhotoCarouselHandle>(null);
 const gesture=useRef<CardGesture|null>(null);
 const blockClickUntil=useRef(0);
 const multiTouch=useRef(false);
 const expansionLocked=useRef(false);
 const expansionTimer=useRef<number|null>(null);
 useEffect(()=>{
  const element=card.current;
  if(!element)return;
  const resize=new ResizeObserver(entries=>{
   const height=entries[0]?.contentRect.height??0;
   element.dataset.size=height<320?"tiny":height<420?"compact":"regular";
  });
  resize.observe(element);
  const carousel=photo.current;
  return ()=>{resize.disconnect();carousel?.cancel();
   if(expansionTimer.current!==null)window.clearTimeout(expansionTimer.current);};
 },[]);
 const updateExpanded=(next:boolean)=>{
  if(!active||busy||expansionLocked.current||next===expanded)return;
  setExpanded(next);
  if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)return;
  expansionLocked.current=true;
  expansionTimer.current=window.setTimeout(()=>{expansionLocked.current=false;
   expansionTimer.current=null;},430);
 };
 const down=(event:ReactPointerEvent<HTMLElement>)=>{
  if(!event.isPrimary){
   multiTouch.current=true;
   blockClickUntil.current=performance.now()+350;
   const old=gesture.current;gesture.current=null;
   if(old?.axis==="photo")photo.current?.finish(old.id,old.x,true);
   details.current?.style.removeProperty("--feed-drag");
   return;
  }
  multiTouch.current=false;
  if(!active||busy||(event.pointerType==="mouse"&&event.button!==0))return;
  gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now(),
   axis:"pending",info:!!(event.target as Element).closest(".feed-v2-details"),
   nativeScroll:!!(event.target as Element).closest(".feed-v2-scroll")};
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
    g.axis="photo";
    photo.current?.begin(g.id,g.x,g.y,g.at);
   }else if(Math.abs(dy)>Math.abs(dx)*1.15&&g.info){
    if(expanded&&g.nativeScroll&&(dy<0||(scroll.current?.scrollTop??0)>0)){
     gesture.current=null;return;
    }
    g.axis="info";
   }else return;
   blockClickUntil.current=performance.now()+350;
   try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* older WebView */}
  }
  if(event.cancelable)event.preventDefault();
  if(g.axis==="photo")photo.current?.move(g.id,event.clientX,event.clientY);
  else details.current?.style.setProperty("--feed-drag",Math.max(-18,Math.min(18,dy*.22))+"px");
 };
 const finish=(event:ReactPointerEvent<HTMLElement>,cancel=false)=>{
  const g=gesture.current;
  if(!g||g.id!==event.pointerId)return;
  gesture.current=null;
  details.current?.style.removeProperty("--feed-drag");
  if(g.axis==="photo")photo.current?.finish(g.id,event.clientX,cancel);
  if(g.axis==="info"&&!cancel){
   const dy=event.clientY-g.y;
   if(dy< -24)updateExpanded(true);
   if(dy>24)updateExpanded(false);
  }
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
           onClick={()=>updateExpanded(!expanded)}>
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
           {person.about&&<div className="feed-v2-about">
             <p className="discovery-short-about">{person.about}</p>
           </div>}
           {person.interests.length>0&&<div className="feed-v2-interests" aria-hidden={!expanded} inert={!expanded}>
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
