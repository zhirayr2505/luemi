import {useEffect,useState} from "react";
import {RefreshCw,ArrowLeft,Heart,Sparkles} from "lucide-react";
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
/* Short emotional captions; deliberately unrelated to backend progress so
   delayed network calls never pretend to have reached a new milestone. */
export const publishingQuotes=[
 "Каждая история начинается с одного «привет».",
 "Иногда один разговор меняет всё.",
 "Твоё самое интересное знакомство ещё впереди.",
 "Самые тёплые истории начинаются неожиданно.",
 "За каждым знакомством может скрываться целый мир.",
 "Кому-то будет очень приятно узнать тебя.",
 "Настоящие чувства начинаются с искренности.",
 "Впереди новые люди, разговоры и эмоции.",
 "Иногда достаточно одного совпадения.",
 "Хорошая история начинается с маленького шага."
] as const;
const QUOTE_INTERVAL_MS=3000;
function nextQuoteIndex(previous:number){
 // Skip the current caption even if Math.random() returns 0 repeatedly.
 const offset=1+Math.floor(Math.random()*(publishingQuotes.length-1));
 return (previous+offset)%publishingQuotes.length;
}
export function PublicationJourney({phase,error,onRetry,onBack,onComplete}:{
 phase:PublishJourneyPhase;error:string;onRetry:()=>void;onBack:()=>void;onComplete:()=>void
}){
 const [displayPhase,setDisplayPhase]=useState<PublishJourneyPhase>(phase);
 const [elapsed,setElapsed]=useState(0);
 const [quoteIndex,setQuoteIndex]=useState(()=>Math.floor(Math.random()*publishingQuotes.length));
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
  if(phase==="complete"||phase==="error"||displayPhase==="complete"||displayPhase==="error")return;
  const timer=window.setInterval(()=>setQuoteIndex(nextQuoteIndex),QUOTE_INTERVAL_MS);
  return()=>window.clearInterval(timer);
 },[phase,displayPhase]);
 useEffect(()=>{
  if(!leaving)return;
  const done=window.setTimeout(onComplete,560);
  return()=>window.clearTimeout(done);
 },[leaving,onComplete]);
 const failed=displayPhase==="error",complete=displayPhase==="complete";
 const stages=Object.keys(publishingCopy) as WorkingPhase[];
 const current=complete?stages.length:stages.indexOf(failed?"publishing":displayPhase);
 return <main className={"luemi-publication-journey"+(complete?" is-complete":"")+(leaving?" is-leaving":"")} role="status" aria-live="polite"
  aria-label="Создание анкеты LUEMI">
  <div className="luemi-publication-glow" aria-hidden="true"/>
  <div className="luemi-publication-orbs" aria-hidden="true"><i/><i/><i/></div>
  <div className="luemi-publication-stars" aria-hidden="true"><i/><i/><i/><i/><i/></div>
  <div className="luemi-publication-petals" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/></div>
  <div className="luemi-publication-brand">
   <span className="luemi-publication-orbit is-outer" aria-hidden="true"/>
   <span className="luemi-publication-orbit is-inner" aria-hidden="true"/>
   <div className="luemi-publication-logo">{complete?<Heart size={82} strokeWidth={1.3} fill="currentColor" aria-hidden="true"/>:
    <img src="/assets/brand/wordmark_original_raster_alpha_W06.webp" alt="luemi"/>}</div>
  </div>
  <div className="luemi-publication-bottom">
   {failed?<span className="luemi-publication-failed-icon" aria-hidden="true">♡</span>:null}
   {!failed&&<span className="luemi-publication-kicker"><Sparkles size={13}/> LUEMI · ТВОЯ ИСТОРИЯ</span>}
   <h1>{failed?"Не удалось закончить создание анкеты":complete?"Всё готово 💜":"Подготавливаем твою анкету"}</h1>
   {failed?<p>{error}</p>:complete?<p>Твоя история в LUEMI начинается</p>:
    <div className="luemi-publication-quote-slot" aria-live="off">
     <p key={quoteIndex} className="luemi-publication-quote">{publishingQuotes[quoteIndex]}</p>
    </div>}
   {!failed&&<div className="luemi-publication-progress" aria-hidden="true">
    <span style={{width:complete?"100%":Math.max(12,(current+1)/stages.length*100)+"%"}}/>
   </div>}
   {failed&&<div className="luemi-publication-recovery">
    <button type="button" onClick={onRetry}><RefreshCw size={17}/> Повторить</button>
    <button type="button" onClick={onBack}><ArrowLeft size={17}/> Вернуться к анкете</button>
   </div>}
   {complete&&<button type="button" className="luemi-publication-enter" disabled={leaving}
     onClick={()=>setLeaving(true)}>Перейти в приложение</button>}
   {!failed&&!complete&&elapsed>=30000&&<p className="luemi-publication-slow">
    Соединение медленное. Твои уже загруженные фото остаются сохранёнными.
   </p>}
  </div>
 </main>;
}
