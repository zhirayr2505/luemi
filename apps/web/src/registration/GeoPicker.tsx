import {useEffect,useRef,useState} from "react";
import type {CSSProperties} from "react";
import {MapPin,Search,Globe2,LocateFixed,LoaderCircle} from "lucide-react";
import {GlassCheckbox,GlassField} from "../ui/Glass";
import type {RegistrationDraft} from "./model";
export interface Place {id:string;city:string;country:string;countryCode:string;region?:string}
interface Response {results?:Place[];coverage?:"demo"|"world";error?:string}
export function countryFlag(code:string):string {
 if(!/^[A-Z]{2}$/.test(code))return "🌐";
 return String.fromCodePoint(...Array.from(code).map(c=>127397+c.charCodeAt(0)));
}
export function GeoPicker({data,patch}:{data:RegistrationDraft;patch:(values:Partial<RegistrationDraft>)=>void}){
 const [query,setQuery]=useState(data.city?data.city+", "+data.country:"");
 const [items,setItems]=useState<Place[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [coverage,setCoverage]=useState<"demo"|"world">("demo");
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>{
   if(query.trim().length<2||data.placeId){setItems([]);setLoading(false);return;}
   const ctrl=new AbortController();controller.current=ctrl;
   const timer=window.setTimeout(()=>{
     setLoading(true);
     void fetch("/api/geo/search?q="+encodeURIComponent(query.trim()),{signal:ctrl.signal})
       .then(async r=>{const j=await r.json() as Response;if(!r.ok)throw Error("Сервис геопоиска временно недоступен.");
         if(ctrl.signal.aborted)return;setItems(j.results??[]);setCoverage(j.coverage??"demo");setError("");})
       .catch(()=>{if(!ctrl.signal.aborted){setError("Не удалось загрузить города. Повтори поиск.");setItems([]);}})
       .finally(()=>{if(!ctrl.signal.aborted)setLoading(false);});
   },280);
   return ()=>{clearTimeout(timer);ctrl.abort();};
 },[query,data.placeId]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const select=(p:Place)=>{
   patch({city:p.city,country:p.country,countryCode:p.countryCode,placeId:p.id});
   setQuery(p.city+", "+p.country);setItems([]);setError("");
 };
 return <div className="geo-stack">
   <GlassField label="Страна и город">
     <div className="geo-input-wrap">
       <Search size={20} aria-hidden="true"/>
       <input className="glass-control geo-input" autoComplete="off" role="combobox" aria-expanded={items.length>0}
         aria-controls="luemi-geo-results" aria-autocomplete="list"
         placeholder="Например, Ереван или Краснодар" value={query} maxLength={80}
         onChange={e=>{setQuery(e.target.value);patch({city:"",country:"",countryCode:"",placeId:""});setError("");}}/>
       {loading&&<LoaderCircle className="spin" size={17} aria-hidden="true"/>}
     </div>
   </GlassField>
   {data.placeId&&<div className="geo-selected"><MapPin size={16}/>{countryFlag(data.countryCode)} {data.city}, {data.country}</div>}
   {!data.placeId&&items.length>0&&<div id="luemi-geo-results" className="geo-results" role="listbox">
     {items.map(p=><button type="button" role="option" aria-selected={false} key={p.id} onClick={()=>select(p)}>
       <span className="geo-flag">{countryFlag(p.countryCode)}</span>
       <span><strong>{p.city}</strong><small>{p.country}{p.region?" · "+p.region:""}</small></span>
       <MapPin size={17} aria-hidden="true"/>
     </button>)}
   </div>}
   {!data.placeId&&query.trim().length>=2&&!loading&&!items.length&&!error&&
     <p className="hint">Подтверждённых совпадений нет. Уточни название города.</p>}
   {error&&<p className="field-warning">{error}</p>}
   {coverage==="demo"&&<p className="hint">Тестовый справочник ограничен несколькими городами. Полный мировой поиск включится после настройки Geoapify.</p>}
   <div className={"radius-control"+(data.worldwide?" is-disabled":"")}>
     <div className="range-title"><span>Радиус поиска</span><strong>{data.radius} км</strong></div>
     <div className="branded-slider" style={{"--range-pct":((data.radius-1)/999*100)+"%"} as CSSProperties}>
       <input type="range" min={1} max={1000} step={1} disabled={data.worldwide} aria-label="Радиус поиска, километры"
         value={data.radius} onChange={e=>patch({radius:Number(e.target.value)})}/>
     </div>
     <div className="range-limits"><span>1 км</span><span>1000 км</span></div>
   </div>
   <GlassCheckbox checked={data.worldwide} onChange={worldwide=>patch({worldwide})}>
     <Globe2 size={17} aria-hidden="true"/> Искать по всему миру
   </GlassCheckbox>
   <button className="glass-choice location-button" disabled type="button" title="Включим с подтверждённым reverse geocoding">
     <LocateFixed size={18}/> Моё местоположение · скоро
   </button>
   <p className="hint">Геолокация только по разрешению. Точный адрес не публикуется.</p>
 </div>;
}
