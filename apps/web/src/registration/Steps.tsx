import {useRef,useState} from "react";
import type {CSSProperties,ReactNode} from "react";
import {Mars,Venus,Users,Languages,Check,Globe2} from "lucide-react";
import {GlassField,GlassCheckbox,GlassChoice,GlassTextInput} from "../ui/Glass";
import {categories,InterestChip,tint} from "../ui/InterestCatalog";
import {GeoPicker} from "./GeoPicker";
import {PhotoSorter,type PhotoItem} from "./PhotoSorter";
import {RegistrationPreview} from "./Preview";
import {cleanName,type RegistrationDraft} from "./model";

export type {PhotoItem} from "./PhotoSorter";
export interface StepProps {
 data:RegistrationDraft;patch:(values:Partial<RegistrationDraft>)=>void;
 photos:PhotoItem[];addPhotos:(files:File[])=>void;removePhoto:(id:string)=>void;
 movePhoto:(from:number,to:number)=>void;editStep:(step:number)=>void;step:number;
}
function ChoiceRow({label,children}:{label:string;children:ReactNode}){
 return <div className="choice-section"><div className="field-label">{label}</div><div className="choice-grid">{children}</div></div>;
}
function DoubleAgeRange({min,max,onChange}:{min:number;max:number;onChange:(min:number,max:number)=>void}){
 const start=(min-18)/62*100,end=(max-18)/62*100;
 return <div className="age-range glass-panel">
   <div className="range-title"><span>Возраст</span><strong>{min}–{max}</strong></div>
   <div className="double-age-range" onPointerDownCapture={e=>{
     const f=document.activeElement;if(f instanceof HTMLInputElement&&f.type!=="range")f.blur();
   }}>
     <div className="double-range-track" aria-hidden="true"><span style={{left:start+"%",width:(end-start)+"%"}}/></div>
     <input className="range-min" type="range" min={18} max={80} value={min} aria-label="Минимальный возраст"
       onChange={e=>onChange(Math.min(Number(e.target.value),max),max)}/>
     <input className="range-max" type="range" min={18} max={80} value={max} aria-label="Максимальный возраст"
       onChange={e=>onChange(min,Math.max(Number(e.target.value),min))}/>
     <div className="range-ends"><span>18</span><span>80</span></div>
   </div>
 </div>;
}
const languageNames=["Русский","English","Հայերեն"];

