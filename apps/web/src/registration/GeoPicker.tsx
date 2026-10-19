import {useEffect,useRef,useState} from "react";
import type {CSSProperties} from "react";
import {MapPin,Search,LocateFixed,LoaderCircle,ChevronDown} from "lucide-react";
import {GlassField} from "../ui/Glass";
import {Flag} from "../ui/Flag";
import type {RegistrationDraft,SearchScope} from "./model";
export interface Place {id:string;city:string;country:string;countryCode:string;region?:string}
interface SearchResult {results?:Place[];coverage?:"demo"|"world"}
const scopeOptions:[SearchScope,string,string][]=[
 ["radius","По радиусу","В пределах выбранного расстояния"],
 ["country","В своей стране","Без ограничения по километрам"],
 ["world","Весь мир","Без ограничений по стране и радиусу"]
];
export const radiusAt=(p:number)=>Math.round(1+4999*Math.pow(Math.max(0,Math.min(p,100))/100,2));
export const positionAt=(km:number)=>Math.round(100*Math.sqrt((Math.max(1,Math.min(km,5000))-1)/4999));
export function GeoPicker({data,patch}:{data:RegistrationDraft;patch:(values:Partial<RegistrationDraft>)=>void}){
 const [manual,setManual]=useState(!!data.placeId);
 const [query,setQuery]=useState(data.placeId?data.city+", "+data.country:"");
 const [results,setResults]=useState<Place[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [demo,setDemo]=useState(false);
 const [scopeOpen,setScopeOpen]=useState(false);
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>{
   if(!manual||query.trim().length<2||data.placeId){setResults([]);return;}
   const ac=new AbortController();controller.current=ac;
   const timer=window.setTimeout(()=>{
     setLoading(true);
     fetch("/api/geo/search?q="+encodeURIComponent(query.trim()),{signal:ac.signal})
       .then(async r=>{if(!r.ok)throw new Error("Поиск сейчас недоступен");return await r.json() as SearchResult;})
       .then(value=>{if(ac.signal.aborted)return;setResults(value.results??[]);setDemo(value.coverage==="demo");setError("");})
       .catch(()=>{if(!ac.signal.aborted){setError("Не удалось найти города. Повтори попытку.");setResults([]);}})
       .finally(()=>{if(!ac.signal.aborted)setLoading(false);});
   },250);
   return ()=>{clearTimeout(timer);ac.abort();};
 },[manual,query,data.placeId]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const choose=(place:Place)=>{
   patch({city:place.city,country:place.country,placeId:place.id,countryCode:place.countryCode});
   setQuery(place.city+", "+place.country);setResults([]);setError("");
 };
 const detect=()=>{
   setManual(false);
   if(!navigator.geolocation){setError("Геолокация недоступна. Выбери город вручную.");return;}
   setLoading(true);setError("");
   navigator.geolocation.getCurrentPosition(async pos=>{
     try{
       const response=await fetch("/api/geo/reverse",{method:"POST",headers:{"Content-Type":"application/json"},
         body:JSON.stringify({lat:pos.coords.latitude,lon:pos.coords.longitude})});
       if(!response.ok)throw new Error("Автоматическое определение сейчас недоступно. Выбери город вручную.");
       const result=await response.json() as {result?:Place};
       if(!result.result)throw new Error("Не удалось определить город.");
       choose(result.result);
     }catch(e){setManual(true);setError(e instanceof Error?e.message:"Не удалось определить местоположение.");}
     finally{setLoading(false);}
   },()=>{setManual(true);setError("Доступ к геолокации не предоставлен. Выбери город вручную.");setLoading(false);},
   {enableHighAccuracy:false,timeout:9000,maximumAge:120000});
 };
 const switchMode=()=>{
   if(manual){setManual(false);setError("");}
   else{setManual(true);setError("");}
 };
 const selectedScope=scopeOptions.find(x=>x[0]===data.searchScope)??scopeOptions[0];
 return <div className="geo-stack">
   {!manual?<button className="geo-location-primary" type="button" onClick={detect} disabled={loading}>
     {loading?<LoaderCircle className="spin" size={22}/>:<LocateFixed size={22}/>}
     <span><strong>{data.placeId?"Определить местоположение снова":"Моё местоположение"}</strong><small>По разрешению Telegram или устройства</small></span>
   </button>:<GlassField label="Страна и город">
     <div className="geo-input-wrap">
       <Search size={20} aria-hidden="true"/>
       <input className="glass-control geo-input" role="combobox" autoComplete="off"
         aria-expanded={results.length>0} aria-controls="luemi-geo-results" aria-autocomplete="list"
         maxLength={80} placeholder="Введи город или страну" value={query}
         onChange={e=>{setQuery(e.target.value);patch({placeId:"",city:"",country:"",countryCode:""});setError("");}}/>
       {loading&&<LoaderCircle className="spin" size={18}/>}
     </div>
   </GlassField>}
   {!manual?<button type="button" className="geo-mode-toggle" onClick={switchMode}>Выбрать город вручную</button>:
     <button type="button" className="geo-mode-toggle" onClick={switchMode}><LocateFixed size={15}/> Определить моё местоположение</button>}
   {manual&&!data.placeId&&results.length>0&&<div id="luemi-geo-results" role="listbox" className="geo-results">
     {results.map(place=><button key={place.id} type="button" role="option" aria-selected={false} onClick={()=>choose(place)}>
       <Flag code={place.countryCode} title={"Флаг "+place.country}/><span><strong>{place.city}</strong><small>{place.country}{place.region?", "+place.region:""}</small></span><MapPin size={17}/>
     </button>)}
   </div>}
   {data.placeId&&<div className="geo-selected"><Flag code={data.countryCode}/><MapPin size={15}/><strong>{data.city}</strong><span>{data.country}</span></div>}
   {manual&&query.trim().length>1&&!loading&&!data.placeId&&!results.length&&!error&&<p className="hint">Выбери реальный город из подсказок. Свободный текст не сохраняется.</p>}
   {error&&<p className="field-warning" role="alert">{error}</p>}
   {demo&&<p className="hint">Тестовый справочник ограничен. Полный мировой поиск требует настройки провайдера.</p>}
   <div className="geo-scope">
     <span className="field-label">Где искать людей?</span>
     <button className="glass-control scope-control" type="button" aria-expanded={scopeOpen} onClick={()=>setScopeOpen(x=>!x)}>
       <span><strong>{selectedScope[1]}</strong><small>{selectedScope[2]}</small></span><ChevronDown size={19}/>
     </button>
     {scopeOpen&&<div className="scope-options">
       {scopeOptions.map(([scope,label,detail])=><button type="button" key={scope} role="option" aria-selected={data.searchScope===scope}
         onClick={()=>{patch({searchScope:scope});setScopeOpen(false);}}>
         <strong>{label}</strong><small>{detail}</small>
       </button>)}
     </div>}
   </div>
   <div className={"radius-control"+(data.searchScope!=="radius"?" is-disabled":"")}>
     <div className="range-title"><span>Радиус поиска</span><strong>{data.radius.toLocaleString("ru")} км</strong></div>
     <div className="branded-slider" style={{"--range-pct":positionAt(data.radius)+"%"} as CSSProperties}>
       <input type="range" min="0" max="100" step="1" disabled={data.searchScope!=="radius"}
         value={positionAt(data.radius)} aria-label="Радиус поиска, километры"
         onChange={e=>patch({radius:radiusAt(Number(e.target.value))})}/>
     </div>
     <div className="range-limits"><span>1 км</span><span>5 000 км</span></div>
   </div>
   <p className="hint">Точные координаты никому не показываются. В режиме «Весь мир» радиус сохраняется для следующего локального поиска.</p>
 </div>;
}
