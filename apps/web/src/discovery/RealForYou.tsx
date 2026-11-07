import {memo,useEffect,useMemo,useRef,useState} from "react";
import {ArrowLeft,ArrowRight,Bookmark,Check,ChevronDown,ChevronUp,Globe2,Heart,Layers3,MapPin,Music2,Plane,Plus,Settings2,Sparkles,Target,Users,X} from "lucide-react";
import type {RegistrationDraft} from "../registration/model";
import type {RealPublishedProfile} from "../registration/real-live-client";
import {Flag} from "../ui/Flag";
import {itemOf} from "../ui/InterestCatalog";
import {useModalLayer} from "../ui/modal-layer";
import "./for-you.css";

// Public For You: genuine published profiles, no fabricated online signals,
// distance, daily changes, new-account timestamps or match percentages.
const topics=[
 {id:"common",title:"Много общего",short:"Общее",description:"Общие интересы в ваших анкетах."},
 {id:"music",title:"Музыка нас объединяет",short:"Музыка",description:"Вы любите музыку."},
 {id:"goals",title:"Похожие цели",short:"Цели",description:"Вы хотите похожего от знакомств."},
 {id:"nearby",title:"Рядом с тобой",short:"Рядом",description:"Люди из твоего города, не GPS-расстояние."},
 {id:"travel",title:"Любят путешествовать",short:"Путешествия",description:"Тем, кто любит открывать новые места."},
 {id:"international",title:"Из других стран",short:"Другие страны",description:"Люди из других стран."},
 {id:"online",title:"Сейчас в сети",short:"В сети",description:"Статусы активности пока недоступны."},
 {id:"new",title:"Новые в LUEMI",short:"Новые",description:"Даты регистрации пока недоступны."}
] as const;
type Topic=(typeof topics)[number]["id"];
type Collection=Topic|"best";
type Prefs={order:Topic[];hidden:Topic[];favorites:Topic[]};
const allIds:Topic[]=topics.map(topic=>topic.id);
const defaultPrefs:Prefs={order:[...allIds],hidden:[],favorites:[]};
const storageKey="luemi:real-for-you:category-hub:v1";
const icons={common:Users,music:Music2,goals:Target,nearby:MapPin,travel:Plane,
 international:Globe2,online:Users,new:Sparkles} as const;
const chips:[Collection,string,typeof Sparkles][]=[
 ["best","Лучшие",Sparkles],["common","Общее",Users],
 ["goals","Цели",Target],["nearby","Рядом",MapPin],
 ["music","Музыка",Music2],["travel","Путешествия",Plane],
 ["international","Другие страны",Globe2]
];
function savedPrefs():Prefs{
 try{
  const value=JSON.parse(localStorage.getItem(storageKey)||"null") as Partial<Prefs>|null;
  if(!value)return defaultPrefs;
  const valid=(input:unknown):Topic[]=>Array.isArray(input)?
   [...new Set(input.filter((id):id is Topic=>allIds.includes(id as Topic)))]:[];
  return {order:[...valid(value.order),...allIds.filter(id=>!valid(value.order).includes(id))],
   hidden:valid(value.hidden),favorites:valid(value.favorites)};
 }catch{return defaultPrefs;}
}
const norm=(value:string)=>value.trim().normalize("NFC").toLocaleLowerCase("ru");
const overlap=(person:RealPublishedProfile,draft:RegistrationDraft)=>
 person.interests.filter(id=>draft.interests.includes(id)).length;
const score=(person:RealPublishedProfile,draft:RegistrationDraft)=>
 overlap(person,draft)*4+
 person.languages.filter(id=>draft.languages.includes(id)).length*2+
 (draft.goal&&draft.goal!=="undecided"&&person.goal===draft.goal?4:0)+
 (norm(person.city)===norm(draft.city)&&person.countryCode===draft.countryCode?2:0);
