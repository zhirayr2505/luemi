import {useCallback,useEffect,useRef,useState} from "react";
import type {CSSProperties} from "react";
import {ArrowLeft,ArrowRight,CalendarDays,Check,ChevronDown,GripVertical,MapPin,UserRound,X} from "lucide-react";
import {GeoPicker} from "../GeoPicker";
import {PhotoSorter,type PhotoItem} from "../PhotoSorter";
import {categories,itemOf} from "../../ui/InterestCatalog";
import {goals,birthDateValid,nameValid,selectedCityValid,validateStep,type RegistrationDraft} from "../model";
import {findExactDuplicatePhotoIds} from "./duplicate-photos";
import {remoteDraftPilot} from "../server-draft";
import "./registration-v4.css";

interface Props{
 fallbackEntry:boolean;draft:RegistrationDraft;patch:(change:Partial<RegistrationDraft>)=>void;
 photos:PhotoItem[];addPhotos:(files:File[])=>void;removePhoto:(id:string)=>void;movePhoto:(from:number,to:number)=>void;
 resetDraft:()=>void;theme:"light"|"dark";onTheme:()=>void;onSave:()=>void;onRetryMedia:()=>void;
 mediaEnabled:boolean;serverSaving:boolean;serverStatus:string;mediaStatus?:string;storageError:string|null;
 restored:boolean;resumeReview:boolean;onRetryStorage:()=>void;onExit:()=>void;registerBack:(fn:()=>void)=>void;
}
const titles=[
 ["Как тебя зовут?","Это имя увидят другие пользователи"],
 ["Расскажи о себе","Укажи дату рождения и пол"],
 ["Где ты сейчас?","Твоё местоположение помогает находить людей рядом"],
 ["Кого ты хочешь встретить?","Настрой знакомства так, как тебе нравится"],
 ["Что ты ищешь?","Выбери, что тебе сейчас ближе"],
 ["Добавь характер","Пара слов о тебе и любимые интересы оживят анкету"],
 ["Покажи себя","Добавь от 3 до 6 фото"],
 ["Всё готово","Проверь анкету и открой себя людям, которые тебе подходят"]
] as const;
const featured=["серьёзные отношения","свидания","дружба","общение","новые знакомства"];
const interestList=[...new Map(categories.flatMap(category=>category.items).map(item=>[item.id,item])).values()];
function restoredIndex(d:RegistrationDraft,photos:PhotoItem[]){
 if(!nameValid(d.name)||!d.trialConsent)return 0;
 if(!birthDateValid(d.day,d.month,d.year)||!d.gender)return 1;
 if(!selectedCityValid(d))return 2;
 if(!d.audience)return 3;
 if(!d.goal)return 4;
 if(!d.about.trim())return 5;
 if(photos.length<3||photos.some(p=>p.status!=="ready"))return 6;
 return 7;
}
function ageOf(d:RegistrationDraft){
 const now=new Date(),year=Number(d.year),month=Number(d.month),day=Number(d.day);
 return year?now.getUTCFullYear()-year-(now.getUTCMonth()+1<month||now.getUTCMonth()+1===month&&now.getUTCDate()<day?1:0):0;
}
function Choice({selected,children,onClick}: {selected:boolean;children:React.ReactNode;onClick:()=>void}){
 return <button type="button" className={"v4-choice"+(selected?" selected":"")} aria-pressed={selected} onClick={onClick}>{selected&&<Check size={13}/>} {children}</button>;
}
function OptionalDetails({d,patch}:{d:RegistrationDraft;patch:Props["patch"]}){
 const [open,setOpen]=useState(false);
 const toggle=(key:"lifestyle"|"pets"|"family",value:string)=>patch({[key]:d[key].includes(value)?d[key].filter(x=>x!==value):[...d[key],value]});
 return <section className="v4-optional">
  <button type="button" className="v4-field v4-details-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}>Больше о себе (необязательно)<ChevronDown size={19}/></button>
  {open&&<div className="v4-optional-content">
   <label>Рост, см<input type="number" min="100" max="250" value={d.height??""} onChange={e=>patch({height:e.target.value?Number(e.target.value):null})}/></label>
   <label>Род занятий<input maxLength={120} value={d.occupation} onChange={e=>patch({occupation:e.target.value})}/></label>
   <label>Образование<input maxLength={120} value={d.education} onChange={e=>patch({education:e.target.value})}/></label>
   {([["Привычки","lifestyle",["Не курю","Люблю спорт","Люблю путешествия","Ранний подъём"]],
     ["Животные","pets",["Кошки","Собаки","Другие животные"]],
     ["Семья и планы","family",["Хочу семью","Уже есть дети","Не планирую детей","Пока не решил(а)"]]] as const).map(([label,key,values])=><div key={key}><strong>{label}</strong><div className="v4-chips">{values.map(value=><Choice key={value} selected={d[key].includes(value)} onClick={()=>toggle(key,value)}>{value}</Choice>)}</div></div>)}
   <label>Факты о себе<textarea maxLength={240} value={d.facts.join("\n")} onChange={e=>patch({facts:e.target.value.split("\n").slice(0,3)})}/></label>
  </div>}
 </section>;
}
export function RealRegistrationV2(p:Props){
 const {draft:d,photos}=p;
 const {restored:hasRestored,resumeReview,registerBack,onExit}=p;
 const [index,setIndex]=useState(()=>resumeReview?7:hasRestored?restoredIndex(d,photos):0);
 const [error,setError]=useState("");
 const [moving,setMoving]=useState(false);
 const [direction,setDirection]=useState<"next"|"back">("next");
 const [moreInterests,setMoreInterests]=useState(false);
 const [moreGoals,setMoreGoals]=useState(false);
 const [selectedPhoto,setSelectedPhoto]=useState(0);
 const [checking,setChecking]=useState(false);
 const body=useRef<HTMLElement>(null),root=useRef<HTMLElement>(null),busy=useRef(false),restored=useRef(hasRestored);
 useEffect(()=>{
  if(hasRestored&&!restored.current){restored.current=true;setIndex(resumeReview?7:restoredIndex(d,photos));}
 },[hasRestored,resumeReview,d,photos]);
 useEffect(()=>{
  const viewport=window.visualViewport,node=root.current;if(!viewport||!node)return;
  let frame=0;
  const update=()=>{frame=0;node.style.setProperty("--v4-visible-height",viewport.height+"px");node.style.setProperty("--v4-top",viewport.offsetTop+"px");};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  update();viewport.addEventListener("resize",schedule);viewport.addEventListener("scroll",schedule);
  return()=>{if(frame)cancelAnimationFrame(frame);viewport.removeEventListener("resize",schedule);viewport.removeEventListener("scroll",schedule);};
 },[]);
 const nav=useCallback((next:number)=>{
  if(busy.current||next<0||next>7||next===index)return;
  busy.current=true;setDirection(next>index?"next":"back");setMoving(true);
  setIndex(next);setError("");
  body.current?.scrollTo({top:0,behavior:"instant"});
  window.setTimeout(()=>{busy.current=false;setMoving(false);},260);
 },[index]);
 const back=useCallback(()=>{if(index===0)onExit();else nav(index-1);},[index,nav,onExit]);
 useEffect(()=>{registerBack(back);return()=>registerBack(()=>{});},[back,registerBack]);
 const advance=async()=>{
  if(busy.current||checking)return;
  let issue="";
  switch(index){
   case 0: issue=!nameValid(d.name)?"Имя: от 2 до 48 букв, пробел, дефис или апостроф.":!d.trialConsent?"Прими условия использования и политику конфиденциальности.":"";break;
   case 1: issue=!birthDateValid(d.day,d.month,d.year)?"Проверь дату. LUEMI доступен с 18 лет.":!d.gender?"Выбери пол.":"";break;
   case 2: issue=validateStep(d,3,photos.length,new Date(),"live")??"";break;
   case 3: issue=!d.audience?"Выбери, кого хочешь встретить.":d.ageMin>d.ageMax?"Проверь диапазон возраста.":"";break;
   case 4: issue=!d.goal?"Выбери хотя бы одну цель.":"";break;
   case 5: issue=validateStep(d,6,photos.length,new Date(),"live")??"";break;
   case 6:
    if(photos.length<3||photos.length>6||photos.some(photo=>photo.status!=="ready"||photo.serverStatus!=="saved"))issue="Дождись загрузки от 3 до 6 фотографий на сервер.";
    else {setChecking(true);try{if((await findExactDuplicatePhotoIds(photos)).length)issue="Замени повторяющиеся фотографии.";}catch{issue="Не удалось проверить фото. Попробуй снова.";}finally{setChecking(false);}}
    break;
  }
  if(issue){setError(issue);return;}
  if(index===7){p.onSave();return;}
  nav(index+1);
 };
 const dob=d.year&&d.month&&d.day?`${d.year}-${d.month.padStart(2,"0")}-${d.day.padStart(2,"0")}`:"";
 const onDob=(value:string)=>{const [year="",month="",day=""]=value.split("-");p.patch({year,month,day});setError("");};
 const toggleInterest=(id:string)=>p.patch({interests:d.interests.includes(id)?d.interests.filter(x=>x!==id):d.interests.length<15?[...d.interests,id]:d.interests});
 const rank=(label:string)=>{const i=featured.indexOf(label.toLowerCase());return i<0?featured.length:i;};
 const sortedGoals=[...goals].sort((a,b)=>rank(a.label)-rank(b.label));
 const currentPhoto=photos[Math.min(selectedPhoto,photos.length-1)];
 const ready=photos.length>=3&&photos.length<=6&&photos.every(photo=>photo.status==="ready"&&photo.serverStatus==="saved");
 return <main ref={root} className="v4-registration" aria-label="Регистрация LUEMI" data-step={index+1}>
  <header className="v4-header"><img src="/assets/brand/wordmark_original_raster_alpha_W06.webp" alt="LUEMI" draggable={false}/><div className="v4-progress" role="progressbar" aria-label="Прогресс регистрации" aria-valuenow={index+1} aria-valuemin={1} aria-valuemax={8}>{titles.map((_,i)=><span key={i} className={i===index?"current":""}/>)}</div></header>
  <section ref={body} className="v4-scroll" aria-labelledby="v4-title">
   <div key={index} className={"v4-stage"+(moving?" v4-enter-"+direction:"")}>
    <h1 id="v4-title">{titles[index][0]}</h1><p className="v4-subtitle">{titles[index][1]}</p>
    {index===0&&<div className="v4-name"><label className="v4-field v4-name-field"><UserRound size={19}/><input aria-label="Имя" autoComplete="given-name" maxLength={48} placeholder="Твоё имя" value={d.name} onChange={e=>{p.patch({name:e.target.value});setError("");}}/>{d.name&&<button type="button" aria-label="Очистить имя" onClick={()=>p.patch({name:""})}><X size={18}/></button>}</label><label className="v4-consent"><input type="checkbox" checked={d.trialConsent} onChange={e=>p.patch({trialConsent:e.target.checked})}/><span>Я принимаю <a href="/terms.html" target="_blank" rel="noopener noreferrer">Условия использования</a> и <a href={remoteDraftPilot.policy||"/privacy.html"} target="_blank" rel="noopener noreferrer">Политику конфиденциальности</a></span></label></div>}
    {index===1&&<div className="v4-stack"><label className="v4-field v4-date"><CalendarDays size={18}/><input type="date" aria-label="Дата рождения" min="1900-01-01" max={new Date(Date.UTC(new Date().getUTCFullYear()-18,new Date().getUTCMonth(),new Date().getUTCDate())).toISOString().slice(0,10)} value={dob} onChange={e=>onDob(e.target.value)}/></label><div className="v4-chips v4-gender">{([["man","Мужчина"],["woman","Женщина"],["other","Другое"]] as const).map(([value,label])=><Choice key={value} selected={d.gender===value} onClick={()=>p.patch({gender:value})}>{label}</Choice>)}</div><p className="v4-hint">Возраст увидят в профиле, а дату рождения — только ты.</p></div>}
    {index===2&&<div className="v4-geo"><GeoPicker variant="v4" data={d} patch={p.patch} clearFieldError={()=>setError("")}/></div>}
    {index===3&&<div className="v4-stack"><strong className="v4-label">Кого хочешь встретить?</strong><div className="v4-chips">{([["women","Женщин"],["men","Мужчин"],["everyone","Всех"]] as const).map(([value,label])=><Choice key={value} selected={d.audience===value} onClick={()=>p.patch({audience:value})}>{label}</Choice>)}</div><div className="v4-age"><span>Возраст</span><strong>{d.ageMin}–{d.ageMax}</strong><div className="v4-range" style={{"--v4-min":(d.ageMin-18)/62*100+"%","--v4-max":(d.ageMax-18)/62*100+"%"} as CSSProperties}><div className="v4-range-track"><span/></div><input type="range" min={18} max={80} value={d.ageMin} aria-label="Минимальный возраст" onChange={e=>p.patch({ageMin:Math.min(+e.target.value,d.ageMax)})}/><input type="range" min={18} max={80} value={d.ageMax} aria-label="Максимальный возраст" onChange={e=>p.patch({ageMax:Math.max(+e.target.value,d.ageMin)})}/></div><small>18 <span>80</span></small></div></div>}
    {index===4&&<div className="v4-goals">{sortedGoals.filter((goal,i)=>i<5||moreGoals||goal.id===d.goal).map(goal=><button key={goal.id} type="button" className={"v4-goal"+(d.goal===goal.id?" selected":"")} aria-pressed={d.goal===goal.id} onClick={()=>p.patch({goal:goal.id})}><span>{goal.label}</span><span className="v4-goal-check">{d.goal===goal.id&&<Check size={15}/>}</span></button>)}<button type="button" className="v4-more" onClick={()=>setMoreGoals(!moreGoals)}>{moreGoals?"Свернуть":"Другие цели"}</button><p className="v4-hint">Выбери один вариант</p></div>}
    {index===5&&<div className="v4-stack v4-personality"><label className="v4-about">О себе<textarea rows={3} value={d.about} maxLength={750} placeholder="Напиши пару слов о себе" onChange={e=>p.patch({about:[...e.target.value].slice(0,750).join("")})}/><small>{[...d.about].length}/750</small></label><strong className="v4-label">Интересы</strong><div className="v4-chips v4-interests">{interestList.filter((item,i)=>moreInterests||i<12||d.interests.includes(item.id)).map(item=><Choice key={item.id} selected={d.interests.includes(item.id)} onClick={()=>toggleInterest(item.id)}>{item.name}</Choice>)}</div><button type="button" className="v4-more" onClick={()=>setMoreInterests(!moreInterests)}>{moreInterests?"Свернуть интересы":"Показать все интересы"}</button><OptionalDetails d={d} patch={p.patch}/></div>}
    {index===6&&<div className="v4-photos">{currentPhoto?.src?<div className="v4-photo-large"><img src={currentPhoto.src} alt="Выбранное фото"/><span>{selectedPhoto===0?"Главное фото":selectedPhoto===1?"Второе главное фото":"Фото анкеты"}</span></div>:<div className="v4-photo-empty">Выбери фотографии из галереи</div>}<PhotoSorter photos={photos} addPhotos={p.addPhotos} removePhoto={p.removePhoto} movePhoto={(from,to)=>{p.movePhoto(from,to);setSelectedPhoto(to);}}/><div className="v4-photo-select">{photos.map((photo,i)=><button type="button" key={photo.id} className={selectedPhoto===i?"selected":""} onClick={()=>setSelectedPhoto(i)} aria-label={`Просмотреть фото ${i+1}`}>{i+1}</button>)}</div><p className="v4-hint"><GripVertical size={14}/> Перетащи фото, чтобы поменять порядок. Первые два — главные.</p><p className="v4-hint">{photos.length} из 6 · {photos.filter(photo=>photo.serverStatus==="saved").length} загружено на сервер</p>{photos.some(photo=>photo.serverStatus==="error")&&<button type="button" className="v4-more" onClick={p.onRetryMedia}>Повторить загрузку</button>}</div>}
    {index===7&&<article className="v4-preview">{photos[0]?.src&&<img className="v4-avatar" src={photos[0].src} alt="Главное фото"/>}<div><h2>{d.name}{ageOf(d)?`, ${ageOf(d)}`:""}</h2><p><MapPin size={14}/>{d.city}{d.country?`, ${d.country}`:""}</p><p>♡ {goals.find(g=>g.id===d.goal)?.label}</p></div>{d.about&&<p className="v4-preview-about">{d.about}</p>}<div className="v4-chips">{d.interests.map(id=>{const item=itemOf(id);return item?<span className="v4-choice selected" key={id}>{item.name}</span>:null;})}</div><div className="v4-gallery">{photos.map((photo,i)=><img src={photo.src} alt={`Фото ${i+1}`} key={photo.id}/>)}</div></article>}
    {error&&<p className="v4-error" role="alert">{error}</p>}
    {p.storageError&&<p className="v4-error" role="alert">Не удалось сохранить черновик. <button type="button" onClick={p.onRetryStorage}>Повторить</button></p>}
    {index>=6&&p.mediaStatus&&<p className="v4-error" role="status">{p.mediaStatus}</p>}
    {index===7&&p.serverStatus&&<p className="v4-error" role="status">{p.serverStatus}</p>}
   </div>
  </section>
  <footer className="v4-footer">{index>0&&<button type="button" className="v4-back" aria-label="Назад" onClick={back}><ArrowLeft size={20}/></button>}<button type="button" className="v4-next" disabled={checking||p.serverSaving||index===0&&!d.trialConsent||index===6&&!ready} onClick={()=>{void advance();}}>{index===7?p.serverSaving?"Создаём…":"Создать анкету":checking?"Проверяем…":"Продолжить"}{index===7?<Check size={19}/>:<ArrowRight size={19}/>}</button></footer>
 </main>;
}
