import {X,MapPin,Heart,Languages,ShieldCheck,Crown} from "lucide-react";
import {useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import type {DemoPerson} from "./model";
import {goals} from "../registration/model";
import {InterestChip} from "../ui/InterestCatalog";
import {languages} from "../ui/Languages";
import {Flag} from "../ui/Flag";
import {PhotoCarousel} from "../ui/PhotoCarousel";
export function DemoProfile({person,onClose}:{person:DemoPerson;onClose:()=>void}){
 const goal=person.goal==="undecided"?undefined:goals.find(g=>g.id===person.goal);
 const pointer=useRef<{id:number;x:number;y:number;t:number;dragging:boolean}|null>(null);
 const [offset,setOffset]=useState(0);
 const down=(event:ReactPointerEvent<HTMLElement>)=>{
   if(event.pointerType==="mouse"&&event.button!==0)return;
   if((event.target as HTMLElement).closest(".discovery-profile-photo,.carousel-frame,button"))return;
   pointer.current={id:event.pointerId,x:event.clientX,y:event.clientY,t:performance.now(),dragging:false};
 };
 const move=(event:ReactPointerEvent<HTMLElement>)=>{
   const p=pointer.current;if(!p||p.id!==event.pointerId)return;
   const dx=event.clientX-p.x,dy=event.clientY-p.y;
   if(!p.dragging){
     if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){pointer.current=null;return;}
     if(dx<9||dx<Math.abs(dy)*1.25)return;
     p.dragging=true;try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* WebView fallback */}
   }
   event.preventDefault();setOffset(Math.max(0,Math.min(window.innerWidth,dx)));
 };
 const up=(event:ReactPointerEvent<HTMLElement>)=>{
   const p=pointer.current;pointer.current=null;
   if(!p||p.id!==event.pointerId)return;
   const dx=event.clientX-p.x,velocity=dx/Math.max(1,performance.now()-p.t);
   setOffset(0);
   if(p.dragging&&(dx>85||velocity>.6))onClose();
 };
 return <section role="dialog" aria-modal="true" aria-label={"Демо-профиль "+person.name} className="discovery-profile-overlay" onPointerDown={down} onPointerMove={move}
   onPointerUp={up} onPointerCancel={()=>{pointer.current=null;setOffset(0);}}
   style={{transform:offset?"translate3d("+offset+"px,0,0)":undefined,
      transition:offset?"none":"transform .23s cubic-bezier(.2,.8,.2,1)"}}>
   <header className="discovery-profile-top"><span className="discovery-demo-label">Демо-профиль</span>
     <button type="button" onClick={onClose} className="discovery-icon-action" aria-label="Закрыть профиль"><X size={21}/></button></header>
   <div className="discovery-profile-scroll">
     <div className="discovery-profile-photo"><PhotoCarousel photos={person.photos} name={person.name} age={person.age}/></div>
     <div className="discovery-profile-facts">
       <div className="discovery-place"><Flag code={person.countryCode} size={22}/><MapPin size={16}/>{person.city}, {person.country}</div>
       {person.premium&&<span className="discovery-profile-premium"><Crown fill="#ffd878" color="#e8af35" size={19}/> Premium · демо</span>}
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
