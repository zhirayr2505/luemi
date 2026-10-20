import {X,MapPin,Heart,Languages,ShieldCheck,Crown} from "lucide-react";
import {useEffect,useRef} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import type {DemoPerson} from "./model";
import {goals} from "../registration/model";
import {InterestChip} from "../ui/InterestCatalog";
import {languages} from "../ui/Languages";
import {Flag} from "../ui/Flag";
import {PhotoCarousel} from "../ui/PhotoCarousel";

type Swipe={id:number;x:number;y:number;time:number;horizontal:boolean};

/** Telegram-like swipe-to-close: only transform the inner page, never the
 * scrolling dialog itself. Portrait photos retain their own swipe gestures. */
export function DemoProfile({person,onClose}:{person:DemoPerson;onClose:()=>void}){
 const goal=person.goal==="undecided"?undefined:goals.find(g=>g.id===person.goal);
 const swipe=useRef<Swipe|null>(null);
 const surface=useRef<HTMLDivElement>(null);
 const finishTimer=useRef<number|null>(null);
 const closing=useRef(false);
 useEffect(()=>()=>{if(finishTimer.current!==null)window.clearTimeout(finishTimer.current);},[]);
 const reset=()=>{
   swipe.current=null;
   if(closing.current)return;
   const element=surface.current;if(!element)return;
   element.style.transition="transform 230ms cubic-bezier(.2,.8,.2,1)";
   element.style.transform="translate3d(0,0,0)";
 };
 const down=(event:ReactPointerEvent<HTMLElement>)=>{
   if(closing.current||(event.pointerType==="mouse"&&event.button!==0))return;
   // PhotoCarousel handles the full horizontal image area. Never steal it.
   if((event.target as HTMLElement).closest(".discovery-profile-photo,.carousel-frame,button"))return;
   swipe.current={id:event.pointerId,x:event.clientX,y:event.clientY,time:performance.now(),horizontal:false};
 };
 const move=(event:ReactPointerEvent<HTMLElement>)=>{
   const p=swipe.current;if(!p||p.id!==event.pointerId)return;
   const dx=event.clientX-p.x,dy=event.clientY-p.y;
   if(!p.horizontal){
     if(Math.abs(dy)>13&&Math.abs(dy)>Math.abs(dx)){swipe.current=null;return;}
     if(dx<11||dx<Math.abs(dy)*1.45)return;
     p.horizontal=true;
     try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* old WebView */}
   }
   if(event.cancelable)event.preventDefault();
   const element=surface.current;if(!element)return;
   element.style.transition="none";
   element.style.transform="translate3d("+Math.min(Math.max(dx,0),window.innerWidth)+"px,0,0)";
 };
 const up=(event:ReactPointerEvent<HTMLElement>)=>{
   const p=swipe.current;
   if(!p||p.id!==event.pointerId)return;
   swipe.current=null;
   if(!p.horizontal){reset();return;}
   const dx=event.clientX-p.x,elapsed=Math.max(performance.now()-p.time,1);
   if(dx>90||dx/elapsed>.65){
     if(closing.current)return;
     closing.current=true;
     const element=surface.current;
     if(element){
       element.style.transition="transform 230ms cubic-bezier(.2,.8,.2,1)";
       element.style.transform="translate3d(100vw,0,0)";
     }
     // On devices respecting reduced motion / backgrounded WebViews, still close.
     finishTimer.current=window.setTimeout(onClose,240);
   }else reset();
 };
 return <section role="dialog" aria-modal="true" aria-label={"Демо-профиль "+person.name}
   className="discovery-profile-overlay" onPointerDown={down} onPointerMove={move}
   onPointerUp={up} onPointerCancel={reset}>
   <div className="discovery-profile-swipe-surface" ref={surface}>
     <header className="discovery-profile-top"><span className="discovery-demo-label">Демо-профиль</span>
       <button type="button" onClick={onClose} className="discovery-icon-action" aria-label="Закрыть профиль"><X size={21}/></button>
     </header>
     <div className="discovery-profile-scroll">
       <div className="discovery-profile-photo"><PhotoCarousel photos={person.photos} name={person.name} age={person.age}/></div>
       <div className="discovery-profile-facts">
         <div className="discovery-place"><Flag code={person.countryCode} size={22}/><MapPin size={16}/>{person.city}, {person.country}</div>
         {person.premium&&<span className="discovery-profile-premium"><Crown fill="#ffd878" color="#e8af35" size={19}/> Premium · демо</span>}
         {goal&&<span className="discovery-goal-badge"><Heart size={15}/>{goal.label}</span>}
         <h3>О себе</h3><p>{person.about}</p>
         <h3>Интересы</h3><div className="chips">{person.interests.map(id=><InterestChip key={id} id={id}/>)}</div>
         <h3><Languages size={17}/> Языки общения</h3><div className="discovery-language-flags">{person.languages.map(id=>{
           const lang=languages.find(l=>l.id===id);
           return lang?<span key={id} title={lang.name}><Flag code={lang.flag} size={26} title={lang.name}/></span>:null;
         })}</div>
         <p className="discovery-notice"><ShieldCheck size={16}/> Этот персонаж создан только для демонстрации. Реальных знакомств здесь пока нет.</p>
       </div>
     </div>
   </div>
 </section>;
}
