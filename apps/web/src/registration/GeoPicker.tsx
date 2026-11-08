import {useEffect,useRef,useState} from "react";
import {MapPin,Search,LocateFixed,LoaderCircle,Globe2,Compass,Check} from "lucide-react";
import {normalizeCountryCode} from "@luemi/contracts";
import {GlassField} from "../ui/Glass";
import {Flag} from "../ui/Flag";
import {createGeoOperationGate,type GeoOperation} from "./geo-operation";
import {geoCsrf} from "../auth/session-adapter";
import {requestDeviceCoordinates,type TelegramLocationManager} from "./geo-device";
import type {RegistrationDraft,SearchScope} from "./model";
import {FOCUS_RELEASE_DELAY_MS,releaseAfterKeyboardSettles,useFieldFocusDock} from "./use-field-focus";
export interface Place {id:string;city:string;country:string;countryCode:string;region?:string}
interface SearchResult {results?:unknown;coverage?:"demo"|"limited"|"world"}
const scopeOptions:[SearchScope,string,typeof Compass][]=[
 ["radius","Рядом",Compass],["city","Мой город",MapPin],["world","Весь мир",Globe2]
];
function asPlace(value:unknown):Place|null {
 if(!value||typeof value!=="object")return null;
 const v=value as Record<string,unknown>,countryCode=normalizeCountryCode(v.countryCode);
 if(!countryCode||typeof v.id!=="string"||v.id.trim().length<3||
    typeof v.city!=="string"||v.city.trim().length<2||
    typeof v.country!=="string"||v.country.trim().length<2)return null;
 return {id:v.id,city:v.city,country:v.country,countryCode,
  ...(typeof v.region==="string"?{region:v.region}:{})};
}
type GeoPickerProps={
 data:RegistrationDraft;
 patch:(values:Partial<RegistrationDraft>)=>void;
 fieldError?:string;
 clearFieldError?:()=>void;
 onFieldFocus?:(field:"city"|null)=>void;
};
export function GeoPicker({data,patch,fieldError,clearFieldError,onFieldFocus}:GeoPickerProps){
 const [manual,setManual]=useState(true);
 const [query,setQuery]=useState(data.placeId?data.city+", "+data.country:"");
 const [editing,setEditing]=useState(false);
 const [results,setResults]=useState<Place[]>([]);
 const [activity,setActivity]=useState<GeoOperation>("idle");
 const [error,setError]=useState("");
 const [demo,setDemo]=useState(false);
 const [cityFocused,setCityFocused]=useState(false);
 const inputRef=useRef<HTMLInputElement>(null);
 const pendingBlur=useRef<(()=>void)|null>(null);
 const cityDock=useFieldFocusDock(cityFocused);
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
 useEffect(()=>{const current=gate.current;current.resume();return ()=>{pendingBlur.current?.();current.dispose();clearGpsDeadline();};},[]);
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
  setManual(true);setQuery(normalized.city+", "+normalized.country);setEditing(false);
  setResults([]);setError("");setActivity("success");inputRef.current?.blur();setCityFocused(false);onFieldFocus?.(null);
 };
 const syntheticQa=import.meta.env.DEV&&window.location.pathname==="/geo-qa.html";
 const detect=()=>{
  cancelPending();
  if(!syntheticQa&&import.meta.env.VITE_LUEMI_REAL_ONLY==="1"&&
     import.meta.env.VITE_LUEMI_GEO_PROVIDER_ENABLED!=="1"&&
     import.meta.env.VITE_LUEMI_GEO_LOCAL_ENABLED!=="1"){
   setManual(true);setActivity("error");
   setError("Определение города пока не подключено. Выбери город вручную.");
   return; // Don't request precise coordinates without a working approved reverse service.
  }
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
  gpsDeadline.current=window.setTimeout(()=>fail("Не удалось определить местоположение. Выбери город вручную."),11000);
  const native=(window.Telegram?.WebApp as {LocationManager?:TelegramLocationManager}|undefined)?.LocationManager;
  void requestDeviceCoordinates({native,browser:navigator.geolocation},signal).then(async coords=>{
   if(!gate.current.isCurrent(token))return;
   clearGpsDeadline();setActivity("resolving");
   const deadline=window.setTimeout(()=>fail("Автоматическое определение города сейчас недоступно. Выбери город вручную."),6500);
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
 const openCitySearch=()=>{
  cancelPending();setManual(true);setEditing(true);setActivity("idle");
  setResults([]);setError("");setDemo(false);setQuery("");
  window.requestAnimationFrame(()=>inputRef.current?.focus());
 };
 const closeCitySearch=()=>{
  cancelPending();setEditing(false);setQuery(selectedLabel);setResults([]);
  setError("");setActivity("idle");inputRef.current?.blur();
  setCityFocused(false);onFieldFocus?.(null);
 };
 const nativeSettings=(window.Telegram?.WebApp as {LocationManager?:TelegramLocationManager}|undefined)?.LocationManager;
 const canOpenGeoSettings=typeof nativeSettings?.openSettings==="function";
 const loading=activity==="searching"||activity==="locating"||activity==="resolving";
 return <div className="geo-stack geo-liquid-location">
   <div className="geo-city-area">
     {!editing&&<span className="field-label">Твой город</span>}
     {!editing&&<button type="button" className="geo-liquid-city" onClick={openCitySearch}
       aria-label={data.placeId?"Изменить город":"Выбрать город"}>
       <span className="geo-liquid-city-icon"><MapPin size={24} strokeWidth={1.7}/></span>
       <span className="geo-liquid-city-copy">
         <strong>{data.placeId?data.city:"Выбрать город"}</strong>
         <small>{data.placeId?data.country:"Найди свой город, чтобы знакомиться рядом"}</small>
       </span>
       <span className="geo-liquid-edit">{data.placeId?"Изменить":"Выбрать"}</span>
     </button>}
     {editing&&<div className="geo-liquid-city-editor">
       <div className="focus-field-slot"><div ref={node=>{cityDock.shellRef.current=node;}}
         className={"focus-field-shell city-focus-shell"+(cityFocused?" is-focused":"")+(fieldError?" has-error":"")}>
         <GlassField label="Найди город">
           <div className="geo-input-wrap">
             <Search size={19} aria-hidden="true"/>
             <input ref={inputRef} className="glass-control geo-input" role="combobox"
               autoComplete="off" aria-expanded={results.length>0} aria-controls="luemi-geo-results"
               aria-autocomplete="list" aria-haspopup="listbox" maxLength={80} placeholder="Название города"
               value={query}
               onFocus={()=>{pendingBlur.current?.();pendingBlur.current=null;setCityFocused(true);onFieldFocus?.("city");clearFieldError?.();}}
               onBlur={()=>{pendingBlur.current?.();pendingBlur.current=releaseAfterKeyboardSettles(()=>{
                 if(document.activeElement===inputRef.current)return;
                 setCityFocused(false);onFieldFocus?.(null);pendingBlur.current=null;
               },FOCUS_RELEASE_DELAY_MS);}}
               onChange={e=>{cancelPending();setQuery(e.target.value);setError("");clearFieldError?.();
                 setResults([]);setActivity("idle");}}/>
             {loading&&<LoaderCircle className="spin" size={18}/>}
           </div>
         </GlassField>
         {results.length>0&&<div id="luemi-geo-results" role="listbox" className="geo-results geo-city-suggestions">
           {results.map(place=><button key={place.id} type="button" role="option"
             aria-label={[place.city,place.country,place.region].filter(Boolean).join(", ")}
             aria-selected={false}
             onPointerDown={event=>event.preventDefault()} onClick={()=>choose(place)}>
             <span className="geo-suggestion-flag"><Flag code={place.countryCode} size={19} title={"Флаг "+place.country}/></span>
             <span className="geo-suggestion-copy">
               <strong>{place.city}</strong>
               <span className="geo-suggestion-country">· {place.country}</span>
             </span>
           </button>)}
         </div>}
       </div></div>
       <button type="button" className="geo-liquid-cancel" onClick={closeCitySearch}>Отмена</button>
     </div>}
     {!editing&&<button className="geo-liquid-locate" type="button" onClick={detect} disabled={loading}>
       {loading?<LoaderCircle className="spin" size={17}/>:<LocateFixed size={17}/>}
       <span>{loading?"Определяем город…":"Определить моё местоположение"}</span>
     </button>}
     {data.placeId&&editing&&<p className="geo-liquid-current">Сейчас выбран: {data.city}, {data.country}</p>}
     {fieldError&&<p role="alert" className="field-warning city-field-warning">{fieldError}</p>}
     {manual&&editing&&query.trim().length>=2&&!loading&&!results.length&&!error&&
       <p className="geo-liquid-caption">Выбери город из подсказок — свободный текст не сохраняется.</p>}
     {error&&<p className="field-warning" role="alert">{error}</p>}
     {error.startsWith("Доступ к геолокации")&&canOpenGeoSettings&&
       <button type="button" className="geo-liquid-locate" onClick={()=>{
         try{nativeSettings?.openSettings?.();}
         catch{setError("Открой настройки местоположения Telegram вручную.");}
       }}>Настройки геолокации Telegram</button>}
     {demo&&import.meta.env.VITE_LUEMI_REAL_ONLY!=="1"&&
       <p className="geo-liquid-caption">Поиск ограничен тестовым справочником.</p>}
   </div>
   <div className="geo-liquid-search-section">
     <div className="geo-liquid-section-head">
       <strong>Где искать людей?</strong>
       <small>Выбери подходящий формат</small>
     </div>
     <div className="geo-liquid-scopes" role="group" aria-label="Где искать людей">
       {scopeOptions.map(([value,label,Icon])=><button key={value} type="button"
         className={data.searchScope===value?"active":""} aria-pressed={data.searchScope===value}
         onClick={()=>patch({searchScope:value})}>
         <Icon size={18} strokeWidth={1.7} aria-hidden="true"/>
         <span>{label}</span>
         {data.searchScope===value&&<span className="geo-scope-check" aria-hidden="true"><Check size={11} strokeWidth={2.8}/></span>}
       </button>)}
       {data.searchScope==="country"&&<button type="button" className="active" aria-pressed="true"
         onClick={()=>patch({searchScope:"country"})}>
         <Globe2 size={18}/><span>Моя страна</span>
         <span className="geo-scope-check" aria-hidden="true"><Check size={11} strokeWidth={2.8}/></span>
       </button>}
     </div>
     <div className="geo-liquid-mode-panel" role="status" aria-live="polite" aria-atomic="true">
       <div key={data.searchScope} className="geo-liquid-mode-content geo-liquid-mode-info">
         <span className="geo-liquid-mode-icon" aria-hidden="true">
           {data.searchScope==="radius"?<Compass size={22} strokeWidth={1.7}/>:
             data.searchScope==="city"?<MapPin size={22} strokeWidth={1.7}/>:
             <Globe2 size={22} strokeWidth={1.7}/>}
         </span>
         <span className="geo-liquid-mode-copy">
           <strong>{data.searchScope==="radius"?"Ближайшие сначала":
             data.searchScope==="city"?"Люди из твоего города":
             data.searchScope==="country"?"Люди из твоей страны":"Весь мир открыт"}</strong>
           <small>{data.searchScope==="radius"?
             "Сначала совпадения поблизости, потом остальные.":
             data.searchScope==="city"?
             "Только твой город. Лучшие совпадения — первыми.":
             data.searchScope==="country"?
             "Анкеты из выбранной страны.":
             "От ближайших городов к дальним, с учётом совпадений."}</small>
         </span>
       </div>
     </div>
   </div>
   <p className="geo-liquid-privacy">Здесь определяем только город. Точную геолокацию можно отдельно включить в настройках профиля.</p>
 </div>;
}
