import {useState} from "react";
import {ArrowLeft,BriefcaseBusiness,GraduationCap,Heart,PawPrint,Ruler,Sparkles,UsersRound} from "lucide-react";
import type {RegistrationDraft} from "./model";
import {GlassChoice,GlassField} from "../ui/Glass";

const lifestyleOptions=["Не курю","Люблю спорт","Люблю путешествия","Ранний подъём"];
const petOptions=["Кошки","Собаки","Другие животные"];
const familyOptions=["Хочу семью","Уже есть дети","Не планирую детей","Пока не решил(а)"];

export function OptionalProfileDetails({data,patch}:{data:RegistrationDraft;patch:(values:Partial<RegistrationDraft>)=>void}){
 const [open,setOpen]=useState(false);
 const toggle=(key:"lifestyle"|"pets"|"family",value:string)=>{
  const values=data[key];patch({[key]:values.includes(value)?values.filter(item=>item!==value):[...values,value]});
 };
 const close=()=>setOpen(false);
 return <section className="optional-profile-details">
   <button type="button" className="optional-profile-toggle" onClick={()=>setOpen(true)}>
     <span><Sparkles size={17}/><strong>Добавить о себе и семье</strong><small>Необязательно — можно позже в профиле</small></span>
     <ArrowLeft size={19} style={{transform:"rotate(180deg)"}} aria-hidden="true"/>
   </button>
   {open&&<div className="optional-profile-screen" role="dialog" aria-modal="true" aria-labelledby="optional-profile-title">
     <header className="optional-profile-screen-head">
       <button type="button" onClick={close} aria-label="Назад"><ArrowLeft size={21}/></button>
       <div><h2 id="optional-profile-title">Немного о тебе</h2><small>Заполни только то, чем хочется поделиться</small></div>
     </header>
     <div className="optional-profile-screen-body">
       <div className="optional-field-row">
         <GlassField label="Рост, см"><div className="optional-input-wrap"><Ruler size={17}/><input className="glass-control" inputMode="numeric" type="number" min={100} max={250} placeholder="178" value={data.height??""} onChange={event=>patch({height:event.target.value?Number(event.target.value):null})}/></div></GlassField>
         <GlassField label="Род занятий"><div className="optional-input-wrap"><BriefcaseBusiness size={17}/><input className="glass-control" maxLength={120} placeholder="Дизайнер" value={data.occupation} onChange={event=>patch({occupation:event.target.value})}/></div></GlassField>
       </div>
       <GlassField label="Образование"><div className="optional-input-wrap"><GraduationCap size={17}/><input className="glass-control" maxLength={120} placeholder="Университет" value={data.education} onChange={event=>patch({education:event.target.value})}/></div></GlassField>
       <div className="optional-choice-group"><span className="field-label"><Heart size={16}/> Что про тебя</span><div className="optional-choice-grid">{lifestyleOptions.map(value=><GlassChoice key={value} chosen={data.lifestyle.includes(value)} onClick={()=>toggle("lifestyle",value)}>{value}</GlassChoice>)}</div></div>
       <div className="optional-choice-group"><span className="field-label"><PawPrint size={16}/> Домашние животные</span><div className="optional-choice-grid">{petOptions.map(value=><GlassChoice key={value} chosen={data.pets.includes(value)} onClick={()=>toggle("pets",value)}>{value}</GlassChoice>)}</div></div>
       <div className="optional-choice-group"><span className="field-label"><UsersRound size={16}/> Семья и планы</span><div className="optional-choice-grid">{familyOptions.map(value=><GlassChoice key={value} chosen={data.family.includes(value)} onClick={()=>toggle("family",value)}>{value}</GlassChoice>)}</div></div>
       <GlassField label="Факты о тебе" hint="До трёх коротких фактов, по одному на строку"><textarea className="glass-control optional-facts" maxLength={240} placeholder="Люблю рассветы\nУмею готовить хачапури" value={data.facts.join("\n")} onChange={event=>patch({facts:event.target.value.split(/\n+/).map(value=>value.trim()).filter(Boolean).slice(0,3)})}/></GlassField>
     </div>
     <footer className="optional-profile-screen-foot"><button type="button" onClick={close}>Пропустить</button><button type="button" onClick={close}>Сохранить</button></footer>
   </div>}
 </section>;
}
