import {useEffect,useState} from "react";
import {Heart,LockKeyhole,RefreshCw} from "lucide-react";
import {getIncomingLikes,getLikesGallery,realMatchPilot,type IncomingLike,type LikesGalleryEntry,type RealLikeKind} from "../registration/real-live-client";
import {LuemiEmptyState,LuemiSkeleton} from "../ui/LuemiV5";
import {LikesGalleryCard} from "./LikesGalleryCard";
import {demoPeople} from "./demo-people";
import type {DemoPerson} from "./model";
import {profileReactionKey,type ProfileReactionAction,useProfileReactionQueue} from "./use-profile-reaction-queue";
import "./likes-gallery.css";

const tabs=[["incoming","Вам"],["outgoing","От вас"],["mutual","Взаимно"]] as const;
type Tab=typeof tabs[number][0];
type Entry={id:string;name:string;photos:string[];tab:Tab;kind:RealLikeKind|null;local?:DemoPerson;match?:LikesGalleryEntry};
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
type Queue=ReturnType<typeof useProfileReactionQueue>;
type Props={
 active:boolean;qaAllowed:boolean;queue:Queue;onPerson:(id:string)=>void;onDemoPerson:(person:DemoPerson)=>void;
 onChat:(match:LikesGalleryEntry)=>Promise<void>;
};

function pendingGlyph(action:ProfileReactionAction|undefined){
 if(action?.phase!=="pending"&&action?.phase!=="sending")return null;
 return action.kind==="skip"?"like-skipped":action.kind==="super"?"superlike-outgoing":"like-outgoing";
}

export function LikesGallery({active,qaAllowed,queue,onPerson,onDemoPerson,onChat}:Props){
 const [tab,setTab]=useState<Tab>("incoming");
 const [demo,setDemo]=useState(false);
 const [rows,setRows]=useState<Entry[]|null>(null);
 const [locked,setLocked]=useState(0);
 const [error,setError]=useState("");
 const [chatError,setChatError]=useState("");
 const [refresh,refreshRows]=useState(0);
 const useDemo=demo&&qaAllowed;
 const revision=[...queue.actions.values()].filter(action=>action.phase==="sent"&&!action.target.demo).length;
 useEffect(()=>{
  if(!active||useDemo)return;
  if(!realMatchPilot.enabled)return;
  const controller=new AbortController();
  void Promise.all([getIncomingLikes(controller.signal),getLikesGallery(controller.signal)]).then(([incoming,gallery])=>{
   if(controller.signal.aborted)return;
   setRows([...incoming.likes.map(liveIncoming),...gallery.outgoing.map(liveOutgoing),...gallery.mutual.map(liveMutual)]);
   setLocked(incoming.hiddenCount);setError("");
  }).catch(()=>{
   if(!controller.signal.aborted)setError("Не удалось загрузить симпатии.");
  });
  return ()=>controller.abort();
 },[active,refresh,revision,useDemo]);

 const result=(entry:Entry)=>{
  const action=queue.actions.get(profileReactionKey({id:entry.id,demo:entry.local?true:undefined}));
  let section=entry.tab;
  if(action?.phase==="sent"&&entry.tab==="incoming"){
   if(action.kind==="skip")return null;
   if(!entry.local)return null; // confirmed live cards move on the authoritative refresh
   section="mutual";
  }
  return section===tab?{entry,action}:null;
 };
 const source=useDemo?fixtureCards:rows??[];
 const entries=source.flatMap(item=>{const row=result(item);return row?[row]:[];});
 const openChat=(entry:Entry)=>{
  setChatError("");
  if(entry.local){setChatError("В тестовом режиме переписка не создаётся.");return;}
  if(entry.match)void onChat(entry.match).catch(()=>setChatError("Не удалось открыть переписку."));
 };
 const switchTab=(next:Tab)=>{setTab(next);setChatError("");};
 const hiddenCards=!useDemo&&tab==="incoming"&&locked>0;

 if(!active)return null;
 return <section className="likes-gallery" aria-label="Симпатии">
  <div className="likes-gallery-head">
   <h2>Симпатии</h2>
   <div className="likes-gallery-tools">
    {qaAllowed&&<button type="button" className="likes-demo-toggle" aria-pressed={useDemo} onClick={()=>{
     setDemo(value=>!value);switchTab("incoming");
    }}>{useDemo?"Тестовый режим":"Демо"}</button>}
    {!useDemo&&<button type="button" className="likes-gallery-refresh" aria-label="Обновить симпатии"
     onClick={()=>{setError("");refreshRows(value=>value+1);}}><RefreshCw size={17}/></button>}
   </div>
  </div>
  <div className="likes-gallery-tabs" role="tablist" aria-label="Тип симпатий">
   {tabs.map(([id,label])=><button type="button" role="tab" aria-controls="likes-gallery-panel" aria-selected={tab===id}
    id={"likes-gallery-tab-"+id} key={id} onClick={()=>switchTab(id)}>{label}</button>)}
  </div>
  {chatError&&<span className="likes-gallery-error" role="status">{chatError}</span>}
  <div className="likes-gallery-scroller" id="likes-gallery-panel" key={tab} role="tabpanel" aria-labelledby={"likes-gallery-tab-"+tab}>
   {!useDemo&&error?<LuemiEmptyState icon={Heart} title={error} description="Проверь соединение и обнови галерею.">
    <button type="button" className="likes-retry" onClick={()=>{setError("");refreshRows(value=>value+1);}}>Повторить</button>
   </LuemiEmptyState>:!useDemo&&rows===null&&realMatchPilot.enabled?<div className="likes-gallery-grid" aria-label="Загрузка симпатий">
    <LuemiSkeleton/><LuemiSkeleton/>
   </div>:!entries.length&&!hiddenCards?<LuemiEmptyState icon={Heart} title={emptyMessage[tab]} description="Новые анкеты появятся здесь."/>:<div className="likes-gallery-grid">
    {entries.map(({entry,action})=>{
     const selected=pendingGlyph(action);
     const indicator=selected??(tab==="mutual"?"like-mutual":tab==="outgoing"?
      entry.kind==="super"?"superlike-outgoing":"like-outgoing":entry.kind==="super"?"superlike-incoming":"like-incoming");
     return <LikesGalleryCard key={entry.id} name={entry.name} age={entry.local?.age} city={entry.local?.city}
      photoOwner={entry.local?undefined:entry.id} photos={entry.photos} indicator={indicator} pending={!!selected}
      react={tab==="incoming"&&!selected?kind=>queue.enqueue({id:entry.id,name:entry.name,demo:entry.local?true:undefined},kind):undefined}
      onOpen={()=>{if(entry.local)onDemoPerson(entry.local);else onPerson(entry.id);}}
      onChat={tab==="mutual"?()=>openChat(entry):undefined} error={action?.phase==="failed"?action.error:undefined}/>;
    })}
    {hiddenCards&&<div className="likes-locked-card" aria-label={"Скрытые симпатии, "+locked}>
     <div><LockKeyhole size={26}/></div><strong>Скрытые симпатии</strong><small>{locked}</small>
    </div>}
   </div>}
  </div>
 </section>;
}
