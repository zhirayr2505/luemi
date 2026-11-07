import {useEffect,useRef,useState} from "react";
import {RotateCcw,SlidersHorizontal,X} from "lucide-react";
import {goals} from "../registration/model";
import {goalLabel} from "../ui/PersonalizedCopy";
import type {RealPublishedProfile} from "../registration/real-live-client";
import {useModalLayer} from "../ui/modal-layer";

export type RealFeedFilter={
 gender:"all"|"man"|"woman";
 minAge:number;
 maxAge:number;
 goal:string;
 commonOnly:boolean;
};
export const defaultRealFeedFilter:RealFeedFilter={
 gender:"all",minAge:18,maxAge:80,goal:"all",commonOnly:false
};

export function realFeedMatches(profile:RealPublishedProfile,filter:RealFeedFilter,interests:readonly string[]){
 if(profile.age<filter.minAge||profile.age>filter.maxAge)return false;
 if(filter.gender!=="all"&&profile.gender!==filter.gender)return false;
 if(filter.goal!=="all"&&profile.goal!==filter.goal)return false;
 if(filter.commonOnly&&(!interests.length||!profile.interests.some(id=>interests.includes(id))))return false;
 return true;
}

export function RealFeedFilters({open,filter,onClose,onApply,interestCount}:{
 open:boolean;filter:RealFeedFilter;onClose:()=>void;
 onApply:(next:RealFeedFilter)=>void;interestCount:number;
}){
 const dialog=useRef<HTMLElement>(null);
 const [working,setWorking]=useState(filter);
 useModalLayer(open,dialog,onClose);
 useEffect(()=>{if(open)setWorking(filter);},[open,filter]);
 if(!open)return null;
 return <div className="discovery-modal-backdrop real-feed-filter-backdrop" onClick={onClose}>
  <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Фильтры анкет"
   className="real-feed-filter-sheet" onClick={event=>event.stopPropagation()}>
   <div className="discovery-sheet-grip" aria-hidden="true"/>
   <header className="real-feed-filter-head">
    <h2><SlidersHorizontal size={20}/> Фильтры</h2>
    <button type="button" aria-label="Закрыть фильтры" data-modal-initial onClick={onClose}><X size={21}/></button>
   </header>
   <div className="real-feed-filter-fields">
    <fieldset><legend>Кого ищем?</legend>
     <div className="real-feed-filter-options">
      {([["all","Всех"],["woman","Женщин"],["man","Мужчин"]] as const).map(([value,label])=>
       <button type="button" key={value} aria-pressed={working.gender===value}
        onClick={()=>setWorking(p=>({...p,gender:value}))}>{label}</button>)}
     </div>
    </fieldset>
    <fieldset><legend>Возраст</legend>
     <div className="real-feed-filter-ages">
      <label>От <output>{working.minAge}</output>
       <input type="range" min="18" max="80" step="1" value={working.minAge}
        onChange={e=>setWorking(p=>({...p,minAge:Math.min(Number(e.target.value),p.maxAge)}))}/>
      </label>
      <label>До <output>{working.maxAge}</output>
       <input type="range" min="18" max="80" step="1" value={working.maxAge}
        onChange={e=>setWorking(p=>({...p,maxAge:Math.max(Number(e.target.value),p.minAge)}))}/>
      </label>
     </div>
    </fieldset>
    <label className="real-feed-filter-goal">Цель знакомства
     <select value={working.goal} onChange={e=>setWorking(p=>({...p,goal:e.target.value}))}>
      <option value="all">Любая цель</option>
      {goals.map(goal=><option key={goal.id} value={goal.id}>{goalLabel(goal.id)}</option>)}
     </select>
    </label>
    <label className="real-feed-filter-check">
     <input type="checkbox" checked={working.commonOnly} disabled={interestCount===0}
      onChange={e=>setWorking(p=>({...p,commonOnly:e.target.checked}))}/>
     <span>Только с общими интересами</span>
    </label>
    {interestCount===0&&<p className="real-feed-filter-hint">Добавь интересы в свою анкету, чтобы включить этот фильтр.</p>}
   </div>
   <footer className="real-feed-filter-footer">
    <button type="button" className="real-feed-filter-reset" onClick={()=>setWorking(defaultRealFeedFilter)}>
     <RotateCcw size={17}/> Сбросить
    </button>
    <button type="button" className="real-feed-filter-apply" onClick={()=>onApply(working)}>Показать анкеты</button>
   </footer>
  </section>
 </div>;
}
