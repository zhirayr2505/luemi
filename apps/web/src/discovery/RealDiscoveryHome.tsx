import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from "react";
import type {ReactNode} from "react";
import type {CSSProperties} from "react";
import {Heart,Images,MessagesSquare,UserRound,RefreshCw,Flag as FlagIcon,ShieldBan,Settings2} from "lucide-react";
import type {RegistrationDraft} from "../registration/model";
import type {DemoKind,DemoPerson} from "./model";
import type {ProfileMasterData} from "./ProfileModel";
import {FeedCard} from "./FeedCard";
import {cardGestureZone} from "./card-gesture-zone";
import {selectionHaptic} from "../ui/haptic";
import {MotionController,type MotionToken} from "../ui/motion-controller";
import {GestureArbiter,computedTranslation,fractionalTrack} from "../ui/gesture-arbiter";
import type {InputKind} from "../ui/gesture-arbiter";
import {createProfileMotionAuthority,PROFILE_MOTION_WRITER_TABLE} from "./profile-motion";
import type {HeaderMotion} from "./GlobalHeader";
import {RealForYou} from "./RealForYou";
import {RealNearby} from "./RealNearby";
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
const androidWebView=typeof navigator!=="undefined"&&/Android/i.test(navigator.userAgent);
const EMPTY_OWNER_PREVIEW:ReadonlyArray<{src:string}>=[];
type Gesture={id:number;kind:InputKind;x:number;y:number;started:number;tracking:boolean;index:number;
 width:number;serial:number;token:MotionToken|null;originTrack:number;originInk:number;
 lastX:number;native?:boolean};
type BrowseInput={pointerId:number;clientX:number;clientY:number;target:EventTarget|null;
 currentTarget:HTMLElement;cancelable:boolean;preventDefault:()=>void;
 isPrimary?:boolean;pointerType?:string;button?:number};

const photoId=(url:string,i:number)=>/([0-9a-f-]{36})$/i.exec(url)?.[1]??"owner-photo-"+i;
export function publishedToMaster(status:OwnerPublicationStatus["profile"],localPhotos:ReadonlyArray<{src:string}>=[]):ProfileMasterData|null{
 if(!status)return null;
 const localReady=localPhotos.length===status.photos.length&&localPhotos.every(photo=>photo.src);
 return {id:null,source:"server",name:status.name,age:status.age,city:status.city,
  country:"",countryCode:status.countryCode,goal:status.goal,about:status.about,
  interests:status.interests,languages:[],premium:false,verified:false,
  registeredAt:null,updatedAt:null,
  photos:status.photos.map((src,i)=>({id:photoId(src,i),src:localReady?localPhotos[i].src:src,status:"published" as const}))};
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
 },[active,refresh]);
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

