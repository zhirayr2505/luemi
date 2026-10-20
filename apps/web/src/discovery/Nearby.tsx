import {memo,useEffect,useMemo,useRef,useState} from "react";
import {ArrowRight,Bookmark,Globe2,MapPin,SlidersHorizontal,UsersRound} from "lucide-react";
import type {RegistrationDraft} from "../registration/model";
import {Flag} from "../ui/Flag";
import {itemOf} from "../ui/InterestCatalog";
import type {DemoPerson,DiscoveryFilter} from "./model";
import {filterDemoPeople} from "./model";
import {forYouDemoPeople} from "./for-you-data";
import {nearbyTitle,selectNearbyDemos} from "./nearby-logic";
import "./nearby.css";

interface Props{
 draft:RegistrationDraft;
 filters:DiscoveryFilter;
 saved:string[];
 onSave:(id:string)=>void;
 onPerson:(id:string)=>void;
 onFilters:()=>void;
 onEditLocation:()=>void;
 onScrollTop?:(top:number)=>void;
}
const pageSize=8;

function PersonCard({person,draft,saved,onSave,onPerson}:{
 person:DemoPerson;draft:RegistrationDraft;saved:boolean;
 onSave:(id:string)=>void;onPerson:(id:string)=>void;
}){
 const photo=person.photos[0];
 const common=draft.interests.find(id=>person.interests.includes(id));
 const label=common?itemOf(common)?.name:null;
 return <article className="nb-card">
   <button className="nb-photo" type="button" onClick={()=>onPerson(person.id)}
     aria-label={"Открыть демо-профиль "+person.name+", "+person.age}>
     <img src={photo.src} alt="" loading="lazy" decoding="async" draggable={false}
       onError={event=>{if(photo.fallback&&event.currentTarget.src!==photo.fallback)event.currentTarget.src=photo.fallback;}}/>
     <span className="nb-photo-shade" aria-hidden="true"/>
     <span className="nb-demo">Демо</span>
     <span className="nb-person"><strong>{person.name}, {person.age}</strong>
       <span><Flag code={person.countryCode} size={15}/><span>{person.city}</span></span>
     </span>
   </button>
   <button className={"nb-bookmark"+(saved?" is-saved":"")} type="button"
     onClick={()=>onSave(person.id)} aria-pressed={saved}
     aria-label={saved?"Убрать "+person.name+" из сохранённых":"Сохранить "+person.name}>
     <Bookmark size={18} strokeWidth={1.9} fill={saved?"currentColor":"none"}/>
   </button>
   {label&&<div className="nb-interest" title={"Общий интерес: "+label}>
     <span aria-hidden="true">✦</span><span>{label}</span>
   </div>}
 </article>;
}
const MemoCard=memo(PersonCard);

export const Nearby=memo(function Nearby({draft,filters,saved,onSave,onPerson,onFilters,onEditLocation,onScrollTop}:Props){
 const [visible,setVisible]=useState(pageSize);
 const scroller=useRef<HTMLDivElement>(null);
 const sentinel=useRef<HTMLDivElement>(null);
 // Share all existing non-geographical filter rules, but never reuse the
 // fixture's fake distance number for local eligibility.
 const filtered=useMemo(()=>filterDemoPeople(forYouDemoPeople,{...filters,scope:"world"},draft),[filters,draft]);
 const people=useMemo(()=>selectNearbyDemos(filtered,draft,filters.scope),[filtered,draft,filters.scope]);
 const shown=people.slice(0,visible);
 const hasMore=shown.length<people.length;
 useEffect(()=>{
  if(!hasMore||!sentinel.current||!scroller.current||typeof IntersectionObserver==="undefined")return;
  const observer=new IntersectionObserver(entries=>{
   if(entries.some(entry=>entry.isIntersecting))setVisible(previous=>Math.min(previous+pageSize,people.length));
  },{root:scroller.current,rootMargin:"160px 0px",threshold:0});
  observer.observe(sentinel.current);
  return ()=>observer.disconnect();
 },[hasMore,people.length]);

 const scope=filters.scope;
 const hasArea=scope==="world"||(scope==="country"?!!draft.countryCode:!!draft.countryCode&&!!draft.city);
 const heading=scope==="world"?"Весь мир":scope==="country"?(draft.country||"Страна не выбрана"):(draft.city||"Город не выбран");
 const subline=scope==="world"?"Поиск без ограничения расстояния":scope==="country"?
  "По указанной стране · не GPS":("Радиус задан: "+filters.radius.toLocaleString("ru")+" км · демо по городу");
 const explanation=scope==="world"?"Мировой демо-каталог — здесь нет измерения расстояний.":
  scope==="country"?"Показываем только анкеты с указанной страной, не реальную геопозицию.":
  "Совпадает заявленный город. Расстояния между людьми не вычисляются.";
 return <section className="nb-root" aria-label="Рядом · демонстрационный каталог">
   <div className="nb-scroll" ref={scroller} onScroll={event=>onScrollTop?.(event.currentTarget.scrollTop)}>
     <button className="nb-location" type="button" onClick={onFilters} aria-label={"Настройки географического поиска: "+heading}>
       <span className="nb-location-icon">{scope==="world"?<Globe2 size={23}/>:<MapPin size={23}/>}</span>
       <span className="nb-location-copy"><strong>{heading}</strong><span>{subline}</span></span>
       <span className="nb-location-edit"><SlidersHorizontal size={18}/></span>
     </button>
     <div className="nb-head">
       <div><h2>{nearbyTitle(scope)}</h2><p>{explanation}</p></div>
       <span className="nb-count">{people.length} · демо</span>
     </div>
     {!hasArea?<div className="nb-empty">
       <MapPin size={29}/><h3>Выбери место поиска</h3>
       <p>Для местного поиска сначала укажи город или страну в своей анкете. Геодоступ не требуется.</p>
       <button type="button" onClick={onEditLocation}>К анкете <ArrowRight size={16}/></button>
     </div>:!people.length?<div className="nb-empty">
       <UsersRound size={30}/><h3>Здесь пока никого не нашли</h3>
       <p>По этим настройкам не нашлось подходящих вымышленных анкет. Настоящих пользователей в демо пока нет.</p>
       <button type="button" onClick={onFilters}>Изменить фильтры <ArrowRight size={16}/></button>
     </div>:<>
       <div className="nb-grid">
         {shown.map(person=><MemoCard key={person.id} person={person} draft={draft}
           saved={saved.includes(person.id)} onSave={onSave} onPerson={onPerson}/>)}
       </div>
       {hasMore&&<div ref={sentinel} className="nb-more">
         <button type="button" onClick={()=>setVisible(n=>Math.min(n+pageSize,people.length))}>
           Показать ещё <ArrowRight size={16}/>
         </button>
       </div>}
     </>}
     <p className="nb-footer">Только вымышленные анкеты · без GPS-координат, выдуманных расстояний и реальных онлайн-статусов.</p>
   </div>
 </section>;
});
