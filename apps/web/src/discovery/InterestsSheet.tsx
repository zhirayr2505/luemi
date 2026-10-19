import {X,Heart} from "lucide-react";
import {InterestChip} from "../ui/InterestCatalog";
export function DiscoveryInterestsSheet({name,ids,onClose}:{name:string;ids:string[];onClose:()=>void}){
 return <div className="discovery-modal-backdrop" onClick={onClose}>
  <section className="discovery-interests-sheet" role="dialog" aria-modal="true"
   aria-label={"Все интересы: "+name} onClick={e=>e.stopPropagation()}>
   <div className="discovery-sheet-grip" aria-hidden="true"/>
   <header className="discovery-interests-heading">
     <h2><Heart size={17}/> Интересы {name}</h2>
     <button className="discovery-icon-action" type="button" onClick={onClose} aria-label="Закрыть интересы"><X size={19}/></button>
   </header>
   <div className="chips discovery-all-interests">{ids.map(id=><InterestChip key={id} id={id}/>)}</div>
   <p className="hint">Это демонстрационная анкета.</p>
  </section>
 </div>;
}
