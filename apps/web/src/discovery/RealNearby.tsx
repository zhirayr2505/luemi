import {useMemo,useState} from "react";
import {ArrowRight,Bookmark,Globe2,MapPin,SlidersHorizontal,UsersRound} from "lucide-react";
import type {RegistrationDraft} from "../registration/model";
import type {RealPublishedProfile} from "../registration/real-live-client";
import {Flag} from "../ui/Flag";
import {itemOf} from "../ui/InterestCatalog";
import "./nearby.css";

type Scope="city"|"country"|"world";
const normalize=(value:string)=>value.trim().normalize("NFC").toLocaleLowerCase("ru");
function Tile({person,draft,saved,onPerson,onSave,priority}:{
 person:RealPublishedProfile;draft:RegistrationDraft;saved:boolean;
 onPerson:(person:RealPublishedProfile)=>void;onSave:(id:string)=>void;priority:boolean
}){
 const photo=person.photos[0];
 const common=draft.interests.find(id=>person.interests.includes(id));
 const interest=common?itemOf(common)?.name:null;
 return <article className="nb-card">
  <button className="nb-photo" type="button" onClick={()=>onPerson(person)}
   aria-label={"Открыть профиль "+person.name+", "+person.age}>
   {photo&&<img src={photo.url} alt="" loading={priority?"eager":"lazy"}
    decoding="async" draggable={false}
    onError={event=>{event.currentTarget.style.visibility="hidden";}}/>}
   <span className="nb-photo-shade" aria-hidden="true"/>
   <span className="nb-person"><strong>{person.name}, {person.age}</strong>
    <span><Flag code={person.countryCode} size={15}/><span>{person.city}</span></span>
   </span>
  </button>
  <button type="button" className={"nb-bookmark"+(saved?" is-saved":"")}
   aria-pressed={saved} title="Закладка сохраняется только в этой сессии"
   aria-label={(saved?"Убрать временную закладку: ":"Отметить в этой сессии: ")+person.name}
   onClick={()=>onSave(person.id)}>
   <Bookmark size={18} strokeWidth={1.9} fill={saved?"currentColor":"none"}/>
  </button>
  {interest&&<div className="nb-interest"><span aria-hidden="true">✦</span><span>{interest}</span></div>}
 </article>;
}
export function RealNearby({draft,people,onPerson,saved,onSave,onMore,hasMore,moreBusy,onEditLocation}:{
 draft:RegistrationDraft;people:RealPublishedProfile[];
 onPerson:(person:RealPublishedProfile)=>void;saved:ReadonlySet<string>;
 onSave:(id:string)=>void;onMore:()=>void;hasMore:boolean;moreBusy:boolean;
 onEditLocation:()=>void
}){
 const [scope,setScope]=useState<Scope>("city");
 const [settings,setSettings]=useState(false);
 const [visible,setVisible]=useState(8);
 const filtered=useMemo(()=>{
  let eligible=people;
  if(scope==="city")eligible=people.filter(person=>!!draft.city&&!!draft.countryCode&&
   person.countryCode===draft.countryCode&&normalize(person.city)===normalize(draft.city));
  if(scope==="country")eligible=people.filter(person=>!!draft.countryCode&&person.countryCode===draft.countryCode);
  return [...eligible].sort((a,b)=>{
   const common=(p:RealPublishedProfile)=>p.interests.filter(x=>draft.interests.includes(x)).length;
   return common(b)-common(a)||a.id.localeCompare(b.id);
  });
 },[people,scope,draft.city,draft.countryCode,draft.interests]);
 const heading=scope==="city"?(draft.city||"Город не выбран"):scope==="country"?
  (draft.country||"Страна не выбрана"):"Весь мир";
 const subline=scope==="city"?"По указанному городу · не GPS":
  scope==="country"?"По указанной стране · не GPS":"Без ограничения по стране";
 const explanation=scope==="city"?"Показываем людей из того же указанного города.":
  scope==="country"?"Показываем людей из выбранной страны.":"Опубликованные анкеты людей со всего мира.";
 const hasArea=scope==="world"||(scope==="country"?!!draft.countryCode:!!draft.city&&!!draft.countryCode);
 return <section className="nb-root" aria-label="Рядом · опубликованные анкеты">
  <div className="nb-scroll">
   <button className="nb-location" type="button" onClick={()=>setSettings(s=>!s)}
    aria-expanded={settings} aria-label={"Настройки географического поиска: "+heading}>
    <span className="nb-location-icon">{scope==="world"?<Globe2 size={23}/>:<MapPin size={23}/>}</span>
    <span className="nb-location-copy"><strong>{heading}</strong><span>{subline}</span></span>
    <span className="nb-location-edit"><SlidersHorizontal size={18}/></span>
   </button>
   {settings&&<div className="real-nearby-scope" role="group" aria-label="Место поиска">
    {([["city","Мой город"],["country","Моя страна"],["world","Весь мир"]] as const).map(([id,label])=>
     <button key={id} type="button" aria-pressed={scope===id} onClick={()=>{
      setScope(id);setVisible(8);setSettings(false);
     }}>{label}</button>)}
    <small>Геопозиция и расстояние не запрашиваются. Учитывается город из анкеты.</small>
   </div>}
   <div className="nb-head">
    <div><h2>{scope==="world"?"Люди со всего мира":scope==="country"?
     "Люди из выбранной страны":"Люди из выбранного города"}</h2>
     <p>{explanation}</p></div>
    <span className="nb-count">{filtered.length} · анкеты</span>
   </div>
   {!hasArea?<div className="nb-empty"><MapPin size={29}/>
    <h3>Выбери место поиска</h3>
    <p>Укажи свой город или страну в анкете либо переключись на поиск по миру.</p>
    <button type="button" onClick={onEditLocation}>Открыть профиль <ArrowRight size={16}/></button>
   </div>:filtered.length===0?<div className="nb-empty"><UsersRound size={30}/>
    <h3>Здесь пока никого не нашли</h3>
    <p>Сейчас нет других опубликованных анкет в этой области. Попробуй выбрать страну или весь мир.</p>
    <button type="button" onClick={()=>setSettings(true)}>Изменить место поиска <ArrowRight size={16}/></button>
   </div>:<>
    <div className="nb-grid">{filtered.slice(0,visible).map((person,i)=>
     <Tile key={person.id} person={person} draft={draft} saved={saved.has(person.id)}
      onPerson={onPerson} onSave={onSave} priority={i<4}/>)}</div>
    {filtered.length>visible&&<div className="nb-more">
     <button type="button" onClick={()=>setVisible(n=>n+8)}>Показать ещё <ArrowRight size={16}/></button>
    </div>}
   </>}
   {hasMore&&<div className="nb-more"><button type="button" disabled={moreBusy} onClick={onMore}>
    {moreBusy?"Загружаем…":"Загрузить другие анкеты"} <ArrowRight size={16}/></button></div>}
   <p className="nb-footer">Только реальные опубликованные анкеты · без выдуманных расстояний и онлайн-статусов. Закладки временные.</p>
  </div>
 </section>;
}
