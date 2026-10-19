import {useEffect,useRef,useState} from "react";
import type {CSSProperties,ReactNode} from "react";
import {Check,Info,Trash2} from "lucide-react";
import {goals,goalIcons} from "../ui/Goals";
import {LanguagePicker} from "./LanguagePicker";
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
 movePhoto:(from:number,to:number)=>void;editStep:(step:number)=>void;resetDraft:()=>void;step:number;
}
function GenderIcon({type}:{type:"man"|"woman"|"everyone"}){
 return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
   strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
   {type==="everyone"?<><circle cx="8" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2.5 20v-3a5.5 5.5 0 0 1 11 0v3m-2-3a5.5 5.5 0 0 1 10.5 0v3"/></>:
    type==="man"?<><circle cx="10" cy="14" r="6"/><path d="M14.5 9.5 21 3m-6 0h6v6"/></>:
    <><circle cx="12" cy="9" r="6"/><path d="M12 15v7m-4-3.5h8"/></>}
 </svg>;
}
function ChoiceRow({label,children}:{label:string;children:ReactNode}){
 return <div className="choice-section"><div className="field-label">{label}</div><div className="choice-grid">{children}</div></div>;
}
function DoubleAgeRange({min,max,onChange}:{min:number;max:number;onChange:(min:number,max:number)=>void}){
 const start=(min-18)/62*100,end=(max-18)/62*100;
 return <div className="age-range glass-panel">
   <div className="range-title"><span>Возраст</span><strong>{min}–{max}</strong></div>
   <p className="age-caption">Выбери возраст людей, с которыми хочешь знакомиться</p>
   <div className="double-age-range" onPointerDownCapture={()=>{
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


export function RegistrationStep({data,patch,photos,addPhotos,removePhoto,movePhoto,editStep,resetDraft,step}:StepProps){
 const month=useRef<HTMLInputElement>(null),year=useRef<HTMLInputElement>(null);
 const [category,setCategory]=useState("Популярное");
 const [nameHint,setNameHint]=useState(false);
 const hintTimer=useRef<number|null>(null);
 useEffect(()=>()=>{if(hintTimer.current!==null)window.clearTimeout(hintTimer.current);},[]);
 const updateName=(raw:string)=>{
   const clean=cleanName(raw);
   patch({name:clean});
   if(clean!==raw){
     setNameHint(true);
     if(hintTimer.current!==null)window.clearTimeout(hintTimer.current);
     hintTimer.current=window.setTimeout(()=>setNameHint(false),2600);
   }else setNameHint(false);
 };
 const date=(field:"day"|"month"|"year",value:string)=>{
   const clean=value.replace(/\D/g,"").slice(0,field==="year"?4:2);
   patch({[field]:clean});
   if(field==="day"&&clean.length===2)month.current?.focus();
   if(field==="month"&&clean.length===2)year.current?.focus();
   if(field==="year"&&clean.length===4)year.current?.blur();
 };
 const toggleInterest=(value:string)=>patch({interests:data.interests.includes(value)
   ?data.interests.filter(x=>x!==value):data.interests.length>=15?data.interests:[...data.interests,value]});
 if(step===1)return <div className="form-stack step-name">
   <GlassField label="Твоё имя"><GlassTextInput autoComplete="given-name" maxLength={48} value={data.name}
     placeholder="Как тебя зовут?" onChange={e=>updateName(e.target.value)}/></GlassField>
   {nameHint&&<div className="name-input-hint" role="status"><Info size={17} aria-hidden="true"/>Можно использовать только буквы, пробел, тире и апостроф.</div>}
   <GlassCheckbox checked={data.trialConsent} onChange={trialConsent=>patch({trialConsent})}>
     Я понимаю, что это тест интерфейса. Данные и фотографии не публикуются и не передаются на сервер.
   </GlassCheckbox>
   <p className="hint">Тестовый черновик сохраняется только на этом устройстве. Очистка данных Telegram удалит его.</p>
   <button className="draft-clear-action" type="button" onClick={resetDraft}><Trash2 size={14}/> Очистить локальный черновик</button>
 </div>;
 if(step===2)return <div className="form-stack">
   <div className="field-label">Дата рождения</div>
   <div className="dob-grid">
     <GlassField label="День"><GlassTextInput inputMode="numeric" autoComplete="bday-day" placeholder="ДД" value={data.day} onChange={e=>date("day",e.target.value)}/></GlassField>
     <GlassField label="Месяц"><GlassTextInput ref={month} inputMode="numeric" autoComplete="bday-month" placeholder="ММ" value={data.month} onChange={e=>date("month",e.target.value)}/></GlassField>
     <GlassField label="Год"><GlassTextInput ref={year} inputMode="numeric" autoComplete="bday-year" placeholder="ГГГГ" value={data.year} onChange={e=>date("year",e.target.value)}/></GlassField>
   </div>
   <ChoiceRow label="Пол">
     <GlassChoice chosen={data.gender==="man"} onClick={()=>patch({gender:"man"})} icon={<GenderIcon type="man"/>}>Мужчина</GlassChoice>
     <GlassChoice chosen={data.gender==="woman"} onClick={()=>patch({gender:"woman"})} icon={<GenderIcon type="woman"/>}>Женщина</GlassChoice>
     <GlassChoice chosen={data.gender==="other"} onClick={()=>patch({gender:"other"})} icon={<GenderIcon type="everyone"/>}>Другой вариант</GlassChoice>
   </ChoiceRow>
   <p className="hint">Только 18+. Правильность даты будет дополнительно проверяться на сервере перед публикацией.</p>
 </div>;
 if(step===3)return <div className="form-stack compact-step"><GeoPicker data={data} patch={patch}/></div>;
 if(step===4)return <div className="form-stack compact-step preferences-step">
   <ChoiceRow label="Кого хочешь встретить?">
     <GlassChoice chosen={data.audience==="women"} onClick={()=>patch({audience:"women"})} icon={<GenderIcon type="woman"/>}>Женщин</GlassChoice>
     <GlassChoice chosen={data.audience==="men"} onClick={()=>patch({audience:"men"})} icon={<GenderIcon type="man"/>}>Мужчин</GlassChoice>
     <GlassChoice chosen={data.audience==="everyone"} onClick={()=>patch({audience:"everyone"})} icon={<GenderIcon type="everyone"/>}>Всех</GlassChoice>
   </ChoiceRow>
   <DoubleAgeRange min={data.ageMin} max={data.ageMax} onChange={(ageMin,ageMax)=>patch({ageMin,ageMax})}/>
   <div className="goals-section"><ChoiceRow label="Цель знакомства">
     {goals.map(goal=>{
       const Icon=goalIcons[goal.id];
       return <GlassChoice key={goal.id} chosen={data.goal===goal.id} icon={<Icon size={17}/>}
         onClick={()=>patch({goal:goal.id})}>{goal.label}</GlassChoice>;
     })}
   </ChoiceRow></div>
 </div>;
 if(step===5)return <div className="form-stack interests-step">
   <div className="category-row" role="group" aria-label="Категории интересов">
     {categories.map(entry=><button type="button" key={entry.name}
       className={"category-chip"+(entry.name===category?" selected":"")} style={tint(entry.colors) as CSSProperties}
       onClick={()=>setCategory(entry.name)} aria-pressed={entry.name===category}>
       <entry.icon size={17} strokeWidth={1.8}/>{entry.name}
     </button>)}
   </div>
   <div className="chips interest-choices">
     {categories.find(x=>x.name===category)?.items.map(item=>
       <InterestChip key={item.id} id={item.id} selected={data.interests.includes(item.id)} onClick={()=>toggleInterest(item.id)}/>)}
   </div>
 </div>;
 if(step===6)return <div className="form-stack">
   <GlassField label="Немного о себе"><textarea className="glass-control glass-textarea" rows={4}
      placeholder="Что тебя радует? Чем любишь заниматься?"
      value={data.about} maxLength={1500} onChange={e=>patch({about:[...e.target.value].slice(0,750).join("")})}/></GlassField>
   <p className="char-count">{[...data.about].length} / 750</p>
   <LanguagePicker selected={data.languages} onChange={languages=>patch({languages})}/>
   <p className="hint"><Check size={14} aria-hidden="true"/> Этот шаг можно пропустить.</p>
 </div>;
 if(step===7)return <div className="form-stack"><PhotoSorter photos={photos} addPhotos={addPhotos}
   removePhoto={removePhoto} movePhoto={movePhoto}/></div>;
 return <div className="form-stack"><RegistrationPreview data={data} photos={photos} editStep={editStep}/></div>;
}

export function SelectedInterests({selected,onChange}:{selected:string[];onChange:(id:string)=>void}){
 return <section className="selected-interests-floating" aria-label="Выбранные интересы">
   <div className="selected-interest-head"><strong>Выбрано</strong><span>{selected.length} / 15</span></div>
   <div className="selected-interest-strip">{selected.length?selected.map(id=>
     <InterestChip key={id} id={id} selected onClick={()=>onChange(id)}/>):
     <span className="hint">Выбирай интересы выше · до 15</span>}</div>
 </section>;
}
