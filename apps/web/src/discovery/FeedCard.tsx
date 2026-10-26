import {useEffect,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {Bookmark,ChevronDown,ChevronUp,Crown,Heart,Sparkles,X,Undo2} from "lucide-react";
import {goals} from "../registration/model";
import {PhotoCarousel} from "../ui/PhotoCarousel";
import {Flag} from "../ui/Flag";
import {InterestChip} from "../ui/InterestCatalog";
import type {DemoKind,DemoPerson} from "./model";

const buttons=[
 ["undo","Отменить",Undo2],["pass","Пропустить",X],
 ["special","Особенная симпатия",Sparkles],["like","Нравится",Heart]
] as const;
type VerticalGesture={id:number;y:number;x:number;claimed:boolean};

/** The keyed complete card remains mounted as it moves through the deck. */
export function FeedCard({person,saved,canUndo,active,busy,onAction,onOpenProfile,onInterests}:{
 person:DemoPerson;saved:boolean;canUndo:boolean;active:boolean;busy:boolean;
 onAction:(kind:DemoKind|"undo")=>void;onOpenProfile:()=>void;onInterests:()=>void;
}){
 const goal=person.goal==="undecided"?null:goals.find(g=>g.id===person.goal);
 const [expanded,setExpanded]=useState(false);
 const card=useRef<HTMLElement>(null);
 const details=useRef<HTMLDivElement>(null);
 const gesture=useRef<VerticalGesture|null>(null);
 const blockClick=useRef(false);
 useEffect(()=>{
  const element=card.current;
  if(!element)return;
  const resize=new ResizeObserver(entries=>{
   const height=entries[0]?.contentRect.height??0;
   element.dataset.size=height<320?"tiny":height<420?"compact":"regular";
  });
  resize.observe(element);
  return ()=>resize.disconnect();
 },[]);
 const down=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(!active||busy||!event.isPrimary||(event.pointerType==="mouse"&&event.button!==0))return;
  gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,claimed:false};
 };
 const move=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const g=gesture.current;
  if(!g||g.id!==event.pointerId)return;
  const dy=event.clientY-g.y,dx=event.clientX-g.x;
  if(!g.claimed){
   if(Math.abs(dx)>9&&Math.abs(dx)>Math.abs(dy)){gesture.current=null;return;}
   if(Math.abs(dy)<9||Math.abs(dy)<Math.abs(dx)*1.15)return;
   // Native scrolling owns the open description; the header can still collapse.
   if(expanded&&(event.target as HTMLElement).closest(".discovery-short-about,.feed-v2-interests")){
    gesture.current=null;return;
   }
   g.claimed=true;
   try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* WebView fallback */}
  }
  if(event.cancelable)event.preventDefault();
  details.current?.style.setProperty("--feed-drag",Math.max(-18,Math.min(18,dy*.22))+"px");
 };
 const finish=(event:ReactPointerEvent<HTMLDivElement>,cancel=false)=>{
  const g=gesture.current;
  if(!g||g.id!==event.pointerId)return;
  gesture.current=null;
  details.current?.style.removeProperty("--feed-drag");
  if(!g.claimed)return;
  blockClick.current=true;
  window.setTimeout(()=>{blockClick.current=false;},0);
  if(!cancel){
   const dy=event.clientY-g.y;
   if(dy< -24)setExpanded(true);
   if(dy>24)setExpanded(false);
  }
 };
 const available=active&&!busy;
 return <div className="discovery-deck-current feed-v2" aria-hidden={!active}>
   <article className="discovery-card feed-v2-card" ref={card} data-expanded={expanded}>
     <div className="discovery-photo feed-v2-photo">
       <PhotoCarousel photos={person.photos} name={person.name} age={person.age}/>
       <span className="discovery-demo-label">Демо</span>
       <button type="button" disabled={!available} className={"discovery-save-control"+(saved?" is-saved":"")}
         aria-label={saved?"Убрать из сохранённых":"Сохранить анкету"}
         aria-pressed={saved} title="Сохранить · демо" onClick={()=>onAction("save")}>
         <Bookmark size={19} fill={saved?"currentColor":"none"} strokeWidth={1.9}/>
       </button>
     </div>
     <div className="feed-v2-information">
       <div className="feed-v2-details" ref={details} onPointerDown={down} onPointerMove={move}
         onPointerUp={event=>finish(event)} onPointerCancel={event=>finish(event,true)}
         onClickCapture={event=>{if(blockClick.current){event.preventDefault();event.stopPropagation();}}}>
         <button className="feed-v2-expand" type="button" disabled={!available}
           aria-label={expanded?"Свернуть информацию":"Раскрыть информацию"} aria-expanded={expanded}
           onClick={()=>setExpanded(value=>!value)}>
           <span/>{expanded?<ChevronDown size={15}/>:<ChevronUp size={15}/>}
         </button>
         <div className="feed-v2-scroll">
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
           {person.about&&<p className="discovery-short-about">{person.about}</p>}
           {expanded&&person.interests.length>0&&<div className="feed-v2-interests">
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
