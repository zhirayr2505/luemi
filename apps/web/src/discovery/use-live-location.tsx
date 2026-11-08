import {useCallback,useEffect,useRef,useState} from "react";
import {Crosshair,MapPin,ShieldCheck,Trash2} from "lucide-react";
import {hasLiveLocationPermission,readPreciseLocation,type TelegramLiveLocationManager,type PreciseReading} from "./live-location-device";
import {getLiveLocationStatus,consentLiveLocation,refreshLiveLocation,revokeLiveLocation,resolveObservedCity,confirmObservedCity,type ObservedCity} from "./live-location-client";
import "./live-location.css";

type City={city:string;countryCode:string;placeId?:string};
const key=(p:{city:string;countryCode:string})=>p.countryCode.trim().toUpperCase()+"|"+p.city.trim().toLocaleLowerCase("ru");
const distanceKm=(a:{lat:number;lon:number},b:{lat:number;lon:number})=>{
 const rad=Math.PI/180,dy=(a.lat-b.lat)*rad,dx=(a.lon-b.lon)*rad;
 const h=Math.sin(dy/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dx/2)**2;
 return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));
};
const locationError=(error:unknown)=>{
 const code=error instanceof Error?error.message:"location_unavailable";
 if(code==="location_denied")return "Доступ к геолокации запрещён. Разреши его в настройках Telegram или телефона.";
 if(code==="location_inaccurate")return "Точность слишком низкая. Попробуй ещё раз на открытом пространстве.";
 if(code==="location_cancelled")return "";
 return "Не удалось определить местоположение. Попробуй ещё раз.";
};
/** Run only in an authenticated, published LUEMI session.
 * No background work after the page is hidden; no persistent device storage.
 * The user chooses to opt in, and can delete location with one action. */
