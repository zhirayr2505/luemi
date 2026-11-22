import {useCallback,useEffect,useLayoutEffect,useRef,useState} from "react";
import {Heart,LockKeyhole,RefreshCw} from "lucide-react";
import {getIncomingLikes,getLikesGallery,realMatchPilot,type IncomingLike,type LikesGalleryEntry,type ProfileMatchState,type RealLikeKind} from "../registration/real-live-client";
import {LuemiEmptyState,LuemiIconButton} from "../ui/LuemiV5";
import {LikesGalleryCard} from "./LikesGalleryCard";
import {ProfileReactionNotices} from "./ProfileReactionNotices";
import {demoPeople} from "./demo-people";
import type {DemoPerson} from "./model";
import {profileReactionKey,type ProfileReactionAction,useProfileReactionQueue} from "./use-profile-reaction-queue";
import "./likes-gallery.css";

const tabs=[["incoming","Вам"],["outgoing","От вас"],["mutual","Взаимно"]] as const;
type Tab=typeof tabs[number][0];
type Entry={id:string;name:string;photos:string[];tab:Tab;kind:RealLikeKind|null;local?:DemoPerson;match?:LikesGalleryEntry};
type DisplayEntry={entry:Entry;key:string;action?:ProfileReactionAction};
const liveIncoming=(entry:IncomingLike):Entry=>({...entry,tab:"incoming"});
const liveOutgoing=(entry:LikesGalleryEntry):Entry=>({...entry,tab:"outgoing"});
const liveMutual=(entry:LikesGalleryEntry):Entry=>({...entry,tab:"mutual",match:entry});
const emptyMessage:Record<Tab,string>={incoming:"Пока нет входящих симпатий",outgoing:"Пока нет отправленных симпатий",mutual:"Пока нет взаимных симпатий"};

export const demoIncomingKind=(id:string):RealLikeKind|null=>{
 const index=demoPeople.findIndex(person=>person.id===id);
 return index>=0&&index<4?index%2===0?"ordinary":"super":null;
};
const fixtureCards=demoPeople.map((person,index):Entry=>({
 id:person.id,name:person.name,photos:person.photos.map(photo=>photo.src),
 tab:index<4?"incoming":index===4?"outgoing":"mutual",
 kind:index<4?demoIncomingKind(person.id):index===4?"super":null,local:person
}));
export function demoGalleryReaction(id:string):ProfileMatchState|null{
 const entry=fixtureCards.find(item=>item.id===id);
 if(!entry)return null;
 return {incoming:entry.tab==="incoming"?entry.kind:null,outgoing:entry.tab==="outgoing"?entry.kind:null,
  matchId:entry.tab==="mutual"?"fixture-match-"+entry.id:null};
}
type Queue=ReturnType<typeof useProfileReactionQueue>;
type Props={
 active:boolean;qaAllowed:boolean;queue:Queue;onPerson:(id:string)=>void;onDemoPerson:(person:DemoPerson)=>void;
 onChat:(match:LikesGalleryEntry)=>Promise<void>;
};

function reactionGlyph(action:ProfileReactionAction|undefined){
 if(!action||action.phase==="failed")return null;
 return action.kind==="skip"?"like-skipped":action.kind==="super"?"superlike-outgoing":"like-outgoing";
}

