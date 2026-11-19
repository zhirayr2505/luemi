import {useCallback,useEffect,useRef,useState} from "react";
import {RotateCcw,ShieldCheck} from "lucide-react";
import type {RegistrationDraft} from "../registration/model";
import {selectionHaptic} from "../ui/haptic";
import type {DemoKind,DemoPerson} from "./model";
import {demoPeople} from "./demo-people";
import {FeedCard} from "./FeedCard";
import {preloadFeedImage,preloadUpcomingFeedPhotos} from "./feed-image-preload";
import "./demo-feed-sandbox.css";

type Props={draft:RegistrationDraft;active:boolean;onExit:()=>void;onOpenProfile:(person:DemoPerson)=>void};
 
/** An isolated QA sandbox. Never calls the real feed, like, match or chat APIs.
 * Every profile is fictional; no invented geographical distance is displayed.
 * There is no database insertion, public discovery indexing or fake Telegram user. */
export function DemoFeedSandbox({draft,active,onExit,onOpenProfile}:Props){
 // Fictional cities are fixed metadata; don't pretend a person's location
 // matches the viewer just because the viewer changed discovery filters.
 const people=demoPeople;
 const [page,setPage]=useState(0);
 const [saved,setSaved]=useState<ReadonlySet<string>>(()=>new Set<string>());
 const [history,setHistory]=useState<number[]>([]);
 const [message,setMessage]=useState("");
 const [leaving,setLeaving]=useState(false);
 const [leavingKind,setLeavingKind]=useState<DemoKind|null>(null);
 const locked=useRef(false),pending=useRef<(()=>void)|null>(null),timer=useRef<number|null>(null);
 const deckRef=useRef<HTMLDivElement>(null);
 const [readyKeys,setReadyKeys]=useState<ReadonlySet<string>>(()=>new Set<string>());
 const readyKeysRef=useRef(new Set<string>());
 const waitingNext=useRef<{key:string;begin:()=>void;timer:number}|null>(null);
 const markReady=useCallback((key:string)=>{
  readyKeysRef.current.add(key);
  setReadyKeys(keys=>{
   if(keys.has(key))return keys;
   const next=new Set(keys);next.add(key);return next;
  });
  const waiting=waitingNext.current;
  if(waiting?.key===key){
   waitingNext.current=null;window.clearTimeout(waiting.timer);
   waiting.begin();
  }
 },[]);
 const coverKey=(person:DemoPerson)=>person.id+"::"+(person.photos[0]?.src??"");
 const current=people[page];
 // The next profile is mounted invisibly and decodes its cover before use.
 // Keep the existing bounded prefetch for subsequent photos.
 useEffect(()=>{
  if(!active)return;
  const controller=new AbortController();
  void preloadUpcomingFeedPhotos(people.slice(page,page+6),controller.signal);
  return()=>controller.abort();
 },[active,page,people]);
 const finish=()=>{
  const commit=pending.current;if(!commit)return;
  pending.current=null;
  if(timer.current!==null)window.clearTimeout(timer.current);
  timer.current=null;
  try{commit();}finally{setLeaving(false);setLeavingKind(null);locked.current=false;}
 };
 const finishRef=useRef<()=>void>(()=>{});finishRef.current=finish;
 useEffect(()=>{
  const recover=()=>{if(pending.current)finishRef.current();};
  const onVisible=()=>{if(document.visibilityState==="visible")recover();};
  window.addEventListener("focus",recover);
  document.addEventListener("visibilitychange",onVisible);
  return()=>{window.removeEventListener("focus",recover);
   document.removeEventListener("visibilitychange",onVisible);
   if(timer.current!==null)window.clearTimeout(timer.current);
   if(waitingNext.current!==null){window.clearTimeout(waitingNext.current.timer);waitingNext.current=null;}
   pending.current=null;locked.current=false;};
 },[]);
 const reset=()=>{
  if(locked.current)return;
  setPage(0);setHistory([]);setSaved(new Set());setMessage("");
  selectionHaptic();
 };
 const action=(kind:DemoKind|"undo")=>{
  if(locked.current){if(pending.current)finish();return;}
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
  selectionHaptic();
  const originalPage=page;
  const beginLeave=()=>{
   pending.current=()=>{
    setHistory(h=>[...h,originalPage].slice(-30));setPage(originalPage+1);
    setMessage(kind==="like"?"Тестовый лайк · не отправлен пользователю":
     kind==="special"?"Тестовый суперлайк · без списания и отправки":"Тестовый пропуск");
   };
   setLeavingKind(kind);setLeaving(true);
   if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)finish();
   else timer.current=window.setTimeout(finish,570);
  };
  // A queued card stays hidden until the current photo begins its exit.
  // Its decoded cover must be ready first; a bounded timer recovers from
  // broken images or suspended Android WebView callbacks.
  const next=people[page+1];
  const source=next?.photos[0]?.src;
  if(!next||!source){beginLeave();return;}
  const key=coverKey(next);
  if(readyKeysRef.current.has(key)){beginLeave();return;}
  void preloadFeedImage(source);
  const waiting={key,begin:beginLeave,timer:0};
  waiting.timer=window.setTimeout(()=>{
   if(waitingNext.current!==waiting)return;
   waitingNext.current=null;beginLeave();
  },2400);
  waitingNext.current=waiting;
 };
 return <div className="demo-qa-feed" aria-label="Тестовая лента LUEMI">
  {current?<div className="discovery-deck-stage has-profiles" ref={deckRef}>
    {people.slice(page,page+2).map((person,offset)=>{
     const queued=offset===1;
     const decoded=readyKeys.has(coverKey(person));
     const state=queued?" deck-queued"+(decoded?" deck-photo-ready":" deck-photo-pending"):
      (leaving?" deck-leaving deck-leaving-"+leavingKind:" deck-active");
     return <div key={person.id} className={"discovery-deck-layer"+state}
       aria-hidden={queued} inert={queued}
       onAnimationEnd={event=>{
        if(queued||!leaving||event.target!==event.currentTarget)return;
        if(["luemi-deck-exit-left","luemi-deck-exit-right","luemi-deck-exit-top"].includes(event.animationName))
         finish();
       }}>
       <FeedCard person={person} viewerInterestIds={draft.interests} saved={saved.has(person.id)}
        preview={queued} canUndo={!queued&&history.length>0}
        active={!queued&&active} busy={queued||leaving}
        onAction={queued?()=>{}:action}
        onOpenProfile={queued?()=>{}:()=>onOpenProfile(person)}
        onInterests={queued?()=>{}:()=>onOpenProfile(person)}
        onExitDemo={queued?undefined:onExit}
        onCoverReady={()=>markReady(coverKey(person))}/>
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
