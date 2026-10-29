import {useState} from "react";
import {ChevronDown, Ruler, Sparkles} from "lucide-react";
import type {RegistrationDraft} from "./model";
import {GlassChoice,GlassField} from "../ui/Glass";

const lifestyleOptions=["Не курю","Люблю спорт","Люблю путешествия","Ранний подъём"];
const petOptions=["Кошки","Собаки","Другие животные"];

export function OptionalProfileDetails({data,patch}:{data:RegistrationDraft;patch:(values:Partial<RegistrationDraft>)=>void}){
 const [open,setOpen]=useState(false);
 const toggle=(key:"lifestyle"|"pets",value:string)=>{
  const values=data[key];patch({[key]:values.includes(value)?values.filter(item=>item!==value):[...values,value]});
 };
 return <section className={"optional-profile-details"+(open?" is-open":"")}>
   <button type="button" className="optional-profile-toggle" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
     <span><Sparkles size={17}/><strong>Добавить о себе</strong><small>Необязательно — можно позже в профиле</small></span>
     <ChevronDown size={19}/>
   </button>
   {open&&<div className="optional-profile-fields">
     <div className="optional-field-row">
       <GlassField label="Рост, см"><div className="optional-input-wrap"><Ruler size={17}/><input className="glass-control" inputMode="numeric" type="number" min={100} max={250} placeholder="Например, 178" value={data.height??""} onChange={event=>patch({height:event.target.value?Number(event.target.value):null})}/></div></GlassField>
       <GlassField label="Занятие"><input className="glass-control" maxLength={120} placeholder="Например, дизайнер" value={data.occupation} onChange={event=>patch({occupation:event.target.value})}/></GlassField>
     </div>
     <GlassField label="Образование"><input className="glass-control" maxLength={120} placeholder="Например, университет" value={data.education} onChange={event=>patch({education:event.target.value})}/></GlassField>
     <div className="optional-choice-group"><span className="field-label">Что про тебя</span><div className="optional-choice-grid">{lifestyleOptions.map(value=><GlassChoice key={value} chosen={data.lifestyle.includes(value)} onClick={()=>toggle("lifestyle",value)}>{value}</GlassChoice>)}</div></div>
     <div className="optional-choice-group"><span className="field-label">Домашние животные</span><div className="optional-choice-grid">{petOptions.map(value=><GlassChoice key={value} chosen={data.pets.includes(value)} onClick={()=>toggle("pets",value)}>{value}</GlassChoice>)}</div></div>
     <GlassField label="Факты о тебе" hint="До трёх коротких фактов, по одному на строку"><textarea className="glass-control optional-facts" maxLength={240} placeholder="Люблю рассветы\nУмею готовить хачапури" value={data.facts.join("\n")} onChange={event=>patch({facts:event.target.value.split(/\n+/).map(value=>value.trim()).filter(Boolean).slice(0,3)})}/></GlassField>
   </div>}
 </section>;
}
