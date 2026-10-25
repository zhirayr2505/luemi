import {memo,useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from "react";
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
import {createProfileMotionAuthority,PROFILE_MOTION_WRITER_TABLE,bindMotionViewport} from "./profile-motion";
import {GeometryMotion} from "./geometry-motion";
import {ProfileSheetMotion} from "./profile-sheet-motion";
import {createSheetFrameTrace,installMotionDebugPanel,motionDebug,motionDebugEnabled,type SheetFrameTrace} from "../ui/motion-debug";
import {reanchorSheet,reanchorPage,remapSheetPixel} from "./profile-geometry";
import {GestureArbiter,fractionalTrack,preservePhotoId} from "../ui/gesture-arbiter";
import {bindMotionLifecycle} from "../ui/motion-lifecycle";
import "./profile-master.css";
import {useModalLayer} from "../ui/modal-layer";

type TabId="about"|"bliki"|"photos"|"gifts"|"meta";
export type ProfileRouteMotionHandle={
 suspendForRoute:()=>void;rollbackRoute:()=>void;commitRouteClose:()=>void;
 suspendForBackground:()=>void;resumeFromBackground:()=>void;
};
type Props={
 data:ProfileMasterData;mode:ProfileView["mode"];onClose?:()=>void;onEdit?:()=>void;
 registerBack?:(handler:(()=>boolean)|null)=>void;
 active?:boolean;onMotionProgress?:(progress:number,dragging:boolean)=>void;
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
/** LU-13 media-window owner. React owns the six stable keyed slot wrappers,
 * not the changing set of at most three decoded image nodes. The ONLY hero
 * transform writer remains PROFILE_MOTION_WRITER_TABLE.hero. This bounded
 * writer changes img membership synchronously before the next paint, with no
 * React render/commit per fractional-window change and no new motion clock.
 */
const ProfileBlurTrack=memo(function ProfileBlurTrack({
 photos,activePhoto,blurFrom,trackRef,bindWriter
}:{
 photos:ProfilePhoto[];activePhoto:number;blurFrom:number;
 trackRef:{current:HTMLDivElement|null};
 bindWriter:(writer:BlurWindowWriter|null)=>void;
}){
 type Peer={node:HTMLImageElement;resource:string};
 const liveRef=useRef(new Map<number,Peer>());
 const overrideRef=useRef<number[]|null>(null);
 const prevPhotosRef=useRef(photos);
 const propsRef=useRef({photos,activePhoto,blurFrom});
 propsRef.current={photos,activePhoto,blurFrom};
 // A photo reorder or src/version replacement must invalidate numeric
 // window slots and never reuse another photo's decoded DOM image.
 if(prevPhotosRef.current!==photos){
  prevPhotosRef.current=photos;
  overrideRef.current=null;
 }
 const updateWindow=()=>{
  const {photos,activePhoto,blurFrom}=propsRef.current;
  const track=trackRef.current;
  if(!track)return;
  const slots=track.children;
  const from=overrideRef.current;
  const requested=from??(()=>{
   const list=[activePhoto];
   if(blurFrom!==activePhoto&&photos[blurFrom])list.push(blurFrom);
   for(const neighbor of [activePhoto-1,activePhoto+1])
    if(list.length<3&&photos[neighbor]&&!list.includes(neighbor))list.push(neighbor);
   return list;
  })();
  const wanted:number[]=[];
  for(const index of requested){
   if(index>=0&&index<photos.length&&!wanted.includes(index)&&wanted.length<3)wanted.push(index);
  }
  // Remove peers that left first; <=3 image nodes at every mutation step.
  for(const [index,peer] of liveRef.current){
   const photo=photos[index],slot=slots[index];
   const identity=photo?resourceIdentity(photo)+"|"+(photo.fallback??""):null;
   if(!wanted.includes(index)||peer.resource!==identity||peer.node.parentElement!==slot){
    peer.node.onerror=null;peer.node.remove();liveRef.current.delete(index);
   }
  }
  for(const index of wanted){
   if(liveRef.current.has(index))continue;
   const photo=photos[index],slot=slots[index];
   if(!photo||!slot)continue;
   const node=document.createElement("img");
   node.dataset.photoId=photo.id;
   node.alt="";node.draggable=false;node.loading="eager";node.decoding="async";
   const fallback=photo.fallback;
   if(fallback)node.onerror=()=>{
    if(node.src!==fallback)node.src=fallback;
   };
   node.src=photo.src;
   slot.appendChild(node);
   liveRef.current.set(index,{node,resource:resourceIdentity(photo)+"|"+(fallback??"")});
  }
 };
 const writerRef=useRef<BlurWindowWriter>(()=>{});
 const applyRef=useRef<()=>void>(()=>{});
 applyRef.current=updateWindow;
 writerRef.current=indices=>{overrideRef.current=indices;applyRef.current();};
 useLayoutEffect(()=>{
  const peers=liveRef.current;
  const bridge:BlurWindowWriter=indices=>writerRef.current(indices);
  bindWriter(bridge);
  // Initial media are present on the first layout frame.
  bridge(null);
  return ()=>{
   bindWriter(null);
   for(const peer of peers.values()){
    peer.node.onerror=null;peer.node.remove();
   }
   peers.clear();overrideRef.current=null;
  };
 },[bindWriter]);
 useLayoutEffect(()=>{applyRef.current();},[photos,activePhoto,blurFrom]);
 return <div className="pm-photo-blur-track" ref={trackRef}>
  {photos.map(photo=><div className="pm-photo-blur-slide" key={photo.id} data-blur-photo-id={photo.id}/>)}
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
export const ProfileMaster=memo(function ProfileMaster({data,mode,onClose,onEdit,registerBack,active=true,onMotionProgress,registerRouteMotion,gestureArbiter}:Props){
 const [preview,setPreview]=useState(false);
 const [tab,setTab]=useState<TabId>("about");
 const [viewer,setViewer]=useState<{photoId:string;source:ViewerSource|null}|null>(null);
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
 const nestedBack=useRef<()=>void>(()=>{});
 const isNestedPreview=mode==="preview"||(mode==="local-self-preview"&&!!onClose);
 useModalLayer(isNestedPreview,shell,()=>nestedBack.current());
 const hero=useRef<HTMLDivElement>(null),photoTrack=useRef<HTMLDivElement>(null),blurTrack=useRef<HTMLDivElement>(null);
 const grab=useRef<HTMLButtonElement>(null),miniAvatar=useRef<HTMLButtonElement>(null);
 const photoMotion=useRef<HTMLDivElement>(null);
 const tabBar=useRef<HTMLDivElement>(null),pages=useRef<HTMLDivElement>(null),pageTrack=useRef<HTMLDivElement>(null);
 const keyboardTabFocus=useRef<number|null>(null);
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
 const sheetMotion=useRef<ProfileSheetMotion|null>(null),tabsRunner=useRef<GeometryMotion|null>(null);
 const sheetRevision=useRef(0),tabsRevision=useRef(0);
 const sheetRootTop=useRef<number|null>(null);
 const sheetDragActive=useRef(false);
 const measureSheetRef=useRef<()=>void>(()=>{}),measureTabsRef=useRef<()=>void>(()=>{});
 const routeFrozen=useRef<{sheet:number;sheetTarget:boolean;sheetSettling:boolean;
   tabs:number;tabsTarget:number;tabsSettling:boolean}|null>(null);
 const routeTerminal=useRef(false);
 const motionCallback=useRef(onMotionProgress);
 motionCallback.current=onMotionProgress;
 const motionActive=active&&!preview;
 const debugTrace=useRef<SheetFrameTrace|null>(null);
 useEffect(()=>{
  if(!motionDebugEnabled)return;
  const trace=createSheetFrameTrace(()=>({
   mode,engineY:sheetMotion.current?.value??null,
   paintedY:sheetY.current,domTop:sheet.current?.style.top??"",
   state:shell.current?.getAttribute("data-sheet-state")??null,
   phase:sheetMotion.current?.phase??"none",collapsedRef:collapsedRef.current,
   min:collapsedY.current,max:expandedY.current
  }));
  debugTrace.current=trace;
  return ()=>{trace.dispose();debugTrace.current=null;};
 },[mode]);
 useEffect(()=>installMotionDebugPanel(),[]);
 useEffect(()=>{
  if(motionDebugEnabled)motionDebug("ProfileMaster.render",{
   mode,active,motionActive,collapsed,collapsedRef:collapsedRef.current,
   paintedY:sheetY.current,min:collapsedY.current,max:expandedY.current,
   sheetPhase:sheetMotion.current?.phase??"none"
  });
 });
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
  // DOM-only bounded media writer: no React reconciliation in the rAF loop.
  blurWriterRef.current(indices);
 };
 const stopBlurTracking=()=>{
  blurSession.current++;
  if(blurSampleFrame.current!==null)cancelAnimationFrame(blurSampleFrame.current);
  blurSampleFrame.current=null;
 };
 const finishBlurTracking=(target:number)=>{
  stopBlurTracking();blurWindowRef.current=null;
  // The terminal media window must match the just-committed target BEFORE
  // the asynchronous parent blurFrom state update. A temporary fallback based
  // on the previous blurFrom would insert and immediately remove a stale
  // decoded image, adding one extra layout/style pass per far transition.
  // Stable at most 3 peers; resource identity stays owned by ProfileBlurTrack.
  const settled=[target,target-1,target+1].filter(i=>i>=0&&i<photos.length);
  blurWriterRef.current(settled);
  setBlurFrom(target);
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
  // One actual top coordinate replaces the asynchronous native scrollTop.
   if(sheet.current)sheet.current.style.top=next.toFixed(2)+"px";
   if(motionDebugEnabled)motionDebug("paintSheet",{
    mode,y:next,offset,dragging,progress,elastic,
    domTop:sheet.current?.style.top??null,collapsedRef:collapsedRef.current
   },false);
  
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
 const ensureSheetMotion=useCallback(()=>{
  if(!sheetMotion.current||sheetMotion.current.isDisposed())sheetMotion.current=new ProfileSheetMotion(sheetY.current,
   (value,dragging)=>paintSheet(value,dragging));
  return sheetMotion.current;
 },[paintSheet]);
 const ensureTabsRunner=()=>{
  if(!tabsRunner.current||tabsRunner.current.isDisposed())tabsRunner.current=new GeometryMotion("tabs",()=>performance.now(),
   cb=>requestAnimationFrame(cb),id=>cancelAnimationFrame(id),
   (pages.current?.scrollLeft??0)/Math.max(1,tabViewport.current),tabsRevision.current);
  return tabsRunner.current;
 };
 const settleSheet=useCallback((next:boolean,source="unspecified")=>{
  if(motionDebugEnabled){
   debugTrace.current?.start();
   motionDebug("settleSheet",{mode,next,source,collapsedRef:collapsedRef.current,
    paintedY:sheetY.current,phase:sheetMotion.current?.phase??"none",
    destination:sheetMotion.current?.destinationCollapsed??null});
  }
  ensureSheetMotion().settle(next,()=>{
   if(motionDebugEnabled)motionDebug("collapsedRef.write",{
    mode,next,previous:collapsedRef.current,y:sheetY.current
   });
   collapsedRef.current=next;
   if(motionDebugEnabled)motionDebug("setCollapsed.invoke",{
    mode,next,y:sheetY.current,phase:sheetMotion.current?.phase??"none"
   });
   setCollapsed(next);
   debugTrace.current?.finished();
  });
  stopSheet.current=()=>{sheetMotion.current?.interrupt();};
 },[ensureSheetMotion,mode]);
 useLayoutEffect(()=>{
  if(!motionActive)return;
  let first=true,hidden=false;
  const measure=(reason="initial")=>{
   if(motionDebugEnabled)motionDebug("measure.enter",{
    mode,reason,collapsedRef:collapsedRef.current,sheetY:sheetY.current,
    phase:sheetMotion.current?.phase??"none",
    engineTarget:sheetMotion.current?.destinationCollapsed??null
   });
   const frame=hero.current,pane=sheet.current,root=shell.current;
   if(!frame||!pane||!root)return;
   if(root.clientHeight<180||!frame.offsetHeight){
    if(motionDebugEnabled)motionDebug("measure.hidden",{mode,reason});
    hidden=true;sheetMotion.current?.pause();return;
   }
   const rootRect=root.getBoundingClientRect();
   const scope=root.closest(".discovery-visitor-route")??root.closest(".discovery-app");
   const image=scope?.querySelector<HTMLElement>(".lh-header .lh-island img")?.getBoundingClientRect();
   const logoBottom=image?image.bottom-rootRect.top-image.height*.11:48;
   const top=Math.max(38,Math.min(root.clientHeight*.24,logoBottom));
   const bottom=Math.max(top+185,frame.offsetHeight-43);
   const dots=(image?.bottom??(rootRect.top+108))-rootRect.top+8;
   // Restoring from hidden is a lifecycle event even if CSS dimensions are
   // byte-identical. Never return before resuming the frozen frame.
   if(!first&&!hidden&&Math.abs(top-collapsedY.current)<.5&&
      Math.abs(bottom-expandedY.current)<.5&&
      Math.abs((sheetRootTop.current??rootRect.top)-rootRect.top)<.5){
    if(motionDebugEnabled)motionDebug("measure.unchanged",{mode,reason,top,bottom});
    return;
   }
   const motion=ensureSheetMotion();
   const physical=first?(collapsedRef.current?top:bottom):
    remapSheetPixel(motion.sample(),sheetRootTop.current??rootRect.top,rootRect.top,top,bottom).local;
   first=false;sheetRootTop.current=rootRect.top;
   sheetRevision.current++;
   collapsedY.current=top;expandedY.current=bottom;
   root.style.setProperty("--pm-expanded-y",bottom+"px");
   pane.style.setProperty("--pm-collapsed-top",top+"px");
   root.style.setProperty("--pm-dots-top",dots+"px");
   if(motionDebugEnabled)motionDebug("measure.apply",{
    mode,reason,top,bottom,physical,
    committedCollapsed:collapsedRef.current,
    fingerActive:sheetDragActive.current,engineY:motion.value,phase:motion.phase
   });
   motion.resize(top,bottom,physical,collapsedRef.current,sheetDragActive.current);
   if(hidden&&motion.phase==="paused"&&!routeFrozen.current)motion.resume();
   hidden=false;
   rebaseSheetGesture.current(motion.value,sheetRevision.current);
  };
  measureSheetRef.current=()=>measure("measureSheetRef");
  measure("effect.mount");
  const anchor=(shell.current?.closest(".discovery-visitor-route")??shell.current?.closest(".discovery-app"))
   ?.querySelector<HTMLElement>(".lh-header .lh-center");
  const ro=new ResizeObserver(entries=>measure("ResizeObserver:"+
   entries.map(entry=>entry.target===hero.current?"hero":
    entry.target===shell.current?"shell":entry.target===anchor?"logo":"other").join(",")));
  if(hero.current)ro.observe(hero.current);
  if(shell.current)ro.observe(shell.current);
  if(anchor)ro.observe(anchor);
  const webApp=window.Telegram?.WebApp;
  const detachViewport=bindMotionViewport(window,()=>measure("bindMotionViewport"));
  const visual=window.visualViewport;
  const windowResize=()=>measure("window.resize");
  const visualResize=()=>measure("visualViewport.resize");
  const visualScroll=()=>measure("visualViewport.scroll");
  const safeAreaChanged=()=>measure("Telegram.safeAreaChanged");
  const contentSafeAreaChanged=()=>measure("Telegram.contentSafeAreaChanged");
  const viewportChanged=()=>measure("Telegram.viewportChanged");
  window.addEventListener("resize",windowResize);
  visual?.addEventListener("resize",visualResize);
  visual?.addEventListener("scroll",visualScroll);
  webApp?.onEvent?.("safeAreaChanged",safeAreaChanged);
  webApp?.onEvent?.("contentSafeAreaChanged",contentSafeAreaChanged);
  webApp?.onEvent?.("viewportChanged",viewportChanged);
  return ()=>{
   measureSheetRef.current=()=>{};
   sheetMotion.current?.pause();ro.disconnect();detachViewport();
   window.removeEventListener("resize",windowResize);
   visual?.removeEventListener("resize",visualResize);
   visual?.removeEventListener("scroll",visualScroll);
   webApp?.offEvent?.("safeAreaChanged",safeAreaChanged);
   webApp?.offEvent?.("contentSafeAreaChanged",contentSafeAreaChanged);
   webApp?.offEvent?.("viewportChanged",viewportChanged);
  };
 },[motionActive,ensureSheetMotion]);
 useEffect(()=>{
  const opticalFrame=blurSampleFrame,opticalSession=blurSession;
  const localArbiter=localGestures.current;
  return ()=>{
   opticalSession.current++;
   if(opticalFrame.current!==null)cancelAnimationFrame(opticalFrame.current);
   opticalFrame.current=null;
   stopSheet.current();stopTabs.current();
   sheetMotion.current?.dispose();tabsRunner.current?.dispose();
   localArbiter.dispose();
   if(dragFrame.current!==null)cancelAnimationFrame(dragFrame.current);
  };
 },[]);
 const closeTop=useCallback(():boolean=>{
  if(viewer){if(viewerBack.current)return viewerBack.current();setViewer(null);return true;}
  if(preview){if(previewBack.current?.())return true;setPreview(false);return true;}
  if(onClose){onClose();return true;}
  return false;
 },[viewer,preview,onClose]);
 nestedBack.current=()=>{closeTop();};
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
 useLayoutEffect(()=>{
  const i=keyboardTabFocus.current;
  if(i===null||tabs[i][0]!==tab)return;
  keyboardTabFocus.current=null;
  tabBar.current?.querySelectorAll<HTMLButtonElement>(".pm-tab")[i]?.focus({preventScroll:true});
 },[tab]);
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
    revision:sheetRevision.current,blocking:inPages?(!collapsedRef.current||scrollTop<=1):!collapsedRef.current,
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
    // Preserve native vertical scrolling after collapse, even when the list
    // is already scrolled. An expanded sheet owns the whole white surface;
    // its old content scrollTop must not disable the collapse gesture.
    if(g.inPages&&g.down&&g.scrollTop>1){g.axis="native";gestures.nativeScroll(g.serial);return;}
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
    else {
    const current=ensureSheetMotion().interrupt();
    // Claim the FULL first movement from touchstart. Subtracting dy here
    // swallowed the initial swipe and broke short fast one-event gestures.
    g.origin=current;
    sheetDragActive.current=true;
   }
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
     ensureSheetMotion().drag(raw>expandedY.current?
     expandedY.current+28*(1-Math.exp(-extra/48)):raw);
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
      ensureSheetMotion().drag(raw>expandedY.current?
     expandedY.current+28*(1-Math.exp(-extra/48)):raw);
     }
    const velocity=performance.now()-g.lastTime<90?g.velocity:0;
    const threshold=Math.min(90,Math.max(65,(expandedY.current-collapsedY.current)*.2));
    const commit=g.down?(dy>threshold||velocity>.65):(dy< -threshold||velocity<-.65);
    clickBlocked.current=performance.now()+260;
    settleSheet(cancelled?g.down:g.down?!commit:commit,"touchend");
   }else if(!g.axis){
    // A tap during settling resumes from the frozen position.
    settleSheet(g.down,"touchend.noAxis");
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
   else if(g.axis==="y"&&g.claimed)settleSheet(g.down,"touchcancel");
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
 },[motionActive,paintTabs,settleSheet,chooseTab,gestures,ensureSheetMotion]);
 // REM-02D: preserve actual fractional positions and semantic destinations.
 const suspendForRoute=()=>{
  if(routeTerminal.current||routeFrozen.current)return;
  const sheetPhase=sheetMotion.current?.phase??"idle",tabsState=tabsRunner.current?.snapshot();
  const sheetValue=sheetMotion.current?.sample()??sheetY.current;
  const tabsValue=tabsState?.phase==="settling"?tabsRunner.current!.sample():tabLastPosition.current;
  routeFrozen.current={
   sheet:sheetValue,sheetTarget:sheetMotion.current?.destinationCollapsed??collapsedRef.current,
   sheetSettling:sheetPhase==="settling"||sheetPhase==="paused",
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
  sheetMotion.current?.pause();tabsRunner.current?.suspend();
  // pause() already paints the exact frozen pixel; a drag() here would
  // destroy the pause snapshot and reset unspent time on route rollback.
  paintTabs(tabsValue);
 };
 const rollbackRoute=()=>{
  if(routeTerminal.current)return;
  const saved=routeFrozen.current;if(!saved)return;
  measureSheetRef.current();measureTabsRef.current();
  routeFrozen.current=null;
  const sheetDriver=sheetMotion.current;
  if(saved.sheetSettling&&sheetDriver?.phase==="paused")sheetDriver.resume();
  else if(Math.abs(sheetY.current-(saved.sheetTarget?collapsedY.current:expandedY.current))>.5)
   settleSheet(saved.sheetTarget,"rollbackRoute");
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
  sheetMotion.current?.dispose();tabsRunner.current?.dispose();
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
 const openMyPhotos=()=>{chooseTab(2);settleSheet(true,"openMyPhotos");};
 const openAvatar=()=>{
  settleSheet(false,"openAvatar");
 };
 const nameLine=<>{view.profile.name||"Имя не указано"}{view.profile.age!==null?", "+view.profile.age:""}</>;
 const location=<>{view.profile.city||view.profile.country?<>{view.profile.countryCode&&<Flag code={view.profile.countryCode} size={19}/>}<span>{[view.profile.city,view.profile.country].filter(Boolean).join(", ")}</span></>:"Город не указан"}</>;
 const goal=view.profile.goal&&view.profile.goal!=="undecided"?goals.find(x=>x.id===view.profile.goal):null;
 // Step 8 embeds the sheet; owner "Предпросмотр" opens a closable nested dialog.
 const embeddedSelf=mode==="local-self-preview"&&!onClose;
 return <section ref={shell} data-sheet-state={collapsed?"collapsed":"expanded"} data-sheet-renderer="absolute" className={"pm-shell "+(mode==="owner"||embeddedSelf?"pm-inline":"pm-dialog")} role={mode==="owner"||embeddedSelf?undefined:"dialog"}
   aria-modal={mode==="owner"||embeddedSelf?undefined:true} tabIndex={mode==="visitor"?-1:undefined} data-modal-initial={mode==="visitor"?"true":undefined} aria-label={mode==="owner"?"Мой профиль":mode==="local-self-preview"?"Локальный предпросмотр черновика":mode==="preview"?"Посмотреть глазами других":"Демо-профиль"}>
  {(mode==="preview"||mode==="local-self-preview"&&!!onClose)&&<div className="pm-preview-toolbar"><button type="button" data-modal-initial onClick={onClose}>Закрыть предпросмотр</button></div>}
   <div className="pm-hero" ref={hero} onPointerDown={photoStart} onPointerMove={photoMove}
    onPointerUp={e=>photoEnd(e)} onPointerCancel={e=>photoEnd(e,true)}
     onLostPointerCapture={e=>photoEnd(e,true)}>
    <div className="pm-photo-motion" ref={photoMotion}>
    {photos.length?<div className="pm-photo-track" ref={photoTrack}>
      {photos.map((p,i)=><div className="pm-photo-slide" key={p.id} role="button" tabIndex={i===activePhoto?0:-1}
       aria-label={"Фотография в галерее профиля "+(i+1)+" из "+photos.length+" — открыть просмотр"}
       onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){
        event.preventDefault();event.stopPropagation();openPhoto(i,event.currentTarget.querySelector("img"));}}}
       onClick={event=>openPhoto(i,event.currentTarget.querySelector("img"))}>
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
    
   <div className="pm-profile-sheet" ref={sheet} onClickCapture={e=>{
    if(performance.now()<clickBlocked.current){e.preventDefault();e.stopPropagation();}
   }}>
    <button ref={grab} type="button" className="pm-sheet-grab" onClick={()=>settleSheet(!collapsedRef.current,"grab.onClick")}
      tabIndex={collapsed?-1:0} aria-label={collapsed?"Потянуть панель вниз":"Развернуть анкету"}><span/></button>
    <div className="pm-identity">
     <div className="pm-identity-core">
      <div className="pm-identity-text">
       <h2>{nameLine} {view.profile.premium&&<span className="pm-premium">◆</span>}{view.profile.verified&&<ShieldCheck size={19} aria-label="Подтверждён"/>}</h2>
       <p className="pm-identity-location">{location}</p>
      </div>
      {current&&<button ref={miniAvatar} type="button" className="pm-mini-avatar"
         onClick={openAvatar} tabIndex={collapsed?0:-1} aria-hidden={!collapsed}
         aria-label={"Раскрыть фото профиля"}>
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
   <div className="pm-tabs" ref={tabBar} role="tablist" aria-label="Разделы профиля"
    onKeyDown={event=>{
     const i=tabs.findIndex(v=>v[0]===tab);
     const next=event.key==="ArrowRight"?Math.min(4,i+1):
      event.key==="ArrowLeft"?Math.max(0,i-1):
      event.key==="Home"?0:event.key==="End"?4:-1;
     if(next<0)return;
     event.preventDefault();
     keyboardTabFocus.current=next;
     chooseTab(next);
     if(next===i){keyboardTabFocus.current=null;
      tabBar.current?.querySelectorAll<HTMLButtonElement>(".pm-tab")[i]?.focus({preventScroll:true});}
    }}>
    {tabs.map(([id,label,Icon],i)=><button type="button" key={id} className={"pm-tab"+(id===tab?" active":"")} role="tab" tabIndex={id===tab?0:-1}
      aria-selected={id===tab} onClick={()=>chooseTab(i)}><Icon size={16}/><span>{label}</span></button>)}
    <span className="pm-tab-ink" ref={ink} aria-hidden="true"/>
   </div>
   <div className="pm-pages" ref={pages} onPointerDown={tabDown} onPointerMove={tabMove}
     onPointerUp={e=>tabEnd(e)} onPointerCancel={e=>tabEnd(e,true)}
     onLostPointerCapture={e=>tabEnd(e,true)}>
    <div className="pm-pages-track" ref={pageTrack}>
     <div className="pm-page" role="tabpanel" aria-label="О себе" inert={tab!=="about"} aria-hidden={tab!=="about"} ref={e=>{if(e)contentPages.current[0]=e;}}><About view={view}/></div>
     <div className="pm-page" role="tabpanel" aria-label="Блики" inert={tab!=="bliki"} aria-hidden={tab!=="bliki"} ref={e=>{if(e)contentPages.current[1]=e;}}><Bliki/></div>
     <div className="pm-page" role="tabpanel" aria-label="Фото" inert={tab!=="photos"} aria-hidden={tab!=="photos"} ref={e=>{if(e)contentPages.current[2]=e;}}>
      {photos.length?<div className="pm-photos-grid">{photos.map((p,i)=><button type="button" key={p.id} className="pm-photo-tile"
       onClick={e=>openPhoto(i,e.currentTarget.querySelector("img"))} aria-label={"Открыть фото "+(i+1)}>
       <PhotoImage photo={p} alt="" loading="lazy"/>{p.status!=="published"&&<span>{p.status==="draft"?"Черновик":"Проверка"}</span>}
       </button>)}</div>:<div className="pm-empty"><Images size={38}/><h3>{view.profile.source==="local-draft"?"Пока нет готовых фото":"Пока нет опубликованных фото"}</h3>
        <p>{view.profile.source==="local-draft"?"Добавь фотографии или дождись окончания локальной обработки.":"Фото на модерации и приватные снимки не видны другим."}</p></div>}
     </div>
     <div className="pm-page" role="tabpanel" aria-label="Подарки" inert={tab!=="gifts"} aria-hidden={tab!=="gifts"} ref={e=>{if(e)contentPages.current[3]=e;}}><Gifts view={view}/></div>
     <div className="pm-page" role="tabpanel" aria-label="О профиле" inert={tab!=="meta"} aria-hidden={tab!=="meta"} ref={e=>{if(e)contentPages.current[4]=e;}}><Meta view={view}/></div>
    </div>
   </div>
  </div>
  </div>
  {viewer&&<QaProfiler id="PhotoViewer"><PhotoViewer view={view} photos={photos} initialPhotoId={viewer.photoId} source={viewer.source}
    contextId={viewerPhotoContext(view)}
    onClose={()=>setViewer(null)} registerBack={registerViewerBack}
    /></QaProfiler>}
   {preview&&<ProfileMaster data={data} mode={data.source==="local-draft"?"local-self-preview":"preview"} onClose={()=>setPreview(false)} registerBack={registerPreviewBack} active={active} onMotionProgress={onMotionProgress}/>}
 </section>;
});
