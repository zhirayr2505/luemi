import {useEffect,useMemo,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent,ReactNode} from "react";
import type {CSSProperties} from "react";
import {Heart,Images,MessagesSquare,UserRound,RefreshCw,Flag as FlagIcon,ShieldBan,Settings2} from "lucide-react";
import type {RegistrationDraft} from "../registration/model";
import type {DemoKind,DemoPerson} from "./model";
import type {ProfileMasterData} from "./ProfileModel";
import {FeedCard} from "./FeedCard";
import {GlobalHeader} from "./GlobalHeader";
import {ProfileMaster} from "./ProfileV3Gateway";
import {VisitorProfileRoute} from "./VisitorProfileRoute";
import {RealChats} from "../chats/RealChats";
import {createChatTransport,type ChatWireConversation} from "../chats/chat-transport";
import {geoCsrf} from "../auth/session-adapter";
import {getPublishedFeed,likePublishedUser,blockPublishedUser,reportPublishedUser,type PublishedFeedPage} from "../registration/real-live-client";
import type {RealPublishedProfile,PublishedReportReason,OwnerPublicationStatus} from "../registration/real-live-client";
import "./discovery.css";
import "./feed-v2.css";
import "./real-discovery.css";

// EXACT approved LUEMI navigation / header / profile components. No demo profiles
// are imported or projected into a real session.
const navigation=[["discover","Знакомства",Images],["likes","Симпатии",Heart],["chats","Чаты",MessagesSquare],["profile","Профиль",UserRound]] as const;
const tabs=[["feed","Лента"],["for-you","Для тебя"],["nearby","Рядом"]] as const;
type MainTab=typeof navigation[number][0];
type BrowseTab=typeof tabs[number][0];

const photoId=(url:string,i:number)=>/([0-9a-f-]{36})$/i.exec(url)?.[1]??"owner-photo-"+i;
export function publishedToMaster(status:OwnerPublicationStatus["profile"]):ProfileMasterData|null{
 if(!status)return null;
 return {id:null,source:"server",name:status.name,age:status.age,city:status.city,
  country:"",countryCode:status.countryCode,goal:status.goal,about:status.about,
  interests:status.interests,languages:[],premium:false,verified:false,
  registeredAt:null,updatedAt:null,
  photos:status.photos.map((src,i)=>({id:photoId(src,i),src,status:"published" as const}))};
}
const visitorToMaster=(p:RealPublishedProfile):ProfileMasterData=>({
 id:p.id,source:"server",name:p.name,age:p.age,city:p.city,country:"",
 countryCode:p.countryCode,goal:p.goal,about:p.about,
 interests:[...p.interests],languages:[...p.languages],verified:false,premium:false,
 registeredAt:null,updatedAt:null,
 photos:p.photos.map(photo=>({id:photo.id,src:photo.url,status:"published" as const}))
});
const toCard=(p:RealPublishedProfile):DemoPerson=>({
 id:p.id,name:p.name,age:p.age,city:p.city,country:"",countryCode:p.countryCode,
 gender:p.gender,goal:p.goal as DemoPerson["goal"],about:p.about,
 interests:[...p.interests],languages:[...p.languages],
 photos:p.photos.map(photo=>({id:photo.id,src:photo.url}))
});

function RealMatches({active,onChat}:{active:boolean;onChat:()=>void}){
 const [items,setItems]=useState<ChatWireConversation[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  if(!active)return;
  const csrf=geoCsrf(),controller=new AbortController();
  if(!csrf){setError("Войди через Telegram, чтобы увидеть симпатии.");setLoading(false);return;}
  setLoading(true);setError("");
  void createChatTransport(csrf).list(controller.signal).then(data=>{
   if(!controller.signal.aborted){setItems(data.conversations);setLoading(false);}
  }).catch(()=>{if(!controller.signal.aborted){setError("Не удалось загрузить симпатии.");setLoading(false);}});
  return ()=>controller.abort();
 },[active,refresh,initialFeed]);
 return <section className="real-discovery-matches" aria-label="Взаимные симпатии">
  <div className="real-discovery-matches-head"><h2>Симпатии</h2>
   <button type="button" aria-label="Обновить симпатии" onClick={()=>setRefresh(x=>x+1)}><RefreshCw size={19}/></button></div>
  {loading?<p role="status">Загружаем симпатии…</p>:error?<p role="alert">{error}</p>:
   !items.length?<div className="discovery-placeholder"><Heart size={36}/><h2>Пока нет взаимных симпатий</h2>
    <p>Когда появится взаимная симпатия, она будет здесь.</p></div>:
   <div className="real-discovery-match-list">{items.map(item=>
    <button type="button" key={item.id} className="real-discovery-match" onClick={onChat}>
     <span className="real-discovery-avatar">{item.peerPhotoUrl?<img src={item.peerPhotoUrl} alt="" loading="lazy"/>:item.peerName.slice(0,1)}</span>
     <span><b>{item.peerName}</b><small>Взаимная симпатия · Открыть чаты</small></span>
     <Heart size={20}/></button>)}</div>}
 </section>;
}

