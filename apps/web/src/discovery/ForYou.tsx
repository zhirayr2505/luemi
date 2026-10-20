import {useEffect,useMemo,useRef,useState} from "react";
import {ArrowLeft,ArrowRight,Bookmark,Check,ChevronDown,ChevronUp,Globe2,Heart,MapPin,Music2,Plane,Settings2,Sparkles,Users,X} from "lucide-react";
import type {RegistrationDraft} from "../registration/model";
import {Flag} from "../ui/Flag";
import {itemOf} from "../ui/InterestCatalog";
import type {DemoPerson,DiscoveryFilter} from "./model";
import {filterDemoPeople} from "./model";
import {forYouDemoPeople} from "./for-you-data";
import {collectionDefinitions,evidence,membersFor,rankDemonstrations} from "./for-you-ranking";
import type {CollectionId} from "./for-you-ranking";
import "./for-you.css";

type Prefs={order:CollectionId[];hidden:CollectionId[];favorites:CollectionId[]};
const allIds:CollectionId[]=collectionDefinitions.map(s=>s.id);
const initial:Prefs={order:allIds,hidden:[],favorites:[]};
const storeKey="luemi:demo-for-you:v1";
function savedPrefs():Prefs{
 try {
  const obj=JSON.parse(localStorage.getItem(storeKey)||"null") as Partial<Prefs>|null;
  if(!obj)return initial;
  const valid=(a:unknown):CollectionId[]=>Array.isArray(a)?a.filter((x):x is CollectionId=>allIds.includes(x as CollectionId)):[];
  return {order:[...new Set([...valid(obj.order),...allIds])],hidden:valid(obj.hidden),favorites:valid(obj.favorites)};
 }catch{return initial;}
}
const icons={online:Users,common:Heart,goals:Sparkles,new:Sparkles,nearby:MapPin,travel:Plane,music:Music2,international:Globe2} as const;
interface Props{
 draft:RegistrationDraft;filters:DiscoveryFilter;saved:string[];
 onSave:(id:string)=>void;onPerson:(id:string)=>void;
 expanded:CollectionId|null;onExpanded:(id:CollectionId|null)=>void;
 settingsOpen:boolean;onSettingsOpen:(b:boolean)=>void;
}
function reason(p:DemoPerson,d:RegistrationDraft){
 const ev=evidence(p,d);
 const names=ev.interests.slice(0,2).map(x=>itemOf(x)?.name).filter(Boolean);
 if(names.length)return "Общее: "+names.join(", ");
 if(ev.sameGoal)return "Похожие цели";
 if(ev.languages.length)return "Общий язык общения";
 return "Анкета · демо";
}
function PersonTile({person,draft,saved,onSave,onPerson}:{person:DemoPerson;draft:RegistrationDraft;saved:boolean;onSave:(id:string)=>void;onPerson:(id:string)=>void}){
 const pic=person.photos[0];
 return <article className="fy-tile">
  <button className="fy-tile-photo" type="button" onClick={()=>onPerson(person.id)} aria-label={"Открыть демо-профиль "+person.name+", "+person.age}>
   <img src={pic.src} alt="" loading="lazy" decoding="async" draggable={false}
    onError={e=>{if(pic.fallback&&e.currentTarget.src!==pic.fallback)e.currentTarget.src=pic.fallback;}}/>
   <span className="fy-tile-fade" aria-hidden="true"/>
   <span className="fy-tile-demo">Демо</span>
   <span className="fy-tile-info"><strong>{person.name}, {person.age}</strong>
     <span><Flag code={person.countryCode} size={15}/>{person.city}</span>
   </span>
  </button>
  <button className={"fy-save"+(saved?" selected":"")} type="button" onClick={()=>onSave(person.id)}
   aria-label={saved?"Убрать "+person.name+" из сохранённых":"Сохранить "+person.name} aria-pressed={saved}>
    <Bookmark size={16} fill={saved?"currentColor":"none"}/>
  </button>
  <p className="fy-tile-reason">{reason(person,draft)}</p>
 </article>;
}
function Empty({text}:{text:string}){return <div className="fy-empty"><Sparkles size={19}/><span>{text}</span></div>;}
function emptyMessage(id:CollectionId){
 switch(id){
  case "online":return "В демо нет достоверных онлайн-статусов. В реальной подборке появятся только пользователи, разрешившие показывать активность.";
  case "new":return "Тестовые персонажи не считаются новыми регистрациями. Раздел заработает после безопасного запуска реальных анкет.";
  case "common":return "Укажи свои интересы или измени фильтры — мы не будем выдумывать совпадения.";
  case "goals":return "Выбери цель знакомства или измени фильтры.";
  case "nearby":return "Реальную близость не определяем. При локальном поиске показываем только тестовые анкеты с таким же указанным городом.";
  case "international":return "Чтобы найти людей из других стран, сначала укажи свою страну и проверь фильтры.";
  default:return "В этой теме пока нет подходящих демо-анкет. Попробуй изменить фильтры.";
 }
}
export function ForYou({draft,filters,saved,onSave,onPerson,expanded,onExpanded,settingsOpen,onSettingsOpen}:Props){
 const [prefs,setPrefs]=useState<Prefs>(savedPrefs);
 const scroll=useRef<HTMLDivElement>(null), first=useRef<HTMLElement>(null);
 useEffect(()=>{try{localStorage.setItem(storeKey,JSON.stringify(prefs));}catch{/* restricted Telegram storage */}},[prefs]);
 const eligible=useMemo(()=>filterDemoPeople(forYouDemoPeople,filters,draft),[filters,draft]);
 const ranked=useMemo(()=>rankDemonstrations(eligible,draft),[eligible,draft]);
 const members=useMemo(()=>Object.fromEntries(collectionDefinitions.map(c=>[c.id,membersFor(c.id,ranked,draft,filters)]))
  as Record<CollectionId,DemoPerson[]>,[ranked,draft,filters]);
 const shown=useMemo(()=>prefs.order.filter(id=>!prefs.hidden.includes(id))
  .sort((a,b)=>Number(prefs.favorites.includes(b))-Number(prefs.favorites.includes(a))),[prefs]);
 const one=(p:DemoPerson)=><PersonTile key={p.id} person={p} draft={draft} saved={saved.includes(p.id)} onSave={onSave} onPerson={onPerson}/>;
 const rail=(list:DemoPerson[],name:string)=><div className="fy-rail" role="group" aria-label={name} onPointerDown={e=>e.stopPropagation()}>{list.map(one)}</div>;
 const flip=(id:CollectionId,field:"hidden"|"favorites")=>setPrefs(p=>({...p,[field]:p[field].includes(id)?p[field].filter(x=>x!==id):[...p[field],id]}));
 const shift=(id:CollectionId,n:number)=>setPrefs(p=>{
  const order=[...p.order],a=order.indexOf(id),b=a+n;if(b<0||b>=order.length)return p;
  [order[a],order[b]]=[order[b],order[a]];return {...p,order};
 });
 const viewTitle=collectionDefinitions.find(c=>c.id===expanded)?.title;
 const jump=()=>{
  if(!scroll.current||!first.current)return;
  const s=scroll.current;
  const delta=first.current.getBoundingClientRect().top-s.getBoundingClientRect().top+s.scrollTop-8;
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  s.scrollTo({top:delta,behavior:reduced?"auto":"smooth"});
 };
 const section=(id:CollectionId)=>{
  const c=collectionDefinitions.find(x=>x.id===id)!,list=members[id],Icon=icons[id];
  return <section className="fy-section" key={id} aria-label={c.title}>
   <div className="fy-section-header"><div><h3><Icon size={18}/>{c.title}</h3><p>{c.description}</p></div>
    {!!list.length&&<button type="button" onClick={()=>onExpanded(id)}>Смотреть всех <ArrowRight size={14}/></button>}
   </div>
   {list.length?rail(list,c.title+" · демо"):<Empty text={emptyMessage(id)}/>}
  </section>;
 };
 return <div className="fy-root">
  <div className="fy-scroll" ref={scroll}>
   <div className="fy-hero">
    <div className="fy-hero-glow" aria-hidden="true"/><div className="fy-hero-mark" aria-hidden="true"><Heart size={89} strokeWidth={.85}/><Sparkles size={29}/></div>
    <div className="fy-hero-copy">
     <span className="fy-eyebrow"><Sparkles size={13}/> ТВОЯ ПОДБОРКА</span>
     <h2>Твоя история может начаться сегодня</h2>
     <p>Открой людей, с которыми у тебя есть что-то общее.</p>
     <button type="button" className="fy-hero-button" onClick={jump}>Смотреть рекомендации <ArrowRight size={16}/></button>
    </div>
   </div>
   <div className="fy-toolbar"><span>Подборки · демо</span>
    <button type="button" onClick={()=>onSettingsOpen(true)}><Settings2 size={16}/> Настроить</button></div>
   <section className="fy-section" ref={first} aria-label="Лучшие совпадения сегодня">
    <div className="fy-section-header"><div><h3><Sparkles size={18}/>Лучшие совпадения сегодня</h3>
     <p>Подборка-пример по интересам, целям и языкам</p></div></div>
    {ranked.length?rail(ranked,"Персональные рекомендации · демо"):<Empty text="По выбранным фильтрам нет тестовых анкет. Измени параметры поиска."/>}
   </section>
   {shown.includes("common")&&section("common")}
   {shown.filter(id=>id!=="common").map(section)}
   {!shown.length&&<Empty text="Все темы скрыты. Верни нужные подборки через «Настроить»."/>}
   <p className="fy-legal">16 вымышленных персонажей · только демо. Нет реальных мэтчей, онлайн-статусов, процентов совместимости или новых регистраций.</p>
  </div>
  {expanded&&<section className="fy-expanded" role="region" aria-label={"Полная подборка: "+viewTitle}>
   <header><button type="button" onClick={()=>onExpanded(null)} aria-label="Назад к подборкам" className="fy-back"><ArrowLeft size={20}/></button>
    <div><h2>{viewTitle}</h2><p>Полная подборка · демо</p></div></header>
   {members[expanded].length?<div className="fy-grid">{members[expanded].map(one)}</div>:<Empty text={emptyMessage(expanded)}/>}
  </section>}
  {settingsOpen&&<section className="fy-manage" role="dialog" aria-modal="true" aria-label="Управление подборками">
   <header><div><h2>Мои подборки</h2><p>Избранное, порядок и видимость тематических блоков.</p></div>
    <button type="button" className="fy-back" onClick={()=>onSettingsOpen(false)} aria-label="Закрыть"><X size={19}/></button></header>
   <div className="fy-manage-list">{prefs.order.map((id,i)=>{
    const c=collectionDefinitions.find(x=>x.id===id)!,Icon=icons[id];
    return <div className="fy-manage-row" key={id}><span><Icon size={16}/>{c.title}</span>
     <div>
      <button type="button" onClick={()=>shift(id,-1)} disabled={i===0} aria-label={"Поднять "+c.title}><ChevronUp size={17}/></button>
      <button type="button" onClick={()=>shift(id,1)} disabled={i===prefs.order.length-1} aria-label={"Опустить "+c.title}><ChevronDown size={17}/></button>
      <button type="button" onClick={()=>flip(id,"favorites")} aria-pressed={prefs.favorites.includes(id)} aria-label={"Избранное: "+c.title}><Heart size={17} fill={prefs.favorites.includes(id)?"currentColor":"none"}/></button>
      <button type="button" onClick={()=>flip(id,"hidden")} aria-pressed={!prefs.hidden.includes(id)} aria-label={"Видимость: "+c.title}>
       {prefs.hidden.includes(id)?<X size={17}/>:<Check size={17}/>}</button>
     </div>
    </div>;
   })}</div>
   <footer><button type="button" onClick={()=>setPrefs(initial)}>Сбросить</button>
    <button type="button" onClick={()=>onSettingsOpen(false)}>Готово</button></footer>
  </section>}
 </div>;
}