export function useLiveLocation(city:City,onConfirmed:(p:ObservedCity)=>void){
 const [enabled,setEnabled]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [updatedAt,setUpdatedAt]=useState<string|null>(null);
 const [candidate,setCandidate]=useState<ObservedCity|null>(null);
 const living=useRef(true);
 const gate=useRef(0);
 const busyRef=useRef(false);
 const dismissed=useRef("");
 const lastReverse=useRef<{lat:number;lon:number;time:number}|null>(null);
 const cityRef=useRef(city);
 const enabledRef=useRef(false);
 const op=useRef<AbortController|null>(null);
 cityRef.current=city;
 enabledRef.current=enabled;
 const native=()=> (window.Telegram?.WebApp as {LocationManager?:TelegramLiveLocationManager}|undefined)?.LocationManager;
 const observe=useCallback(async(reading:PreciseReading,signal:AbortSignal)=>{
  if(signal.aborted||!living.current)return;
  // Avoid reverse-geocoding every location tick: check new area or 6h interval.
  const coarse={lat:Math.round(reading.lat*100)/100,lon:Math.round(reading.lon*100)/100};
  const previous=lastReverse.current;
  if(previous&&Date.now()-previous.time<21600000&&distanceKm(previous,coarse)<3)return;
  lastReverse.current={...coarse,time:Date.now()};
  const place=await resolveObservedCity(reading,signal);
  if(!place||signal.aborted||!living.current)return;
  const current=cityRef.current;
  if(key(place)===key(current)||place.id===current.placeId)return;
  if(dismissed.current===key(place))return;
  // City changes are never made by an automatic location refresh.
  setCandidate(place);
 },[]);
 const refresh=useCallback(async()=>{
  if(!enabledRef.current||busyRef.current||document.visibilityState!=="visible")return;
  if(!await hasLiveLocationPermission(native()))return;
  const controller=new AbortController();
  op.current?.abort();op.current=controller;
  const serial=++gate.current;
  busyRef.current=true;
  try{
   const reading=await readPreciseLocation(controller.signal,native());
   if(controller.signal.aborted||serial!==gate.current)return;
   await refreshLiveLocation(reading);
   if(controller.signal.aborted||serial!==gate.current)return;
   setUpdatedAt(new Date().toISOString());
   await observe(reading,controller.signal);
  }catch(e){
   if(!controller.signal.aborted&&serial===gate.current&&
     e instanceof Error&&e.message==="location_http_409"){
    // Consent revoked on another device: never re-enable it implicitly.
    enabledRef.current=false;setEnabled(false);
   }
  }finally{busyRef.current=false;}
 },[observe]);
 useEffect(()=>{
  living.current=true;
  const ctrl=new AbortController();
  void getLiveLocationStatus(ctrl.signal).then(status=>{
   if(ctrl.signal.aborted)return;
   setEnabled(status.enabled);enabledRef.current=status.enabled;
   setUpdatedAt(status.updatedAt);setLoaded(true);
  }).catch(()=>{if(!ctrl.signal.aborted){setLoaded(true);setError("Настройки геолокации сейчас недоступны.");}});
  return()=>{living.current=false;ctrl.abort();op.current?.abort();};
 },[]);
 useEffect(()=>{
  if(!enabled)return;
  // Telegram WebView may suspend all timers offscreen. Check on visibility
  // and focus, with a throttled 10-minute visible-only refresh.
  const visible=()=>{
   if(document.visibilityState==="visible")void refresh();
   else op.current?.abort(); // Never finish an in-flight GPS read in the background.
  };
  document.addEventListener("visibilitychange",visible);
  window.addEventListener("focus",visible);
  const timer=window.setInterval(visible,600000);
  void refresh();
  return()=>{
   document.removeEventListener("visibilitychange",visible);
   window.removeEventListener("focus",visible);
   window.clearInterval(timer);
  };
 },[enabled,refresh]);
 const enable=async()=>{
  if(busy||!loaded||enabled)return;
  busyRef.current=true;setBusy(true);setError("");
  const controller=new AbortController();
  op.current?.abort();op.current=controller;
  const serial=++gate.current;
  try{
   // Device location permission is a distinct step after the user's
   // explicit LUEMI consent action below.
   const reading=await readPreciseLocation(controller.signal,native(),true);
   if(controller.signal.aborted||serial!==gate.current)return;
   await consentLiveLocation(reading);
   if(controller.signal.aborted||serial!==gate.current)return;
   enabledRef.current=true;setEnabled(true);setUpdatedAt(new Date().toISOString());
   void observe(reading,controller.signal);
  }catch(e){
   if(!controller.signal.aborted&&serial===gate.current)
    setError(locationError(e)||"Не удалось включить геолокацию.");
  }finally{busyRef.current=false;setBusy(false);}
 };
 const disable=async()=>{
  if(busy||!loaded)return;
  setBusy(true);busyRef.current=true;setError("");
  op.current?.abort();++gate.current;
  try{
   await revokeLiveLocation();
   enabledRef.current=false;setEnabled(false);setCandidate(null);
   setUpdatedAt(null);lastReverse.current=null;dismissed.current="";
  }catch{setError("Не получилось удалить координаты. Проверь соединение и повтори.");}
  finally{busyRef.current=false;setBusy(false);}
 };
 const acceptCity=async()=>{
  if(!candidate||busy)return;
  setBusy(true);setError("");
  try{
   const selected=await confirmObservedCity(candidate);
   dismissed.current=key(selected);setCandidate(null);
   cityRef.current={city:selected.city,countryCode:selected.countryCode,placeId:selected.id};
   onConfirmed(selected);
  }catch{setError("Не получилось изменить город. Попробуй ещё раз.");}
  finally{setBusy(false);}
 };
 const settings=<section className="luemi-live-location" aria-label="Точная геолокация">
  <div className="luemi-live-location-head">
   <Crosshair size={21}/><div><strong>Точная геолокация</strong>
    <small>{enabled?"Включена · только при использовании LUEMI":"Выключена"}</small></div>
  </div>
  <p>При согласии координаты хранятся в закрытой базе и используются для подбора людей рядом. Другие пользователи видят только город. Обновление происходит при открытом приложении.</p>
  {!enabled?<button type="button" className="luemi-live-location-action" disabled={!loaded||busy}
    onClick={()=>{void enable();}}><ShieldCheck size={18}/>{busy?"Определяем местоположение…":"Разрешить точную геолокацию"}</button>:
    <button type="button" className="luemi-live-location-delete" disabled={busy}
     onClick={()=>{void disable();}}><Trash2 size={17}/>{busy?"Удаляем координаты…":"Выключить и удалить координаты"}</button>}
  {enabled&&updatedAt&&<small className="luemi-live-location-hint">Последнее обновление: {new Date(updatedAt).toLocaleString("ru-RU")}</small>}
  {error&&<p className="luemi-live-location-error" role="alert">{error}</p>}
 </section>;
 const dialog=candidate?<div className="luemi-live-location-backdrop">
   <section className="luemi-live-location-dialog" role="dialog" aria-modal="true" aria-label="Подтвердить новый город">
    <span className="luemi-live-location-symbol"><MapPin size={24}/></span>
    <h2>Похоже, ты в новом городе 💜</h2>
    <p>Твоё местоположение изменилось. Обновить город в анкете?</p>
    <div className="luemi-live-location-cities">
     <span><small>В анкете</small><strong>{city.city}</strong></span>
     <span><small>Сейчас</small><strong>{candidate.city}</strong></span>
    </div>
    <button type="button" className="luemi-live-location-accept" disabled={busy}
     onClick={()=>{void acceptCity();}}>{busy?"Меняем город…":"Поменять на "+candidate.city}</button>
    <button type="button" className="luemi-live-location-keep" disabled={busy}
     onClick={()=>{dismissed.current=key(candidate);setCandidate(null);setError("");}}>Оставить {city.city}</button>
    {error&&<p className="luemi-live-location-error" role="alert">{error}</p>}
    <small>Текущие координаты используются только для рекомендаций. Город меняется лишь с твоего согласия.</small>
   </section>
  </div>:null;
 return{settings,dialog};
}
