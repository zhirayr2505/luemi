import {X,MapPin,Heart,Languages,ShieldCheck} from "lucide-react";
import type {DemoPerson} from "./model";
import {goals} from "../registration/model";
import {InterestChip} from "../ui/InterestCatalog";
import {languages} from "../ui/Languages";
import {Flag} from "../ui/Flag";
import {PhotoCarousel} from "../ui/PhotoCarousel";
export function DemoProfile({person,onClose}:{person:DemoPerson;onClose:()=>void}){
 const goal=goals.find(g=>g.id===person.goal);
 return <section role="dialog" aria-modal="true" aria-label={"Демо-профиль "+person.name} className="discovery-profile-overlay">
   <header className="discovery-profile-top"><span className="discovery-demo-label">Демо-профиль</span>
     <button type="button" onClick={onClose} className="discovery-icon-action" aria-label="Закрыть профиль"><X size={21}/></button></header>
   <div className="discovery-profile-scroll">
     <div className="discovery-profile-photo"><PhotoCarousel photos={person.photos} name={person.name} age={person.age}/></div>
     <div className="discovery-profile-facts">
       <div className="discovery-place"><Flag code={person.countryCode} size={22}/><MapPin size={16}/>{person.city}, {person.country}</div>
       {goal&&<span className="discovery-goal-badge"><Heart size={15}/>{goal.label}</span>}
       <h3>О себе</h3><p>{person.about}</p>
       <h3>Интересы</h3><div className="chips">{person.interests.map(id=><InterestChip key={id} id={id}/>)}</div>
       <h3><Languages size={17}/> Языки общения</h3><div className="discovery-language-flags">{person.languages.map(id=>{
         const lang=languages.find(l=>l.id===id);return lang?<span key={id} title={lang.name}><Flag code={lang.flag} size={26} title={lang.name}/></span>:null;
       })}</div>
       <p className="discovery-notice"><ShieldCheck size={16}/> Этот персонаж создан только для демонстрации. Реальных знакомств здесь пока нет.</p>
     </div>
   </div>
 </section>;
}
