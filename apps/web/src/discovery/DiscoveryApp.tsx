import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import type {CSSProperties} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {X,Heart,Undo2,Images,MessagesSquare,UserRound,ArrowRight,Layers3} from "lucide-react";
import type {RegistrationDraft} from "../registration/model";
import {FeedCard} from "./FeedCard";
import {demoPeople} from "./demo-people";
import {forYouDemoPeople} from "./for-you-data";
import type {CollectionId} from "./for-you-ranking";
import {ForYou} from "./ForYou";
import {Nearby} from "./Nearby";
import {demoAct,demoUndo,filterDemoPeople,freshDemoState,defaultFilters} from "./model";
import type {MainTab,DiscoveryTab,DemoKind,DiscoveryFilter} from "./model";
import {DiscoveryFilters} from "./Filters";
import {DiscoveryInterestsSheet} from "./InterestsSheet";
import {ProfileMaster} from "./ProfileMaster";
import {GlobalHeader} from "./GlobalHeader";
import type {HeaderMotion} from "./GlobalHeader";
import {fromDemoPerson,fromLocalDraft} from "./ProfileModel";
import "./discovery.css";

const navigation=[["discover","Знакомства",Images],["likes","Симпатии",Heart],["chats","Чаты",MessagesSquare],["profile","Профиль",UserRound]] as const;
const topTabs=[["feed","Лента"],["for-you","Для тебя"],["nearby","Рядом"]] as const;

type Gesture={id:number;x:number;y:number;started:number;tracking:boolean;index:number;width:number};
function Placeholder({title,text}:{title:string;text:string}){
 return <div className="discovery-placeholder"><Layers3 size={35} strokeWidth={1.4}/>
 <h2>{title}</h2><p>{text}</p><span>Следующий этап LUEMI</span></div>;
}
function EmptyFeed({hasProfiles,canUndo,onUndo,onRestart}:{hasProfiles:boolean;canUndo:boolean;
 onUndo:()=>void;onRestart:()=>void}){
 return <div className="discovery-empty discovery-deck-finish">
   <Heart size={38}/><h2>{hasProfiles?"Все демо-анкеты просмотрены":"Подходящих демо-анкет нет"}</h2>
   <p>Это тестовые персонажи, а не реальные пользователи.</p>
   {canUndo&&<button type="button" className="discovery-glass-button" onClick={onUndo}>
     <Undo2 size={16}/> Отменить
   </button>}
   <button type="button" className="discovery-glass-button" onClick={onRestart}>Начать заново</button>
 </div>;
}
interface Props {draft:RegistrationDraft;photos:ReadonlyArray<{id:string;src:string}>;theme:"light"|"dark";onTheme:()=>void;onExit:()=>void;registerBack:(handler:()=>void)=>void}