function LiveDeck({active,tab,draft,initialFeed,onPerson,onMatched,saved,onSave,onEditLocation,onScrollTop}:{
 active:boolean;tab:BrowseTab;draft:RegistrationDraft;initialFeed?:PublishedFeedPage|null;
 onPerson:(p:RealPublishedProfile)=>void;onMatched:()=>void;
 saved:ReadonlySet<string>;onSave:(id:string)=>void;onEditLocation:()=>void;
 onScrollTop:(top:number)=>void
}){
 const [rows,setRows]=useState<RealPublishedProfile[]>([]);
 const [loading,setLoading]=useState(false),[error,setError]=useState("");
 const [refresh,setRefresh]=useState(0),[cursor,setCursor]=useState<string|null>(null);
 const lastRefresh=useRef(-1);
 const [busy,setBusy]=useState(false),[moreBusy,setMoreBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [menu,setMenu]=useState<RealPublishedProfile|null>(null);
 const [reporting,setReporting]=useState(false),[reason,setReason]=useState<PublishedReportReason>("spam");
 const [page,setPage]=useState(0);
 const abort=useRef<AbortController|null>(null);
 useEffect(()=>{
  if(!active||lastRefresh.current===refresh)return;
  lastRefresh.current=refresh;
  const controller=new AbortController();abort.current?.abort();abort.current=controller;
  let complete=false;
  setLoading(true);setError("");setMessage("");
  if(initialFeed&&refresh===0){
   // First paint already has the actual signed server recommendations and
   // the first decoded image blobs from the publication handoff.
   setRows(initialFeed.profiles);setCursor(initialFeed.nextCursor);
   setPage(0);setLoading(false);complete=true;return()=>controller.abort();
  }
  void getPublishedFeed(controller.signal).then(result=>{
   if(controller.signal.aborted)return;
   setRows(result.profiles);setCursor(result.nextCursor);setPage(0);setLoading(false);complete=true;
  }).catch(()=>{if(!controller.signal.aborted){setLoading(false);setError("Не удалось загрузить анкеты.");complete=true;}});
  return ()=>{if(!complete&&lastRefresh.current===refresh)lastRefresh.current=-1;controller.abort();};
 },[active,refresh,initialFeed]);
 // Each tab now owns its approved presentation. Only Feed renders a full-screen deck;
 // For You and Nearby sort/filter the complete real server page themselves.
 const matchedRows=rows;
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
 if(tab!=="feed")return <div className="real-discovery-deck real-discovery-collections">
  {message&&<div className="real-discovery-notice" role="status">{message}</div>}
  {loading?<div className="discovery-empty" role="status"><Heart size={36}/><h2>Загружаем анкеты…</h2></div>:
   error?<div className="discovery-empty" role="alert"><h2>Анкеты не загрузились</h2><p>{error}</p>
    <button type="button" className="discovery-glass-button" onClick={()=>setRefresh(n=>n+1)}>Повторить</button></div>:
   tab==="for-you"?
    <RealForYou draft={draft} people={rows} onPerson={onPerson} saved={saved} onSave={onSave}
     onScrollTop={onScrollTop} onMore={()=>{void more();}} hasMore={!!cursor} moreBusy={moreBusy}/>:
    <RealNearby draft={draft} people={rows} onPerson={onPerson} saved={saved} onSave={onSave}
     onScrollTop={onScrollTop} onMore={()=>{void more();}} hasMore={!!cursor} moreBusy={moreBusy} onEditLocation={onEditLocation}/>}
 </div>;
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
     <p>Когда появятся новые люди, ты увидишь их здесь.</p>
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

export function RealDiscoveryHome({draft,theme,onTheme,publishedProfile,ownerPhotoPreview=EMPTY_OWNER_PREVIEW,initialFeed,accountPanel,onEdit}:{
 draft:RegistrationDraft;theme:"light"|"dark";onTheme:()=>void;
 publishedProfile:OwnerPublicationStatus["profile"]|undefined;initialFeed?:PublishedFeedPage|null;
 ownerPhotoPreview?:ReadonlyArray<{src:string}>;
 accountPanel:ReactNode;onEdit:()=>void;
}){
 const [mainTab,setMainTab]=useState<MainTab>("discover");
 const [browse,setBrowse]=useState<BrowseTab>("feed");
 const [person,setPerson]=useState<RealPublishedProfile|null>(null);
 const [accountOpen,setAccountOpen]=useState(false);
 // Session-only bookmarks: the API has no durable saved-profiles endpoint yet.
 const [savedIds,setSavedIds]=useState<ReadonlySet<string>>(()=>new Set<string>());
 const onSave=(id:string)=>setSavedIds(previous=>{
  const next=new Set(previous);if(next.has(id))next.delete(id);else next.add(id);return next;
 });
 const index=tabs.findIndex(t=>t[0]===browse);
 const pages=useRef<HTMLDivElement>(null),topTabsSurface=useRef<HTMLDivElement>(null);
 const pageTrack=useRef<HTMLDivElement>(null),underline=useRef<HTMLSpanElement>(null);
 const pagerSettleTimer=useRef<number|null>(null);
 const motionAuthority=useRef(createProfileMotionAuthority());
 const inputOwnership=useRef(new GestureArbiter());
 const gesture=useRef<Gesture|null>(null);
 const suspendBrowse=useRef<()=>void>(()=>{});
 const clickBlockUntil=useRef(0);
 const browseMotion=useRef(new MotionController("browse",{
  frame:cb=>requestAnimationFrame(cb),cancelFrame:id=>cancelAnimationFrame(id)
 }));
 const browseSettle=useRef<{token:MotionToken;target:number}|null>(null);
 const browsePosition=useRef(0);
 const ensureBrowseMotion=()=>{
  if(browseMotion.current.snapshot().disposed)
   browseMotion.current=new MotionController("browse",{
    frame:cb=>requestAnimationFrame(cb),cancelFrame:id=>cancelAnimationFrame(id)
   },browsePosition.current);
  return browseMotion.current;
 };
 const header=useRef<HeaderMotion>(null);
 const scrollPositions=useRef({"for-you":0,nearby:0});
 const visitorBackRef=useRef<(()=>boolean)|null>(null),profileBackRef=useRef<(()=>boolean)|null>(null);
 const registerVisitorBack=useCallback((fn:(()=>boolean)|null)=>{visitorBackRef.current=fn;},[]);
 const registerProfileBack=useCallback((fn:(()=>boolean)|null)=>{profileBackRef.current=fn;},[]);
 const onScrollTop=useCallback((tab:BrowseTab,top:number)=>{
  if(tab==="feed")return;
  scrollPositions.current[tab]=top;
  if(mainTab==="discover"&&browse===tab&&!person)header.current?.setScrollTop(top);
 },[mainTab,browse,person]);
 useLayoutEffect(()=>{
  if(mainTab==="profile"||person)return;
  header.current?.reset();
  if(mainTab==="discover"&&browse!=="feed")header.current?.setScrollTop(scrollPositions.current[browse]);
 },[mainTab,browse,person]);
 const owner=useMemo(()=>publishedToMaster(publishedProfile,ownerPhotoPreview),[publishedProfile,ownerPhotoPreview]);
 const selectTab=(index:number)=>{
  const bounded=Math.max(0,Math.min(tabs.length-1,index));
  if(tabs[bounded][0]===browse)return;
  setBrowse(tabs[bounded][0]);
  selectionHaptic();
 };
 // One fractional coordinate drives the browse track and its underline.
 const paintBrowse=(trackX:number,inkX:number)=>{
  motionAuthority.current.run("browse",PROFILE_MOTION_WRITER_TABLE.browse,()=>{
   pageTrack.current?.style.setProperty("--luemi-tab-offset","0px");
   pageTrack.current?.style.setProperty("--luemi-drag",trackX+"px");
   underline.current?.style.setProperty("--luemi-tab-offset","0px");
   underline.current?.style.setProperty("--luemi-underline-drag",inkX+"px");
  });
 };
 const frozenBrowse=()=>{
  ensureBrowseMotion();
  const width=pages.current?.clientWidth||window.innerWidth;
  // Both CSS transitions can have different in-flight matrix values.
  const trackX=computedTranslation(pageTrack.current),inkX=computedTranslation(underline.current);
  const fraction=fractionalTrack(pageTrack.current,width,browsePosition.current);
  const old=browseSettle.current;
  if(old){browseMotion.current.interrupt(old.token,"interrupted");browseSettle.current=null;}
  if(pagerSettleTimer.current!==null){clearTimeout(pagerSettleTimer.current);pagerSettleTimer.current=null;}
  pageTrack.current?.classList.remove("is-settling");
  underline.current?.classList.remove("is-settling");
  pageTrack.current?.classList.add("is-finger-tracking");
  underline.current?.classList.add("is-finger-tracking");
  paintBrowse(trackX,inkX);
  browsePosition.current=fraction;
  return {width,fraction,trackX,inkX};
 };
 const finishPagerSettle=(token:MotionToken|null=browseSettle.current?.token??null)=>{
  const current=browseSettle.current;
  if(!current||!token||!browseMotion.current.owns(token))return;
  const width=pages.current?.clientWidth||1;
  if(Math.abs(computedTranslation(pageTrack.current)+current.target*width)>1)return;
  if(!browseMotion.current.finish(token,{paint:()=>{
   motionAuthority.current.run("browse",PROFILE_MOTION_WRITER_TABLE.browse,()=>{
    pageTrack.current?.style.setProperty("--luemi-tab-offset",(-current.target*100)+"%");
    underline.current?.style.setProperty("--luemi-tab-offset",(current.target*100)+"%");
    pageTrack.current?.style.setProperty("--luemi-drag","0px");
    underline.current?.style.setProperty("--luemi-underline-drag","0px");
   });
  },onCommit:()=>{
   browsePosition.current=current.target;
   pageTrack.current?.classList.remove("is-settling");
   underline.current?.classList.remove("is-settling");
   browseSettle.current=null;
   if(pagerSettleTimer.current!==null)clearTimeout(pagerSettleTimer.current);
   pagerSettleTimer.current=null;
   // Keep React reconciliation, inert changes and Nearby activation out of
   // the moving frame. The track/indicator have already reached the target.
   selectTab(current.target);
  }}))return;
 };
 const settleDrag=(targetIndex:number,token:MotionToken|null=null)=>{
  const target=Math.max(0,Math.min(tabs.length-1,targetIndex));
  // Freeze at the last visible matrix, including button/dot navigation mid-settle.
  if(!token)frozenBrowse();
  const c=browseMotion.current;
  if(!token){
   token=c.begin(browsePosition.current);
   if(!token)return;
   c.claim(token);
  }
  if(!c.settle(token,target))return;
  browseSettle.current={token,target};
  pageTrack.current?.classList.add("is-settling");
  underline.current?.classList.add("is-settling");
  // Flush one frozen frame BEFORE re-enabling original CSS transitions.
  void pageTrack.current?.offsetWidth;
  pageTrack.current?.classList.remove("is-finger-tracking");
  underline.current?.classList.remove("is-finger-tracking");
  motionAuthority.current.run("browse",PROFILE_MOTION_WRITER_TABLE.browse,()=>{
   pageTrack.current?.style.setProperty("--luemi-tab-offset",(-target*100)+"%");
   underline.current?.style.setProperty("--luemi-tab-offset",(target*100)+"%");
   pageTrack.current?.style.setProperty("--luemi-drag","0px");
   underline.current?.style.setProperty("--luemi-underline-drag","0px");
  });
  // Original transitionend remains primary. Fallback commits once only.
  pagerSettleTimer.current=window.setTimeout(()=>{
   // At >300ms the browser should have painted the terminal matrix.
   // A delayed transition has another frame to finish, never a stale commit.
   if(browseSettle.current?.token===token){
    if(Math.abs(computedTranslation(pageTrack.current)+target*(pages.current?.clientWidth||1))>1){
     pagerSettleTimer.current=window.setTimeout(()=>finishPagerSettle(token),80);
    }else finishPagerSettle(token);
   }
  },380);
 };
 const requestBrowseTab=(i:number)=>{
  if(gesture.current?.tracking)return;
  settleDrag(i);
 };
 useEffect(()=>()=>{inputOwnership.current.dispose();browseMotion.current.dispose();
  if(pagerSettleTimer.current!==null)window.clearTimeout(pagerSettleTimer.current);
 },[]);
 const down=(event:BrowseInput,kind:InputKind="pointer")=>{
  ensureBrowseMotion();
  if(event.isPrimary===false){inputOwnership.current.secondFinger();cancelSwipe();return;}
  if(event.pointerType==="mouse"&&event.button!==0)return;
  const target=event.target instanceof Element?event.target:null;
  if(!target)return;
  if(target.closest("[role=dialog],.discovery-filter-sheet,.fy-rail,.fy-expanded,.fy-manage"))return;
  const feedCard=target.closest<HTMLElement>(".feed-v2-card");
  // The photo recognizer owns the entire carousel surface. A parent candidate
  // there races with photo pointer capture on Android touch sequences.
  if(target.closest(".feed-v2-photo .carousel-frame"))return;
  const interactive=target.closest("button,a,input,textarea,select,[contenteditable]");
  // Browse touch starts can land on a ForYou/Nearby tile button after a
  // scroller layout tick. A TAP is still handled by its native onClick; only
  // an axis-confirmed horizontal DRAG claims the pager and suppresses click.
  // Keep modal controls, rails, edit fields and other custom gestures isolated.
  const tileSwipe=!!interactive?.matches("button")&&
    !!interactive.closest(".fy-scroll,.nb-scroll")&&
    !interactive.closest(".fy-rail,.fy-expanded,.fy-manage,.discovery-action");
  if(interactive&&!tileSwipe&&
     !interactive.matches(".discovery-name-button,.feed-v2-expand,.discovery-top-tabs [role=tab]"))return;
  if(event.clientX-(pages.current?.getBoundingClientRect().left??0)<26)return;
  // The details subtree owns text gestures even when it reaches above the
  // old cutoff. The carousel consumes in-range photo swipes in capture;
  // a swipe past the final photo can pass through to this pager.
  if(feedCard){const rect=feedCard.getBoundingClientRect();
   if(!target.closest(".feed-v2-details,.feed-v2-photo .carousel-frame")&&
     cardGestureZone(event.clientY,rect.top,rect.height)!=="browse")return;}
  const serial=inputOwnership.current.begin(kind,event.pointerId,"browse");
  if(serial===null)return;
  inputOwnership.current.begin(kind,event.pointerId,"native");
  gesture.current={id:event.pointerId,kind,x:event.clientX,y:event.clientY,
   started:performance.now(),tracking:false,index:index,
   width:pages.current?.clientWidth||window.innerWidth,serial,token:null,
   originTrack:0,originInk:0,lastX:event.clientX};
 };
 const move=(event:BrowseInput,kind:InputKind="pointer")=>{
  const g=gesture.current;if(!g||g.kind!==kind||g.id!==event.pointerId||g.native)return;
  let x=event.clientX-g.x;const y=event.clientY-g.y;
  g.lastX=event.clientX;
  if(!g.tracking){
   if(Math.abs(y)>12&&Math.abs(y)>Math.abs(x)){
    inputOwnership.current.nativeScroll(g.serial);g.native=true;return;
   }
   if(Math.abs(x)<6||Math.abs(x)<Math.abs(y)*1.2)return;
   // Axis direction above already distinguished native pan-y from browse pan-x.
   // A resting scrollTop > 0 must NOT disable horizontal swipes for the entire
   // ForYou/Nearby scroller. Native vertical motion retains exclusive ownership.
   if(!event.cancelable){
    inputOwnership.current.nativeScroll(g.serial);g.native=true;return;
   }
   if(!inputOwnership.current.claim("browse",g.serial))return;
   const frozen=frozenBrowse();
   g.tracking=true;g.width=frozen.width;g.index=frozen.fraction;
   g.originTrack=frozen.trackX;g.originInk=frozen.inkX;
   // The axis threshold is a recognition phase, not movement of the track.
   // Start from the visible frame when ownership is claimed.
   g.x=event.clientX;g.started=performance.now();x=0;
   g.token=browseMotion.current.begin(g.index);
   if(g.token)browseMotion.current.claim(g.token);
   if(kind==="pointer")try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* older WebView */}
  }
  if(!g.token||!inputOwnership.current.owns("browse",g.serial))return;
  if(event.cancelable)event.preventDefault();
  const limited=(g.index<=.001&&x>0)||(g.index>=tabs.length-1-.001&&x<0);
  const shift=limited?x*.22:Math.max(-g.width,Math.min(g.width,x));
  const trackX=g.originTrack+shift,inkX=g.originInk-shift/3;
  // Coalesced one RAF with generation guard; no React renders during move.
  browseMotion.current.schedulePaint(g.token,trackX,()=>paintBrowse(trackX,inkX));
 };
 const up=(event:BrowseInput,cancel=false,kind:InputKind="pointer")=>{
  const g=gesture.current;if(!g||g.kind!==kind||g.id!==event.pointerId)return;
  gesture.current=null;
  if(!g.tracking||!g.token){
   if(g.native)inputOwnership.current.finish("native",g.serial);
   else {
    // Release only this component's candidates. Another recognizer may still
    // process its native touchend after the synthetic pointerup.
    inputOwnership.current.finishCandidate(g.serial,"browse");
    inputOwnership.current.finishCandidate(g.serial,"native");
   }
   return;
  }
  if(!inputOwnership.current.finish("browse",g.serial))return;
  if(kind==="pointer")try{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}catch{/* implicit release */}
  const x=event.clientX-g.x,elapsed=Math.max(1,performance.now()-g.started);
  const velocity=Math.abs(x)/elapsed;
  const rawTarget=!cancel&&(Math.abs(x)>g.width*.18||velocity>.55)
   ?Math.round(g.index)+(x<0?1:-1):Math.round(g.index);
  const target=Math.max(0,Math.min(tabs.length-1,rawTarget));
  clickBlockUntil.current=performance.now()+260;
  // Flush the release position before cancelling a pending finger RAF. The
  // CSS settle now starts at the actual final pointer location, not an older
  // composited frame.
  const limited=(g.index<=.001&&x>0)||(g.index>=tabs.length-1-.001&&x<0);
  const shift=limited?x*.22:Math.max(-g.width,Math.min(g.width,x));
  browseMotion.current.paint(g.token,g.originTrack+shift,
   ()=>paintBrowse(g.originTrack+shift,g.originInk-shift/3));
  settleDrag(target,g.token);
 };
 const cancelSwipe=()=>{const g=gesture.current;gesture.current=null;
  if(!g)return;
  inputOwnership.current.cancel();
  if(g.tracking){
   if(g.token)browseMotion.current.cancel(g.token,"gesture-cancel");
   settleDrag(index);
  }
 };
 // Android WebView can cancel Pointer Events as soon as its native pan recognizer
 // takes over. A non-passive touchmove recognizes horizontal intent on the same
 // surface and prevents only that gesture; vertical scrolling stays native.
 useEffect(()=>{
  const surfaces=[pages.current,topTabsSurface.current].filter((node):node is HTMLDivElement=>!!node);
  const input=(touch:Touch,event:TouchEvent,el:HTMLElement):BrowseInput=>({
   pointerId:touch.identifier,clientX:touch.clientX,clientY:touch.clientY,
   target:event.target,currentTarget:el,cancelable:event.cancelable,
   preventDefault:()=>event.preventDefault(),isPrimary:true,pointerType:"touch"
  });
  const cleanups=surfaces.map(el=>{
   const start=(event:TouchEvent)=>{
    if(event.touches.length!==1){cancelSwipe();return;}
    down(input(event.changedTouches[0],event,el),"touch");
   };
   const track=(event:TouchEvent)=>{
    if(event.touches.length!==1){cancelSwipe();return;}
    move(input(event.touches[0],event,el),"touch");
   };
   const end=(event:TouchEvent)=>{
    for(const touch of Array.from(event.changedTouches))up(input(touch,event,el),false,"touch");
   };
   const cancel=(event:TouchEvent)=>{
    for(const touch of Array.from(event.changedTouches))up(input(touch,event,el),true,"touch");
   };
   el.addEventListener("touchstart",start,{passive:true});
   el.addEventListener("touchmove",track,{passive:false});
   el.addEventListener("touchend",end,{passive:true});
   el.addEventListener("touchcancel",cancel,{passive:true});
   return ()=>{el.removeEventListener("touchstart",start);el.removeEventListener("touchmove",track);
    el.removeEventListener("touchend",end);el.removeEventListener("touchcancel",cancel);};
  });
  return ()=>cleanups.forEach(cleanup=>cleanup());
 });
 suspendBrowse.current=()=>{
  cancelSwipe();
  const pending=browseSettle.current;
  if(!pending)return;
  browseMotion.current.cancel(pending.token,"external");browseSettle.current=null;
  if(pagerSettleTimer.current!==null)clearTimeout(pagerSettleTimer.current);
  pagerSettleTimer.current=null;
  pageTrack.current?.classList.remove("is-finger-tracking","is-settling");
  underline.current?.classList.remove("is-finger-tracking","is-settling");
  pageTrack.current?.classList.add("is-finger-tracking");
  underline.current?.classList.add("is-finger-tracking");
  motionAuthority.current.run("browse",PROFILE_MOTION_WRITER_TABLE.browse,()=>{
   pageTrack.current?.style.setProperty("--luemi-tab-offset",(-index*100)+"%");
   pageTrack.current?.style.setProperty("--luemi-drag","0px");
   underline.current?.style.setProperty("--luemi-tab-offset",(index*100)+"%");
   underline.current?.style.setProperty("--luemi-underline-drag","0px");
  });
  void pageTrack.current?.offsetWidth;
  pageTrack.current?.classList.remove("is-finger-tracking");
  underline.current?.classList.remove("is-finger-tracking");
  browsePosition.current=index;
 };
 useEffect(()=>{
  const stop=()=>suspendBrowse.current();
  const hidden=()=>{if(document.hidden)stop();};
  window.addEventListener("blur",stop);document.addEventListener("visibilitychange",hidden);
  return ()=>{window.removeEventListener("blur",stop);document.removeEventListener("visibilitychange",hidden);};
 },[]);

 useEffect(()=>{if(mainTab!=="discover"||person||accountOpen)suspendBrowse.current();},[mainTab,person,accountOpen]);
 const backRef=useRef<()=>void>(()=>{});
 backRef.current=()=>{
  if(person){if(visitorBackRef.current?.())return;setPerson(null);return;}
  if(accountOpen){setAccountOpen(false);return;}
  if(mainTab==="profile"&&profileBackRef.current?.())return;
  if(mainTab!=="discover"){setMainTab("discover");return;}
  if(browse!=="feed"){requestBrowseTab(0);return;}
 };
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==="Escape")backRef.current();};
  window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);},[]);
 return <section className="discovery-app real-discovery-home"
  data-profile-renderer={androidWebView?"android":"standard"} data-profile-mode={mainTab==="profile"||!!person?"true":"false"}>
  <div className="discovery-ambient" aria-hidden="true"/>
  <GlobalHeader ref={header} mode={mainTab==="profile"?"profile":"browse"} theme={theme} onTheme={onTheme}
   onFilters={()=>{setMainTab("discover");requestBrowseTab(1);}} onSaved={()=>setMainTab("likes")}/>
  <div className="discovery-main-panels">
   <section className="discovery-panel discovery-browse-panel" hidden={mainTab!=="discover"}>
    <div className="discovery-top-tabs" ref={topTabsSurface} role="tablist" aria-label="Разделы знакомств"
     onKeyDown={e=>{const next=e.key==="ArrowRight"?Math.min(2,index+1):
      e.key==="ArrowLeft"?Math.max(0,index-1):e.key==="Home"?0:e.key==="End"?2:-1;
      if(next<0)return;e.preventDefault();requestBrowseTab(next);}}
     onPointerDown={e=>{if(e.pointerType!=="touch")down(e);}}
     onPointerMove={e=>{if(e.pointerType!=="touch")move(e);}}
     onPointerUp={e=>{if(e.pointerType!=="touch")up(e);}}
     onPointerCancel={e=>{if(e.pointerType!=="touch")up(e,true);}}
     onLostPointerCapture={e=>{if(e.pointerType!=="touch")up(e,true);}}>
     {tabs.map(([id,label],i)=><button key={id} type="button" role="tab" className={browse===id?"active":""}
      aria-selected={browse===id} tabIndex={browse===id?0:-1}
      onClick={()=>{if(performance.now()>=clickBlockUntil.current)requestBrowseTab(i);}}>{label}</button>)}
     <span className="discovery-tab-underline" ref={underline} aria-hidden="true"
      style={{"--luemi-tab-offset":index*100+"%"} as CSSProperties}/>
    </div>
    <div className="discovery-pages" ref={pages}
     onPointerDown={e=>{if(e.pointerType!=="touch")down(e);}}
     onPointerMove={e=>{if(e.pointerType!=="touch")move(e);}}
     onPointerUp={e=>{if(e.pointerType!=="touch")up(e);}}
     onPointerCancel={e=>{if(e.pointerType!=="touch")up(e,true);}}
     onLostPointerCapture={e=>{if(e.pointerType!=="touch")cancelSwipe();}}
     onClickCapture={e=>{if(performance.now()<clickBlockUntil.current){e.preventDefault();e.stopPropagation();}}}>
     <div className="discovery-page-track" ref={pageTrack}
      onTransitionEnd={e=>{if(e.target===e.currentTarget&&e.propertyName==="transform")finishPagerSettle();}}
      style={{"--luemi-tab-offset":(-index*100)+"%"} as CSSProperties}>
      {tabs.map(([id,label])=><section key={id} className="discovery-page" role="tabpanel" aria-label={label}
       aria-hidden={browse!==id} inert={browse!==id}>
       <LiveDeck active={mainTab==="discover"&&browse===id} tab={id} draft={draft}
        initialFeed={initialFeed} saved={savedIds} onSave={onSave}
        onScrollTop={top=>onScrollTop(id,top)}
        onEditLocation={()=>setMainTab("profile")}
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
      registerBack={registerProfileBack}
      onMotionProgress={(progress,dragging)=>header.current?.setProfileProgress(progress,dragging)}
      active={mainTab==="profile"&&!person}/>:<div className="discovery-empty">
      <UserRound size={37}/><h2>Анкета готовится</h2>
      <p>Заверши публикацию, чтобы увидеть свой профиль.</p>
      <button type="button" className="discovery-glass-button" onClick={()=>setAccountOpen(true)}>Открыть настройки</button>
     </div>}
    <button type="button" className="real-discovery-settings" aria-label="Настройки аккаунта" title="Настройки аккаунта"
     onClick={()=>setAccountOpen(true)}><Settings2 size={20}/></button>
   </section>
  </div>
  {person&&<VisitorProfileRoute key={person.id} data={visitorToMaster(person)} theme={theme} onTheme={onTheme}
   onExit={()=>setPerson(null)} registerBack={registerVisitorBack}/>}
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
