import {useEffect,useState} from "react";
import {RefreshCw,ArrowLeft,Check,Sparkles} from "lucide-react";
import "./publication-journey.css";

export type PublishJourneyPhase="publishing"|"recommendations"|"nearby"|"photos"|"complete"|"error";
type WorkingPhase=Exclude<PublishJourneyPhase,"error"|"complete">;
export const publishingCopy:Record<WorkingPhase,string>={
 publishing:"Подготавливаем вашу анкету",
 recommendations:"Учитываем ваши интересы",
 nearby:"Ищем подходящие анкеты рядом",
 photos:"Загружаем первую ленту"
};
const journeySequence:Exclude<PublishJourneyPhase,"error">[]=["publishing","recommendations","nearby","photos","complete"];
export function PublicationJourney({phase,error,onRetry,onBack,onComplete}:{
 phase:PublishJourneyPhase;error:string;onRetry:()=>void;onBack:()=>void;onComplete:()=>void
}){
 const [displayPhase,setDisplayPhase]=useState<PublishJourneyPhase>(phase);
 const [elapsed,setElapsed]=useState(0);
 const [leaving,setLeaving]=useState(false);
 useEffect(()=>{
  if(phase==="error"){setDisplayPhase("error");return;}
  if(phase==="publishing"){setDisplayPhase("publishing");return;}
  const current=displayPhase==="error"?-1:journeySequence.indexOf(displayPhase);
  const target=journeySequence.indexOf(phase);
  if(current>=target)return;
  const timer=window.setTimeout(()=>setDisplayPhase(journeySequence[current+1]),360);
  return()=>window.clearTimeout(timer);
 },[phase,displayPhase]);
 useEffect(()=>{
  if(displayPhase==="error"||displayPhase==="complete")return;
  setElapsed(0);
  const start=Date.now(),interval=window.setInterval(()=>setElapsed(Date.now()-start),500);
  return()=>window.clearInterval(interval);
 },[displayPhase]);
 useEffect(()=>{
  if(displayPhase!=="complete"){setLeaving(false);return;}
  const exit=window.setTimeout(()=>setLeaving(true),520);
  const done=window.setTimeout(onComplete,1080);
  return()=>{window.clearTimeout(exit);window.clearTimeout(done);};
 },[displayPhase,onComplete]);
 const failed=displayPhase==="error",complete=displayPhase==="complete";
 const stages=Object.keys(publishingCopy) as WorkingPhase[];
 const current=complete?stages.length:stages.indexOf(failed?"publishing":displayPhase);
 return <main className={"luemi-publication-journey"+(complete?" is-complete":"")+(leaving?" is-leaving":"")} role="status" aria-live="polite"
  aria-label="Создание анкеты LUEMI">
  <div className="luemi-publication-glow" aria-hidden="true"/>
  <div className="luemi-publication-orbs" aria-hidden="true"><i/><i/><i/></div>
  <div className="luemi-publication-stars" aria-hidden="true"><i/><i/><i/><i/><i/></div>
  <div className="luemi-publication-brand">
   <span className="luemi-publication-orbit is-outer" aria-hidden="true"/>
   <span className="luemi-publication-orbit is-inner" aria-hidden="true"/>
   <div className="luemi-publication-logo"><img src="/assets/brand/wordmark_original_raster_alpha_W06.webp" alt="luemi"/></div>
  </div>
  <div className="luemi-publication-bottom">
   {complete?<span className="luemi-publication-complete" aria-hidden="true"><Check size={24}/></span>:
    failed?<span className="luemi-publication-failed-icon" aria-hidden="true">♡</span>:null}
   {!failed&&<span className="luemi-publication-kicker"><Sparkles size={13}/> LUEMI · ТВОЯ ИСТОРИЯ</span>}
   <h1>{failed?"Не удалось закончить создание анкеты":complete?"Всё готово 💜":publishingCopy[displayPhase]}</h1>
   <p>{failed?error:complete?"Открываем LUEMI":displayPhase==="publishing"?
    "Сохраняем фотографии и создаём анкету":"LUEMI подготавливает твоё знакомство 💜"}</p>
   {!failed&&<div className="luemi-publication-progress" aria-hidden="true">
    <span style={{width:complete?"100%":Math.max(12,(current+1)/stages.length*100)+"%"}}/>
   </div>}
   {!failed?<div className="luemi-publication-dots" aria-hidden="true">
    {stages.map((stage,i)=><span key={stage} className={i===current?"is-current":i<current||complete?"is-done":""}/>)}
   </div>:<div className="luemi-publication-recovery">
    <button type="button" onClick={onRetry}><RefreshCw size={17}/> Повторить</button>
    <button type="button" onClick={onBack}><ArrowLeft size={17}/> Вернуться к анкете</button>
   </div>}
   {!failed&&!complete&&elapsed>=30000&&<p className="luemi-publication-slow">
    Соединение медленное. Твои уже загруженные фото остаются сохранёнными.
   </p>}
  </div>
 </main>;
}
