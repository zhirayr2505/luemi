import {useMemo,useRef,useState} from "react";
import {ArrowLeft,ArrowRight,Bookmark,Check,ChevronDown,ChevronUp,Globe2,Heart,MapPin,Music2,Plane,Settings2,Sparkles,Users,X} from "lucide-react";
import type {RegistrationDraft} from "../registration/model";
import type {RealPublishedProfile} from "../registration/real-live-client";
import {Flag} from "../ui/Flag";
import {itemOf} from "../ui/InterestCatalog";
import "./for-you.css";

// Restore the approved For You shelves with authenticated, published profiles.
// No demo fixtures, fictional online presence, or invented registration dates.
const topics=[
 {id:"online",title:"Сейчас в сети",description:"Статусы присутствия пока недоступны."},
 {id:"common",title:"Много общего",description:"Люди с похожими интересами."},
 {id:"goals",title:"Похожие цели",description:"Вы хотите похожего от знакомств."},
 {id:"new",title:"Новые в LUEMI",description:"Новые регистрации появятся после подтверждения даты публикации."},
 {id:"nearby",title:"Рядом с тобой",description:"Люди из указанного города — без определения GPS."},
 {id:"travel",title:"Любят путешествовать",description:"Люди, которые указали путешествия в интересах."},
 {id:"music",title:"Музыка нас объединяет",description:"Люди с интересом к музыке."},
 {id:"international",title:"Из других стран",description:"Знакомства за пределами твоей страны."}
] as const;
type Topic=(typeof topics)[number]["id"];
const allIds:Topic[]=topics.map(t=>t.id);
const icons={online:Users,common:Heart,goals:Sparkles,new:Sparkles,nearby:MapPin,travel:Plane,music:Music2,international:Globe2} as const;
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
  // The public feed does not contain presence or published-at signals.
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
 if(person.languages.some(id=>draft.languages.includes(id)))return "Общий язык общения";
 return "Реальная анкета LUEMI";
}
function Tile({person,draft,saved,onSave,onPerson,priority=false}:{
 person:RealPublishedProfile;draft:RegistrationDraft;saved:boolean;
 onSave:(id:string)=>void;onPerson:(person:RealPublishedProfile)=>void;priority?:boolean
}){
 const photo=person.photos[0];
 return <article className="fy-tile">
  <button type="button" className="fy-tile-photo" onClick={()=>onPerson(person)}
   aria-label={"Открыть профиль "+person.name+", "+person.age}>
   {photo&&<img src={photo.url} alt="" loading={priority?"eager":"lazy"} decoding="async"
    draggable={false} onError={event=>{event.currentTarget.style.visibility="hidden";}}/>}
   <span className="fy-tile-fade" aria-hidden="true"/>
   <span className="fy-tile-info"><strong>{person.name}, {person.age}</strong>
    <span><Flag code={person.countryCode} size={15}/>{person.city}</span></span>
  </button>
  <button className={"fy-save"+(saved?" selected":"")} type="button"
   onClick={()=>onSave(person.id)} aria-pressed={saved}
   aria-label={(saved?"Убрать временную закладку: ":"Отметить в этой сессии: ")+person.name}
   title="Закладки сохраняются только до закрытия приложения">
   <Bookmark size={16} fill={saved?"currentColor":"none"}/>
  </button>
  <p className="fy-tile-reason">{reason(person,draft)}</p>
 </article>;
}
const emptyMessage=(id:Topic)=>{
 if(id==="online")return "Онлайн-статусы пока не передаются сервером.";
 if(id==="new")return "Сервер пока не передаёт дату регистрации — не будем выдумывать её.";
 return "В этой подборке пока нет подходящих опубликованных анкет.";
};
export function RealForYou({draft,people,onPerson,saved,onSave,onMore,hasMore,moreBusy,onScrollTop}:{
 draft:RegistrationDraft;people:RealPublishedProfile[];
 onPerson:(person:RealPublishedProfile)=>void;saved:ReadonlySet<string>;onSave:(id:string)=>void;
 onMore:()=>void;hasMore:boolean;moreBusy:boolean;onScrollTop?:(top:number)=>void
}){
 const [order,setOrder]=useState<Topic[]>(allIds);
 const [hidden,setHidden]=useState<Topic[]>([]);
 const [favorites,setFavorites]=useState<Topic[]>([]);
 const [expanded,setExpanded]=useState<Topic|"best"|null>(null);
 const [manage,setManage]=useState(false);
 const scroll=useRef<HTMLDivElement>(null);
 const ranked=useMemo(()=>[...people].sort((a,b)=>score(b,draft)-score(a,draft)||a.id.localeCompare(b.id)),[people,draft]);
 const shown=order.filter(id=>!hidden.includes(id))
  .sort((a,b)=>Number(favorites.includes(b))-Number(favorites.includes(a)));
 const rows=(persons:RealPublishedProfile[],name:string,priority=false)=>
  <div className="fy-rail" role="group" aria-label={name}
   onPointerDown={event=>event.stopPropagation()}>
   {persons.slice(0,6).map((p,i)=><Tile key={p.id} person={p} draft={draft}
    saved={saved.has(p.id)} onSave={onSave} onPerson={onPerson} priority={priority&&i<2}/>)}
  </div>;
 const section=(id:Topic)=>{
  const topic=topics.find(t=>t.id===id)!;
  const list=members(id,ranked,draft);
  const Icon=icons[id];
  return <section className="fy-section" key={id} aria-label={topic.title}>
   <div className="fy-section-header"><div><h3><Icon size={18}/>{topic.title}</h3>
    <p>{topic.description}</p></div>
    {list.length>0&&<button type="button" onClick={()=>setExpanded(id)}>Смотреть всех <ArrowRight size={14}/></button>}
   </div>
   {list.length?rows(list,topic.title):
    <div className="fy-empty"><Sparkles size={19}/><span>{emptyMessage(id)}</span></div>}
  </section>;
 };
 const toggle=(id:Topic,which:"hidden"|"favorites")=>{
  const setter=which==="hidden"?setHidden:setFavorites;
  setter(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
 };
 const shift=(id:Topic,by:number)=>setOrder(prev=>{
  const from=prev.indexOf(id),to=from+by;
  if(to<0||to>=prev.length)return prev;
  const next=[...prev];[next[from],next[to]]=[next[to],next[from]];return next;
 });
 const heading=expanded==="best"?"Лучшие совпадения сегодня":topics.find(t=>t.id===expanded)?.title;
 const expandedPeople=expanded===null?[]:expanded==="best"?ranked:members(expanded,ranked,draft);
 return <div className="fy-root">
  <div className="fy-scroll" ref={scroll} inert={!!expanded} aria-hidden={!!expanded}
   onScroll={e=>{if(!expanded)onScrollTop?.(e.currentTarget.scrollTop);}}>
   <div className="fy-hero">
    <div className="fy-hero-glow" aria-hidden="true"/>
    <div className="fy-hero-mark" aria-hidden="true"><Heart size={89} strokeWidth={.85}/><Sparkles size={29}/></div>
    <div className="fy-hero-copy">
     <span className="fy-eyebrow"><Sparkles size={13}/> ТВОЯ ПОДБОРКА</span>
     <h2>Твоя история может начаться сегодня</h2>
     <p>Открой людей, с которыми у тебя есть что-то общее.</p>
     <button className="fy-hero-button" type="button" onClick={()=>{
      scroll.current?.querySelector(".fy-section")?.scrollIntoView({behavior:"smooth",block:"start"});
     }}>Смотреть рекомендации <ArrowRight size={16}/></button>
    </div>
   </div>
   <div className="fy-toolbar"><span>Подборки · реальные анкеты</span>
    <button type="button" onClick={()=>setManage(true)}><Settings2 size={16}/> Настроить</button></div>
   <section className="fy-section" aria-label="Лучшие совпадения сегодня">
    <div className="fy-section-header"><div><h3><Sparkles size={18}/>Лучшие совпадения сегодня</h3>
     <p>По интересам, целям и языкам — без выдуманного процента совместимости</p></div>
     {ranked.length>0&&<button type="button" onClick={()=>setExpanded("best")}>Смотреть всех <ArrowRight size={14}/></button>}
    </div>
    {ranked.length?rows(ranked,"Персональные рекомендации",true):
     <div className="fy-empty"><Sparkles size={19}/>Пока нет опубликованных анкет для рекомендаций.</div>}
   </section>
   {shown.map(section)}
   {!shown.length&&<div className="fy-empty">Все темы скрыты. Верни их через «Настроить».</div>}
   {hasMore&&<div className="nb-more"><button type="button" disabled={moreBusy} onClick={onMore}>
    {moreBusy?"Загружаем…":"Загрузить ещё анкеты"} <ArrowRight size={16}/></button></div>}
   <p className="fy-legal">Только опубликованные реальные анкеты. Онлайн-статусы и расстояния не выдумываются. Закладки временные.</p>
  </div>
  {expanded&&<section className="fy-expanded" role="region" aria-label={"Подборка: "+heading}>
   <header><button type="button" className="fy-back" onClick={()=>setExpanded(null)} aria-label="Назад к подборкам">
    <ArrowLeft size={20}/></button><div><h2>{heading}</h2><p>Опубликованные анкеты LUEMI</p></div></header>
   {expandedPeople.length?<div className="fy-grid" onScroll={e=>onScrollTop?.(e.currentTarget.scrollTop)}>
    {expandedPeople.map(p=><Tile key={p.id} person={p} draft={draft}
     saved={saved.has(p.id)} onSave={onSave} onPerson={onPerson}/>)}
   </div>:<div className="fy-empty">Пока никого не нашли.</div>}
  </section>}
  {manage&&<section className="fy-manage" role="dialog" aria-modal="true" aria-label="Управление подборками">
   <header><div><h2>Мои подборки</h2><p>Избранное, порядок и видимость тематических блоков.</p></div>
    <button type="button" className="fy-back" onClick={()=>setManage(false)} aria-label="Закрыть"><X size={19}/></button>
   </header>
   <div className="fy-manage-list">{order.map((id,i)=>{
    const topic=topics.find(t=>t.id===id)!,Icon=icons[id];
    return <div className="fy-manage-row" key={id}><span><Icon size={16}/>{topic.title}</span>
     <div>
      <button type="button" onClick={()=>shift(id,-1)} disabled={i===0} aria-label={"Поднять "+topic.title}><ChevronUp size={17}/></button>
      <button type="button" onClick={()=>shift(id,1)} disabled={i===order.length-1} aria-label={"Опустить "+topic.title}><ChevronDown size={17}/></button>
      <button type="button" onClick={()=>toggle(id,"favorites")} aria-pressed={favorites.includes(id)}
       aria-label={"Избранное: "+topic.title}><Heart size={17} fill={favorites.includes(id)?"currentColor":"none"}/></button>
      <button type="button" onClick={()=>toggle(id,"hidden")} aria-pressed={!hidden.includes(id)}
       aria-label={"Видимость: "+topic.title}>{hidden.includes(id)?<X size={17}/>:<Check size={17}/>}</button>
     </div></div>;
   })}</div>
   <footer><button type="button" onClick={()=>{setOrder(allIds);setHidden([]);setFavorites([]);}}>Сбросить</button>
    <button type="button" onClick={()=>setManage(false)}>Готово</button></footer>
  </section>}
 </div>;
}