export function DiscoveryApp({draft,photos,theme,onTheme,onExit,registerBack}:Props){
 const [mainTab,setMainTab]=useState<MainTab>("discover");
 const [profilePrepared,setProfilePrepared]=useState(false);
 const visitorBackRef=useRef<(()=>boolean)|null>(null);
 const registerVisitorBack=useCallback((handler:(()=>boolean)|null)=>{visitorBackRef.current=handler;},[]);
 const profileBackRef=useRef<(()=>boolean)|null>(null);
 const registerProfileBack=useCallback((handler:(()=>boolean)|null)=>{profileBackRef.current=handler;},[]);
 const ownProfile=useMemo(()=>fromLocalDraft(draft,photos),[draft,photos]);
 const [discoveryTab,setDiscoveryTab]=useState<DiscoveryTab>("feed");
 // Prepare Nearby when For You becomes current or Nearby is selected; keep it mounted thereafter.
 const [nearbyPrepared,setNearbyPrepared]=useState(false);
 // Prewarm Nearby only after For You's first pager transition, during an idle
 // interval. A direct first visit to Nearby still mounts synchronously.
 useEffect(()=>{
  if(nearbyPrepared||discoveryTab!=="for-you"||mainTab!=="discover")return;
  let cancelled=false;
  let idleId:number|null=null;
  const timer=window.setTimeout(()=>{
   if("requestIdleCallback" in window){
    idleId=window.requestIdleCallback(()=>{
     if(!cancelled)setNearbyPrepared(true);
    },{timeout:1800});
   }else if(!cancelled)setNearbyPrepared(true);
  },450);
  return ()=>{
   cancelled=true;window.clearTimeout(timer);
   if(idleId!==null&&"cancelIdleCallback" in window)window.cancelIdleCallback(idleId);
  };
 },[nearbyPrepared,discoveryTab,mainTab]);
 const gesture=useRef<Gesture|null>(null);
 const clickBlockUntil=useRef(0);
 const pages=useRef<HTMLDivElement>(null);
 const pageTrack=useRef<HTMLDivElement>(null);
 const underline=useRef<HTMLSpanElement>(null);
 const swipeFrame=useRef<number|null>(null);
 const pagerSettleTimer=useRef<number|null>(null);
 const [filters,setFilters]=useState<DiscoveryFilter>(defaultFilters);
 const [filterOpen,setFilterOpen]=useState(false);
 const [savedOpen,setSavedOpen]=useState(false);
 const [personOpen,setPersonOpen]=useState<string|null>(null);
 const [interestOpen,setInterestOpen]=useState<string|null>(null);
 const [forYouCollection,setForYouCollection]=useState<CollectionId|"best"|null>(null);
 const [forYouSettings,setForYouSettings]=useState(false);
 const [leaving,setLeaving]=useState<string|null>(null);
 const transitionRef=useRef<number|null>(null);
 const pendingCommit=useRef<(()=>void)|null>(null);
 const locked=useRef(false);
 const [feed,setFeed]=useState(freshDemoState);
 const [announcement,setAnnouncement]=useState("");
 const profiles=useMemo(()=>filterDemoPeople(demoPeople,filters,draft),[filters,draft]);
 const ids=useMemo(()=>profiles.map(p=>p.id),[profiles]);
 const person=profiles[feed.index];
 const selectedPerson=forYouDemoPeople.find(p=>p.id===personOpen);
 const globalHeader=useRef<HeaderMotion>(null);
 const reportProfileMotion=useCallback((progress:number,dragging:boolean)=>globalHeader.current?.setProfileProgress(progress,dragging),[]);
 const profileMode=mainTab==="profile"||!!selectedPerson;
 const savedScroll=useRef({"for-you":0,nearby:0});
 const reportForYouScroll=useCallback((top:number)=>{
   savedScroll.current["for-you"]=top;
   if(mainTab==="discover"&&discoveryTab==="for-you"&&!personOpen)globalHeader.current?.setScrollTop(top);
 },[mainTab,discoveryTab,personOpen]);
 const reportNearbyScroll=useCallback((top:number)=>{
   savedScroll.current.nearby=top;
   if(mainTab==="discover"&&discoveryTab==="nearby"&&!personOpen)globalHeader.current?.setScrollTop(top);
 },[mainTab,discoveryTab,personOpen]);
 useEffect(()=>{
   // The active profile paints its own scroll progress; resetting the header
   // after child effects would flash the contrast shadow to zero on return.
   if(profileMode)return;
   globalHeader.current?.reset();
   if(mainTab==="discover"&&!personOpen){
     globalHeader.current?.setScrollTop(discoveryTab==="for-you"?savedScroll.current["for-you"]:
       discoveryTab==="nearby"?savedScroll.current.nearby:0);
   }
 },[mainTab,discoveryTab,personOpen,profileMode]);
 const tabIndex=topTabs.findIndex(x=>x[0]===discoveryTab);

 const indicate=useCallback((message:string)=>{setAnnouncement(message);},[]);
 // Commit only after the outgoing full card completes its own animation.
 // Timeout is a safety fallback for backgrounded or reduced-motion WebViews.
 const finishDeck=useCallback(()=>{
   const commit=pendingCommit.current;
   if(!commit)return;
   pendingCommit.current=null;
   if(transitionRef.current!==null)window.clearTimeout(transitionRef.current);
   transitionRef.current=null;
   commit();
 },[]);
 useEffect(()=>()=>{if(transitionRef.current!==null)window.clearTimeout(transitionRef.current);pendingCommit.current=null;},[]);
 const leave=useCallback(()=>{
  if(personOpen&&visitorBackRef.current?.())return;
  if(mainTab==="profile"&&profileBackRef.current?.())return;
  if(personOpen){setPersonOpen(null);return;}
  if(interestOpen){setInterestOpen(null);return;}
  if(forYouSettings){setForYouSettings(false);return;}
  if(forYouCollection){setForYouCollection(null);return;}
  if(filterOpen){setFilterOpen(false);return;}
  if(savedOpen){setSavedOpen(false);return;}
  if(mainTab!=="discover"){if(locked.current)finishDeck();setMainTab("discover");return;}
  if(discoveryTab!=="feed"){setDiscoveryTab("feed");return;}
  onExit();
 },[personOpen,interestOpen,forYouSettings,forYouCollection,filterOpen,savedOpen,mainTab,discoveryTab,onExit,finishDeck]);
 useEffect(()=>{registerBack(leave);},[leave,registerBack]);
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{if(event.key==="Escape")leave();};
  window.addEventListener("keydown",key);return ()=>window.removeEventListener("keydown",key);
 },[leave]);

 const act=(kind:DemoKind|"undo")=>{
  if(locked.current)return;
  if(kind==="undo"){
    if(!feed.history.length)return;
    setFeed(prev=>demoUndo(prev));indicate("Действие отменено · демо");return;
  }
  if(!person)return;
  if(kind==="save"){
    const wasSaved=feed.saved.includes(person.id);
    setFeed(prev=>demoAct(prev,ids,kind));
    indicate(wasSaved?"Убрано из сохранённых · демо":"Сохранено · демо");
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();return;
  }
  // Both full cards, including name, photo, interests and actions, already exist
  // in the same keyed deck before motion begins. This prevents the photo-only flash.
  locked.current=true;
  setLeaving(person.id);
  window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
  const message=kind==="pass"?"Анкета пропущена · демо":
    kind==="like"?"Симпатия · никому не отправлена":"Особенная симпатия · только демо";
  pendingCommit.current=()=>{
    setFeed(prev=>demoAct(prev,ids,kind));
    setLeaving(null);
    locked.current=false;
    indicate(message);
  };
  transitionRef.current=window.setTimeout(finishDeck,440);
 };
 const selectTab=(index:number)=>{
  const bounded=Math.max(0,Math.min(topTabs.length-1,index));
  if(topTabs[bounded][0]===discoveryTab)return;
  if(bounded===2)setNearbyPrepared(true);
  setDiscoveryTab(topTabs[bounded][0]);
  window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
 };
 // Pointer movement updates only CSS compositor variables in one animation frame.
 // React must not render all profile cards on every move.
 const paintDrag=(value:number)=>{
  pageTrack.current?.style.setProperty("--luemi-drag",value+"px");
  underline.current?.style.setProperty("--luemi-underline-drag",(-value/3)+"px");
 };
 const flushDrag=()=>{
  if(swipeFrame.current!==null){window.cancelAnimationFrame(swipeFrame.current);swipeFrame.current=null;}
 };
 const finishPagerSettle=()=>{
  if(pagerSettleTimer.current!==null){window.clearTimeout(pagerSettleTimer.current);pagerSettleTimer.current=null;}
  pageTrack.current?.classList.remove("is-settling");
  underline.current?.classList.remove("is-settling");
 };
 // Commit final transform and underline offset in the same JS event before
 // React changes the active tab. Do not animate back to the old index first.
 const settleDrag=(targetIndex:number)=>{
  flushDrag();
  if(pagerSettleTimer.current!==null)window.clearTimeout(pagerSettleTimer.current);
  pageTrack.current?.classList.add("is-settling");
  underline.current?.classList.add("is-settling");
  pageTrack.current?.classList.remove("is-finger-tracking");
  underline.current?.classList.remove("is-finger-tracking");
  pageTrack.current?.style.setProperty("--luemi-tab-offset",(-targetIndex*100)+"%");
  underline.current?.style.setProperty("--luemi-tab-offset",(targetIndex*100)+"%");
  paintDrag(0);
  // transitionend is primary; this only frees the layer if WebView drops the event.
  pagerSettleTimer.current=window.setTimeout(finishPagerSettle,380);
 };
 useEffect(()=>()=>{flushDrag();
  if(pagerSettleTimer.current!==null)window.clearTimeout(pagerSettleTimer.current);
 },[]);
 const down=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(event.pointerType==="mouse"&&event.button!==0)return;
  if((event.target as HTMLElement).closest(".discovery-photo,.carousel-frame,.discovery-action,[role=dialog],.discovery-filter-sheet,.fy-rail,.fy-expanded,.fy-manage,.nb-card,.nb-location"))return;
  gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,started:performance.now(),tracking:false,index:tabIndex,
   width:pages.current?.clientWidth||window.innerWidth};
 };
 const move=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const g=gesture.current;if(!g||g.id!==event.pointerId)return;
  const x=event.clientX-g.x,y=event.clientY-g.y;
  if(!g.tracking){
    if(Math.abs(y)>12&&Math.abs(y)>Math.abs(x)){gesture.current=null;return;}
    if(Math.abs(x)<6||Math.abs(x)<Math.abs(y)*1.2)return;
    g.tracking=true;
    pageTrack.current?.classList.add("is-finger-tracking");
    underline.current?.classList.add("is-finger-tracking");
    try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* older Telegram WebView */}
  }
  if(event.cancelable)event.preventDefault();
  const width=g.width;
  const limited=(g.index===0&&x>0)||(g.index===2&&x<0);
  const shift=limited?x*.22:Math.max(-width,Math.min(width,x));
  flushDrag();
  swipeFrame.current=window.requestAnimationFrame(()=>{swipeFrame.current=null;paintDrag(shift);});
 };
 const up=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const g=gesture.current;if(!g||g.id!==event.pointerId)return;
  gesture.current=null;
  if(!g.tracking)return;
  const x=event.clientX-g.x,elapsed=Math.max(1,performance.now()-g.started);
  const velocity=Math.abs(x)/elapsed;
  const rawTarget=Math.abs(x)>g.width*.18||velocity>.55
    ?g.index+(x<0?1:-1):g.index;
  const target=Math.max(0,Math.min(topTabs.length-1,rawTarget));
  clickBlockUntil.current=performance.now()+260;
  settleDrag(target);
  if(target!==g.index)selectTab(target);
 };
 const cancelSwipe=()=>{
  const g=gesture.current;gesture.current=null;
  if(g?.tracking)settleDrag(g.index);
 };
 const apply=(next:DiscoveryFilter)=>{
  if(transitionRef.current!==null)window.clearTimeout(transitionRef.current);
  transitionRef.current=null;pendingCommit.current=null;locked.current=false;setLeaving(null);
  setFilters(next);setFeed(prev=>({...freshDemoState(),saved:prev.saved}));setFilterOpen(false);
  indicate("Фильтры применены к демо-анкетам");
 };
 const openSaved=()=>{setSavedOpen(true);setFilterOpen(false);};
 const openNearbyFilters=useCallback(()=>setFilterOpen(true),[]);
 const savedRef=useRef(feed.saved);
 savedRef.current=feed.saved;
 const toggleForYouSave=useCallback((id:string)=>{
  if(!forYouDemoPeople.some(p=>p.id===id))return;
  // A stable callback lets unchanged memoized For You/Nearby tiles stay mounted.
  // Update the ref immediately so two rapid taps use the latest bookmark state.
  const wasSaved=savedRef.current.includes(id);
  savedRef.current=wasSaved?savedRef.current.filter(value=>value!==id):[...savedRef.current,id];
  setFeed(prev=>({...prev,saved:prev.saved.includes(id)?prev.saved.filter(value=>value!==id):[...prev.saved,id]}));
  indicate(wasSaved?"Убрано из сохранённых · демо":"Сохранено · демо");
  window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
 },[indicate]);
 const selectMainTab=(tab:MainTab)=>{
  if(tab===mainTab)return;
  // End an in-flight Deck Lift in the same React batch before hiding Feed.
  if(locked.current)finishDeck();
  if(tab==="profile")setProfilePrepared(true);
  setMainTab(tab);
 };

 const restartFeed=()=>{
   if(transitionRef.current!==null)window.clearTimeout(transitionRef.current);
   transitionRef.current=null;pendingCommit.current=null;locked.current=false;setLeaving(null);
   setFilters(defaultFilters);setFeed(prev=>({...freshDemoState(),saved:prev.saved}));
   indicate("Демо-Лента начата заново");
 };
 return <div className="discovery-app" data-profile-overlay={selectedPerson?"true":"false"} data-profile-mode={profileMode?"true":"false"}>
   <div className="discovery-ambient" aria-hidden="true"/>
   <GlobalHeader ref={globalHeader} mode={profileMode?"profile":"browse"} theme={theme}
     onTheme={onTheme} onFilters={()=>setFilterOpen(true)} onSaved={openSaved}
    />
   <div className="discovery-main-panels">
     <section className="discovery-panel" hidden={mainTab!=="discover"}>
       <div className="discovery-top-tabs" role="tablist" aria-label="Разделы знакомств"
         onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancelSwipe}>
         {topTabs.map(([value,label],i)=><button type="button" role="tab" key={value}
           aria-selected={discoveryTab===value} onClick={()=>{if(performance.now()>=clickBlockUntil.current)selectTab(i);}}
           className={discoveryTab===value?"active":""}>{label}</button>)}
         <span className="discovery-tab-underline" ref={underline} aria-hidden="true"
           style={{"--luemi-tab-offset":tabIndex*100+"%"} as CSSProperties}/>
       </div>
       <div className="discovery-pages" ref={pages} onPointerDown={down}
         onPointerMove={move} onPointerUp={up} onPointerCancel={cancelSwipe}>
         <div className="discovery-page-track" ref={pageTrack}
           onTransitionEnd={event=>{
             if(event.target===event.currentTarget&&event.propertyName==="transform")finishPagerSettle();
           }}
           style={{"--luemi-tab-offset":(-tabIndex*100)+"%"} as CSSProperties}>
           <section className="discovery-page" role="tabpanel" aria-label="Лента">
             {<div className="discovery-deck-stage">
               {person&&<div key={person.id}
                 className={"discovery-deck-layer"+(leaving?" deck-leaving":" deck-active")}
                 onAnimationEnd={event=>{if(leaving&&event.target===event.currentTarget&&
                   event.animationName==="luemi-deck-leave")finishDeck();}}>
                 <FeedCard person={person} saved={feed.saved.includes(person.id)}
                   canUndo={feed.history.length>0} active={true}
                   onAction={act} onOpenProfile={()=>setPersonOpen(person.id)}
                   onInterests={()=>setInterestOpen(person.id)}/>
               </div>}
               {profiles[feed.index+1]&&<div key={profiles[feed.index+1].id}
                 className={"discovery-deck-layer"+(leaving?" deck-entering":" deck-queued")}>
                 <FeedCard person={profiles[feed.index+1]} saved={feed.saved.includes(profiles[feed.index+1].id)}
                   canUndo={feed.history.length>0} active={false} onAction={act}
                   onOpenProfile={()=>setPersonOpen(profiles[feed.index+1].id)}
                   onInterests={()=>setInterestOpen(profiles[feed.index+1].id)}/>
               </div>}
               {!profiles[feed.index+1]&&<div key="deck-complete"
                 className={"discovery-deck-layer"+(leaving?" deck-entering":person?" deck-queued":" deck-active")}
                 aria-hidden={!!person}>
                 <EmptyFeed hasProfiles={profiles.length>0} canUndo={feed.history.length>0}
                   onUndo={()=>act("undo")} onRestart={restartFeed}/>
               </div>}
             </div>}
           </section>
           <section className="discovery-page" role="tabpanel" aria-label="Для тебя">
             <ForYou draft={draft} filters={filters} saved={feed.saved} onScrollTop={reportForYouScroll} onSave={toggleForYouSave}
               onPerson={setPersonOpen} expanded={forYouCollection} onExpanded={setForYouCollection}
               settingsOpen={forYouSettings} onSettingsOpen={setForYouSettings}/>
           </section>
           <section className="discovery-page" role="tabpanel" aria-label="Рядом">
             {nearbyPrepared&&<Nearby active={mainTab==="discover"&&discoveryTab==="nearby"&&!selectedPerson} draft={draft} filters={filters} saved={feed.saved} onScrollTop={reportNearbyScroll} onSave={toggleForYouSave}
               onPerson={setPersonOpen} onFilters={openNearbyFilters} onEditLocation={onExit}/>}
           </section>
         </div>
       </div>
     </section>
     <section className="discovery-panel" hidden={mainTab!=="likes"}>
       <Placeholder title="Симпатии" text="Настоящие мэтчи и входящие появятся только после безопасного серверного запуска."/>
     </section>
     <section className="discovery-panel" hidden={mainTab!=="chats"}>
       <Placeholder title="Чаты" text="Реальные переписки будут доступны после взаимного мэтча."/>
     </section>
     <section className="discovery-panel discovery-profile-panel" hidden={mainTab!=="profile"}>
       {profilePrepared&&<ProfileMaster data={ownProfile} mode="owner" onEdit={onExit} registerBack={registerProfileBack} active={mainTab==="profile"&&!selectedPerson} onMotionProgress={reportProfileMotion}/>}
     </section>
   {selectedPerson&&<ProfileMaster data={fromDemoPerson(selectedPerson)} mode="visitor" key={selectedPerson.id}
     onClose={()=>setPersonOpen(null)} registerBack={registerVisitorBack} onMotionProgress={reportProfileMotion}/>}
   </div>
   <nav className="discovery-bottom-nav" aria-label="Главная навигация LUEMI">
     {navigation.map(([value,label,Icon])=><button type="button" key={value}
       className={"discovery-nav-item"+(mainTab===value?" active":"")}
       aria-current={mainTab===value?"page":undefined} onClick={()=>selectMainTab(value)}>
       <Icon size={22} strokeWidth={1.75}/><span>{label}</span></button>)}
   </nav>
   <span className="discovery-sr-status" role="status" aria-live="polite">{announcement}</span>
   <DiscoveryFilters open={filterOpen} filter={filters} draft={draft} onClose={()=>setFilterOpen(false)} onApply={apply}/>
   {savedOpen&&<div className="discovery-modal-backdrop" onClick={()=>setSavedOpen(false)}>
     <section className="discovery-saved-sheet" role="dialog" aria-label="Сохранённые демо-анкеты" aria-modal="true"
       onClick={e=>e.stopPropagation()}>
       <header><h2>Сохранённые <span className="discovery-demo-label">Демо</span></h2>
         <button className="discovery-icon-action" type="button" onClick={()=>setSavedOpen(false)} aria-label="Закрыть"><X size={19}/></button>
       </header>
       <div className="discovery-saved-list">
         {feed.saved.length?feed.saved.map(id=>{
           const p=forYouDemoPeople.find(x=>x.id===id);
           return p?<button className="discovery-saved" key={id} type="button" onClick={()=>{setSavedOpen(false);setPersonOpen(id);}}>
             <img src={p.photos[0].src} alt=""/><span>{p.name}, {p.age}</span><ArrowRight size={17}/>
           </button>:null;
         }):<p className="hint">Пока нет сохранённых демо-анкет.</p>}
       </div>
     </section>
   </div>}
   {interestOpen&&(()=>{const p=demoPeople.find(x=>x.id===interestOpen);return p?<DiscoveryInterestsSheet name={p.name} ids={p.interests} onClose={()=>setInterestOpen(null)}/>:null;})()}

 </div>;
}