function useGalleryReflow(){
 const grid=useRef<HTMLDivElement>(null);
 const last=useRef<{grid:HTMLDivElement;width:number;positions:Map<Element,{x:number;y:number}>}|null>(null);
 const moving=useRef(new WeakMap<HTMLElement,Animation>());
 useLayoutEffect(()=>{
  const node=grid.current;
  if(!node){last.current=null;return;}
  const previous=last.current;
  const positions=new Map([...node.children].filter(child=>child instanceof HTMLElement)
   .map(child=>[child,{x:child.offsetLeft,y:child.offsetTop}]));
  const width=node.clientWidth;
  last.current={grid:node,width,positions};
  if(previous?.grid!==node||previous.width!==width||
   window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  // Keep reflow on translate so it can finish independently of a card's exit transform.
  const moves=[];
  for(const [child,position] of positions){
   const before=previous.positions.get(child);
   if(!before||typeof child.animate!=="function"||before.x===position.x&&before.y===position.y)continue;
   const animation=moving.current.get(child);
   const [x=0,y=0]=animation?getComputedStyle(child).translate.split(" ").map(parseFloat).filter(Number.isFinite):[];
   moves.push({child,animation,x:before.x-position.x+x,y:before.y-position.y+y});
  }
  for(const {child,animation,x,y} of moves){
   animation?.cancel();
   const next=child.animate([{translate:`${x}px ${y}px`},{translate:"0px 0px"}],
    {duration:260,easing:"cubic-bezier(.2,.75,.2,1)"});
   moving.current.set(child,next);
   void next.finished.then(()=>{
    if(moving.current.get(child)===next)moving.current.delete(child);
   },()=>{});
  }
 });
 return grid;
}

export function LikesGallery({active,qaAllowed,queue,onPerson,onDemoPerson,onChat}:Props){
 const [tab,setTab]=useState<Tab>("incoming");
 const [demo,setDemo]=useState(false);
 const [rows,setRows]=useState<Entry[]|null>(null);
 const [loading,setLoading]=useState(false);
 const [locked,setLocked]=useState(0);
 const [error,setError]=useState("");
 const [chatError,setChatError]=useState("");
 const [refresh,refreshRows]=useState(0);
 const [exited,setExited]=useState<ReadonlySet<string>>(()=>new Set());
 const previousIncoming=useRef<DisplayEntry[]>([]);
 const grid=useGalleryReflow();
 const finishExit=useCallback((key:string)=>setExited(keys=>new Set([...keys,key])),[]);
 const useDemo=demo&&qaAllowed;
 const revision=[...queue.actions.values()].filter(action=>action.phase==="sent"&&!action.target.demo).length;
 useEffect(()=>{
  if(!active||useDemo)return;
  if(!realMatchPilot.enabled){setRows([]);setLoading(false);return;}
  const controller=new AbortController();
  setLoading(true);
  const timeout=window.setTimeout(()=>{
   if(controller.signal.aborted)return;
   controller.abort();
   setLoading(false);setError("Симпатии загружаются слишком долго. Попробуй обновить.");
  },12000);
  void Promise.all([getIncomingLikes(controller.signal),getLikesGallery(controller.signal)]).then(([incoming,gallery])=>{
   if(controller.signal.aborted)return;
   window.clearTimeout(timeout);
   setRows([...incoming.likes.map(liveIncoming),...gallery.outgoing.map(liveOutgoing),...gallery.mutual.map(liveMutual)]);
   setLocked(incoming.hiddenCount);setLoading(false);setError("");
  }).catch(()=>{
   if(!controller.signal.aborted){
    window.clearTimeout(timeout);
    setLoading(false);setError("Не удалось загрузить симпатии.");
   }
  });
  return ()=>{window.clearTimeout(timeout);controller.abort();};
 },[active,refresh,revision,useDemo]);

 const rowFor=(entry:Entry):DisplayEntry=>{
  const key=profileReactionKey({id:entry.id,demo:entry.local?true:undefined});
  return {entry,key,action:queue.actions.get(key)};
 };
 const result=(row:DisplayEntry)=>{
  const {entry,action}=row;
  let section=entry.tab;
  if(action?.phase==="sent"&&entry.tab==="incoming"){
   if(action.kind==="skip")return null;
   if(!entry.local)return null; // confirmed live cards move on the authoritative refresh
   section="mutual";
  }
  return section===tab?row:null;
 };
 const source=useDemo?fixtureCards:rows??[];
 const entries=source.flatMap(item=>{const row=result(rowFor(item));return row?[row]:[];});
 if(active&&tab==="incoming"){
  const present=new Set(entries.map(row=>row.key));
  // The refreshed server list can drop a card while its reaction or exit is in flight.
  previousIncoming.current.forEach(({entry,key},index)=>{
   const action=queue.actions.get(key);
   if(!!entry.local===useDemo&&!present.has(key)&&!exited.has(key)&&
    action?.target.surface==="gallery"&&action.phase!=="failed"){
    entries.splice(index,0,{entry,key,action});
   }
  });
 }
 useLayoutEffect(()=>{
  previousIncoming.current=active&&tab==="incoming"?entries:[];
 });
 const fallbackNotices=queue.notices.filter(notice=>notice.target.surface==="gallery"&&
  !entries.some(row=>row.key===profileReactionKey(notice.target)&&row.entry.tab==="incoming"&&tab==="incoming"));
 const openChat=(entry:Entry)=>{
  setChatError("");
  if(entry.local){setChatError("В тестовом режиме переписка не создаётся.");return;}
  if(entry.match)void onChat(entry.match).catch(()=>setChatError("Не удалось открыть переписку."));
 };
 const switchTab=(next:Tab)=>{setTab(next);setChatError("");};
 const hiddenCards=!useDemo&&tab==="incoming"&&locked>0;

 if(!active)return null;
 return <section className="likes-gallery" aria-label="Симпатии">
  <header className="likes-gallery-chrome">
   <div className="likes-gallery-brand">
    <img src="/assets/brand/wordmark_original_raster_alpha_W06.webp" alt="LUEMI" width="88" height="30"
     decoding="async" fetchPriority="high"/>
   </div>
   <div className="likes-gallery-head">
    <h2>Симпатии</h2>
    <div className="likes-gallery-tools">
     {qaAllowed&&<button type="button" className="likes-demo-toggle" aria-pressed={useDemo} onClick={()=>{
      setDemo(value=>!value);switchTab("incoming");
     }}><span>Демо</span></button>}
     {!useDemo&&<LuemiIconButton className="likes-gallery-refresh" label="Обновить симпатии"
      onClick={()=>{setError("");refreshRows(value=>value+1);}}><RefreshCw size={16}/></LuemiIconButton>}
    </div>
   </div>
   <div className="likes-gallery-tabs" role="tablist" aria-label="Тип симпатий">
    {tabs.map(([id,label])=><button type="button" role="tab" aria-controls="likes-gallery-panel" aria-selected={tab===id}
     id={"likes-gallery-tab-"+id} key={id} onClick={()=>switchTab(id)}>{label}</button>)}
   </div>
  </header>
  {(chatError||(!useDemo&&entries.length>0&&error))&&
   <span className="likes-gallery-error" role="status">{chatError||error}</span>}
  <div className="likes-gallery-scroller" id="likes-gallery-panel" key={tab} role="tabpanel" aria-labelledby={"likes-gallery-tab-"+tab}>
   {!useDemo&&error&&!entries.length?<LuemiEmptyState icon={Heart} title={error} description="Проверь соединение и обнови галерею.">
    <button type="button" className="likes-retry" onClick={()=>{setError("");refreshRows(value=>value+1);}}>Повторить</button>
   </LuemiEmptyState>:!useDemo&&loading&&rows===null?<div className="likes-gallery-grid likes-loading-grid" role="status" aria-label="Загружаем симпатии">
    {[0,1].map(index=><div key={index} className="likes-loading-card" aria-hidden="true">
     <div className="likes-loading-photo"/><div className="likes-loading-caption"><i/><i/></div>
    </div>)}
   </div>:!entries.length&&!hiddenCards?<LuemiEmptyState icon={Heart} title={emptyMessage[tab]} description="Новые анкеты появятся здесь."/>:<div ref={grid} className="likes-gallery-grid">
    {entries.map(({entry,key,action})=>{
     const reaction=tab==="incoming"&&action?.target.surface==="gallery"&&action.phase!=="failed"?action:undefined;
     const selected=tab==="incoming"?reactionGlyph(action):null;
     const indicator=selected??(tab==="mutual"?"like-mutual":tab==="outgoing"?
      entry.kind==="super"?"superlike-outgoing":"like-outgoing":entry.kind==="super"?"superlike-incoming":"like-incoming");
     return <LikesGalleryCard key={key} layoutKey={key} name={entry.name} age={entry.local?.age} city={entry.local?.city}
      photoOwner={entry.local?undefined:entry.id} photos={entry.photos} indicator={indicator} pending={!!selected}
      reaction={reaction} onUndo={()=>queue.undo(key)} onExit={finishExit}
      react={tab==="incoming"&&!selected?kind=>queue.enqueue({id:entry.id,name:entry.name,demo:entry.local?true:undefined,surface:"gallery"},kind):undefined}
      onOpen={()=>{if(entry.local)onDemoPerson(entry.local);else onPerson(entry.id);}}
      onChat={tab==="mutual"?()=>openChat(entry):undefined} error={action?.phase==="failed"?action.error:undefined}/>;
    })}
    {hiddenCards&&<div className="likes-locked-card" aria-label={"Скрытые симпатии, "+locked}>
     <div><LockKeyhole size={26}/></div><strong>Скрытые симпатии</strong><small>{locked}</small>
    </div>}
   </div>}
  </div>
  <ProfileReactionNotices notices={fallbackNotices} undo={queue.undo}/>
 </section>;
}
