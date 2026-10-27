import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from "react";
import {selectionHaptic} from "../ui/haptic";
import type {CSSProperties} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {X,Heart,Undo2,Images,MessagesSquare,UserRound,ArrowRight,Layers3} from "lucide-react";
import type {RegistrationDraft} from "../registration/model";
import {FeedCard} from "./FeedCard";
import {RealChats} from "../chats/RealChats";
import {ChatsPreview} from "../chats/ChatsPreview";
import {cardGestureZone} from "./card-gesture-zone";
import {demoPeople} from "./demo-people";
import {forYouDemoPeople} from "./for-you-data";
import type {CollectionId} from "./for-you-ranking";
import {ForYou} from "./ForYou";
import {Nearby} from "./Nearby";
import {demoAct,demoUndo,filterDemoPeople,freshDemoState,defaultFilters} from "./model";
import type {MainTab,DiscoveryTab,DemoKind,DiscoveryFilter} from "./model";
import {DiscoveryFilters} from "./Filters";
import {DiscoveryInterestsSheet} from "./InterestsSheet";
import {ProfileMaster} from "./ProfileV3Gateway";
import {VisitorProfileRoute} from "./VisitorProfileRoute";
import {GlobalHeader} from "./GlobalHeader";
import {createProfileMotionAuthority,PROFILE_MOTION_WRITER_TABLE} from "./profile-motion";
import {MotionController,type MotionToken} from "../ui/motion-controller";
import {GestureArbiter,computedTranslation,fractionalTrack} from "../ui/gesture-arbiter";
import type {HeaderMotion} from "./GlobalHeader";
import {fromDemoPerson,fromLocalDraft} from "./ProfileModel";
import {QaProfiler} from "./qa-profiler";
import {useModalLayer} from "../ui/modal-layer";
import "./discovery.css";
import "./feed-v2.css";

const navigation=[["discover","Знакомства",Images],["likes","Симпатии",Heart],["chats","Чаты",MessagesSquare],["profile","Профиль",UserRound]] as const;
const topTabs=[["feed","Лента"],["for-you","Для тебя"],["nearby","Рядом"]] as const;
const androidWebView=typeof navigator!=="undefined"&&/Android/i.test(navigator.userAgent);

