import {useEffect,useRef,useState} from "react";
import {remoteDraftPilot} from "./server-draft";
import {realFeedPilot} from "./real-live-client";
import type {CSSProperties,ReactNode} from "react";
import {Info} from "lucide-react";
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
 deferConsent?:boolean;
 data:RegistrationDraft;patch:(values:Partial<RegistrationDraft>)=>void;
 photos:PhotoItem[];addPhotos:(files:File[])=>void;removePhoto:(id:string)=>void;
 movePhoto:(from:number,to:number)=>void;resetDraft:()=>void;step:number;
 fieldError?:{field:"name"|"date"|"city"|"about";message:string}|null;
 clearFieldError?:(field:"name"|"date"|"city"|"about")=>void;
 onFieldFocus?:(field:"name"|"date"|"city"|null)=>void;
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
export function DoubleAgeRange({min,max,onChange}:{min:number;max:number;onChange:(min:number,max:number)=>void}){
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


export function RegistrationStep({data,patch,photos,addPhotos,removePhoto,movePhoto,step,deferConsent,
 fieldError,clearFieldError,onFieldFocus}:StepProps){
 const nameInput=useRef<HTMLInputElement>(null);
 const dobInput=useRef<HTMLInputElement>(null);
 const [category,setCategory]=useState("Популярное");
 const [nameFocused,setNameFocused]=useState(false);
 const [dobFocused,setDobFocused]=useState(false);
 const [focusShift,setFocusShift]=useState(0);
 const [nameHint,setNameHint]=useState(false);
 const hintTimer=useRef<number|null>(null);
 const dobTimer=useRef<number|null>(null);
 const focusTimer=useRef<number|null>(null);
 const focusInput=useRef<HTMLInputElement|null>(null);
 useEffect(()=>()=>{
   if(hintTimer.current!==null)window.clearTimeout(hintTimer.current);
   if(dobTimer.current!==null)window.clearTimeout(dobTimer.current);
   if(focusTimer.current!==null)window.clearTimeout(focusTimer.current);
 },[]);
 const refreshFocusPosition=()=>{
   const input=focusInput.current;
   if(!input)return;
   const viewport=window.visualViewport;
   const footer=input.closest<HTMLElement>(".v2-device")?.querySelector<HTMLElement>(".v2-footer");
   const footerTop=footer?.getBoundingClientRect().top;
   const keyboardTop=footerTop!==undefined&&footerTop>0?footerTop:
     viewport?viewport.offsetTop+viewport.height:window.innerHeight;
   const rect=input.getBoundingClientRect();
   const idealCenter=keyboardTop-Math.min(132,Math.max(84,(viewport?.height??window.innerHeight)*.18));
   const raw=idealCenter-(rect.top+rect.height/2);
   const minShift=18-rect.top;
   const maxShift=keyboardTop-18-rect.bottom;
   setFocusShift(Math.round(Math.max(minShift,Math.min(maxShift,raw))));
 };
 const beginFieldFocus=(field:"name"|"date",input:HTMLInputElement)=>{
   if(focusTimer.current!==null)window.clearTimeout(focusTimer.current);
   focusInput.current=input;
   setFocusShift(0);
   clearFieldError?.(field);
   onFieldFocus?.(field);
   window.requestAnimationFrame(()=>{
     input.scrollIntoView({behavior:"smooth",block:"nearest"});
     window.requestAnimationFrame(refreshFocusPosition);
   });
 };
 const endFieldFocus=()=>{
   if(focusTimer.current!==null)window.clearTimeout(focusTimer.current);
   focusTimer.current=window.setTimeout(()=>{
     if(document.activeElement===focusInput.current)return;
     focusInput.current=null;
     setFocusShift(0);
     onFieldFocus?.(null);
   },180);
 };
 useEffect(()=>{
   if(!nameFocused&&!dobFocused)return;
   const viewport=window.visualViewport;
   const refresh=()=>window.requestAnimationFrame(refreshFocusPosition);
   viewport?.addEventListener("resize",refresh);
   viewport?.addEventListener("scroll",refresh);
   window.addEventListener("resize",refresh);
   refresh();
   return()=>{
     viewport?.removeEventListener("resize",refresh);
     viewport?.removeEventListener("scroll",refresh);
     window.removeEventListener("resize",refresh);
   };
 },[nameFocused,dobFocused]);
 const updateName=(raw:string)=>{
   const clean=cleanName(raw);
   patch({name:clean});
   if(clean!==raw){
     setNameHint(true);
     if(hintTimer.current!==null)window.clearTimeout(hintTimer.current);
     hintTimer.current=window.setTimeout(()=>setNameHint(false),2600);
   }else setNameHint(false);
 };
 const dateDigits=`${data.day}${data.month}${data.year}`.replace(/\D/g,"").slice(0,8);
 const dateValue=dateDigits.length<2?dateDigits:
   dateDigits.length===2?`${dateDigits}.`:
   dateDigits.length<4?`${dateDigits.slice(0,2)}.${dateDigits.slice(2)}`:
   dateDigits.length===4?`${dateDigits.slice(0,2)}.${dateDigits.slice(2)}.`:
   `${dateDigits.slice(0,2)}.${dateDigits.slice(2,4)}.${dateDigits.slice(4)}`;
 const updateDate=(raw:string)=>{
   const digits=raw.replace(/\D/g,"").slice(0,8);
   patch({day:digits.slice(0,2),month:digits.slice(2,4),year:digits.slice(4,8)});
   if(digits.length===8){
     if(dobTimer.current!==null)window.clearTimeout(dobTimer.current);
     dobTimer.current=window.setTimeout(()=>{
       dobInput.current?.blur();
       setDobFocused(false);
       setFocusShift(0);
       onFieldFocus?.(null);
     },120);
   }
 };
 const toggleInterest=(value:string)=>patch({interests:data.interests.includes(value)
   ?data.interests.filter(x=>x!==value):data.interests.length>=15?data.interests:[...data.interests,value]});
 if(step===1)return <div className="form-stack step-name">
   {nameFocused&&<div className="field-focus-overlay" aria-hidden="true" onMouseDown={()=>nameInput.current?.blur()}/>}
   <div className={"name-focus-shell"+(nameFocused?" is-focused":"")+(fieldError?.field==="name"?" has-error":"")}
     style={{"--focus-shift":`${focusShift}px`} as CSSProperties}>
     <GlassField label="Твоё имя"><GlassTextInput ref={nameInput} autoComplete="given-name" enterKeyHint="next" maxLength={48} value={data.name}
       aria-invalid={fieldError?.field==="name"}
       placeholder="Как тебя зовут?" onFocus={e=>{
         setNameFocused(true);beginFieldFocus("name",e.currentTarget);
       }} onBlur={()=>{
         setNameFocused(false);endFieldFocus();
       }} onChange={e=>{
         clearFieldError?.("name");updateName(e.target.value);
       }}/></GlassField>
     {(nameHint||fieldError?.field==="name")&&<div className="field-inline-hint name-input-hint" role="status">
       <Info size={16} aria-hidden="true"/>{fieldError?.field==="name"?fieldError.message:"Можно использовать только буквы, пробел, тире и апостроф."}
     </div>}
   </div>
   {!deferConsent&&<RegistrationConsent data={data} patch={patch}/>}
 </div>;
 if(step===2)return <div className="form-stack dob-step">
   {dobFocused&&<div className="field-focus-overlay" aria-hidden="true" onMouseDown={()=>dobInput.current?.blur()}/>}
   <div className={"dob-focus-shell"+(dobFocused?" is-focused":"")+(fieldError?.field==="date"?" has-error":"")}
     style={{"--focus-shift":`${focusShift}px`} as CSSProperties}>
     <GlassField label="Дата рождения" hint="Например, 12.05.1998">
       <GlassTextInput ref={dobInput} inputMode="numeric" autoComplete="bday" placeholder="ДД.ММ.ГГГГ"
         aria-label="Дата рождения, день месяц год" aria-invalid={fieldError?.field==="date"} value={dateValue}
         enterKeyHint="done"
         onFocus={e=>{
           setDobFocused(true);beginFieldFocus("date",e.currentTarget);
         }}
         onBlur={()=>{setDobFocused(false);endFieldFocus();}}
         onKeyDown={e=>{
           if(e.key==="Backspace"&&e.currentTarget.selectionStart===dateValue.length&&dateValue.endsWith(".")){
             e.preventDefault();updateDate(dateDigits.slice(0,-1));
           }
         }}
         onChange={e=>{clearFieldError?.("date");updateDate(e.target.value);}}/>
     </GlassField>
     {fieldError?.field==="date"&&<div className="field-inline-hint" role="alert"><Info size={16} aria-hidden="true"/>{fieldError.message}</div>}
   </div>
   <ChoiceRow label="Пол">
     <GlassChoice chosen={data.gender==="man"} onClick={()=>patch({gender:"man"})} icon={<GenderIcon type="man"/>}>Мужчина</GlassChoice>
     <GlassChoice chosen={data.gender==="woman"} onClick={()=>patch({gender:"woman"})} icon={<GenderIcon type="woman"/>}>Женщина</GlassChoice>
     <GlassChoice chosen={data.gender==="other"} onClick={()=>patch({gender:"other"})} icon={<GenderIcon type="everyone"/>}>Другой вариант</GlassChoice>
   </ChoiceRow>
   
 </div>;
 if(step===3)return <div className="form-stack compact-step"><GeoPicker data={data} patch={patch}
   fieldError={fieldError?.field==="city"?fieldError.message:undefined}
   clearFieldError={()=>clearFieldError?.("city")} onFieldFocus={onFieldFocus}/></div>;
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
 if(step===6)return <div className={"form-stack about-step"+(fieldError?.field==="about"?" has-error":"")}>
   <GlassField label="Немного о себе"><textarea className="glass-control glass-textarea" rows={4}
      aria-invalid={fieldError?.field==="about"}
      placeholder="Что тебя радует? Чем любишь заниматься?"
      value={data.about} maxLength={750} onChange={e=>{clearFieldError?.("about");patch({about:[...e.target.value].slice(0,750).join("")});}}/></GlassField>
   {fieldError?.field==="about"&&<div className="field-inline-hint" role="alert"><Info size={16} aria-hidden="true"/>{fieldError.message}</div>}
   <p className="char-count">{[...data.about].length} / 750</p>
   <LanguagePicker selected={data.languages} onChange={languages=>patch({languages})}/>
   <p className="hint">Интересы и языки можно добавить позже в профиле.</p>
 </div>;
 if(step===7)return <div className="form-stack"><PhotoSorter photos={photos} addPhotos={addPhotos}
   removePhoto={removePhoto} movePhoto={movePhoto}/></div>;
 return <div className="form-stack"><RegistrationPreview data={data} photos={photos}/></div>;
}

/** A single mandatory consent below date of birth and gender. */
export function RegistrationConsent({data,patch}:{data:RegistrationDraft;patch:(change:Partial<RegistrationDraft>)=>void}){
 return <div className="registration-consent-compact"><GlassCheckbox checked={data.trialConsent}
   onChange={trialConsent=>patch({trialConsent})}>
   {realFeedPilot.enabled?<span>Я принимаю <a href="/privacy" target="_blank" rel="noopener noreferrer">политику конфиденциальности и условия использования LUEMI</a>, подтверждаю совершеннолетие и согласен(-на) на сохранение и публикацию анкеты и выбранных фотографий.</span>:
    remoteDraftPilot.enabled?<span>Я принимаю <a href="/privacy" target="_blank" rel="noopener noreferrer">политику конфиденциальности и условия использования LUEMI</a> и согласен(-на) на сохранение анкеты.</span>:
    "Я принимаю условия тестового режима."}
 </GlassCheckbox></div>;
}

export function SelectedInterests({selected,onChange}:{selected:string[];onChange:(id:string)=>void}){
 return <section className="selected-interests-floating" aria-label="Выбранные интересы">
   <div className="selected-interest-head"><strong>Выбрано</strong><span>{selected.length} / 15</span></div>
   <div className="selected-interest-strip">{selected.length?selected.map(id=>
     <InterestChip key={id} id={id} selected onClick={()=>onChange(id)}/>):
     <span className="hint">Выбирай интересы выше · до 15</span>}</div>
 </section>;
}