export function RegistrationStep({data,patch,photos,addPhotos,removePhoto,movePhoto,editStep,step}:StepProps){
 const month=useRef<HTMLInputElement>(null),year=useRef<HTMLInputElement>(null);
 const [category,setCategory]=useState("Популярное");
 const date=(field:"day"|"month"|"year",value:string)=>{
   const clean=value.replace(/\D/g,"").slice(0,field==="year"?4:2);
   patch({[field]:clean});
   if(field==="day"&&clean.length===2)month.current?.focus();
   if(field==="month"&&clean.length===2)year.current?.focus();
   if(field==="year"&&clean.length===4)year.current?.blur();
 };
 const toggleInterest=(value:string)=>patch({interests:data.interests.includes(value)
   ?data.interests.filter(x=>x!==value):data.interests.length>=15?data.interests:[...data.interests,value]});
 if(step===1)return <div className="form-stack">
   <GlassField label="Твоё имя"><GlassTextInput autoComplete="given-name" maxLength={48} value={data.name}
     placeholder="Как тебя зовут?" onChange={e=>patch({name:cleanName(e.target.value)})}/></GlassField>
   <GlassCheckbox checked={data.trialConsent} onChange={trialConsent=>patch({trialConsent})}>
     Я понимаю, что это тест интерфейса. Данные и фотографии не публикуются и не передаются на сервер.
   </GlassCheckbox>
   <p className="hint">Для полноценной регистрации будут подготовлены отдельные условия использования и политика приватности.</p>
 </div>;
 if(step===2)return <div className="form-stack">
   <div className="field-label">Дата рождения</div>
   <div className="dob-grid">
     <GlassField label="День"><GlassTextInput inputMode="numeric" autoComplete="bday-day" placeholder="ДД" value={data.day} onChange={e=>date("day",e.target.value)}/></GlassField>
     <GlassField label="Месяц"><GlassTextInput ref={month} inputMode="numeric" autoComplete="bday-month" placeholder="ММ" value={data.month} onChange={e=>date("month",e.target.value)}/></GlassField>
     <GlassField label="Год"><GlassTextInput ref={year} inputMode="numeric" autoComplete="bday-year" placeholder="ГГГГ" value={data.year} onChange={e=>date("year",e.target.value)}/></GlassField>
   </div>
   <ChoiceRow label="Пол">
     <GlassChoice chosen={data.gender==="man"} onClick={()=>patch({gender:"man"})} icon={<Mars size={17}/>}>Мужчина</GlassChoice>
     <GlassChoice chosen={data.gender==="woman"} onClick={()=>patch({gender:"woman"})} icon={<Venus size={17}/>}>Женщина</GlassChoice>
     <GlassChoice chosen={data.gender==="other"} onClick={()=>patch({gender:"other"})} icon={<Users size={17}/>}>Другой вариант</GlassChoice>
   </ChoiceRow>
   <p className="hint">Только 18+. Правильность даты будет дополнительно проверяться на сервере перед публикацией.</p>
 </div>;
 if(step===3)return <div className="form-stack"><GeoPicker data={data} patch={patch}/></div>;
 if(step===4)return <div className="form-stack">
   <ChoiceRow label="Кого хочешь встретить?">
     <GlassChoice chosen={data.audience==="women"} onClick={()=>patch({audience:"women"})} icon={<Venus size={17}/>}>Женщин</GlassChoice>
     <GlassChoice chosen={data.audience==="men"} onClick={()=>patch({audience:"men"})} icon={<Mars size={17}/>}>Мужчин</GlassChoice>
     <GlassChoice chosen={data.audience==="everyone"} onClick={()=>patch({audience:"everyone"})} icon={<Users size={17}/>}>Всех</GlassChoice>
   </ChoiceRow>
   <DoubleAgeRange min={data.ageMin} max={data.ageMax} onChange={(ageMin,ageMax)=>patch({ageMin,ageMax})}/>
   <ChoiceRow label="Цель знакомства">
     <GlassChoice chosen={data.goal==="relationship"} onClick={()=>patch({goal:"relationship"})}>Отношения</GlassChoice>
     <GlassChoice chosen={data.goal==="dates"} onClick={()=>patch({goal:"dates"})}>Свидания</GlassChoice>
     <GlassChoice chosen={data.goal==="friends"} onClick={()=>patch({goal:"friends"})}>Общение</GlassChoice>
   </ChoiceRow>
 </div>;
 if(step===5)return <div className="form-stack interests-step">
   <div className="category-row" role="group" aria-label="Категории интересов">
     {categories.map(x=><button type="button" key={x.name}
       className={"category-chip"+(x.name===category?" selected":"")} style={tint(x.colors) as CSSProperties}
       onClick={()=>setCategory(x.name)} aria-pressed={x.name===category}>
       <x.icon size={17} strokeWidth={1.8}/>{x.name}
     </button>)}
   </div>
   <div className="chips interest-choices">
     {categories.find(x=>x.name===category)?.items.map(x=>
       <InterestChip key={x.name} name={x.name} selected={data.interests.includes(x.name)} onClick={()=>toggleInterest(x.name)}/>)}
   </div>
   <div className="selected-interests">
     <strong>Выбрано · {data.interests.length} из 15</strong>
     <div className="chips">{data.interests.length?data.interests.map(x=>
       <InterestChip key={x} name={x} selected onClick={()=>toggleInterest(x)}/>):<span className="hint">Пока ничего не выбрано</span>}</div>
   </div>
 </div>;
 if(step===6)return <div className="form-stack">
   <GlassField label="Немного о себе"><textarea className="glass-control glass-textarea" rows={6}
      placeholder="Что тебя радует? Чем любишь заниматься?"
      value={data.about} maxLength={1500} onChange={e=>patch({about:[...e.target.value].slice(0,750).join("")})}/></GlassField>
   <p className="char-count">{[...data.about].length} / 750</p>
   <ChoiceRow label="Языки общения">
     {languageNames.map(name=><GlassChoice key={name} chosen={data.languages.includes(name)}
       icon={<Languages size={16}/>} onClick={()=>patch({languages:data.languages.includes(name)
         ?data.languages.filter(x=>x!==name):[...data.languages,name]})}>{name}</GlassChoice>)}
   </ChoiceRow>
   <p className="hint"><Check size={14} aria-hidden="true"/> Этот шаг можно пропустить. Вопросы о характере и ценностях появятся после регистрации.</p>
 </div>;
 if(step===7)return <div className="form-stack"><PhotoSorter photos={photos} addPhotos={addPhotos}
   removePhoto={removePhoto} movePhoto={movePhoto}/></div>;
 return <div className="form-stack"><RegistrationPreview data={data} photos={photos} editStep={editStep}/></div>;
}
