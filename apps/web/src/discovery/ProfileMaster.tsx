import {memo,useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from "react";
import {flushSync} from "react-dom";
import type {PointerEvent as ReactPointerEvent} from "react";
import {PenLine,Eye,FileText,Sparkles,Images,Gift,UserRound,Heart,CalendarDays,ShieldCheck,Languages as LanguagesIcon,Info} from "lucide-react";
import {Flag} from "../ui/Flag";
import {InterestChip} from "../ui/InterestCatalog";
import {languages} from "../ui/Languages";
import {goals} from "../registration/model";
import type {ProfileMasterData,ProfilePhoto,ProfileView} from "./ProfileModel";
import {projectProfile} from "./ProfileModel";
import {PhotoViewer} from "./PhotoViewer";
import {QaProfiler} from "./qa-profiler";
import {resourceIdentity,viewerPhotoContext,type ViewerSource} from "./photo-viewer-state";
import {BlikViewer} from "./BlikViewer";
import {createProfileMotionAuthority,PROFILE_MOTION_WRITER_TABLE,bindMotionViewport} from "./profile-motion";
import {GeometryMotion} from "./geometry-motion";
import {reanchorSheet,reanchorPage,remapSheetPixel} from "./profile-geometry";
import {GestureArbiter,fractionalTrack,preservePhotoId} from "../ui/gesture-arbiter";
import {bindMotionLifecycle} from "../ui/motion-lifecycle";
import "./profile-master.css";

type TabId="about"|"bliki"|"photos"|"gifts"|"meta";
export type ProfileRouteMotionHandle={
 suspendForRoute:()=>void;rollbackRoute:()=>void;commitRouteClose:()=>void;
 suspendForBackground:()=>void;resumeFromBackground:()=>void;
};
type Props={
 data:ProfileMasterData;mode:ProfileView["mode"];onClose?:()=>void;onEdit?:()=>void;
 registerBack?:(handler:(()=>boolean)|null)=>void;
 active?:boolean;onMotionProgress?:(progress:number,dragging:boolean)=>void;
 registerRouteGestureCancel?:(handler:(()=>void)|null)=>void;
 registerRouteMotion?:(handle:ProfileRouteMotionHandle|null)=>void;
 gestureArbiter?:GestureArbiter;
};
const tabs=[["about","О себе",FileText],["bliki","Блики",Sparkles],["photos","Фото",Images],
 ["gifts","Подарки",Gift],["meta","О профиле",UserRound]] as const;
type Swipe={id:number;x:number;y:number;t:number;axis:""|"x"|"y";index:number;width:number;lastX?:number;revision?:number;serial?:number;claimed?:boolean};
function PhotoImage({photo,alt,loading="lazy"}:{photo:ProfilePhoto;alt:string;loading?:"lazy"|"eager"}){
 return <img data-photo-id={photo.id} src={photo.src} alt={alt} draggable={false} loading={loading} decoding="async"
   onError={e=>{if(photo.fallback&&e.currentTarget.src!==photo.fallback)e.currentTarget.src=photo.fallback;}}/>;
}
type BlurWindowWriter=(indices:number[]|null)=>void;
/** Heavy blurred pixels remain in the accepted keyed slide. A window shift
 * only renders slides whose enabled/media state changes; unaffected slots
 * reuse both React work and the already decoded <img> DOM node. No extra media.
 */
const ProfileBlurSlide=memo(function ProfileBlurSlide({photo,enabled}:{
 photo:ProfilePhoto;enabled:boolean;
}){
 return <div className="pm-photo-blur-slide" data-blur-photo-id={photo.id}>
  {enabled&&<PhotoImage photo={photo} alt="" loading="eager"/>}
 </div>;
});
/** Memoized media-only renderer: moving the 3 blur peers may NOT rerender the
 * whole profile, native scroll tabs or the accepted hero track controller.
 */
const ProfileBlurTrack=memo(function ProfileBlurTrack({
 photos,activePhoto,blurFrom,trackRef,bindWriter
}:{
 photos:ProfilePhoto[];activePhoto:number;blurFrom:number;
 trackRef:{current:HTMLDivElement|null};
 bindWriter:(writer:BlurWindowWriter|null)=>void;
}){
 const [windowIndices,setWindowIndices]=useState<number[]|null>(null);
 useLayoutEffect(()=>{
  bindWriter(setWindowIndices);
  return ()=>bindWriter(null);
 },[bindWriter]);
 const indices=useMemo(()=>{
  if(windowIndices)return new Set(windowIndices);
  const list=[activePhoto];
  if(blurFrom!==activePhoto&&photos[blurFrom])list.push(blurFrom);
  for(const neighbor of [activePhoto-1,activePhoto+1])
   if(list.length<3&&photos[neighbor]&&!list.includes(neighbor))list.push(neighbor);
  return new Set(list);
 },[activePhoto,blurFrom,photos,windowIndices]);
 return <div className="pm-photo-blur-track" ref={trackRef}>
  {photos.map((photo,i)=><ProfileBlurSlide key={photo.id} photo={photo} enabled={indices.has(i)}/>)}
 </div>;
});
function About({view}:{view:ProfileView}){
 const p=view.profile,goal=p.goal&&p.goal!=="undecided"?goals.find(g=>g.id===p.goal):null;
 return <div className="pm-card-stack">
  {goal&&<article className="pm-card"><div className="pm-card-subtitle"><Heart size={17}/> Цель знакомства</div><strong>{goal.label}</strong></article>}
  {p.about&&<article className="pm-card"><h3>Обо мне</h3><p>{p.about}</p></article>}
  {!!p.interests.length&&<article className="pm-card"><h3>Интересы</h3><div className="pm-interests">{p.interests.map(id=><InterestChip key={id} id={id}/>)}</div></article>}
  {!!p.languages.length&&<article className="pm-card"><div className="pm-card-subtitle"><LanguagesIcon size={17}/> Языки общения</div>
    <div className="pm-language-list">{p.languages.map(id=>{
     const found=languages.find(l=>l.id===id);return found?<span key={id}><Flag code={found.flag} size={22}/>{found.name}</span>:null;
    })}</div></article>}
  {!p.about&&!p.interests.length&&!goal&&!p.languages.length&&
    <div className="pm-empty"><FileText size={38}/><h3>Пока ничего не заполнено</h3>
     <p>{view.profile.source==="local-draft"?"Добавь описание или интересы в регистрации.":"Здесь появится информация, когда владелец её добавит."}</p></div>}
  {view.profile.source!=="server"&&<p className="pm-demo-disclaimer"><Info size={15}/>
   {view.profile.source==="fixture"?"Вымышленный демонстрационный персонаж — не реальный пользователь.":"Локальный черновик. Анкета не опубликована."}</p>}
 </div>;
}
function Bliki(){return <div className="pm-empty pm-bliki"><div className="pm-bliki-mark"><Sparkles size={47} strokeWidth={1.2}/></div>
 <h3>Пока нет бликов</h3><p>Здесь появятся короткие моменты из жизни.</p><span>Функция готовится</span></div>;}
function Gifts({view}:{view:ProfileView}){return <div className="pm-card-stack">
 <p className="pm-demo-disclaimer"><Info size={15}/> Витрина подарков — только демонстрация, без покупок или полученных подарков.</p>
 <div className="pm-gift-pinned"><span>Пример закреплённого подарка · Демо</span><div aria-hidden="true">🧸</div><strong>Мишка любви</strong></div>
 <h3 className="pm-section-heading">Примеры подарков</h3>
 <div className="pm-gift-grid">{[["🌹","Роза"],["💝","Сердце"],["🧸","Мишка"]].map(([emoji,name])=>
  <div key={name} className="pm-gift"><span aria-hidden="true">{emoji}</span><b>{name}</b><small>Демо</small></div>)}</div>
 {view.mode==="owner"&&<p className="pm-muted">Настоящая коллекция откроется после запуска безопасного сервиса подарков.</p>}
 </div>;}
function Meta({view}:{view:ProfileView}){
 const p=view.profile,fmt=(v:string|null)=>v&&p.source==="server"?new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"long",year:"numeric"}).format(new Date(v)):"Данные ещё недоступны";
 const rows=[{label:"Дата регистрации",value:fmt(p.registeredAt),Icon:CalendarDays},
 {label:"Последнее обновление",value:fmt(p.updatedAt),Icon:CalendarDays},
 {label:"Статус верификации",value:p.verified?"Подтверждён":"Не подтверждён",Icon:ShieldCheck},
 {label:"ID профиля",value:p.id&&p.source==="server"?p.id:"Данные ещё недоступны",Icon:UserRound}];
 return <div className="pm-card-stack">
 {rows.map(({label,value,Icon})=><article className="pm-meta-item" key={label}>
  <div className="pm-meta-icon"><Icon size={21}/></div><div><span>{label}</span><strong>{value}</strong></div></article>)}
 {p.source!=="server"&&<p className="pm-demo-disclaimer"><Info size={15}/> Демо/черновик: даты, публичный ID и проверка не подтверждены сервером.</p>}
 </div>;
}
export const ProfileMaster=memo(function ProfileMaster({data,mode,onClose,onEdit,registerBack,active=true,onMotionProgress,registerRouteGestureCancel,registerRouteMotion,gestureArbiter}:Props){
 const [preview,setPreview]=useState(false);
 const [tab,setTab]=useState<TabId>("about");
 const [viewer,setViewer]=useState<{photoId:string;source:ViewerSource|null}|null>(null);
 const [blikOpen,setBlikOpen]=useState(false);
 const [collapsed,setCollapsed]=useState(false);

 // 02A: exclusive paint-path ownership only. Gestures and physics unchanged.
 const motionAuthority=useRef(createProfileMotionAuthority());
 const view=useMemo(()=>projectProfile(data,mode),[data,mode]);
 const photos=view.photos;
 const [activePhoto,setActivePhoto]=useState(0);
 const [blurFrom,setBlurFrom]=useState(0);
 const blurWriterRef=useRef<BlurWindowWriter>(()=>{});
 const bindBlurWriter=useCallback((writer:BlurWindowWriter|null)=>{
  blurWriterRef.current=writer??(()=>{});
 },[]);
 const blurWindowRef=useRef<number[]|null>(null);
 const blurSampleFrame=useRef<number|null>(null);
 const blurSession=useRef(0);
 const activePhotoId=useRef<string|null>(photos[0]?.id??null);
 const previousPhotos=useRef(photos);
 const localGestures=useRef(new GestureArbiter());
 const gestures=gestureArbiter??localGestures.current;
 const current=photos[Math.min(activePhoto,Math.max(0,photos.length-1))];
 // At most three actual blur images are mounted, including the outgoing frame
 // if a progress-dot jump spans more than one slide.
 const viewport=useRef<HTMLDivElement>(null);
 const shell=useRef<HTMLElement>(null),sheet=useRef<HTMLDivElement>(null),blurLayer=useRef<HTMLDivElement>(null);
 const hero=useRef<HTMLDivElement>(null),photoTrack=useRef<HTMLDivElement>(null),blurTrack=useRef<HTMLDivElement>(null);
 const grab=useRef<HTMLButtonElement>(null),miniAvatar=useRef<HTMLButtonElement>(null);
 const photoMotion=useRef<HTMLDivElement>(null),rubberY=useRef(0);
 const tabBar=useRef<HTMLDivElement>(null),pages=useRef<HTMLDivElement>(null),pageTrack=useRef<HTMLDivElement>(null);
 const ink=useRef<HTMLSpanElement>(null),contentPages=useRef<HTMLDivElement[]>([]);
 const tabMetrics=useRef<Array<{left:number;width:number}>>([]);
 const tabViewport=useRef(1),tabLastPosition=useRef(0);
 const dragFrame=useRef<number|null>(null);
 const photoSwipe=useRef<Swipe|null>(null),tabSwipe=useRef<Swipe|null>(null);
 const clickBlocked=useRef(0),expandedY=useRef(385),collapsedY=useRef(46),collapsedRef=useRef(false);
 const sheetY=useRef(385);
 const stopSheet=useRef<()=>void>(()=>{}),stopTabs=useRef<()=>void>(()=>{});
 const cancelSheetGesture=useRef<()=>void>(()=>{});
 const rebaseSheetGesture=useRef<(relativeY:number,revision:number)=>void>(()=>{});
 const rebaseTabsGesture=useRef<(position:number,revision:number)=>void>(()=>{});
 const sheetRunner=useRef<GeometryMotion|null>(null),tabsRunner=useRef<GeometryMotion|null>(null);
 const sheetRevision=useRef(0),tabsRevision=useRef(0);
 const sheetIntent=useRef<boolean|null>(null),sheetRootTop=useRef<number|null>(null);
 const sheetDragActive=useRef(false);
 const measureSheetRef=useRef<()=>void>(()=>{}),measureTabsRef=useRef<()=>void>(()=>{});
 const routeFrozen=useRef<{sheet:number;sheetTarget:boolean;sheetSettling:boolean;
   tabs:number;tabsTarget:number;tabsSettling:boolean}|null>(null);
 const routeTerminal=useRef(false);
 const motionCallback=useRef(onMotionProgress);
 motionCallback.current=onMotionProgress;
 const motionActive=active&&!preview;
 const previewBack=useRef<(()=>boolean)|null>(null);
 const registerPreviewBack=useCallback((handler:(()=>boolean)|null)=>{previewBack.current=handler;},[]);
 const registerViewerBack=useCallback((handler:(()=>boolean)|null)=>{viewerBack.current=handler;},[]);
 const viewerBack=useRef<(()=>boolean)|null>(null);
 const tabSelectionRef=useRef<TabId>(tab);
 tabSelectionRef.current=tab;
 // The accepted hero Motion Authority owns BOTH transform writers.
 // This only tracks which <=3 blur media are already staged at the actual
 // sampled CSS fraction; no competing timeline or motion controller.
 const blurWindowAt=(position:number,toward:number):number[]=>{
  const f=Math.max(0,Math.min(photos.length-1,position));
  const left=Math.floor(f),right=Math.ceil(f),dir=toward<f?-1:1;
  const candidates=[left,right,dir>0?right+1:left-1,dir>0?right+2:left-2,dir>0?left-1:right+1];
  const result:number[]=[];
  for(const n of candidates)if(n>=0&&n<photos.length&&!result.includes(n)&&result.length<3)
   result.push(n);
  return result;
 };
 const showBlurWindow=(indices:number[])=>{
  const old=blurWindowRef.current;
  if(old&&indices.length===old.length&&indices.every(i=>old.includes(i)))return;
  blurWindowRef.current=indices;
  flushSync(()=>blurWriterRef.current(indices));
 };
 const stopBlurTracking=()=>{
  blurSession.current++;
  if(blurSampleFrame.current!==null)cancelAnimationFrame(blurSampleFrame.current);
  blurSampleFrame.current=null;
 };
 const finishBlurTracking=(target:number)=>{
  stopBlurTracking();blurWindowRef.current=null;
  flushSync(()=>{blurWriterRef.current(null);setBlurFrom(target);});
 };
 const followBlurPosition=(target:number)=>{
  stopBlurTracking();
  const generation=blurSession.current;let stable=0;
  const tick=()=>{
   if(generation!==blurSession.current)return;
   const width=Math.max(1,hero.current?.clientWidth??1);
   const at=fractionalTrack(photoTrack.current,width,target);
   showBlurWindow(blurWindowAt(at,target));
   stable=Math.abs(at-target)<.004?stable+1:0;
   if(stable>=2){finishBlurTracking(target);return;}
   blurSampleFrame.current=requestAnimationFrame(tick);
  };
  blurSampleFrame.current=requestAnimationFrame(tick);
 };
 const setTransform=useCallback((idx:number,delta=0)=>{
  motionAuthority.current.run("hero",PROFILE_MOTION_WRITER_TABLE.hero,()=>{
   const value=`translate3d(calc(-${idx*100}% + ${delta}px),0,0)`;
   if(photoTrack.current)photoTrack.current.style.transform=value;
   if(blurTrack.current)blurTrack.current.style.transform=value;
  });
 },[]);
 // The stationary viewport owns vertical scroll. The rounded surface itself
 // has no transform, animated top, paint containment or clipping ancestor.
 const paintSheet=useCallback((offset:number,dragging=false)=>{
  motionAuthority.current.run("sheet",PROFILE_MOTION_WRITER_TABLE.sheet,()=>{
  // Normal motion uses the stationary native scroll viewport. Only the
  // limited elastic pull moves the white surface; portrait pixels don't warp.
  const elastic=Math.max(0,Math.min(28,offset-expandedY.current));
  const next=Math.max(collapsedY.current,Math.min(expandedY.current+28,offset));
  sheetY.current=next;
  const progress=Math.max(0,Math.min(1,(expandedY.current-next)/
   Math.max(1,expandedY.current-collapsedY.current)));
  if(viewport.current)viewport.current.scrollTop=Math.max(0,expandedY.current-Math.min(next,expandedY.current));
  if(sheet.current&&Math.abs(elastic-rubberY.current)>.05){
   sheet.current.style.transform=elastic>0.05?`translate3d(0,${elastic.toFixed(2)}px,0)`:"";
   rubberY.current=elastic;
  }
  if(photoMotion.current){
   const y=-10*progress+elastic*.22;
   const scale=1+.025*progress+elastic*.001;
   photoMotion.current.style.transform=`translate3d(0,${y.toFixed(2)}px,0) scale(${scale.toFixed(4)})`;
  }
  if(blurLayer.current)blurLayer.current.style.opacity=String(progress*.9);
  // Reconcile the grab and avatar in the same motion frame, instead of
  // triggering two CSS opacity transitions by toggling data-sheet-state.
  const avatarT=Math.max(0,Math.min(1,(progress-.72)/.24));
  if(miniAvatar.current){
   miniAvatar.current.style.opacity=String(avatarT);
   miniAvatar.current.style.transform=`translate3d(0,${(4*(1-avatarT)).toFixed(2)}px,0) scale(${(.9+.1*avatarT).toFixed(3)})`;
   miniAvatar.current.style.pointerEvents=progress>.96?"auto":"none";
  }
  if(grab.current){
   const grabT=Math.max(0,Math.min(1,(progress-.86)/.12));
   grab.current.style.opacity=String(1-grabT);
   grab.current.style.pointerEvents=progress>.98?"none":"auto";
  }
  if(motionActive)motionCallback.current?.(progress,dragging);
  });
 },[motionActive]);
 const ensureSheetRunner=()=>{
  if(!sheetRunner.current||sheetRunner.current.isDisposed())sheetRunner.current=new GeometryMotion("sheet",()=>performance.now(),
   cb=>requestAnimationFrame(cb),id=>cancelAnimationFrame(id),sheetY.current,sheetRevision.current);
  return sheetRunner.current;
 };
 const ensureTabsRunner=()=>{
  if(!tabsRunner.current||tabsRunner.current.isDisposed())tabsRunner.current=new GeometryMotion("tabs",()=>performance.now(),
   cb=>requestAnimationFrame(cb),id=>cancelAnimationFrame(id),
   (pages.current?.scrollLeft??0)/Math.max(1,tabViewport.current),tabsRevision.current);
  return tabsRunner.current;
 };
 const settleSheet=useCallback((next:boolean)=>{
  stopSheet.current();
  const driver=ensureSheetRunner();
  const from=driver.snapshot().phase==="idle"?sheetY.current:driver.cancel();
  const destination=next?collapsedY.current:expandedY.current;
  sheetIntent.current=next;
  // Original endpoint/curve/duration unchanged. A geometry rebase will spend
  // only the remaining time rather than restarting the 335/240ms interval.
  driver.start(from,destination,from>expandedY.current?240:335,[.22,.79,.22,1],
   value=>paintSheet(value,true),()=>{
    collapsedRef.current=next;
    setCollapsed(next);
    sheetIntent.current=null;
   },sheetRevision.current);
  stopSheet.current=()=>{const frozen=driver.cancel();paintSheet(frozen,true);};
 },[paintSheet]);
 useLayoutEffect(()=>{
  if(!motionActive)return;
  let first=true,hidden=false;
  const measure=()=>{
   const frame=hero.current,pane=sheet.current,root=shell.current;
   if(!frame||!pane||!root)return;
   if(!root.clientWidth||!root.clientHeight||!frame.offsetHeight){
    hidden=true;sheetRunner.current?.suspend();return;
   }
   // Read all rectangles first. Cached old root top is essential when the
   // visual viewport moves the entire profile between two frames.
   const shellRect=root.getBoundingClientRect();
   const headerScope=root.closest(".discovery-visitor-route")??root.closest(".discovery-app");
   const imageRect=headerScope?.querySelector<HTMLElement>(".lh-header .lh-island img")?.getBoundingClientRect();
   const logoBottom=imageRect?imageRect.bottom-shellRect.top-imageRect.height*.11:48;
   const top=Math.max(38,Math.min(root.clientHeight*.24,logoBottom));
   const bottom=Math.max(top+185,frame.offsetHeight-43);
   const dots=(imageRect?.bottom??(shellRect.top+108))-shellRect.top+8;
   if(!first&&!hidden&&Math.abs(top-collapsedY.current)<.5&&
      Math.abs(bottom-expandedY.current)<.5&&
      Math.abs((sheetRootTop.current??shellRect.top)-shellRect.top)<.5)return;
   const driver=sheetRunner.current;
   const phase=driver?.snapshot().phase??"idle";
   const oldValue=phase==="settling"||phase==="suspended"?driver!.sample():sheetY.current;
   const oldTop=sheetRootTop.current??shellRect.top;
   const mapped=remapSheetPixel(oldValue,oldTop,shellRect.top,top,bottom);
   // Explicit measurable exception: an old pixel can be outside the new
   // physically reachable interval. Do not silently claim ≤1px continuity.
   if(mapped.clamped){
    root.dataset.geometryClampReason="outside-new-sheet-endpoints";
    root.dataset.geometryClampPx=Math.abs(mapped.unclamped-mapped.local).toFixed(2);
   }else{
    delete root.dataset.geometryClampReason;
    delete root.dataset.geometryClampPx;
   }
   const visible=mapped.local;
   // Clamping is unavoidable only when the old absolute position no longer
   // exists in the new viewport. Never scale touch movement by the new height.
   const next=first&&phase!=="suspended"?(collapsedRef.current?top:bottom):
    phase==="idle"&&sheetIntent.current===null&&!sheetDragActive.current?
     (collapsedRef.current?top:bottom):visible;
   first=false;hidden=false;sheetRootTop.current=shellRect.top;
   sheetRevision.current++;
   collapsedY.current=top;expandedY.current=bottom;
   root.style.setProperty("--pm-expanded-y",bottom+"px");
   pane.style.setProperty("--pm-collapsed-top",top+"px");
   root.style.setProperty("--pm-dots-top",dots+"px");
   // Rebase active touch anchors without cancelling the user's finger session.
   rebaseSheetGesture.current(next,sheetRevision.current);
   const intent=sheetIntent.current;
   if(driver&&phase!=="idle"&&intent!==null&&!routeFrozen.current){
    const destination=intent?top:bottom;
    if(phase==="suspended")driver.reveal(sheetRevision.current,next,destination);
    else driver.rebase(sheetRevision.current,next,destination);
   }
   paintSheet(next,true);
   // Physical state is committed by settle completion, never merely by a target.
  };
  measureSheetRef.current=measure;
  measure();
  const ro=new ResizeObserver(measure);
  if(hero.current)ro.observe(hero.current);
  if(shell.current)ro.observe(shell.current);
  const anchor=(shell.current?.closest(".discovery-visitor-route")??shell.current?.closest(".discovery-app"))
   ?.querySelector<HTMLElement>(".lh-header .lh-center");
  if(anchor)ro.observe(anchor);
  const webApp=window.Telegram?.WebApp;
  const detachViewport=bindMotionViewport(window,()=>measure());
  const visual=window.visualViewport;
  window.addEventListener("resize",measure);
  visual?.addEventListener("resize",measure);
  visual?.addEventListener("scroll",measure);
  webApp?.onEvent?.("safeAreaChanged",measure);
  webApp?.onEvent?.("contentSafeAreaChanged",measure);
  webApp?.onEvent?.("viewportChanged",measure);
  return ()=>{
   measureSheetRef.current=()=>{};sheetRunner.current?.suspend();ro.disconnect();detachViewport();
   window.removeEventListener("resize",measure);
   visual?.removeEventListener("resize",measure);
   visual?.removeEventListener("scroll",measure);
   webApp?.offEvent?.("safeAreaChanged",measure);
   webApp?.offEvent?.("contentSafeAreaChanged",measure);
   webApp?.offEvent?.("viewportChanged",measure);
  };
 },[motionActive,paintSheet]);
 useEffect(()=>{
  const opticalFrame=blurSampleFrame,opticalSession=blurSession;
  const localArbiter=localGestures.current;
  return ()=>{
   opticalSession.current++;
   if(opticalFrame.current!==null)cancelAnimationFrame(opticalFrame.current);
   opticalFrame.current=null;
   stopSheet.current();stopTabs.current();
   sheetRunner.current?.dispose();tabsRunner.current?.dispose();
   localArbiter.dispose();
   if(dragFrame.current!==null)cancelAnimationFrame(dragFrame.current);
  };
 },[]);
 const closeTop=useCallback(():boolean=>{
  if(viewer){if(viewerBack.current)return viewerBack.current();setViewer(null);return true;}
  if(preview){if(previewBack.current?.())return true;setPreview(false);return true;}
  if(blikOpen){setBlikOpen(false);return true;}
  if(onClose){onClose();return true;}
  return false;
 },[viewer,preview,blikOpen,onClose]);
 useEffect(()=>{if(!active)return;registerBack?.(closeTop);return ()=>registerBack?.(null);},[active,closeTop,registerBack]);
 const openPhoto=(index:number,element:HTMLElement|null)=>{
  const photo=photos[index];
  if(performance.now()<clickBlocked.current||!photo)return;
  const contextId=viewerPhotoContext(view);
  const source:ViewerSource|null=element?{
   photoId:photo.id,contextId,resourceKey:resourceIdentity(photo),
   resolveElement:()=>element
  }:null;
  setViewer({photoId:photo.id,source});
 };
 // The visible CSS matrix (not activePhoto's integer) is the starting frame
 // when a new pointer interrupts a 290ms CSS track transition.
 const photoStart=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(!e.isPrimary){gestures.secondFinger();photoSwipe.current=null;return;}
  if((e.target as HTMLElement).closest("button")||(e.pointerType==="mouse"&&e.button!==0))return;
  const serial=gestures.begin("pointer",e.pointerId,"hero");
  if(serial===null)return;
  gestures.begin("pointer",e.pointerId,"native");
  photoSwipe.current={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now(),
   axis:"",index:activePhoto,width:hero.current?.clientWidth||innerWidth,serial};
 };
 const photoMove=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const g=photoSwipe.current;if(!g||g.id!==e.pointerId)return;
  const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(!g.axis){
   if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;
   g.axis=Math.abs(dx)>Math.abs(dy)*1.2?"x":"y";
   if(g.axis!=="x"){gestures.nativeScroll(g.serial!);return;}
  }
  if(g.axis!=="x")return;
  if(!g.claimed){
   if(!gestures.claim("hero",g.serial!))return;
   g.claimed=true;
   g.width=hero.current?.clientWidth||g.width;
   g.index=fractionalTrack(photoTrack.current,g.width,activePhoto);
   stopBlurTracking(); // pointer now owns sampled fraction, not old dot target
   if(photoTrack.current){
    // The exact capture frame is inspectable by real Chromium gesture QA.
    photoTrack.current.dataset.motionFrozenX=String(-g.index*g.width);
    photoTrack.current.style.transition="none";
    if(blurTrack.current)blurTrack.current.style.transition="none";
    setTransform(g.index);
   }
   try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* old WebView */}
  }
  if(!gestures.owns("hero",g.serial!))return;
  if(e.cancelable)e.preventDefault();
  const atFirst=g.index<=.001&&dx>0;
  const atLast=g.index>=photos.length-1-.001&&dx<0;
  const edge=atFirst||atLast;
  const shift=edge?dx*.18:dx;
  if(dragFrame.current!==null)cancelAnimationFrame(dragFrame.current);
  dragFrame.current=requestAnimationFrame(()=>{
   dragFrame.current=null;
   if(photoSwipe.current!==g||!gestures.owns("hero",g.serial!))return;
   if(blurWindowRef.current){
    const fractional=g.index-shift/Math.max(1,g.width);
    showBlurWindow(blurWindowAt(fractional,fractional+(shift>=0?-1:1)));
   }
   setTransform(g.index,shift);
  });
 };
 const choosePhoto=(index:number)=>{
  if(index<0||index>=photos.length)return;
  if(dragFrame.current!==null){cancelAnimationFrame(dragFrame.current);dragFrame.current=null;}
  const track=photoTrack.current,width=hero.current?.clientWidth||1;
  const currentFraction=fractionalTrack(track,width,activePhoto);
  stopBlurTracking();
  const far=Math.abs(index-currentFraction)>1.01;
  if(far||blurWindowRef.current)showBlurWindow(blurWindowAt(currentFraction,index));
  if(track){
   track.style.transition="none";
   if(blurTrack.current)blurTrack.current.style.transition="none";
   setTransform(currentFraction);
   // Flush once only on navigation boundaries, never on pointermove.
   void track.offsetWidth;
   track.style.transition="transform 290ms cubic-bezier(.2,.76,.22,1)";
   if(blurTrack.current)blurTrack.current.style.transition=track.style.transition;
  }
  setTransform(index);
  activePhotoId.current=photos[index].id;
  setBlurFrom(Math.max(0,Math.min(photos.length-1,Math.round(currentFraction))));
  setActivePhoto(index);
  if(far||blurWindowRef.current)followBlurPosition(index);
  else {
   const token=++blurSession.current;
   const done=()=>{if(token===blurSession.current)finishBlurTracking(index);};
   const ended=(event:TransitionEvent)=>{
    if(event.target===track&&event.propertyName==="transform"){
     track?.removeEventListener("transitionend",ended);done();
    }
   };
   track?.addEventListener("transitionend",ended);
   // Cleanup fallback only: the unchanged physical CSS settle is 290 ms.
   window.setTimeout(()=>{track?.removeEventListener("transitionend",ended);done();},330);
  }
 };
 const photoEnd=(e:ReactPointerEvent<HTMLDivElement>,cancel=false)=>{
  const g=photoSwipe.current;if(!g||g.id!==e.pointerId)return;
  photoSwipe.current=null;
  if(dragFrame.current!==null){cancelAnimationFrame(dragFrame.current);dragFrame.current=null;}
  if(!g.claimed||!gestures.owns("hero",g.serial!)){
   if(g.axis==="y"&&gestures.owns("native",g.serial!))gestures.finish("native",g.serial!);
   else gestures.finishCandidate(g.serial!);
   return;
  }
  gestures.finish("hero",g.serial!);
  try{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}catch{/* implicit release */}
  const dx=e.clientX-g.x,dt=Math.max(1,performance.now()-g.t);
  const target=!cancel&&(Math.abs(dx)>g.width*.2||Math.abs(dx)/dt>.55)?
   Math.max(0,Math.min(photos.length-1,Math.round(g.index)+(dx<0?1:-1))):
   Math.max(0,Math.min(photos.length-1,Math.round(g.index)));
  choosePhoto(target);
  clickBlocked.current=performance.now()+280;
 };
 useLayoutEffect(()=>{
  const list=previousPhotos.current;
  if(list===photos)return;
  previousPhotos.current=photos;
  const index=preservePhotoId(list,photos,activePhotoId.current,activePhoto);
  // Reorder/removal invalidates pending indices, never keeps a blur slot
  // bound to the old photo at the same array position.
  stopBlurTracking();blurWindowRef.current=null;
  blurWriterRef.current(null);setBlurFrom(index);
  activePhotoId.current=photos[index]?.id??null;
  photoSwipe.current=null;
  if(dragFrame.current!==null){cancelAnimationFrame(dragFrame.current);dragFrame.current=null;}
  if(photoTrack.current){
   photoTrack.current.style.transition="none";
   if(blurTrack.current)blurTrack.current.style.transition="none";
   setTransform(index);
  }
  if(index!==activePhoto)setActivePhoto(index);
 },[photos,activePhoto,setTransform]);
 const paintTabs=useCallback((i:number,dx=0)=>{
  motionAuthority.current.run("tabs",PROFILE_MOTION_WRITER_TABLE.tabs,()=>{
  const position=Math.max(0,Math.min(4,i-dx/Math.max(1,tabViewport.current)));
  tabLastPosition.current=position;
  if(pages.current)pages.current.scrollLeft=position*tabViewport.current;
  const indicator=ink.current,metrics=tabMetrics.current;
  const left=Math.floor(position),right=Math.min(4,left+1),ratio=position-left;
  const first=metrics[left],other=metrics[right];
  if(!indicator||!first||!other)return;
  const x=first.left+(other.left-first.left)*ratio;
  const width=first.width+(other.width-first.width)*ratio;
  indicator.style.transform=`translate3d(${x}px,0,0) scaleX(${width/Math.max(1,metrics[0].width)})`;
  });
 },[]);
 useLayoutEffect(()=>{
  const bar=tabBar.current;
  if(!motionActive||!bar)return;
  let first=true,hidden=false;
  const measure=()=>{
   const rawWidth=pages.current?.clientWidth??0;
   if(!bar.clientWidth||!rawWidth){hidden=true;tabsRunner.current?.suspend();return;}
   const metrics=Array.from(bar.querySelectorAll<HTMLButtonElement>(".pm-tab"))
    .map(el=>({left:el.offsetLeft,width:el.offsetWidth}));
   if(!metrics.length||metrics.some(m=>m.width<=0))return;
   const changed=hidden||rawWidth!==tabViewport.current||
    metrics.some((m,i)=>m.left!==tabMetrics.current[i]?.left||m.width!==tabMetrics.current[i]?.width);
   if(!first&&!changed)return;
   // Snapshot the FRACTIONAL page before width and tab metrics are replaced.
   const runner=tabsRunner.current,phase=runner?.snapshot().phase??"idle";
   const fraction=phase==="settling"||phase==="suspended"?runner!.sample():tabLastPosition.current;
   first=false;hidden=false;tabsRevision.current++;
   tabMetrics.current=metrics;tabViewport.current=rawWidth;
   if(ink.current)ink.current.style.width=metrics[0].width+"px";
   rebaseTabsGesture.current(fraction,tabsRevision.current);
   if(tabSwipe.current){
    const g=tabSwipe.current;
    g.index=reanchorPage(fraction,g.x,g.lastX??g.x,rawWidth);
    g.width=rawWidth;g.revision=tabsRevision.current;
   }
   // Do not paintTabs(selected): that destroys fractional position mid-settle.
   const destination=tabs.findIndex(v=>v[0]===tabSelectionRef.current);
   if(runner&&phase!=="idle"&&!routeFrozen.current){
    if(phase==="suspended")runner.reveal(tabsRevision.current,fraction,destination);
    else runner.rebase(tabsRevision.current,fraction,destination);
   }
   paintTabs(fraction);
  };
  measureTabsRef.current=measure;
  measure();
  const ro=new ResizeObserver(measure);
  ro.observe(bar);
  if(pages.current)ro.observe(pages.current);
  let cancelled=false;
  void document.fonts.ready.then(()=>{if(!cancelled)measure();});
  const detachViewport=bindMotionViewport(window,()=>measure());
  return ()=>{cancelled=true;measureTabsRef.current=()=>{};ro.disconnect();detachViewport();tabsRunner.current?.suspend();};
 },[motionActive,paintTabs]);
 const chooseTab=useCallback((newIndex:number)=>{
  const i=Math.min(4,Math.max(0,newIndex));
  stopTabs.current();
  const runner=ensureTabsRunner();
  const from=runner.snapshot().phase==="idle"?tabLastPosition.current:runner.cancel();
  tabSelectionRef.current=tabs[i][0];
  setTab(tabs[i][0]);
  runner.start(from,i,295,[.22,.77,.23,1],value=>paintTabs(value),()=>paintTabs(i),
   tabsRevision.current);
  stopTabs.current=()=>{const frozen=runner.cancel();paintTabs(frozen);};
  const bar=tabBar.current,metric=tabMetrics.current[i];
  if(bar&&metric)bar.scrollTo({left:Math.max(0,metric.left+metric.width/2-bar.clientWidth/2),
   behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
 },[paintTabs]);
 // Mouse/pen tab input must use the SAME exclusive gesture owner as native
 // sheet Touch and the visitor route. Candidate input must not stop settling.
 const tabDown=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(e.pointerType==="touch")return;
  if(!e.isPrimary){gestures.secondFinger();tabSwipe.current=null;return;}
  if(e.pointerType==="mouse"&&e.button!==0)return;
  const serial=gestures.begin("pointer",e.pointerId,"tabs");
  if(serial===null)return;
  gestures.begin("pointer",e.pointerId,"native");
  tabSwipe.current={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now(),axis:"",
   index:(pages.current?.scrollLeft??0)/tabViewport.current,width:tabViewport.current,
   lastX:e.clientX,revision:tabsRevision.current,serial,claimed:false};
 };
 const tabMove=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const g=tabSwipe.current;if(!g||g.id!==e.pointerId)return;
  g.lastX=e.clientX;
  const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(!g.axis){
   if(Math.max(Math.abs(dx),Math.abs(dy))<7)return;
   g.axis=Math.abs(dx)>Math.abs(dy)*1.18?"x":"y";
   if(g.axis!=="x"){gestures.nativeScroll(g.serial!);return;}
  }
  if(g.axis!=="x")return;
  if(!g.claimed){
   if(!gestures.claim("tabs",g.serial!))return;
   g.claimed=true;
   stopTabs.current();
   // REM-02B fractional position survives the unclaimed candidate period.
   g.index=(pages.current?.scrollLeft??0)/Math.max(1,tabViewport.current);
   g.width=tabViewport.current;
   try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* old WebView */}
  }
  if(!gestures.owns("tabs",g.serial!))return;
  if(e.cancelable)e.preventDefault();
  paintTabs(g.index,dx);
 };
 const tabEnd=(e:ReactPointerEvent<HTMLDivElement>,cancel=false)=>{
  const g=tabSwipe.current;if(!g||g.id!==e.pointerId)return;
  tabSwipe.current=null;
  if(!g.claimed||!gestures.owns("tabs",g.serial!)){
   if(g.axis==="y"&&gestures.owns("native",g.serial!))gestures.finish("native",g.serial!);
   else gestures.finishCandidate(g.serial!);
   return;
  }
  gestures.finish("tabs",g.serial!);
  try{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}catch{/* implicit release */}
  const dx=e.clientX-g.x,dt=Math.max(1,performance.now()-g.t);
  const next=!cancel&&(Math.abs(dx)>g.width*.17||Math.abs(dx)/dt>.52)?
   Math.round(g.index)+(dx<0?1:-1):Math.round(g.index);
  clickBlocked.current=performance.now()+240;
  chooseTab(next);
 };
 useEffect(()=>{
  const pane=sheet.current;if(!motionActive||!pane)return;
  type SheetGesture={x:number;y:number;start:number;down:boolean;scrollTop:number;
   origin:number;axis:""|"x"|"y"|"native";inPages:boolean;index:number;
   lastY:number;lastX:number;lastTime:number;velocity:number;blocking:boolean;revision:number;
   serial:number;claimed:boolean};
  let gesture:SheetGesture|null=null,frame:number|null=null;
  const flush=()=>{if(frame!==null){cancelAnimationFrame(frame);frame=null;}};
  const abort=()=>{
   pane.removeEventListener("touchmove",move);flush();gesture=null;
   sheetDragActive.current=false;
  };
  rebaseSheetGesture.current=(newValue,revision)=>{
   const g=gesture;if(!g)return;
   flush();g.origin=reanchorSheet(newValue,g.y,g.lastY);
   g.revision=revision;
  };
  rebaseTabsGesture.current=(position,revision)=>{
   const g=gesture;if(!g||!g.inPages)return;
   flush();g.index=reanchorPage(position,g.x,g.lastX,tabViewport.current);
   g.revision=revision;
  };
  cancelSheetGesture.current=abort;
  const start=(e:TouchEvent)=>{
   if(routeFrozen.current||routeTerminal.current)return;
   if(e.touches.length!==1){gestures.secondFinger();cancel();return;}
   const target=e.target as HTMLElement;
   if(target.closest(".pm-tabs"))return;
   const t=e.touches[0],inPages=!!target.closest(".pm-pages");
   const serial=gestures.begin("touch",t.identifier,"sheet");
   if(serial===null)return;
   // One physical touch can be observed by pointer and native Touch adapters.
   gestures.begin("touch",t.identifier,"tabs");
   gestures.begin("touch",t.identifier,"native");
   const scrollTop=inPages?(contentPages.current[tabs.findIndex(v=>v[0]===tabSelectionRef.current)]?.scrollTop||0):0;
   // A candidate does not stop an existing settle or the browser native scroll.
   sheetDragActive.current=false;
   const now=performance.now();
   gesture={x:t.clientX,y:t.clientY,start:now,down:collapsedRef.current,scrollTop,
    origin:sheetY.current,axis:"",inPages,index:(pages.current?.scrollLeft??0)/tabViewport.current,
    lastY:t.clientY,lastX:t.clientX,lastTime:now,velocity:0,
    revision:sheetRevision.current,blocking:inPages?scrollTop<=1:!collapsedRef.current,
    serial,claimed:false};
   pane.removeEventListener("touchmove",move);
   pane.addEventListener("touchmove",move,{passive:!gesture.blocking});
  };
  const move=(e:TouchEvent)=>{
   const g=gesture;if(!g||e.touches.length!==1)return;
   const t=e.touches[0],dx=t.clientX-g.x,dy=t.clientY-g.y;
   g.lastX=t.clientX;
   if(!g.axis){
    if(Math.max(Math.abs(dx),Math.abs(dy))<7)return;
    // A page already scrolled vertically keeps native control in either axis,
    // including vertical diagonals; no custom sheet or tabs writer may claim.
    if(g.inPages&&g.scrollTop>1){g.axis="native";gestures.nativeScroll(g.serial);return;}
    // If the listener started passive, it must NEVER take over native scroll
    // mid-session, even when the diagonal later resembles a horizontal drag.
    if(Math.abs(dx)>Math.abs(dy)*1.18)
     g.axis=g.inPages&&g.blocking&&e.cancelable?"x":"native";
    else g.axis=(dy>0?(g.scrollTop<=1&&g.origin<=expandedY.current+28):
     g.origin>collapsedY.current+.5)?"y":"native";
    if(g.axis==="native"){gestures.nativeScroll(g.serial);return;}
    const owner=g.axis==="x"?"tabs":"sheet";
    if(!gestures.claim(owner,g.serial)){g.axis="native";return;}
    g.claimed=true;
    if(g.axis==="x")stopTabs.current();
    else {stopSheet.current();sheetIntent.current=null;sheetDragActive.current=true;}
   }
   if(g.axis==="native"||!gestures.owns(g.axis==="x"?"tabs":"sheet",g.serial))return;
   if(g.blocking&&e.cancelable)e.preventDefault();
   const now=performance.now(),dt=now-g.lastTime;
   if(dt>0){g.velocity=(t.clientY-g.lastY)/dt;g.lastTime=now;}
   g.lastY=t.clientY;
   flush();
   const rev=g.revision;
   frame=requestAnimationFrame(()=>{
    frame=null;
    if(gesture!==g||rev!==g.revision||!gestures.owns(g.axis==="x"?"tabs":"sheet",g.serial))return;
    if(g.axis==="x")paintTabs(g.index,dx);
    else {
     const raw=g.origin+dy,extra=Math.max(0,raw-expandedY.current);
     paintSheet(raw>expandedY.current?
      expandedY.current+28*(1-Math.exp(-extra/48)):raw,true);
    }
   });
  };
  const finish=(e:TouchEvent,cancelled:boolean)=>{
   const g=gesture;abort();if(!g)return;
   if(g.claimed)gestures.finish(g.axis==="x"?"tabs":"sheet",g.serial);
   else if(g.axis==="native")gestures.finish("native",g.serial);
   else gestures.finishCandidate(g.serial);
   const t=e.changedTouches[0];if(!t)return;
   const dx=t.clientX-g.x,dy=t.clientY-g.y;
   if(g.axis==="x"&&g.claimed){
    const dt=Math.max(1,performance.now()-g.start);
    const next=!cancelled&&(Math.abs(dx)>tabViewport.current*.17||Math.abs(dx)/dt>.52)?
     Math.round(g.index)+(dx<0?1:-1):Math.round(g.index);
    clickBlocked.current=performance.now()+260;chooseTab(next);
   }else if(g.axis==="y"&&g.claimed){
    if(!cancelled){
      const raw=g.origin+dy,extra=Math.max(0,raw-expandedY.current);
      paintSheet(raw>expandedY.current?
       expandedY.current+28*(1-Math.exp(-extra/48)):raw,true);
     }
    const velocity=performance.now()-g.lastTime<90?g.velocity:0;
    const threshold=Math.min(90,Math.max(65,(expandedY.current-collapsedY.current)*.2));
    const commit=g.down?(dy>threshold||velocity>.65):(dy< -threshold||velocity<-.65);
    clickBlocked.current=performance.now()+260;
    settleSheet(cancelled?g.down:g.down?!commit:commit);
   }else if(!g.axis){
    // A tap during settling resumes from the frozen position.
    settleSheet(g.down);
    const selected=tabs.findIndex(v=>v[0]===tabSelectionRef.current);
    if(g.inPages&&Math.abs((pages.current?.scrollLeft??0)-selected*tabViewport.current)>.5)chooseTab(selected);
   } // Native scroll is exclusive; never repair pages.scrollLeft from its touchend.
  };
  const end=(e:TouchEvent)=>finish(e,false);
  const cancel=()=>{
   const g=gesture;abort();if(!g)return;
   if(g.claimed)gestures.finish(g.axis==="x"?"tabs":"sheet",g.serial);
   else if(g.axis==="native")gestures.finish("native",g.serial);
   else gestures.finishCandidate(g.serial);
   if(g.axis==="x"&&g.claimed)chooseTab(tabs.findIndex(v=>v[0]===tabSelectionRef.current));
   else if(g.axis==="y"&&g.claimed)settleSheet(g.down);
  };
  pane.addEventListener("touchstart",start,{passive:true});
  pane.addEventListener("touchend",end,{passive:true});
  pane.addEventListener("touchcancel",cancel,{passive:true});
  return ()=>{
   abort();cancelSheetGesture.current=()=>{};
   rebaseSheetGesture.current=()=>{};rebaseTabsGesture.current=()=>{};
   pane.removeEventListener("touchstart",start);pane.removeEventListener("touchend",end);
   pane.removeEventListener("touchcancel",cancel);
  };
 },[motionActive,paintSheet,paintTabs,settleSheet,chooseTab,gestures]);
 // REM-02D: preserve actual fractional positions and semantic destinations.
 const suspendForRoute=()=>{
  if(routeTerminal.current||routeFrozen.current)return;
  const sheetState=sheetRunner.current?.snapshot(),tabsState=tabsRunner.current?.snapshot();
  const sheetValue=sheetState?.phase==="settling"?sheetRunner.current!.sample():sheetY.current;
  const tabsValue=tabsState?.phase==="settling"?tabsRunner.current!.sample():tabLastPosition.current;
  routeFrozen.current={
   sheet:sheetValue,sheetTarget:sheetIntent.current??collapsedRef.current,
   sheetSettling:sheetState?.phase==="settling"||sheetState?.phase==="suspended",
   tabs:tabsValue,tabsTarget:tabs.findIndex(v=>v[0]===tabSelectionRef.current),
   tabsSettling:tabsState?.phase==="settling"||tabsState?.phase==="suspended"
  };
  cancelSheetGesture.current();
  const photoId=photoSwipe.current?.id,tabId=tabSwipe.current?.id;
  photoSwipe.current=null;tabSwipe.current=null;sheetDragActive.current=false;
  // Lost native cancel events must not leave hidden pointer capture behind.
  try{if(photoId!==undefined&&hero.current?.hasPointerCapture(photoId))
   hero.current.releasePointerCapture(photoId);}catch{/* WebView capture may already be gone */}
  try{if(tabId!==undefined&&pages.current?.hasPointerCapture(tabId))
   pages.current.releasePointerCapture(tabId);}catch{/* implicit release */}
  if(dragFrame.current!==null){cancelAnimationFrame(dragFrame.current);dragFrame.current=null;}
  sheetRunner.current?.suspend();tabsRunner.current?.suspend();
  paintSheet(sheetValue,true);paintTabs(tabsValue);
 };
 const rollbackRoute=()=>{
  if(routeTerminal.current)return;
  const saved=routeFrozen.current;if(!saved)return;
  measureSheetRef.current();measureTabsRef.current();
  routeFrozen.current=null;
  const sheetDriver=sheetRunner.current;
  if(saved.sheetSettling&&sheetDriver?.snapshot().phase==="suspended"){
   sheetRevision.current=Math.max(sheetRevision.current,sheetDriver.snapshot().revision+1);
   sheetDriver.reveal(sheetRevision.current,sheetY.current,
    saved.sheetTarget?collapsedY.current:expandedY.current);
  }else if(Math.abs(sheetY.current-(saved.sheetTarget?collapsedY.current:expandedY.current))>.5)
   settleSheet(saved.sheetTarget);
  const tabDriver=tabsRunner.current;
  if(saved.tabsSettling&&tabDriver?.snapshot().phase==="suspended"){
   tabsRevision.current=Math.max(tabsRevision.current,tabDriver.snapshot().revision+1);
   tabDriver.reveal(tabsRevision.current,tabLastPosition.current,saved.tabsTarget);
  }else if(Math.abs(tabLastPosition.current-saved.tabsTarget)>.001)
   chooseTab(saved.tabsTarget);
 };
 const commitRouteClose=()=>{
  if(routeTerminal.current)return;
  routeTerminal.current=true;routeFrozen.current=null;
  cancelSheetGesture.current();photoSwipe.current=null;tabSwipe.current=null;
  if(dragFrame.current!==null){cancelAnimationFrame(dragFrame.current);dragFrame.current=null;}
  stopSheet.current();stopTabs.current();
  sheetRunner.current?.dispose();tabsRunner.current?.dispose();
 };
 const suspendForBackground=()=>{if(!routeTerminal.current){suspendForRoute();gestures.cancel();}};
 const resumeFromBackground=()=>{if(!routeTerminal.current)rollbackRoute();};
 const routeMotionHandle=useRef<ProfileRouteMotionHandle>({
  suspendForRoute:()=>{},rollbackRoute:()=>{},commitRouteClose:()=>{},
  suspendForBackground:()=>{},resumeFromBackground:()=>{}
 });
 routeMotionHandle.current={suspendForRoute,rollbackRoute,commitRouteClose,
  suspendForBackground,resumeFromBackground};
 useLayoutEffect(()=>{
  if(!registerRouteMotion)return;
  const handle:ProfileRouteMotionHandle={
   suspendForRoute:()=>routeMotionHandle.current.suspendForRoute(),
   rollbackRoute:()=>routeMotionHandle.current.rollbackRoute(),
   commitRouteClose:()=>routeMotionHandle.current.commitRouteClose(),
   suspendForBackground:()=>routeMotionHandle.current.suspendForBackground(),
   resumeFromBackground:()=>routeMotionHandle.current.resumeFromBackground()
  };
  registerRouteMotion(handle);
  return ()=>registerRouteMotion(null);
 },[registerRouteMotion]);
 useEffect(()=>{
  if(gestureArbiter)return;
  return bindMotionLifecycle(()=>{
   routeMotionHandle.current.suspendForBackground();
  },()=>routeMotionHandle.current.resumeFromBackground());
 },[gestureArbiter]);
 useLayoutEffect(()=>{
  if(!registerRouteGestureCancel)return;
  const cancel=()=>{
   photoSwipe.current=null;tabSwipe.current=null;
   cancelSheetGesture.current();
   stopSheet.current();stopTabs.current();
   if(dragFrame.current!==null){cancelAnimationFrame(dragFrame.current);dragFrame.current=null;}
  };
  registerRouteGestureCancel(cancel);
  return ()=>registerRouteGestureCancel(null);
 },[registerRouteGestureCancel]);
 const openMyPhotos=()=>{chooseTab(2);settleSheet(true);};
 const openAvatar=()=>{
  if(view.profile.activeBlik){setBlikOpen(true);return;}
  settleSheet(false);
 };
 const nameLine=<>{view.profile.name||"Имя не указано"}{view.profile.age!==null?", "+view.profile.age:""}</>;
 const location=<>{view.profile.city||view.profile.country?<>{view.profile.countryCode&&<Flag code={view.profile.countryCode} size={19}/>}<span>{[view.profile.city,view.profile.country].filter(Boolean).join(", ")}</span></>:"Город не указан"}</>;
 const goal=view.profile.goal&&view.profile.goal!=="undecided"?goals.find(x=>x.id===view.profile.goal):null;
 // Step 8 embeds the sheet; owner "Предпросмотр" opens a closable nested dialog.
 const embeddedSelf=mode==="local-self-preview"&&!onClose;
 return <section ref={shell} data-sheet-state={collapsed?"collapsed":"expanded"} data-sheet-renderer="scroll" className={"pm-shell "+(mode==="owner"||embeddedSelf?"pm-inline":"pm-dialog")} role={mode==="owner"||embeddedSelf?undefined:"dialog"}
   aria-modal={mode==="owner"||embeddedSelf?undefined:true} aria-label={mode==="owner"?"Мой профиль":mode==="local-self-preview"?"Локальный предпросмотр черновика":mode==="preview"?"Посмотреть глазами других":"Демо-профиль"}>
  {(mode==="preview"||mode==="local-self-preview"&&!!onClose)&&<div className="pm-preview-toolbar"><button type="button" onClick={onClose}>Закрыть предпросмотр</button></div>}
   <div className="pm-hero" ref={hero} onPointerDown={photoStart} onPointerMove={photoMove}
    onPointerUp={e=>photoEnd(e)} onPointerCancel={e=>photoEnd(e,true)}
     onLostPointerCapture={e=>photoEnd(e,true)}>
    <div className="pm-photo-motion" ref={photoMotion}>
    {photos.length?<div className="pm-photo-track" ref={photoTrack}>
      {photos.map((p,i)=><div className="pm-photo-slide" key={p.id} onClick={event=>openPhoto(i,event.currentTarget.querySelector("img"))}>
       <PhotoImage photo={p} alt={"Фото "+(i+1)+" · "+view.profile.name} loading={i===0?"eager":"lazy"}/></div>)}
     </div>:<div className="pm-hero-no-photo"><Images size={40}/><span>{view.profile.source==="local-draft"?"В локальном черновике нет фото":"Публичных фотографий пока нет"}</span></div>}
     <div className="pm-photo-blur" ref={blurLayer} aria-hidden="true">
      <ProfileBlurTrack photos={photos} activePhoto={activePhoto} blurFrom={blurFrom}
       trackRef={blurTrack} bindWriter={bindBlurWriter}/>
     </div>
     </div>
    <div className="pm-hero-gradient" aria-hidden="true"/>
    {photos.length>1&&<div className="pm-photo-progress" role="group" aria-label="Фотографии профиля">{photos.map((p,i)=>
     <button type="button" key={p.id} aria-label={"Фото "+(i+1)+" из "+photos.length}
       aria-current={i===activePhoto?"true":undefined}
       className={i===activePhoto?"active":""}
       onClick={()=>choosePhoto(i)}/>)}</div>}
    {view.profile.source!=="server"&&<span className="pm-hero-demo">{view.profile.source==="fixture"?"Демо":"Черновик"}</span>}
   </div>
   <div className="pm-sheet-viewport" ref={viewport}>
    <div className="pm-sheet-spacer" aria-hidden="true"/>
   <div className="pm-profile-sheet" ref={sheet} onClickCapture={e=>{
    if(performance.now()<clickBlocked.current){e.preventDefault();e.stopPropagation();}
   }}>
    <button ref={grab} type="button" className="pm-sheet-grab" onClick={()=>settleSheet(!collapsedRef.current)}
      tabIndex={collapsed?-1:0} aria-label={collapsed?"Потянуть панель вниз":"Развернуть анкету"}><span/></button>
    <div className="pm-identity">
     <div className="pm-identity-core">
      <div className="pm-identity-text">
       <h2>{nameLine} {view.profile.premium&&<span className="pm-premium">◆</span>}{view.profile.verified&&<ShieldCheck size={19} aria-label="Подтверждён"/>}</h2>
       <p className="pm-identity-location">{location}</p>
      </div>
      {current&&<button ref={miniAvatar} type="button" className={"pm-mini-avatar"+(view.profile.activeBlik?" has-blik":"")}
         onClick={openAvatar} tabIndex={collapsed?0:-1} aria-hidden={!collapsed}
         aria-label={view.profile.activeBlik?"Открыть активный блик":"Раскрыть фото профиля"}>
         <PhotoImage photo={current} alt="" loading="eager"/>
       </button>}
     </div>
     {goal&&<span className="pm-goal-chip"><Heart size={14}/>{goal.label}</span>}
    </div>
    {mode==="owner"&&<div className="pm-owner-actions">
     <button type="button" onClick={openMyPhotos}><Images size={17}/> Мои фото</button>
     <button type="button" className="pm-owner-edit" onClick={onEdit}><PenLine size={17}/> Изменить</button>
     <button type="button" onClick={()=>setPreview(true)}><Eye size={17}/>{data.source==="local-draft"?"Предпросмотр":"Как видят"}</button>
    </div>}
   <div className="pm-tabs" ref={tabBar} role="tablist" aria-label="Разделы профиля">
    {tabs.map(([id,label,Icon],i)=><button type="button" key={id} className={"pm-tab"+(id===tab?" active":"")} role="tab"
      aria-selected={id===tab} onClick={()=>chooseTab(i)}><Icon size={16}/><span>{label}</span></button>)}
    <span className="pm-tab-ink" ref={ink} aria-hidden="true"/>
   </div>
   <div className="pm-pages" ref={pages} onPointerDown={tabDown} onPointerMove={tabMove}
     onPointerUp={e=>tabEnd(e)} onPointerCancel={e=>tabEnd(e,true)}
     onLostPointerCapture={e=>tabEnd(e,true)}>
    <div className="pm-pages-track" ref={pageTrack}>
     <div className="pm-page" ref={e=>{if(e)contentPages.current[0]=e;}}><About view={view}/></div>
     <div className="pm-page" ref={e=>{if(e)contentPages.current[1]=e;}}><Bliki/></div>
     <div className="pm-page" ref={e=>{if(e)contentPages.current[2]=e;}}>
      {photos.length?<div className="pm-photos-grid">{photos.map((p,i)=><button type="button" key={p.id} className="pm-photo-tile"
       onClick={e=>openPhoto(i,e.currentTarget.querySelector("img"))} aria-label={"Открыть фото "+(i+1)}>
       <PhotoImage photo={p} alt="" loading="lazy"/>{p.status!=="published"&&<span>{p.status==="draft"?"Черновик":"Проверка"}</span>}
       </button>)}</div>:<div className="pm-empty"><Images size={38}/><h3>{view.profile.source==="local-draft"?"Пока нет готовых фото":"Пока нет опубликованных фото"}</h3>
        <p>{view.profile.source==="local-draft"?"Добавь фотографии или дождись окончания локальной обработки.":"Фото на модерации и приватные снимки не видны другим."}</p></div>}
     </div>
     <div className="pm-page" ref={e=>{if(e)contentPages.current[3]=e;}}><Gifts view={view}/></div>
     <div className="pm-page" ref={e=>{if(e)contentPages.current[4]=e;}}><Meta view={view}/></div>
    </div>
   </div>
  </div>
  </div>
  {viewer&&<QaProfiler id="PhotoViewer"><PhotoViewer view={view} photos={photos} initialPhotoId={viewer.photoId} source={viewer.source}
    contextId={viewerPhotoContext(view)}
    onClose={()=>setViewer(null)} registerBack={registerViewerBack}
    /></QaProfiler>}
  {blikOpen&&view.profile.activeBlik&&<BlikViewer blik={view.profile.activeBlik} name={view.profile.name} onClose={()=>setBlikOpen(false)}/>}
  {preview&&<ProfileMaster data={data} mode={data.source==="local-draft"?"local-self-preview":"preview"} onClose={()=>setPreview(false)} registerBack={registerPreviewBack} active={active} onMotionProgress={onMotionProgress}/>}
 </section>;
});