function LiveDeck({active,tab,draft,initialFeed,onPerson,onMatched}:{
 active:boolean;tab:BrowseTab;draft:RegistrationDraft;initialFeed?:PublishedFeedPage|null;
 onPerson:(p:RealPublishedProfile)=>void;onMatched:()=>void
}){
 const [rows,setRows]=useState<RealPublishedProfile[]>([]);
 const [loading,setLoading]=useState(false),[error,setError]=useState("");
 const [refresh,setRefresh]=useState(0),[cursor,setCursor]=useState<string|null>(null);
 const [busy,setBusy]=useState(false),[moreBusy,setMoreBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [menu,setMenu]=useState<RealPublishedProfile|null>(null);
 const [reporting,setReporting]=useState(false),[reason,setReason]=useState<PublishedReportReason>("spam");
 const [page,setPage]=useState(0);
 const abort=useRef<AbortController|null>(null);
 useEffect(()=>{
  if(!active)return;
  const controller=new AbortController();abort.current?.abort();abort.current=controller;
  setLoading(true);setError("");setMessage("");
  if(initialFeed&&refresh===0){
   // First paint already has the actual signed server recommendations and
   // the first decoded image blobs from the publication handoff.
   setRows(initialFeed.profiles);setCursor(initialFeed.nextCursor);
   setPage(0);setLoading(false);return()=>controller.abort();
  }
  void getPublishedFeed(controller.signal).then(result=>{
   if(controller.signal.aborted)return;
   setRows(result.profiles);setCursor(result.nextCursor);setPage(0);setLoading(false);
  }).catch(()=>{if(!controller.signal.aborted){setLoading(false);setError("Не удалось загрузить анкеты.");}});
  return ()=>controller.abort();
 },[active,refresh]);
 const matchedRows=useMemo(()=>{
  if(tab==="nearby")return rows.filter(p=>p.city.trim().toLocaleLowerCase("ru")===draft.city.trim().toLocaleLowerCase("ru"));
  if(tab==="for-you")return rows.filter(p=>p.interests.some(id=>draft.interests.includes(id)));
  return rows;
 },[rows,tab,draft.city,draft.interests]);
 const current=matchedRows[page];
 const more=async()=>{
  if(!cursor||moreBusy||busy)return;
  const controller=new AbortController();abort.current?.abort();abort.current=controller;
  setMoreBusy(true);
  try{
   const response=await getPublishedFeed(controller.signal,cursor);
   if(controller.signal.aborted)return;
   setRows(existing=>{const ids=new Set(existing.map(x=>x.id));
    return [...existing,...response.profiles.filter(x=>!ids.has(x.id))];});
   setCursor(response.nextCursor);
  }catch{if(!controller.signal.aborted)setMessage("Не удалось загрузить следующие анкеты.");}
  finally{if(abort.current===controller)setMoreBusy(false);}
 };
 const act=async(kind:DemoKind|"undo")=>{
  if(!current||busy)return;
  if(kind==="undo"||kind==="save")return;
  if(kind==="pass"){setPage(n=>n+1);return;}
  setBusy(true);setMessage("");
  try{
   const result=await likePublishedUser(current.id);
   setRows(prev=>prev.filter(p=>p.id!==current.id));
   setPage(n=>Math.max(0,n-1));
   setMessage(result.matched?"Взаимная симпатия! 💜":"Симпатия отправлена 💜");
   if(result.matched)onMatched();
  }catch{setMessage("Не удалось поставить симпатию. Повтори попытку.");}
  finally{setBusy(false);}
 };
 const block=async()=>{
  if(!menu||busy)return;
  setBusy(true);
  try{await blockPublishedUser(menu.id);setRows(prev=>prev.filter(p=>p.id!==menu.id));setMessage("Анкета заблокирована.");setMenu(null);}
  catch{setMessage("Не удалось заблокировать анкету.");}
  finally{setBusy(false);}
 };
 const report=async()=>{
  if(!menu||busy)return;
  setBusy(true);
  try{await reportPublishedUser(menu.id,reason);setMenu(null);setReporting(false);setMessage("Жалоба отправлена.");}
  catch{setMessage("Не удалось отправить жалобу.");}
  finally{setBusy(false);}
 };
 return <div className="real-discovery-deck">
  {message&&<div className="real-discovery-notice" role="status">{message}</div>}
  {loading?<div className="discovery-empty" role="status"><Heart size={36}/><h2>Загружаем анкеты…</h2></div>:
   error?<div className="discovery-empty" role="alert"><h2>Анкеты не загрузились</h2><p>{error}</p>
    <button type="button" className="discovery-glass-button" onClick={()=>setRefresh(n=>n+1)}>Повторить</button></div>:
   <div className="discovery-deck-stage">{current?
    <div className="discovery-deck-layer deck-active" key={current.id}>
     <FeedCard person={toCard(current)} real saved={false} canUndo={false}
      active={active} busy={busy} onAction={kind=>{void act(kind);}}
      onOpenProfile={()=>onPerson(current)} onInterests={()=>onPerson(current)}
      onMore={()=>{setMenu(current);setReporting(false);}}/>
    </div>:
    <div className="discovery-deck-layer deck-active"><div className="discovery-empty real-discovery-empty">
     <Heart size={38}/><h2>Пока нет анкет</h2>
     <p>{tab==="nearby"?"В твоём городе пока нет подходящих анкет.":
      tab==="for-you"?"Пока нет анкет с общими интересами.":"Когда появятся новые люди, ты увидишь их здесь."}</p>
     {cursor&&<button type="button" className="discovery-glass-button" disabled={moreBusy} onClick={()=>{void more();}}>
      {moreBusy?"Загружаем…":"Посмотреть дальше"}</button>}
     <button type="button" className="discovery-glass-button" onClick={()=>setRefresh(n=>n+1)}>
      <RefreshCw size={16}/> Обновить</button></div></div>}
   </div>}
  {!!current&&cursor&&page>=matchedRows.length-1&&<button type="button"
   className="real-discovery-more" disabled={moreBusy} onClick={()=>{void more();}}>
   {moreBusy?"Загружаем…":"Загрузить ещё анкеты"}</button>}
  {menu&&<div className="discovery-modal-backdrop real-discovery-modal" onClick={()=>{if(!busy){setMenu(null);setReporting(false);}}}>
   <section className="real-discovery-modal-sheet" role="dialog" aria-modal="true" aria-label="Действия с анкетой"
    onClick={event=>event.stopPropagation()}>
    <h2>{reporting?"Пожаловаться":"Действия с анкетой"}</h2>
    {!reporting?<><p>{menu.name}, {menu.age}</p>
      <button type="button" disabled={busy} onClick={()=>{void block();}}><ShieldBan size={19}/> Заблокировать</button>
      <button type="button" disabled={busy} onClick={()=>setReporting(true)}><FlagIcon size={19}/> Пожаловаться</button>
    </>:<><label>Причина жалобы
      <select value={reason} onChange={e=>setReason(e.target.value as PublishedReportReason)} disabled={busy}>
       <option value="spam">Спам или реклама</option><option value="harassment">Угрозы или преследование</option>
       <option value="impersonation">Чужая анкета</option><option value="unsafe_media">Неприемлемое фото</option>
       <option value="nonconsensual_photo">Фото без согласия</option>
       <option value="minor_suspected">Возможно, нет 18 лет</option>
      </select></label>
      <button type="button" disabled={busy} onClick={()=>{void report();}}>Отправить жалобу</button></>}
    <button type="button" disabled={busy} onClick={()=>{setMenu(null);setReporting(false);}}>Отмена</button>
   </section>
  </div>}
 </div>;
}

export function RealDiscoveryHome({draft,theme,onTheme,publishedProfile,initialFeed,accountPanel,onEdit}:{
 draft:RegistrationDraft;theme:"light"|"dark";onTheme:()=>void;
 publishedProfile:OwnerPublicationStatus["profile"]|undefined;initialFeed?:PublishedFeedPage|null;
 accountPanel:ReactNode;onEdit:()=>void;
}){
 const [mainTab,setMainTab]=useState<MainTab>("discover");
 const [browse,setBrowse]=useState<BrowseTab>("feed");
 const [person,setPerson]=useState<RealPublishedProfile|null>(null);
 const [accountOpen,setAccountOpen]=useState(false);
 const index=tabs.findIndex(t=>t[0]===browse);
 const start=useRef<{id:number;x:number;y:number;claimed:boolean}|null>(null);
 const suppressClick=useRef(0);
 const owner=useMemo(()=>publishedToMaster(publishedProfile),[publishedProfile]);
 const onDown=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(e.pointerType==="mouse"&&e.button!==0)return;
  if((e.target as Element).closest("button,a,input,textarea,select,[role=dialog],.discovery-card"))return;
  start.current={id:e.pointerId,x:e.clientX,y:e.clientY,claimed:false};
 };
 const onUp=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const g=start.current;start.current=null;if(!g||g.id!==e.pointerId)return;
  const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.4){
   const next=Math.max(0,Math.min(2,index+(dx<0?1:-1)));
   if(next!==index){setBrowse(tabs[next][0]);suppressClick.current=performance.now()+300;}
  }
 };
 return <section className="discovery-app real-discovery-home" data-profile-mode={mainTab==="profile"?"true":"false"}>
  <div className="discovery-ambient" aria-hidden="true"/>
  <GlobalHeader mode={mainTab==="profile"?"profile":"browse"} theme={theme} onTheme={onTheme}
   onFilters={()=>{setMainTab("discover");setBrowse("for-you");}} onSaved={()=>setMainTab("likes")}/>
  <div className="discovery-main-panels">
   <section className="discovery-panel discovery-browse-panel" hidden={mainTab!=="discover"}>
    <div className="discovery-top-tabs" role="tablist" aria-label="Разделы знакомств"
     onKeyDown={e=>{const change=e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0;
      if(!change)return;e.preventDefault();setBrowse(tabs[Math.max(0,Math.min(2,index+change))][0]);}}>
     {tabs.map(([id,label])=><button key={id} type="button" role="tab" className={browse===id?"active":""}
      aria-selected={browse===id} tabIndex={browse===id?0:-1}
      onClick={()=>setBrowse(id)}>{label}</button>)}
     <span className="discovery-tab-underline" aria-hidden="true"
      style={{"--luemi-tab-offset":index*100+"%"} as CSSProperties}/>
    </div>
    <div className="discovery-pages" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={()=>{start.current=null;}}
      onClickCapture={e=>{if(performance.now()<suppressClick.current){e.preventDefault();e.stopPropagation();}}}>
     <div className="discovery-page-track" style={{"--luemi-tab-offset":(-index*100)+"%"} as CSSProperties}>
      {tabs.map(([id,label])=><section key={id} className="discovery-page" role="tabpanel" aria-label={label}
       aria-hidden={browse!==id} inert={browse!==id}>
       <LiveDeck active={mainTab==="discover"&&browse===id} tab={id} draft={draft}
        initialFeed={initialFeed}
        onPerson={setPerson} onMatched={()=>setMainTab("chats")}/>
      </section>)}
     </div>
    </div>
   </section>
   <section className="discovery-panel" hidden={mainTab!=="likes"}>
    <RealMatches active={mainTab==="likes"} onChat={()=>setMainTab("chats")}/>
   </section>
   <section className="discovery-panel real-discovery-chat-panel" hidden={mainTab!=="chats"}>
    {mainTab==="chats"&&<RealChats/>}
   </section>
   <section className="discovery-panel discovery-profile-panel" hidden={mainTab!=="profile"}>
    {owner?<ProfileMaster data={owner} mode="owner" onEdit={()=>setAccountOpen(true)}
      active={mainTab==="profile"}/>:<div className="discovery-empty">
      <UserRound size={37}/><h2>Анкета готовится</h2>
      <p>Заверши публикацию, чтобы увидеть свой профиль.</p>
      <button type="button" className="discovery-glass-button" onClick={()=>setAccountOpen(true)}>Открыть настройки</button>
     </div>}
    <button type="button" className="real-discovery-settings" aria-label="Настройки аккаунта" title="Настройки аккаунта"
     onClick={()=>setAccountOpen(true)}><Settings2 size={20}/></button>
   </section>
  </div>
  {person&&<VisitorProfileRoute data={visitorToMaster(person)} theme={theme} onTheme={onTheme}
   onExit={()=>setPerson(null)} registerBack={()=>{}}/>}
  <nav className="discovery-bottom-nav" aria-label="Главная навигация LUEMI">
   {navigation.map(([id,label,Icon])=><button type="button" key={id}
    className={"discovery-nav-item"+(mainTab===id?" active":"")}
    aria-current={mainTab===id?"page":undefined} onClick={()=>{setPerson(null);setMainTab(id);}}>
     <Icon size={22} strokeWidth={1.75}/><span>{label}</span></button>)}
  </nav>
  {accountOpen&&<div className="discovery-modal-backdrop real-discovery-account-modal"
   onClick={()=>setAccountOpen(false)}>
   <section className="real-discovery-account-sheet" role="dialog" aria-modal="true" aria-label="Настройки профиля"
    onClick={e=>e.stopPropagation()}>
    <button className="real-discovery-account-close" type="button" onClick={()=>setAccountOpen(false)}>Закрыть</button>
    <div>{accountPanel}</div>
    <button className="discovery-glass-button" type="button" onClick={()=>{setAccountOpen(false);onEdit();}}>Редактировать анкету</button>
   </section>
  </div>}
 </section>;
}
