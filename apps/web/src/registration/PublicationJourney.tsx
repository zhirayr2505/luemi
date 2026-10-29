import {useEffect,useState} from "react";
import {RefreshCw,ArrowLeft} from "lucide-react";
import "./publication-journey.css";

export type PublishJourneyPhase="publishing"|"recommendations"|"nearby"|"photos"|"error";
export const publishingCopy:Record<Exclude<PublishJourneyPhase,"error">,string>={
 publishing:"Публикуем твою анкету",
 recommendations:"Ищем людей по интересам",
 nearby:"Подбираем людей рядом",
 photos:"Готовим твою ленту"
};
export function PublicationJourney({phase,error,onRetry,onBack}:{
 phase:PublishJourneyPhase;error:string;onRetry:()=>void;onBack:()=>void
}){
 const [elapsed,setElapsed]=useState(0);
 useEffect(()=>{
  if(phase==="error")return;
  setElapsed(0);
  const start=Date.now(),interval=window.setInterval(()=>setElapsed(Date.now()-start),500);
  return()=>window.clearInterval(interval);
 },[phase]);
 const failed=phase==="error";
 const stages=Object.keys(publishingCopy) as Array<Exclude<PublishJourneyPhase,"error">>;
 const current=stages.indexOf(failed?"publishing":phase);
 return <main className="luemi-publication-journey" role="status" aria-live="polite"
  aria-label="Создание анкеты LUEMI">
  <div className="luemi-publication-glow" aria-hidden="true"/>
  <div className="luemi-publication-brand">
   <img src="/assets/brand/wordmark_original_raster_alpha_W06.webp" alt="luemi"/>
  </div>
  <div className="luemi-publication-bottom">
   {!failed?<span className="luemi-publication-ring" aria-hidden="true"/>:
    <span className="luemi-publication-failed-icon" aria-hidden="true">♡</span>}
   <h1>{failed?"Не удалось закончить создание анкеты":publishingCopy[phase]}</h1>
   <p>{failed?error:"LUEMI подготавливает твоё знакомство 💜"}</p>
   {!failed?<div className="luemi-publication-dots" aria-hidden="true">
    {stages.map((stage,i)=><span key={stage} className={i===current?"is-current":i<current?"is-done":""}/>)}
   </div>:<div className="luemi-publication-recovery">
    <button type="button" onClick={onRetry}><RefreshCw size={17}/> Повторить</button>
    <button type="button" onClick={onBack}><ArrowLeft size={17}/> Вернуться к анкете</button>
   </div>}
   {!failed&&elapsed>=30000&&<p className="luemi-publication-slow">
    Соединение медленное. Твои уже загруженные фото остаются сохранёнными.
   </p>}
  </div>
 </main>;
}
