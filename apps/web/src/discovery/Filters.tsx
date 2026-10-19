import {useEffect,useState} from "react";
import {X,RotateCcw,SlidersHorizontal} from "lucide-react";
import type {DiscoveryFilter} from "./model";
import {defaultFilters} from "./model";
import {goals} from "../registration/model";
import {positionAt,radiusAt} from "../registration/GeoPicker";
import {DoubleAgeRange} from "../registration/Steps";
import type {RegistrationDraft} from "../registration/model";
interface Props {open:boolean;filter:DiscoveryFilter;draft:RegistrationDraft;onClose:()=>void;onApply:(next:DiscoveryFilter)=>void}
export function DiscoveryFilters({open,filter,draft,onClose,onApply}:Props){
 const [working,setWorking]=useState<DiscoveryFilter>(filter);
 useEffect(()=>{if(open)setWorking(filter);},[open,filter]);
 useEffect(()=>{
  if(!open)return;
  const listener=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();};
  document.addEventListener("keydown",listener);
  return ()=>document.removeEventListener("keydown",listener);
 },[open,onClose]);
 if(!open)return null;
 const set=<K extends keyof DiscoveryFilter>(key:K,value:DiscoveryFilter[K])=>setWorking(prev=>({...prev,[key]:value}));
 return <div className="discovery-modal-backdrop" role="presentation" onClick={onClose}>
   <section role="dialog" aria-modal="true" aria-label="Фильтры знакомств" className="discovery-filter-sheet"
     onClick={e=>e.stopPropagation()}>
     <div className="discovery-sheet-grip" aria-hidden="true"/>
     <header className="discovery-sheet-heading"><h2><SlidersHorizontal size={18}/> Фильтры</h2>
       <button type="button" className="discovery-icon-action" aria-label="Закрыть фильтры" onClick={onClose}><X size={20}/></button>
     </header>
     <div className="discovery-filter-content">
       <fieldset className="discovery-filter-group"><legend>Кого ищем?</legend>
         <div className="discovery-filter-options">
         {([["everyone","Всех"],["women","Женщин"],["men","Мужчин"]] as const).map(([value,label])=>
           <button type="button" key={value} className={"discovery-option"+(working.audience===value?" selected":"")}
             aria-pressed={working.audience===value} onClick={()=>set("audience",value)}>{label}</button>)}
         </div>
       </fieldset>
       <DoubleAgeRange min={working.minAge} max={working.maxAge} onChange={(minAge,maxAge)=>setWorking(p=>({...p,minAge,maxAge}))}/>
       <fieldset className="discovery-filter-group"><legend>География</legend>
         <div className="discovery-filter-options">
         {([["radius","По радиусу"],["country","Моя страна"],["world","Весь мир"]] as const).map(([value,label])=>
           <button type="button" key={value} className={"discovery-option"+(working.scope===value?" selected":"")}
             aria-pressed={working.scope===value} onClick={()=>set("scope",value)}>{label}</button>)}
         </div>
         {working.scope==="radius"&&<div className="discovery-radius">
           <label htmlFor="discovery-radius">Радиус: <strong>{working.radius.toLocaleString("ru")} км</strong></label>
           <input id="discovery-radius" type="range" min={0} max={100} value={positionAt(working.radius)}
             onChange={e=>set("radius",radiusAt(Number(e.target.value)))}/>
           <span>1–5000 км</span>
         </div>}
         {working.scope==="country"&&!draft.countryCode&&<p className="hint">Страна в черновике не выбрана: географическое ограничение пока не применится.</p>}
         {working.scope==="radius"&&<p className="hint">Расстояния демонстрационные и не обозначают реальное положение людей.</p>}
       </fieldset>
       <fieldset className="discovery-filter-group"><legend>Цель знакомства</legend>
         <select className="glass-control" value={working.goal} onChange={e=>set("goal",e.target.value as DiscoveryFilter["goal"])}>
           <option value="all">Любая цель</option>
           {goals.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}
         </select>
       </fieldset>
       <label className="discovery-filter-toggle">
         <input type="checkbox" checked={working.commonOnly} onChange={e=>set("commonOnly",e.target.checked)}/>
         <span>Только с общими интересами</span>
       </label>
     </div>
     <footer className="discovery-sheet-footer">
       <button type="button" className="discovery-reset" onClick={()=>setWorking(defaultFilters)}><RotateCcw size={15}/> Сбросить</button>
       <button type="button" className="discovery-apply" onClick={()=>onApply(working)}>Показать анкеты</button>
     </footer>
   </section>
 </div>;
}
