import {useEffect,useMemo,useRef,useState} from "react";
import {RotateCcw,ShieldCheck} from "lucide-react";
import type {RegistrationDraft} from "../registration/model";
import {selectionHaptic} from "../ui/haptic";
import type {DemoKind,DemoPerson} from "./model";
import {demoPeople} from "./demo-people";
import {FeedCard} from "./FeedCard";
import "./demo-feed-sandbox.css";

type Props={draft:RegistrationDraft;active:boolean;onExit:()=>void;onOpenProfile:(person:DemoPerson)=>void};
 
/** An isolated QA sandbox. Never calls the real feed, like, match or chat APIs.
 * Every profile is fictional; no invented geographical distance is displayed.
 * There is no database insertion, public discovery indexing or fake Telegram user. */
export function DemoFeedSandbox({draft,active,onExit,onOpenProfile}:Props){
 const people=useMemo<DemoPerson[]>(()=>demoPeople.map((person,index)=>{
  if(index!==0||!draft.city.trim())return person;
  return {...person,city:draft.city.trim(),country:draft.country.trim()||person.country,
   countryCode:draft.countryCode||person.countryCode};
 }),[draft.city,draft.country,draft.countryCode]);
 const [page,setPage]=useState(0);
 const [saved,setSaved]=useState<ReadonlySet<string>>(()=>new Set<string>());
 const [history,setHistory]=useState<number[]>([]);
 const [message,setMessage]=useState("");
 const [leaving,setLeaving]=useState(false);
 const [leavingKind,setLeavingKind]=useState<DemoKind|null>(null);
 const locked=useRef(false),pending=useRef<(()=>void)|null>(null),timer=useRef<number|null>(null);
 const current=people[page],next=people[page+1];
 const finish=()=>{
  const commit=pending.current;if(!commit)return;
  pending.current=null;
  if(timer.current!==null)window.clearTimeout(timer.current);
  timer.current=null;commit();
  setLeaving(false);setLeavingKind(null);locked.current=false;
 };
 useEffect(()=>()=>{if(timer.current!==null)window.clearTimeout(timer.current);
  pending.current=null;locked.current=false;},[]);
 const reset=()=>{
  if(locked.current)return;
  setPage(0);setHistory([]);setSaved(new Set());setMessage("");
  selectionHaptic();
 };
 const action=(kind:DemoKind|"undo")=>{
  if(locked.current)return;
  if(kind==="undo"){
   const previous=history.at(-1);
   if(previous!==undefined){setPage(previous);setHistory(h=>h.slice(0,-1));
    setMessage("Возврат к предыдущей тестовой анкете");selectionHaptic();}
   return;
  }
  if(!current)return;
  if(kind==="save"){
   setSaved(before=>{const next=new Set(before);
    if(next.has(current.id))next.delete(current.id);else next.add(current.id);return next;});
   setMessage("Сохранено только в демонстрационной сессии");selectionHaptic();return;
  }
  locked.current=true;
  const originalPage=page;
  pending.current=()=>{
   setHistory(h=>[...h,originalPage].slice(-30));setPage(originalPage+1);
   setMessage(kind==="like"?"Тестовый лайк · не отправлен пользователю":
    kind==="special"?"Тестовый суперлайк · без списания и отправки":"Тестовый пропуск");
  };
  setLeavingKind(kind);setLeaving(true);selectionHaptic();
  if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)finish();
  else timer.current=window.setTimeout(finish,540);
 };
 return <div className="demo-qa-feed" aria-label="Тестовая лента LUEMI">
  {current?<div className="discovery-deck-stage has-profiles">
    {[current,next].filter((person):person is DemoPerson=>Boolean(person)).map((person,i)=>{
     const foreground=i===0;
     return <div key={person.id}
       className={"discovery-deck-layer"+(foreground?
         (leaving?" deck-leaving deck-leaving-"+leavingKind:" deck-active"):
         (leaving?" deck-entering":" deck-queued"))}
       onAnimationEnd={event=>{
        // Keep the keyed successor through the full rising animation: committing
        // at the outgoing card's shorter exit used to cause a visible hop.
        if(!leaving||event.target!==event.currentTarget)return;
        if((!foreground&&event.animationName==="luemi-demo-arrive")||
           (foreground&&!next&&["luemi-demo-pass","luemi-demo-like","luemi-demo-special"].includes(event.animationName)))finish();
       }}>
       <FeedCard person={person} saved={saved.has(person.id)}
        canUndo={foreground&&history.length>0}
        active={foreground&&active} busy={!foreground||leaving}
        onAction={foreground?action:()=>{}}
        onOpenProfile={foreground?()=>onOpenProfile(person):()=>{}}
        onInterests={foreground?()=>onOpenProfile(person):()=>{}}
        onExitDemo={foreground?onExit:undefined}/>
      </div>;
    })}
  </div>:<div className="demo-qa-finished">
    <ShieldCheck size={31}/><h3>Все {people.length} анкет просмотрены</h3>
    <p>Можно повторить тест свайпов, фотографий и подсветки сколько угодно раз.</p>
    <button type="button" onClick={reset}><RotateCcw size={18}/> Посмотреть заново</button>
   </div>}
  <span className="demo-qa-sr-only" role="status" aria-live="polite">{message||"Демонстрационные анкеты. Реальные лайки не отправляются."}</span>
 </div>;
}
