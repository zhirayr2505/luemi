import {useEffect,useState} from "react";
import {createPortal} from "react-dom";
import {ArrowLeft,BriefcaseBusiness,GraduationCap,Heart,PawPrint,Ruler,Sparkles,UsersRound} from "lucide-react";
import type {RegistrationDraft} from "./model";
import {GlassChoice,GlassField} from "../ui/Glass";

const lifestyleOptions=["Не курю","Люблю спорт","Люблю путешествия","Ранний подъём"];
const rhythmOptions=["Люблю уютные вечера","Часто выбираюсь на природу","Ночные прогулки","Люблю готовить"];
const valuesOptions=["Ценю честность","Люблю глубокие разговоры","Открыт(а) новому","Ценю чувство юмора"];
const petOptions=["Кошки","Собаки","Другие животные"];
const familyOptions=["Хочу семью","Уже есть дети","Не планирую детей","Пока не решил(а)"];

type OptionalProfileDetailsProps={
 data:RegistrationDraft;
 patch:(values:Partial<RegistrationDraft>)=>void;
 open:boolean;
 onOpenChange:(open:boolean)=>void;
 overlayHost:HTMLElement|null;
};
export function OptionalProfileDetails({data,patch,open,onOpenChange,overlayHost}:OptionalProfileDetailsProps){
 const [factsText,setFactsText]=useState(data.facts.join("\n"));
 const [present,setPresent]=useState(open);
 const [leaving,setLeaving]=useState(false);
 useEffect(()=>{
  if(open){setPresent(true);setLeaving(false);return;}
  if(!present)return;
  setLeaving(true);
  const timeout=window.setTimeout(()=>{setPresent(false);setLeaving(false);},280);
  return()=>window.clearTimeout(timeout);
 },[open,present]);
 const toggle=(key:"lifestyle"|"pets"|"family",value:string)=>{
  const values=data[key];patch({[key]:values.includes(value)?values.filter(item=>item!==value):[...values,value]});
 };
 const close=()=>{
  if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
  onOpenChange(false);
 };
 const save=()=>{patch({facts:factsText.split(/\n/).map(value=>value.trim()).filter(Boolean).slice(0,3)});close();};
 return <section className="optional-profile-details">
   <button type="button" className="optional-profile-toggle" aria-haspopup="dialog" aria-expanded={open}
     onClick={()=>{setFactsText(data.facts.join("\n"));onOpenChange(true);}}>
     <span><Sparkles size={17}/><strong>Добавить о себе</strong><small>Необязательно · можно заполнить позже</small></span>
     <ArrowLeft size={19} style={{transform:"rotate(180deg)"}} aria-hidden="true"/>
   </button>
   {present&&overlayHost&&createPortal(<div className={"optional-profile-screen"+(leaving?" is-leaving":"")}
     role="dialog" aria-modal={open} aria-labelledby="optional-profile-title" aria-hidden={leaving||undefined}>
     <header className="optional-profile-screen-head">
       <button type="button" onClick={close} aria-label="Назад"><ArrowLeft size={21}/></button>
       <div><h2 id="optional-profile-title">Добавить о себе</h2><small>Заполни только то, чем хочется поделиться</small></div>
     </header>
     <div className="optional-profile-screen-body">
       <div className="optional-field-row">
         <GlassField label="Рост, см"><div className="optional-input-wrap"><Ruler size={17}/><input className="glass-control" inputMode="numeric" type="number" min={100} max={250} placeholder="178" value={data.height??""} onChange={event=>patch({height:event.target.value?Number(event.target.value):null})}/></div></GlassField>
         <GlassField label="Род занятий"><div className="optional-input-wrap"><BriefcaseBusiness size={17}/><input className="glass-control" maxLength={120} placeholder="Дизайнер" value={data.occupation} onChange={event=>patch({occupation:event.target.value})}/></div></GlassField>
       </div>
       <GlassField label="Образование"><div className="optional-input-wrap"><GraduationCap size={17}/><input className="glass-control" maxLength={120} placeholder="Университет" value={data.education} onChange={event=>patch({education:event.target.value})}/></div></GlassField>
       <div className="optional-choice-group"><span className="field-label"><Heart size={16}/> Что про тебя</span><div className="optional-choice-grid">{lifestyleOptions.map(value=><GlassChoice key={value} chosen={data.lifestyle.includes(value)} onClick={()=>toggle("lifestyle",value)}>{value}</GlassChoice>)}</div></div>
       <div className="optional-choice-group"><span className="field-label"><Sparkles size={16}/> Твой ритм</span><div className="optional-choice-grid">{rhythmOptions.map(value=><GlassChoice key={value} chosen={data.lifestyle.includes(value)} onClick={()=>toggle("lifestyle",value)}>{value}</GlassChoice>)}</div></div>
       <div className="optional-choice-group"><span className="field-label"><Heart size={16}/> Что для тебя важно</span><div className="optional-choice-grid">{valuesOptions.map(value=><GlassChoice key={value} chosen={data.lifestyle.includes(value)} onClick={()=>toggle("lifestyle",value)}>{value}</GlassChoice>)}</div></div>
       <div className="optional-choice-group"><span className="field-label"><PawPrint size={16}/> Домашние животные</span><div className="optional-choice-grid">{petOptions.map(value=><GlassChoice key={value} chosen={data.pets.includes(value)} onClick={()=>toggle("pets",value)}>{value}</GlassChoice>)}</div></div>
       <div className="optional-choice-group"><span className="field-label"><UsersRound size={16}/> Семья и планы</span><div className="optional-choice-grid">{familyOptions.map(value=><GlassChoice key={value} chosen={data.family.includes(value)} onClick={()=>toggle("family",value)}>{value}</GlassChoice>)}</div></div>
       <GlassField label="Факты о тебе" hint="До трёх коротких фактов, по одному на строку"><textarea className="glass-control optional-facts" maxLength={240} placeholder={"Люблю рассветы\nУмею готовить хачапури"} value={factsText} onChange={event=>setFactsText(event.target.value.split("\n").slice(0,3).join("\n"))}/></GlassField>
     </div>
     <footer className="optional-profile-screen-foot"><button type="button" onClick={close}>Позже</button><button type="button" onClick={save}>Сохранить</button></footer>
   </div>,overlayHost)}
 </section>;
}