function members(id:Topic,people:RealPublishedProfile[],draft:RegistrationDraft){
 switch(id){
  // These signals are absent from the server's public-profile response.
  case "online":case "new":return [];
  case "common":return people.filter(p=>overlap(p,draft)>0);
  case "goals":return people.filter(p=>draft.goal&&draft.goal!=="undecided"&&p.goal===draft.goal);
  case "nearby":return people.filter(p=>!!draft.city&&p.countryCode===draft.countryCode&&norm(p.city)===norm(draft.city));
  case "travel":return people.filter(p=>p.interests.includes("путешествия"));
  case "music":return people.filter(p=>p.interests.includes("музыка"));
  case "international":return people.filter(p=>!!draft.countryCode&&p.countryCode!==draft.countryCode);
 }
}
function reason(person:RealPublishedProfile,draft:RegistrationDraft){
 const names=person.interests.filter(id=>draft.interests.includes(id)).slice(0,2)
  .map(id=>itemOf(id)?.name).filter(Boolean);
 if(names.length)return "Общее: "+names.join(", ");
 if(draft.goal&&draft.goal!=="undecided"&&person.goal===draft.goal)return "Похожие цели";
 if(person.languages.some(id=>draft.languages.includes(id)))return "Общий язык";
 return "Анкета LUEMI";
}
const Tile=memo(function Tile({person,draft,saved,onSave,onPerson,priority=false,compact=false}:{
 person:RealPublishedProfile;draft:RegistrationDraft;saved:boolean;
 onSave:(id:string)=>void;onPerson:(person:RealPublishedProfile)=>void;
 priority?:boolean;compact?:boolean;
}){
 const photo=person.photos[0];
 return <article className={"fy-tile fy-real-tile"+(compact?" fy-real-tile-compact":"")}>
  <button className="fy-tile-photo" type="button" onClick={()=>onPerson(person)}
   aria-label={"Открыть анкету "+person.name+", "+person.age}>
   <span className="fy-photo-fallback" aria-hidden="true">{person.name.slice(0,1)}</span>
   {photo&&<img src={photo.url} alt="" loading={priority?"eager":"lazy"} decoding="async"
    draggable={false} onError={event=>{event.currentTarget.style.visibility="hidden";}}/>}
   <span className="fy-tile-fade" aria-hidden="true"/>
   <span className="fy-tile-info">
    <strong>{person.name}, {person.age}</strong>
    <span className="fy-tile-location"><Flag code={person.countryCode} size={12}/>{person.city}</span>
    {!compact&&<span className="fy-tile-detail">{reason(person,draft)}</span>}
   </span>
  </button>
  <button className={"fy-save"+(saved?" selected":"")} type="button"
   aria-label={(saved?"Убрать закладку: ":"Сохранить на эту сессию: ")+person.name}
   aria-pressed={saved} title="Закладки действуют до закрытия приложения"
   onClick={()=>onSave(person.id)}>
   <Bookmark size={15} fill={saved?"currentColor":"none"}/>
  </button>
 </article>;
});
const Avatar=memo(function Avatar({person,onPerson}:{
 person:RealPublishedProfile;onPerson:(person:RealPublishedProfile)=>void;
}){
 return <button type="button" className="fy-avatar" onClick={()=>onPerson(person)}
  aria-label={"Открыть анкету "+person.name+", "+person.age}>
  <span className="fy-avatar-photo">
   <span className="fy-avatar-fallback" aria-hidden="true">{person.name.slice(0,1)}</span>
   {person.photos[0]&&<img src={person.photos[0].url} loading="lazy" decoding="async"
    alt="" draggable={false} onError={event=>{event.currentTarget.style.visibility="hidden";}}/>}
  </span>
  <span className="fy-avatar-name">{person.name}</span>
 </button>;
});
const emptyMessage=(id:Topic)=>{
 if(id==="online")return "Когда появятся подтверждённые онлайн-статусы, здесь будут люди в сети.";
 if(id==="new")return "Новые анкеты появятся здесь после подключения подтверждённых дат публикации.";
 return "Пока нет подходящих опубликованных анкет.";
};
export function RealForYou({draft,people,onPerson,saved,onSave,onMore,hasMore,moreBusy,onScrollTop}:{
 draft:RegistrationDraft;people:RealPublishedProfile[];
 onPerson:(person:RealPublishedProfile)=>void;saved:ReadonlySet<string>;onSave:(id:string)=>void;
 onMore:()=>void;hasMore:boolean;moreBusy:boolean;onScrollTop?:(top:number)=>void;
}){
 const [prefs,setPrefs]=useState<Prefs>(savedPrefs);
 const [expanded,setExpanded]=useState<Collection|null>(null);
 const [manage,setManage]=useState(false);
 const scroll=useRef<HTMLDivElement>(null);
 const manageDialog=useRef<HTMLElement>(null);
 useModalLayer(manage,manageDialog,()=>setManage(false));
 useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(prefs));}catch{/* Telegram private mode */}},[prefs]);
 const ranked=useMemo(()=>[...people].sort((a,b)=>score(b,draft)-score(a,draft)||a.id.localeCompare(b.id)),[people,draft]);
 const collections=useMemo(()=>Object.fromEntries(topics.map(t=>[t.id,members(t.id,ranked,draft)])) as Record<Topic,RealPublishedProfile[]>,[ranked,draft]);
 const shown=useMemo(()=>prefs.order.filter(id=>!prefs.hidden.includes(id))
  .sort((a,b)=>Number(prefs.favorites.includes(b))-Number(prefs.favorites.includes(a))),[prefs]);
 const visibleChips=chips.filter(([id])=>id==="best"||shown.includes(id));
 const jump=(id:Collection)=>{
  const root=scroll.current;
  const target=root?.querySelector<HTMLElement>('[data-fy-section="'+id+'"]');
  if(!root||!target)return;
  const distance=target.getBoundingClientRect().top-root.getBoundingClientRect().top+root.scrollTop-6;
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  root.scrollTo({top:distance,behavior:reduced?"auto":"smooth"});
 };
 const toggle=(id:Topic,which:"hidden"|"favorites")=>
  setPrefs(prev=>({...prev,[which]:prev[which].includes(id)?
   prev[which].filter(value=>value!==id):[...prev[which],id]}));
 const shift=(id:Topic,by:number)=>setPrefs(prev=>{
  const order=[...prev.order],from=order.indexOf(id),to=from+by;
  if(to<0||to>=order.length)return prev;
  [order[from],order[to]]=[order[to],order[from]];
  return {...prev,order};
 });
 const row=(list:RealPublishedProfile[],name:string,compact=false,priority=false)=>
  <div className={"fy-rail"+(compact?" fy-rail-compact":"")} role="group" aria-label={name}
   onPointerDown={e=>e.stopPropagation()}>
   {list.slice(0,compact?8:6).map((person,i)=><Tile key={person.id} person={person} draft={draft}
    saved={saved.has(person.id)} onSave={onSave} onPerson={onPerson}
    compact={compact} priority={priority&&i<2}/>)}
  </div>;
 const section=(id:Topic)=>{
  const topic=topics.find(t=>t.id===id)!;
  const Icon=icons[id],list=collections[id];
  return <section key={id} data-fy-section={id}
   className={"fy-section"+(list.length?"":" fy-section-unavailable")} aria-label={topic.title}>
   <div className="fy-section-header"><h3><Icon size={18}/>{topic.title}</h3>
    {list.length>0&&<button type="button" onClick={()=>setExpanded(id)} aria-label={"Смотреть всех: "+topic.title}>Все <ArrowRight size={16}/></button>}
   </div>
   {list.length?row(list,topic.title,id==="music"):(
    <div className="fy-empty"><Sparkles size={15}/><span>{emptyMessage(id)}</span></div>
   )}
  </section>;
 };
 const expandedTitle=expanded==="best"?"Лучшие совпадения":topics.find(t=>t.id===expanded)?.title;
 const expandedPeople=expanded==="best"?ranked:expanded?collections[expanded]:[];
 return <div className="fy-root fy-real" data-layout="category-hub">
  <div className="fy-scroll" ref={scroll} inert={!!expanded||manage} aria-hidden={!!expanded||manage}
   onScroll={event=>{if(!expanded&&!manage)onScrollTop?.(event.currentTarget.scrollTop);}}>
   <nav className="fy-topic-chips" aria-label="Темы рекомендаций">
    {[visibleChips.slice(0,4),visibleChips.slice(4)].map((group,i)=>
     <div className="fy-chip-row" key={i} onPointerDown={e=>e.stopPropagation()}>
      {group.map(([id,label,Icon])=><button key={id} className={"fy-chip"+(id==="best"?" fy-chip-active":"")}
       type="button" onClick={()=>jump(id)}><Icon size={15}/><span>{label}</span></button>)}
     </div>)}
   </nav>
   <div className="fy-customize">
    <span><Layers3 size={18}/>Мои подборки</span>
    <button type="button" onClick={()=>setManage(true)}><Settings2 size={16}/>Настроить<ArrowRight size={15}/></button>
   </div>
   <section className="fy-intro" aria-label="Люди для тебя">
    <div className="fy-section-header"><h3>Сегодня тебе подойдут</h3>
     {ranked.length>0&&<button type="button" onClick={()=>setExpanded("best")}>Все <ArrowRight size={16}/></button>}
    </div>
    {ranked.length?<div className="fy-avatar-rail" role="group" aria-label="Быстрые рекомендации"
      onPointerDown={e=>e.stopPropagation()}>
      {ranked.slice(0,8).map(person=><Avatar person={person} key={person.id} onPerson={onPerson}/>)}
      <button type="button" className="fy-avatar fy-avatar-all" onClick={()=>setExpanded("best")} aria-label="Все рекомендации">
       <span className="fy-avatar-photo"><Plus size={25}/></span><span className="fy-avatar-name">Все</span>
      </button>
     </div>:<div className="fy-empty"><Sparkles size={17}/>Пока нет опубликованных анкет для рекомендаций.</div>}
   </section>
   <section className="fy-section fy-best" data-fy-section="best" aria-label="Лучшие совпадения">
    <div className="fy-section-header"><h3>Лучшие совпадения</h3>
     {ranked.length>0&&<button type="button" onClick={()=>setExpanded("best")}>Все <ArrowRight size={16}/></button>}
    </div>
    {ranked.length?row(ranked,"Лучшие совпадения",false,true):
     <div className="fy-empty"><Sparkles size={17}/>Сейчас нет подходящих анкет. Попробуй изменить фильтры.</div>}
   </section>
   {shown.map(section)}
   {!shown.length&&<div className="fy-empty">Все темы скрыты. Верни их через «Настроить».</div>}
   {hasMore&&<div className="fy-load-more"><button type="button" disabled={moreBusy} onClick={onMore}>
    {moreBusy?"Загружаем…":"Загрузить ещё анкеты"} <ArrowRight size={16}/></button></div>}
   <p className="fy-legal">Только реальные опубликованные анкеты. Закладки действуют в течение сессии. Онлайн-статусы и расстояния не выдумываются.</p>
  </div>
  {expanded&&<section className="fy-expanded" role="region" aria-label={"Подборка: "+expandedTitle}>
   <header><button type="button" className="fy-back" onClick={()=>setExpanded(null)}
    aria-label="Назад к подборкам"><ArrowLeft size={20}/></button>
    <div><h2>{expandedTitle}</h2><p>Опубликованные анкеты LUEMI</p></div>
   </header>
   {expandedPeople.length?<div className="fy-grid">
    {expandedPeople.map(person=><Tile key={person.id} person={person} draft={draft}
     saved={saved.has(person.id)} onSave={onSave} onPerson={onPerson}/>)}
   </div>:<div className="fy-empty">Пока никого не нашли.</div>}
  </section>}
  {manage&&<section className="fy-manage" ref={manageDialog} tabIndex={-1}
   role="dialog" aria-modal="true" aria-label="Управление подборками">
   <header><div><h2>Мои подборки</h2><p>Избранное, порядок и видимость разделов</p></div>
    <button type="button" className="fy-back" data-modal-initial onClick={()=>setManage(false)}
     aria-label="Закрыть"><X size={19}/></button>
   </header>
   <div className="fy-manage-list">{prefs.order.map((id,i)=>{
    const topic=topics.find(t=>t.id===id)!;const Icon=icons[id];
    return <div className="fy-manage-row" key={id}>
     <span><Icon size={16}/>{topic.title}</span>
     <div>
      <button type="button" onClick={()=>shift(id,-1)} disabled={i===0}
       aria-label={"Поднять "+topic.title}><ChevronUp size={17}/></button>
      <button type="button" onClick={()=>shift(id,1)} disabled={i===prefs.order.length-1}
       aria-label={"Опустить "+topic.title}><ChevronDown size={17}/></button>
      <button type="button" onClick={()=>toggle(id,"favorites")}
       aria-pressed={prefs.favorites.includes(id)} aria-label={"Избранное: "+topic.title}>
       <Heart size={17} fill={prefs.favorites.includes(id)?"currentColor":"none"}/></button>
      <button type="button" onClick={()=>toggle(id,"hidden")}
       aria-pressed={!prefs.hidden.includes(id)} aria-label={"Видимость: "+topic.title}>
       {prefs.hidden.includes(id)?<X size={17}/>:<Check size={17}/>}</button>
     </div>
    </div>;
   })}</div>
   <footer><button type="button" onClick={()=>setPrefs({
    order:[...defaultPrefs.order],hidden:[],favorites:[]
   })}>Сбросить</button>
    <button type="button" onClick={()=>setManage(false)}>Готово</button></footer>
  </section>}
 </div>;
}