type Gesture={id:number;x:number;y:number;started:number;tracking:boolean;index:number;width:number;serial:number;token:MotionToken|null;originTrack:number;originInk:number;lastX:number;native?:boolean};
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
 const keyboardBrowseFocus=useRef<number|null>(null);
 const [personOpen,setPersonOpen]=useState<string|null>(null);
 // All three pager children exist before a finger can expose a neighbor.
 // Nearby's inactive observer remains disabled by its active prop.
 const gesture=useRef<Gesture|null>(null);
 const suspendBrowse=useRef<()=>void>(()=>{});
 const clickBlockUntil=useRef(0);
 const pages=useRef<HTMLDivElement>(null);
 const pageTrack=useRef<HTMLDivElement>(null);
 const underline=useRef<HTMLSpanElement>(null);
 const pagerSettleTimer=useRef<number|null>(null);
 const motionAuthority=useRef(createProfileMotionAuthority());
 const inputOwnership=useRef(new GestureArbiter());
 const browseMotion=useRef(new MotionController("browse",{
  frame:cb=>requestAnimationFrame(cb),cancelFrame:id=>cancelAnimationFrame(id)
 }));
 const browseSettle=useRef<{token:MotionToken;target:number}|null>(null);
 const browsePosition=useRef(0);
 // StrictMode invokes provisional effect cleanup; never reuse a disposed
 // controller for the next real interaction.
 const ensureBrowseMotion=()=>{
  if(browseMotion.current.snapshot().disposed)
   browseMotion.current=new MotionController("browse",{
    frame:cb=>requestAnimationFrame(cb),cancelFrame:id=>cancelAnimationFrame(id)
   },browsePosition.current);
  return browseMotion.current;
 };
 const [filters,setFilters]=useState<DiscoveryFilter>(defaultFilters);
 const [filterOpen,setFilterOpen]=useState(false);
 const [savedOpen,setSavedOpen]=useState(false);
 const savedDialog=useRef<HTMLElement>(null);
 useModalLayer(savedOpen,savedDialog,()=>setSavedOpen(false));
 const [interestOpen,setInterestOpen]=useState<string|null>(null);
 const [forYouCollection,setForYouCollection]=useState<CollectionId|"best"|null>(null);
 const [forYouSettings,setForYouSettings]=useState(false);
 const [leaving,setLeaving]=useState<string|null>(null);
 const [leavingKind,setLeavingKind]=useState<DemoKind|null>(null);
 const transitionRef=useRef<number|null>(null);
 const pendingCommit=useRef<(()=>void)|null>(null);
 const locked=useRef(false);
 const [feed,setFeed]=useState(freshDemoState);
 const [announcement,setAnnouncement]=useState("");
 const profiles=useMemo(()=>filterDemoPeople(demoPeople,filters,draft),[filters,draft]);
 const ids=useMemo(()=>profiles.map(p=>p.id),[profiles]);
 const person=profiles[feed.index];
 const selectedPerson=forYouDemoPeople.find(p=>p.id===personOpen);
 // The fixture list is a stable module-owned dataset; only its selected
 // identity or changed data may project new profile/photos. Avoid rebuilding
 // the whole view during theme, scroll, saves or unrelated parent commits.
 const selectedProfile=useMemo(()=>selectedPerson?fromDemoPerson(selectedPerson):null,[selectedPerson]);
 const exitVisitorProfile=useCallback(()=>setPersonOpen(null),[]);
 const globalHeader=useRef<HeaderMotion>(null);
 const reportProfileMotion=useCallback((progress:number,dragging:boolean)=>globalHeader.current?.setProfileProgress(progress,dragging),[]);
 const profileMode=mainTab==="profile"||!!selectedPerson;
 const backgroundHeaderMode=mainTab==="profile"?"profile":"browse";
 const savedScroll=useRef({"for-you":0,nearby:0});
 const forYouCollectionScroll=useRef<Partial<Record<CollectionId|"best",number>>>({});
 const activeScrollContext=useRef(forYouCollection);
 activeScrollContext.current=forYouCollection;
 const currentBrowse=useRef({mainTab,discoveryTab,personOpen});
 currentBrowse.current={mainTab,discoveryTab,personOpen};
 const reportForYouScroll=useCallback((top:number,context:CollectionId|"best"|null)=>{
   if(context)forYouCollectionScroll.current[context]=top;
   else savedScroll.current["for-you"]=top;
   const browse=currentBrowse.current;
   if(browse.mainTab==="discover"&&browse.discoveryTab==="for-you"&&
     !browse.personOpen&&activeScrollContext.current===context)
    globalHeader.current?.setScrollTop(top);
 },[]);
 const reportNearbyScroll=useCallback((top:number)=>{
   savedScroll.current.nearby=top;
   if(mainTab==="discover"&&discoveryTab==="nearby"&&!personOpen)globalHeader.current?.setScrollTop(top);
 },[mainTab,discoveryTab,personOpen]);
 useLayoutEffect(()=>{
   // The active profile paints its own scroll progress; resetting the header
   // after child effects would flash the contrast shadow to zero on return.
   if(profileMode)return;
   globalHeader.current?.reset();
   if(mainTab==="discover"&&!personOpen){
     globalHeader.current?.setScrollTop(discoveryTab==="for-you"?
       (forYouCollection?(forYouCollectionScroll.current[forYouCollection]??0):savedScroll.current["for-you"]):
       discoveryTab==="nearby"?savedScroll.current.nearby:0);
   }
 },[mainTab,discoveryTab,personOpen,profileMode,forYouCollection]);
 const tabIndex=topTabs.findIndex(x=>x[0]===discoveryTab);
 useLayoutEffect(()=>{
  const i=keyboardBrowseFocus.current;
  if(i===null||topTabs[i][0]!==discoveryTab)return;
  keyboardBrowseFocus.current=null;
  document.querySelectorAll<HTMLButtonElement>(".discovery-top-tabs [role=tab]")[i]?.focus({preventScroll:true});
 },[discoveryTab]);

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
 useEffect(()=>()=>{if(transitionRef.current!==null)window.clearTimeout(transitionRef.current);
  transitionRef.current=null;pendingCommit.current=null;locked.current=false;},[]);
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
    selectionHaptic();return;
  }
  // Both full cards, including name, photo, interests and actions, already exist
  // in the same keyed deck before motion begins. This prevents the photo-only flash.
  locked.current=true;
  setLeaving(person.id);
  setLeavingKind(kind);
  const message=kind==="pass"?"Анкета пропущена · демо":
    kind==="like"?"Симпатия · никому не отправлена":"Особенная симпатия · только демо";
  pendingCommit.current=()=>{
    setFeed(prev=>demoAct(prev,ids,kind));
    setLeaving(null);
    setLeavingKind(null);
    locked.current=false;
    indicate(message);
  };
  // The completion callback and fallback are installed before optional bridge work.
  // Reduced-motion clients never wait for a transition they intentionally omit.
  if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)finishDeck();
  else transitionRef.current=window.setTimeout(finishDeck,440);
  selectionHaptic();
 };
 const selectTab=(index:number)=>{
  const bounded=Math.max(0,Math.min(topTabs.length-1,index));
  if(topTabs[bounded][0]===discoveryTab)return;
  setDiscoveryTab(topTabs[bounded][0]);
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
  if(pageTrack.current)pageTrack.current.dataset.motionFrozenX=String(trackX);
  if(underline.current)underline.current.dataset.motionFrozenX=String(inkX);
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
  }}))return;
 };
 const settleDrag=(targetIndex:number,token:MotionToken|null=null)=>{
  const target=Math.max(0,Math.min(topTabs.length-1,targetIndex));
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
  selectTab(i);
 };
 useEffect(()=>()=>{inputOwnership.current.dispose();browseMotion.current.dispose();
  if(pagerSettleTimer.current!==null)window.clearTimeout(pagerSettleTimer.current);
 },[]);
 const down=(event:ReactPointerEvent<HTMLDivElement>)=>{
  ensureBrowseMotion();
  if(!event.isPrimary){inputOwnership.current.secondFinger();cancelSwipe();return;}
  if(event.pointerType==="mouse"&&event.button!==0)return;
  const target=event.target as HTMLElement;
  if(target.closest("[role=dialog],.discovery-filter-sheet,.fy-rail,.fy-expanded,.fy-manage"))return;
  const feedCard=target.closest<HTMLElement>(".feed-v2-card");
  const interactive=target.closest("button,a,input,textarea,select,[contenteditable]");
  if(interactive&&!interactive.matches(".discovery-name-button,.feed-v2-expand,.discovery-top-tabs [role=tab]"))return;
  if(event.clientX-(pages.current?.getBoundingClientRect().left??0)<26)return;
  // The details subtree owns text gestures even when it reaches above the
  // old cutoff. The carousel consumes in-range photo swipes in capture;
  // a swipe past the final photo can pass through to this pager.
  if(feedCard){const rect=feedCard.getBoundingClientRect();
   if(!target.closest(".feed-v2-details,.feed-v2-photo .carousel-frame")&&
     cardGestureZone(event.clientY,rect.top,rect.height)!=="browse")return;}
  const serial=inputOwnership.current.begin("pointer",event.pointerId,"browse");
  if(serial===null)return;
  inputOwnership.current.begin("pointer",event.pointerId,"native");
  gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,
   started:performance.now(),tracking:false,index:tabIndex,
   width:pages.current?.clientWidth||window.innerWidth,serial,token:null,
   originTrack:0,originInk:0,lastX:event.clientX};
 };
 const move=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const g=gesture.current;if(!g||g.id!==event.pointerId||g.native)return;
  const x=event.clientX-g.x,y=event.clientY-g.y;
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
   g.token=browseMotion.current.begin(g.index);
   if(g.token)browseMotion.current.claim(g.token);
   try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* older WebView */}
  }
  if(!g.token||!inputOwnership.current.owns("browse",g.serial))return;
  if(event.cancelable)event.preventDefault();
  const limited=(g.index<=.001&&x>0)||(g.index>=topTabs.length-1-.001&&x<0);
  const shift=limited?x*.22:Math.max(-g.width,Math.min(g.width,x));
  const trackX=g.originTrack+shift,inkX=g.originInk-shift/3;
  // Coalesced one RAF with generation guard; no React renders during move.
  browseMotion.current.schedulePaint(g.token,trackX,()=>paintBrowse(trackX,inkX));
 };
 const up=(event:ReactPointerEvent<HTMLDivElement>,cancel=false)=>{
  const g=gesture.current;if(!g||g.id!==event.pointerId)return;
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
  try{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}catch{/* implicit release */}
  const x=event.clientX-g.x,elapsed=Math.max(1,performance.now()-g.started);
  const velocity=Math.abs(x)/elapsed;
  const rawTarget=!cancel&&(Math.abs(x)>g.width*.18||velocity>.55)
   ?Math.round(g.index)+(x<0?1:-1):Math.round(g.index);
  const target=Math.max(0,Math.min(topTabs.length-1,rawTarget));
  clickBlockUntil.current=performance.now()+260;
  // Flush the release position before cancelling a pending finger RAF. The
  // CSS settle now starts at the actual final pointer location, not an older
  // composited frame.
  const limited=(g.index<=.001&&x>0)||(g.index>=topTabs.length-1-.001&&x<0);
  const shift=limited?x*.22:Math.max(-g.width,Math.min(g.width,x));
  browseMotion.current.paint(g.token,g.originTrack+shift,
   ()=>paintBrowse(g.originTrack+shift,g.originInk-shift/3));
  settleDrag(target);
  if(target!==tabIndex)selectTab(target);
 };
 const cancelSwipe=()=>{const g=gesture.current;gesture.current=null;
  if(!g)return;
  inputOwnership.current.cancel();
  if(g.tracking){
   if(g.token)browseMotion.current.cancel(g.token,"gesture-cancel");
   settleDrag(tabIndex);
  }
 };
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
   pageTrack.current?.style.setProperty("--luemi-tab-offset",(-tabIndex*100)+"%");
   pageTrack.current?.style.setProperty("--luemi-drag","0px");
   underline.current?.style.setProperty("--luemi-tab-offset",(tabIndex*100)+"%");
   underline.current?.style.setProperty("--luemi-underline-drag","0px");
  });
  void pageTrack.current?.offsetWidth;
  pageTrack.current?.classList.remove("is-finger-tracking");
  underline.current?.classList.remove("is-finger-tracking");
  browsePosition.current=tabIndex;
 };
 useEffect(()=>{
  const stop=()=>suspendBrowse.current();
  const hidden=()=>{if(document.hidden)stop();};
  window.addEventListener("blur",stop);document.addEventListener("visibilitychange",hidden);
  return ()=>{window.removeEventListener("blur",stop);document.removeEventListener("visibilitychange",hidden);};
 },[]);
 const apply=(next:DiscoveryFilter)=>{
  if(transitionRef.current!==null)window.clearTimeout(transitionRef.current);
  transitionRef.current=null;pendingCommit.current=null;locked.current=false;setLeaving(null);setLeavingKind(null);
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
  selectionHaptic();
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
   transitionRef.current=null;pendingCommit.current=null;locked.current=false;setLeaving(null);setLeavingKind(null);
   setFilters(defaultFilters);setFeed(prev=>({...freshDemoState(),saved:prev.saved}));
   indicate("Демо-Лента начата заново");
 };
 return <div className="discovery-app" data-profile-overlay={selectedPerson?"true":"false"}
   data-profile-renderer={androidWebView?"android":"standard"}
   data-profile-mode={profileMode?"true":"false"}>
   <div className="discovery-ambient" aria-hidden="true"/>
   <GlobalHeader ref={globalHeader} mode={backgroundHeaderMode} theme={theme}
     onTheme={onTheme} onFilters={()=>setFilterOpen(true)} onSaved={openSaved}
    />
   <div className="discovery-main-panels">
     <section className="discovery-panel discovery-browse-panel" hidden={mainTab!=="discover"}>
       <div className="discovery-top-tabs" role="tablist" aria-label="Разделы знакомств"
         onKeyDown={event=>{
          const i=topTabs.findIndex(value=>value[0]===discoveryTab);
          const next=event.key==="ArrowRight"?Math.min(2,i+1):
           event.key==="ArrowLeft"?Math.max(0,i-1):
           event.key==="Home"?0:event.key==="End"?2:-1;
          if(next<0)return;
          event.preventDefault();
          keyboardBrowseFocus.current=next;
          requestBrowseTab(next);
          if(next===i){keyboardBrowseFocus.current=null;
           document.querySelectorAll<HTMLButtonElement>(".discovery-top-tabs [role=tab]")[i]?.focus({preventScroll:true});}
         }}
         onPointerDown={down} onPointerMove={move} onPointerUp={e=>up(e)} onPointerCancel={e=>up(e,true)} onLostPointerCapture={e=>up(e,true)}>
         {topTabs.map(([value,label],i)=><button type="button" role="tab" key={value}
           aria-selected={discoveryTab===value} tabIndex={discoveryTab===value?0:-1} onClick={()=>{if(performance.now()>=clickBlockUntil.current)requestBrowseTab(i);}}
           className={discoveryTab===value?"active":""}>{label}</button>)}
         <span className="discovery-tab-underline" ref={underline} aria-hidden="true"
           style={{"--luemi-tab-offset":tabIndex*100+"%"} as CSSProperties}/>
       </div>
       <div className="discovery-pages" ref={pages} onPointerDown={down}
         onPointerMove={move} onPointerUp={up} onPointerCancel={cancelSwipe}
         onLostPointerCapture={cancelSwipe}
         onClickCapture={event=>{if(performance.now()<clickBlockUntil.current){event.preventDefault();event.stopPropagation();}}}>
         <div className="discovery-page-track" ref={pageTrack}
           onTransitionEnd={event=>{
             if(event.target===event.currentTarget&&event.propertyName==="transform")finishPagerSettle();
           }}
           style={{"--luemi-tab-offset":(-tabIndex*100)+"%"} as CSSProperties}>
           <section className="discovery-page" role="tabpanel" aria-label="Лента" inert={discoveryTab!=="feed"} aria-hidden={discoveryTab!=="feed"}>
             {<div className="discovery-deck-stage">
               {person&&<div key={person.id}
                 className={"discovery-deck-layer"+(leaving?" deck-leaving deck-leaving-"+leavingKind:" deck-active")}
                 onAnimationEnd={event=>{if(leaving&&event.target===event.currentTarget&&
                   ["luemi-deck-leave","feed-v2-like","feed-v2-special"].includes(event.animationName))finishDeck();}}>
                 <FeedCard person={person} saved={feed.saved.includes(person.id)}
                   canUndo={feed.history.length>0} active={true} busy={!!leaving}
                   onAction={act} onOpenProfile={()=>setPersonOpen(person.id)}
                   onInterests={()=>setInterestOpen(person.id)}/>
               </div>}
               {profiles[feed.index+1]&&<div key={profiles[feed.index+1].id}
                 className={"discovery-deck-layer"+(leaving?" deck-entering":" deck-queued")}>
                 <FeedCard person={profiles[feed.index+1]} saved={feed.saved.includes(profiles[feed.index+1].id)}
                   canUndo={feed.history.length>0} active={false} busy={!!leaving} onAction={act}
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
           <section className="discovery-page" role="tabpanel" aria-label="Для тебя" inert={discoveryTab!=="for-you"} aria-hidden={discoveryTab!=="for-you"}>
             <ForYou draft={draft} filters={filters} saved={feed.saved} onScrollTop={reportForYouScroll} onSave={toggleForYouSave}
               onPerson={setPersonOpen} expanded={forYouCollection} onExpanded={setForYouCollection}
               settingsOpen={forYouSettings} onSettingsOpen={setForYouSettings}/>
           </section>
           <section className="discovery-page" role="tabpanel" aria-label="Рядом" inert={discoveryTab!=="nearby"} aria-hidden={discoveryTab!=="nearby"}>
             <Nearby active={mainTab==="discover"&&discoveryTab==="nearby"&&!selectedPerson} draft={draft} filters={filters} saved={feed.saved} onScrollTop={reportNearbyScroll} onSave={toggleForYouSave}
               onPerson={setPersonOpen} onFilters={openNearbyFilters} onEditLocation={onExit}/>
           </section>
         </div>
       </div>
     </section>
     <section className="discovery-panel" hidden={mainTab!=="likes"}>
       <Placeholder title="Симпатии" text="Настоящие мэтчи и входящие появятся только после безопасного серверного запуска."/>
     </section>
     <section className="discovery-panel" hidden={mainTab!=="chats"}>
       {import.meta.env.VITE_LUEMI_REAL_CHATS==="1"?<RealChats/>:<ChatsPreview/>}
     </section>
     <section className="discovery-panel discovery-profile-panel" hidden={mainTab!=="profile"}>
       {profilePrepared&&<ProfileMaster data={ownProfile} mode="owner" onEdit={onExit} registerBack={registerProfileBack} active={mainTab==="profile"&&!selectedPerson} onMotionProgress={reportProfileMotion}/>}
     </section>
   </div>
   {selectedPerson&&selectedProfile&&<QaProfiler id="VisitorProfileRoute"><VisitorProfileRoute key={selectedPerson.id} data={selectedProfile}
     theme={theme} onTheme={onTheme} onExit={exitVisitorProfile} registerBack={registerVisitorBack}/></QaProfiler>}
   <nav className="discovery-bottom-nav" aria-label="Главная навигация LUEMI">
     {navigation.map(([value,label,Icon])=><button type="button" key={value}
       className={"discovery-nav-item"+(mainTab===value?" active":"")}
       aria-current={mainTab===value?"page":undefined} onClick={()=>selectMainTab(value)}>
       <Icon size={22} strokeWidth={1.75}/><span>{label}</span></button>)}
   </nav>
   <span className="discovery-sr-status" role="status" aria-live="polite">{announcement}</span>
   <DiscoveryFilters open={filterOpen} filter={filters} draft={draft} onClose={()=>setFilterOpen(false)} onApply={apply}/>
   {savedOpen&&<div className="discovery-modal-backdrop" onClick={()=>setSavedOpen(false)}>
     <section className="discovery-saved-sheet" ref={savedDialog} tabIndex={-1} role="dialog" aria-label="Сохранённые демо-анкеты" aria-modal="true"
       onClick={e=>e.stopPropagation()}>
       <header><h2>Сохранённые <span className="discovery-demo-label">Демо</span></h2>
         <button className="discovery-icon-action" type="button" onClick={()=>setSavedOpen(false)} data-modal-initial aria-label="Закрыть"><X size={19}/></button>
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
