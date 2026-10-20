import {Bookmark, Crown, Heart, Sparkles, X, Undo2} from "lucide-react";
import {goals} from "../registration/model";
import {PhotoCarousel} from "../ui/PhotoCarousel";
import {Flag} from "../ui/Flag";
import {InterestChip} from "../ui/InterestCatalog";
import type {DemoKind,DemoPerson} from "./model";

const buttons=[
 ["undo","Отменить",Undo2],
 ["pass","Пропустить",X],
 ["special","Особенная симпатия",Sparkles],
 ["like","Нравится",Heart]
] as const;

/** One *complete* profile, including photo, text and controls.
 * The deck keeps each keyed instance mounted as it moves from next to active.
 * A new candidate can never appear as a photo-only placeholder. */
export function FeedCard({person,saved,canUndo,active,onAction,onOpenProfile,onInterests}:{
 person:DemoPerson;saved:boolean;canUndo:boolean;active:boolean;
 onAction:(kind:DemoKind|"undo")=>void;onOpenProfile:()=>void;onInterests:()=>void;
}){
 const goal=person.goal==="undecided"?null:goals.find(g=>g.id===person.goal);
 return <div className="discovery-deck-current" aria-hidden={!active}>
   <article className="discovery-card">
     <div className="discovery-photo">
       <PhotoCarousel photos={person.photos} name={person.name} age={person.age}/>
       <span className="discovery-demo-label">Демо</span>
       {<button type="button" disabled={!active} className={"discovery-save-control"+(saved?" is-saved":"")}
         aria-label={saved?"Убрать из сохранённых":"Сохранить анкету"}
         aria-pressed={saved} title="Сохранить · демо" onClick={()=>onAction("save")}>
         <Bookmark size={19} fill={saved?"currentColor":"none"} strokeWidth={1.9}/>
       </button>}
     </div>
     <div className="discovery-card-overlay">
       <div className="discovery-name-row">
         <button className="discovery-name-button" type="button" onClick={onOpenProfile} disabled={!active}
           aria-label={"Посмотреть профиль "+person.name+", "+person.age}>
           <span>{person.name}, {person.age}</span>
         </button>
         {person.premium&&<span className="discovery-premium" title="Демо Premium" aria-label="Premium">
           <Crown size={19} strokeWidth={2} fill="#ffd878" color="#e8af35"/>
         </span>}
         {goal&&<span className="discovery-goal-badge"><Heart size={13}/>{goal.label}</span>}
       </div>
       <div className="discovery-place"><Flag code={person.countryCode} size={19}/>{person.city}</div>
       <div className="discovery-interests">
         {person.interests.slice(0,3).map(id=><InterestChip key={id} id={id}/>)}
         {person.interests.length>3&&<button type="button" className="discovery-more"
           onClick={onInterests} disabled={!active} aria-label={"Показать все интересы "+person.name}>
           +{person.interests.length-3}
         </button>}
       </div>
       <p className="discovery-short-about">{person.about}</p>
     </div>
   </article>
   {<div className="discovery-actions" aria-label="Демо-действия с анкетой">
     {buttons.map(([kind,label,Icon])=><button type="button" key={kind}
       className={"discovery-action discovery-"+kind} aria-label={label} title={label}
       onClick={()=>onAction(kind)} disabled={!active||(kind==="undo"&&!canUndo)}>
       <Icon size={kind==="like"?28:kind==="special"?24:20} strokeWidth={1.85}/>
     </button>)}
   </div>}
 </div>;
}
