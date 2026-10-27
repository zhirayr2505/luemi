import {useEffect,useRef,useState} from "react";
import type {CSSProperties} from "react";
import {MapPin,Search,LocateFixed,LoaderCircle,ChevronDown} from "lucide-react";
import {normalizeCountryCode} from "@luemi/contracts";
import {GlassField} from "../ui/Glass";
import {Flag} from "../ui/Flag";
import {createGeoOperationGate,type GeoOperation} from "./geo-operation";
import {geoCsrf} from "../auth/session-adapter";
import {requestDeviceCoordinates,type TelegramLocationManager} from "./geo-device";
import type {RegistrationDraft,SearchScope} from "./model";
export interface Place {id:string;city:string;country:string;countryCode:string;region?:string}
interface SearchResult {results?:unknown;coverage?:"demo"|"world"}
const scopeOptions:[SearchScope,string,string][]=[
 ["radius","По радиусу","В пределах выбранного расстояния"],
 ["country","В своей стране","Без ограничения по километрам"],
 ["world","Весь мир","Без ограничений по стране и радиусу"]
];
export const radiusAt=(p:number)=>Math.round(1+4999*Math.pow(Math.max(0,Math.min(p,100))/100,2));
export const positionAt=(km:number)=>Math.round(100*Math.sqrt((Math.max(1,Math.min(km,5000))-1)/4999));
function asPlace(value:unknown):Place|null {
 if(!value||typeof value!=="object")return null;
 const v=value as Record<string,unknown>,countryCode=normalizeCountryCode(v.countryCode);
 if(!countryCode||typeof v.id!=="string"||v.id.trim().length<3||
    typeof v.city!=="string"||v.city.trim().length<2||
    typeof v.country!=="string"||v.country.trim().length<2)return null;
 return {id:v.id,city:v.city,country:v.country,countryCode,
  ...(typeof v.region==="string"?{region:v.region}:{})};
}
export function GeoPicker({data,patch}:{data:RegistrationDraft;patch:(values:Partial<RegistrationDraft>)=>void}){
 const [manual,setManual]=useState(!!data.placeId);
 const [query,setQuery]=useState(data.placeId?data.city+", "+data.country:"");
 const [editing,setEditing]=useState(false);
 const [results,setResults]=useState<Place[]>([]);
 const [activity,setActivity]=useState<GeoOperation>("idle");
 const [error,setError]=useState("");
 const [demo,setDemo]=useState(false);
 const [scopeOpen,setScopeOpen]=useState(false);
 const gate=useRef(createGeoOperationGate());
 const gpsDeadline=useRef<number|null>(null);
 const clearGpsDeadline=()=>{
  if(gpsDeadline.current!==null){window.clearTimeout(gpsDeadline.current);gpsDeadline.current=null;}
 };
 const cancelPending=()=>{
  gate.current.cancel();
  clearGpsDeadline();
 };
 // StrictMode runs setup→cleanup→setup in development. An unmounted browser GPS
 // callback cannot update this component OR its still-mounted parent draft.
 useEffect(()=>{const current=gate.current;current.resume();return ()=>{current.dispose();clearGpsDeadline();};},[]);
 const selectedLabel=data.placeId?data.city+", "+data.country:"";
 useEffect(()=>{
  if(!manual)return; // GPS remains owned by the detect operation.
  if(!editing||query.trim().length<2){
   setResults([]);setDemo(false);setActivity("idle");return;
  }
  const current=gate.current,token=current.begin(),signal=current.attach(token);
  setActivity("idle");setResults([]);setError("");
  const timer=window.setTimeout(async()=>{
   if(!gate.current.isCurrent(token))return;
   setActivity("searching");
   try{
    const searchUrl="/api/"+(import.meta.env.VITE_LUEMI_AUTH_V2==="1"?"v2/geo":"geo")+
      "/search?q="+encodeURIComponent(query.trim());
    const v2=import.meta.env.VITE_LUEMI_AUTH_V2==="1";
    const csrf=geoCsrf();
    let response:Response;
    if(v2&&!csrf)throw new Error("session_required");
    response=await fetch(searchUrl,{signal,credentials:"same-origin",cache:"no-store",
      ...(v2?{headers:{"X-Luemi-CSRF":csrf!}}:{})});
    // In real-user mode NEVER silently replace a failed worldwide search with
    // the synthetic/demo city fixtures. Tell the user and allow manual retry.
    if(!response.ok&&v2&&import.meta.env.VITE_LUEMI_REAL_DISCOVERY_UI!=="1")
      response=await fetch("/api/geo/search?q="+encodeURIComponent(query.trim()),
        {signal,credentials:"same-origin",cache:"no-store"});
    if(!response.ok)throw new Error("Поиск сейчас недоступен");
    const json=await response.json() as SearchResult;
    if(!Array.isArray(json?.results))throw new Error("Некорректный ответ поиска");
    const places=json.results.map(asPlace);
    if(places.some(place=>place===null))throw new Error("Некорректный ответ поиска");
    if(!gate.current.isCurrent(token))return;
    setResults(places as Place[]);
    setDemo(json.coverage==="demo");setError("");setActivity("success");
   }catch{
    if(!gate.current.isCurrent(token))return;
    setResults([]);setActivity("error");
    setError("Не удалось найти города. Повтори попытку.");
   }
  },250);
  return ()=>{window.clearTimeout(timer);current.cancel(token);};
 },[manual,editing,query]);
 const choose=(place:Place,expected?:number)=>{
  if(expected!==undefined&&!gate.current.isCurrent(expected))return;
  const normalized=asPlace(place);
  if(!normalized){setError("Не удалось определить город. Выбери его вручную.");setActivity("error");return;}
  cancelPending();
  patch({city:normalized.city,country:normalized.country,placeId:normalized.id,countryCode:normalized.countryCode});
  setQuery(normalized.city+", "+normalized.country);setEditing(false);
  setResults([]);setError("");setActivity("success");
 };
 const syntheticQa=import.meta.env.DEV&&window.location.pathname==="/geo-qa.html";
 const detect=()=>{
  cancelPending();
  if(!syntheticQa&&(import.meta.env.VITE_LUEMI_AUTH_V2!=="1"||!geoCsrf())){
   setManual(true);setActivity("error");
   setError("Войди в LUEMI через Telegram, чтобы определить город.");
   return;
  }
  const token=gate.current.begin(),signal=gate.current.attach(token);
  setManual(false);setEditing(false);setResults([]);setError("");setActivity("locating");
  const fail=(message:string)=>{
   if(!gate.current.isCurrent(token))return;
   clearGpsDeadline();setManual(true);setActivity("error");setError(message);
   gate.current.cancel(token);
  };
  // Telegram's native location API is preferred on Android WebView. Native init
  // may never call back; the same deadline protects both native and GPS paths.
  gpsDeadline.current=window.setTimeout(()=>fail("Не удалось получить местоположение. Выбери город вручную."),11000);
  const native=(window.Telegram?.WebApp as {LocationManager?:TelegramLocationManager}|undefined)?.LocationManager;
  void requestDeviceCoordinates({native,browser:navigator.geolocation},signal).then(async coords=>{
   if(!gate.current.isCurrent(token))return;
   clearGpsDeadline();setActivity("resolving");
   const deadline=window.setTimeout(()=>fail("Сервис определения города не ответил. Выбери город вручную."),6500);
   try{
    // Coordinates are used only for the one requested reverse lookup; LUEMI
    // does not put exact GPS coordinates into the registration draft.
    const response=await fetch(syntheticQa?"/api/geo/reverse":"/api/v2/geo/reverse",{
     method:"POST",credentials:"same-origin",cache:"no-store",
     headers:syntheticQa?{"Content-Type":"application/json"}:
      {"Content-Type":"application/json","X-Luemi-CSRF":geoCsrf()??""},
     body:JSON.stringify(coords),signal
    });
    if(!response.ok)throw new Error(response.status===429?
     "Лимит геолокации исчерпан. Выбери город вручную.":
     "Сервис определения города недоступен. Выбери город вручную.");
    const json=await response.json() as {result?:unknown};
    if(!gate.current.isCurrent(token))return;
    const place=asPlace(json?.result);
    if(!place)throw new Error("Не удалось определить город. Выбери его вручную.");
    choose(place,token);
   }catch(e){
    if(gate.current.isCurrent(token))
     fail(e instanceof Error?e.message:"Не удалось определить город.");
   }finally{window.clearTimeout(deadline);}
  }).catch(e=>{
   if(!gate.current.isCurrent(token))return;
   const code=e instanceof Error?e.message:"location_unavailable";
   if(code==="location_cancelled")return;
   fail(code==="location_denied"?"Доступ к геолокации не предоставлен. Разреши его в Telegram или выбери город вручную.":
    "Не удалось получить координаты. Проверь разрешение геолокации или выбери город вручную.");
  });
 };
 const switchMode=()=>{
  cancelPending();setActivity("cancelled");setError("");setResults([]);setDemo(false);setEditing(false);
  setManual(value=>!value);
  setQuery(selectedLabel);
 };
 const loading=activity==="searching"||activity==="locating"||activity==="resolving";
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
         onChange={e=>{cancelPending();setQuery(e.target.value);setEditing(true);setError("");setResults([]);setActivity("idle");}}/>
       {loading&&<LoaderCircle className="spin" size={18}/>}
     </div>
   </GlassField>}
   {!manual?<button type="button" className="geo-mode-toggle" onClick={switchMode}>Выбрать город вручную</button>:
     <button type="button" className="geo-mode-toggle" onClick={switchMode}><LocateFixed size={15}/> Определить моё местоположение</button>}
   {manual&&editing&&results.length>0&&<div id="luemi-geo-results" role="listbox" className="geo-results">
     {results.map(place=><button key={place.id} type="button" role="option" aria-selected={false} onClick={()=>choose(place)}>
       <Flag code={place.countryCode} title={"Флаг "+place.country}/><span><strong>{place.city}</strong><small>{place.country}{place.region?", "+place.region:""}</small></span><MapPin size={17}/>
     </button>)}
   </div>}
   {data.placeId&&<div className="geo-selected"><Flag code={data.countryCode}/><MapPin size={15}/><strong>{data.city}</strong><span>{data.country}</span></div>}
   {manual&&editing&&query.trim().length>1&&!loading&&!results.length&&!error&&<p className="hint">Выбери реальный город из подсказок. Свободный текст не сохраняется.</p>}
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
     <div className="branded-slider" onPointerDownCapture={()=>{
       const field=document.activeElement;
       if(field instanceof HTMLInputElement&&field.type!=="range")field.blur();
     }} style={{"--range-pct":positionAt(data.radius)+"%"} as CSSProperties}>
       <input type="range" min="0" max="100" step="1" disabled={data.searchScope!=="radius"}
         value={positionAt(data.radius)} aria-label="Радиус поиска, километры"
         onChange={e=>patch({radius:radiusAt(Number(e.target.value))})}/>
     </div>
     <div className="range-limits"><span>1 км</span><span>5 000 км</span></div>
   </div>
   <p className="hint">При нажатии «Моё местоположение» координаты однократно передаются серверу для определения города через геокодер. В анкету сохраняется только выбранный город. В режиме «Весь мир» радиус сохраняется.</p>
 </div>;
}
