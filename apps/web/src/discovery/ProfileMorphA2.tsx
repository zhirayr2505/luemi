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
import {ProfileMorphBackground} from "./ProfileMorphBackground";
import {QaProfiler} from "./qa-profiler";
import {resourceIdentity,viewerPhotoContext,type ViewerSource} from "./photo-viewer-state";
import {ProfileMorphMotion} from "./profile-morph-a2-motion";
import {profileMorphGeometry,morphFrame,type MorphGeometry} from "./profile-morph-a2-geometry";
import {reconcilePhotoId} from "./photo-viewer-state";
import {useModalLayer} from "../ui/modal-layer";
import {GestureArbiter} from "../ui/gesture-arbiter";
import "./profile-morph-a2.css";

type TabId="about"|"bliki"|"photos"|"meta"|"gifts";
const tabs=[["about","О себе",FileText],["bliki","Блики",Sparkles],["photos","Фото",Images],
 ["meta","Аккаунт",UserRound],["gifts","Подарки",Gift]] as const;
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
function PhotoImage({photo,alt,loading="lazy"}:{photo:ProfilePhoto;alt:string;loading?:"lazy"|"eager"}){
 return <img data-photo-id={photo.id} src={photo.src} alt={alt} draggable={false} loading={loading} decoding="async"
  onError={e=>{if(photo.fallback&&e.currentTarget.src!==photo.fallback)e.currentTarget.src=photo.fallback;}}/>;
}
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

type PointerSession={id:number;x:number;y:number;at:number;lastX:number;lastY:number;lastAt:number;
 axis:"pending"|"x"|"y";start:number;claimed:boolean;serial?:number;velocity?:number;};
const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));
const photoPixel=(element:HTMLElement|null,slideWidth:number,otherwise:number)=>{
 if(!element||slideWidth<=0)return otherwise;
 const raw=getComputedStyle(element).transform;
 const m=raw==="none"?null:new DOMMatrixReadOnly(raw);
 return m?clamp(-m.m41/slideWidth,0,Number.MAX_SAFE_INTEGER):otherwise;
};
/** A2 replaces the old sheet/hero/tabs engines; renderer owns no per-frame React state. */
export const ProfileMaster=memo(function ProfileMaster({data,mode,onClose,onEdit,registerBack,active=true,onMotionProgress,registerRouteMotion,gestureArbiter}:Props){
 const view=useMemo(()=>projectProfile(data,mode),[data,mode]),photos=view.photos;
 const [tab,setTab]=useState<TabId>("about");
 const [photoId,setPhotoId]=useState<string|null>(photos[0]?.id??null);
 const [viewer,setViewer]=useState<{photoId:string;source:ViewerSource|null}|null>(null);
 const [preview,setPreview]=useState(false);
 const [state,setState]=useState<"compact"|"expanded">("compact");
 const root=useRef<HTMLElement>(null),sheet=useRef<HTMLDivElement>(null),face=useRef<HTMLDivElement>(null);
 const compactText=useRef<HTMLDivElement>(null),expandedText=useRef<HTMLDivElement>(null),backdrop=useRef<HTMLDivElement>(null);
 const pagesTrack=useRef<HTMLDivElement>(null),photoTrack=useRef<HTMLDivElement>(null);
 const photoDots=useRef<HTMLDivElement>(null),photoRing=useRef<HTMLDivElement>(null);
 const photoViewport=useRef<HTMLDivElement>(null),tabsRoot=useRef<HTMLDivElement>(null),ink=useRef<HTMLSpanElement>(null);
 const motion=useRef<ProfileMorphMotion|null>(null);
 const geometry=useRef<MorphGeometry>(profileMorphGeometry(390,730));
 const photoIdLive=useRef(photoId),tabLive=useRef(tab);
 photoIdLive.current=photoId;tabLive.current=tab;
 const activeIndex=Math.max(0,photos.findIndex(p=>p.id===photoId));
 const current=photos[activeIndex];
 const selectedViewerBack=useRef<(()=>boolean)|null>(null),selectedPreviewBack=useRef<(()=>boolean)|null>(null);
 const innerBack=useRef<()=>void>(()=>{});
 const nested=mode==="preview"||(mode==="local-self-preview"&&!!onClose);
 useModalLayer(nested,root,()=>innerBack.current());
 const photoDrag=useRef<PointerSession|null>(null),pageDrag=useRef<PointerSession|null>(null),sheetDrag=useRef<PointerSession|null>(null);
 const suppressClick=useRef(0);
 const activeTabIndex=tabs.findIndex(t=>t[0]===tab);
 const motionCallback=useRef(onMotionProgress);motionCallback.current=onMotionProgress;

 // One stable profile backing surface stays opaque over the underlying Discovery card.
 // The identical photo IMG node stays mounted throughout compact <-> expanded.
 const paint=useRef<(p:number)=>void>(()=>{});
 paint.current=p=>{
  const frame=morphFrame(geometry.current,p);
  if(sheet.current)sheet.current.style.transform=`translate3d(0,${frame.sheetY}px,0)`;
  if(face.current){
   face.current.style.transform=`translate3d(${frame.photoX}px,${frame.photoY}px,0) scale(${frame.scaleX},${frame.scaleY})`;
   face.current.style.borderRadius=frame.radius+"%";
   // Counter-scale portrait pixels: the moving clip may change aspect but faces never stretch.
   if(photoViewport.current)photoViewport.current.style.transform="scaleY("+(frame.scaleX/frame.scaleY)+")";
   if(photoRing.current)photoRing.current.style.opacity=String(Math.max(0,1-p*1.8));
  }
  if(compactText.current){compactText.current.style.opacity=String(frame.compactAlpha);compactText.current.style.pointerEvents=p<.2?"auto":"none";}
  if(expandedText.current)expandedText.current.style.opacity=String(frame.expandedAlpha);
  if(backdrop.current)backdrop.current.style.opacity=String(1-frame.expandedAlpha);
  if(photoDots.current){photoDots.current.style.opacity=String(clamp((p-.65)/.3,0,1));
   photoDots.current.style.pointerEvents=p>.97?"auto":"none";}
  motionCallback.current?.(1-p,motion.current?.snapshot().phase==="dragging");
 };
 useLayoutEffect(()=>{
  const engine=new ProfileMorphMotion(p=>paint.current(p),undefined,
   value=>setState(value===0?"compact":"expanded"),
   ()=>window.matchMedia?.("(prefers-reduced-motion: reduce)").matches??false);
  motion.current=engine;
  let resizeFrame:number|null=null;
  const measure=()=>{
   resizeFrame=null;
   const el=root.current;if(!el)return;
   const rect=el.getBoundingClientRect();
   if(rect.width<250||rect.height<350)return;
   const header=el.closest(".discovery-visitor-route")?.querySelector(".lh-island img")??
    el.closest(".discovery-app")?.querySelector(".lh-island img");
   const chromeBottom=header?.getBoundingClientRect().bottom;
   const g=profileMorphGeometry(rect.width,rect.height,chromeBottom?chromeBottom-rect.top:86);
   const old=geometry.current;
   if(g.width===old.width&&g.height===old.height&&g.compactTop===old.compactTop&&g.expandedTop===old.expandedTop)return;
   geometry.current=g;
   el.style.setProperty("--a2-compact-top",g.compactTop+"px");
   el.style.setProperty("--a2-expanded-top",g.expandedTop+"px");
   el.style.setProperty("--a2-avatar-size",g.avatarSize+"px");
   el.style.setProperty("--a2-avatar-left",g.avatarX+"px");
   el.style.setProperty("--a2-avatar-top",g.avatarY+"px");
   engine.snapshot();paint.current(engine.sample());
  };
  const scheduleMeasure=()=>{if(resizeFrame===null)resizeFrame=requestAnimationFrame(measure);};
  measure();
  const observer=new ResizeObserver(scheduleMeasure);
  if(root.current)observer.observe(root.current);
  window.addEventListener("resize",scheduleMeasure);
  const viewport=window.visualViewport;
  viewport?.addEventListener("resize",scheduleMeasure);
  const web=window.Telegram?.WebApp;
  const changed=(event?:{isStateStable?:boolean})=>{if(event?.isStateStable===false)return;scheduleMeasure();};
  web?.onEvent?.("viewportChanged",changed);
  web?.onEvent?.("safeAreaChanged",scheduleMeasure);
  return ()=>{
   observer.disconnect();window.removeEventListener("resize",scheduleMeasure);
   viewport?.removeEventListener("resize",scheduleMeasure);
   web?.offEvent?.("viewportChanged",changed);
   web?.offEvent?.("safeAreaChanged",scheduleMeasure);
   if(resizeFrame!==null)cancelAnimationFrame(resizeFrame);
   engine.dispose();motion.current=null;
  };
 },[]);
 useEffect(()=>{
  const suspend=()=>motion.current?.suspend(),resume=()=>motion.current?.resume();
  const visibility=()=>{if(document.visibilityState==="hidden")suspend();else resume();};
  document.addEventListener("visibilitychange",visibility);
  window.addEventListener("pagehide",suspend);window.addEventListener("pageshow",resume);
  return ()=>{document.removeEventListener("visibilitychange",visibility);
   window.removeEventListener("pagehide",suspend);window.removeEventListener("pageshow",resume);};
 },[]);
 useLayoutEffect(()=>{
  if(!registerRouteMotion)return;
  const handle:ProfileRouteMotionHandle={
   suspendForRoute:()=>motion.current?.suspend(),
   rollbackRoute:()=>motion.current?.resume(),
   commitRouteClose:()=>motion.current?.dispose(),
   suspendForBackground:()=>motion.current?.suspend(),
   resumeFromBackground:()=>motion.current?.resume()
  };
  registerRouteMotion(handle);return ()=>registerRouteMotion(null);
 },[registerRouteMotion]);
 // Preserve photo ID across reordered/hidden/published lists. All media come from projectProfile().
 const oldPhotoIds=useRef(photos.map(x=>x.id));
 useLayoutEffect(()=>{
  const ids=photos.map(x=>x.id);
  if(ids.join("\u0000")===oldPhotoIds.current.join("\u0000"))return;
  const reconciled=reconcilePhotoId(photoIdLive.current,oldPhotoIds.current,photos);
  oldPhotoIds.current=ids;
  if(photoTrack.current){const index=Math.max(0,photos.findIndex(p=>p.id===reconciled));
   photoTrack.current.style.transition="none";
   photoTrack.current.style.transform=`translate3d(-${index*100}%,0,0)`;
  }
  setPhotoId(reconciled);
 },[photos]);
 const choosePhoto=(index:number,animate=true)=>{
  if(index<0||index>=photos.length)return;
  if(photoTrack.current){
   photoTrack.current.style.transition=animate?"transform 220ms cubic-bezier(.2,.8,.2,1)":"none";
   photoTrack.current.style.transform=`translate3d(-${index*100}%,0,0)`;
  }
  photoIdLive.current=photos[index].id;setPhotoId(photos[index].id);
 };
 const chooseTab=(index:number,animate=true)=>{
  const next=clamp(index,0,tabs.length-1);
  if(pagesTrack.current){
   pagesTrack.current.style.transition=animate?"transform 210ms cubic-bezier(.22,.8,.2,1)":"none";
   pagesTrack.current.style.transform=`translate3d(-${next*100}%,0,0)`;
  }
  tabLive.current=tabs[next][0];setTab(tabs[next][0]);
  const node=tabsRoot.current,underline=ink.current;
  if(node&&underline){
   const buttons=node.querySelectorAll<HTMLButtonElement>(".pm-a2-tab");
   const target=buttons[next];
   if(target){underline.style.transition=animate?"transform 210ms ease,width 210ms ease":"none";
    underline.style.width=target.offsetWidth+"px";
    underline.style.transform=`translate3d(${target.offsetLeft}px,0,0)`;}
  }
 };
 useLayoutEffect(()=>{chooseTab(0,false);},[]);
 const startSheet=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(!event.isPrimary){gestureArbiter?.secondFinger();if(sheetDrag.current?.claimed)motion.current?.release(0,true);sheetDrag.current=null;return;}
  if(event.pointerType==="mouse"&&event.button!==0)return;
  const engine=motion.current;if(!engine)return;
  const serial=gestureArbiter?.begin("pointer",event.pointerId,"sheet");
  if(gestureArbiter&&serial===null)return;
  sheetDrag.current={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now(),
   lastX:event.clientX,lastY:event.clientY,lastAt:performance.now(),axis:"pending",start:engine.sample(),claimed:false,serial:serial??undefined};
  // Candidate does not interrupt an already-running settle: claim movement first.
 };
 const moveSheet=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const g=sheetDrag.current;if(g?.id!==event.pointerId)return;
  if(Math.abs(event.clientY-g.y)>4&&!g.claimed){
   if(g.serial!==undefined&&!gestureArbiter?.claim("sheet",g.serial))return;
   g.claimed=true;
   motion.current?.dragStart(g.y,geometry.current.span);
   try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* host ownership */}
  }
  if(g.serial!==undefined&&!g.claimed)return;
  const now=performance.now();const dt=now-g.lastAt;
  if(dt>0&&dt<120){const v=(event.clientY-g.lastY)/dt;g.velocity=g.velocity===undefined?v:g.velocity*.28+v*.72;}
  g.lastY=event.clientY;g.lastAt=now;
  motion.current?.drag(event.clientY);
 };
 const endSheet=(event:ReactPointerEvent<HTMLDivElement>,cancelled=false)=>{
  const g=sheetDrag.current;if(!g||g.id!==event.pointerId)return;
  sheetDrag.current=null;
  if(g.serial!==undefined){
   if(g.claimed)gestureArbiter?.finish("sheet",g.serial);
   else gestureArbiter?.finishCandidate(g.serial,"sheet");
  }
  // An x-axis back swipe owned by the visitor route is not a profile toggle.
  const dx=event.clientX-g.x,dy=event.clientY-g.y;
  const pointerTap=Math.hypot(dx,dy)<9;
  if(!g.claimed){if(!cancelled&&pointerTap&&(g.serial===undefined||!gestureArbiter?.owner()))motion.current?.toggle();}
  else {const now=performance.now();const average=(event.clientY-g.y)/Math.max(1,now-g.at);
   const velocity=now-g.lastAt<120?(g.velocity??average):average;
   motion.current?.release(velocity,cancelled);}
  suppressClick.current=performance.now()+260;
  try{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}catch{/* implicit */}
 };
 const slideStart=(event:ReactPointerEvent<HTMLDivElement>,kind:"photo"|"tab")=>{
  if(!event.isPrimary){gestureArbiter?.secondFinger();return;}
  if(event.pointerType==="mouse"&&event.button!==0)return;
  if(kind==="photo"&&(motion.current?.sample()??0)<.95)return;
  if((event.target as Element).closest("button"))return;
  const serial=gestureArbiter?.begin("pointer",event.pointerId,kind==="photo"?"hero":"tabs");
  if(gestureArbiter&&serial===null)return;
  const node=kind==="photo"?photoTrack.current:pagesTrack.current;
  const width=(kind==="photo"?photoViewport.current:root.current)?.clientWidth??1;
  const index=kind==="photo"?activeIndex:activeTabIndex;
  const start=photoPixel(node,width,index);
  const g:PointerSession={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now(),lastX:event.clientX,
   lastY:event.clientY,lastAt:performance.now(),axis:"pending",start,claimed:false,serial:serial??undefined};
  (kind==="photo"?photoDrag:pageDrag).current=g;
 };
 const slideMove=(event:ReactPointerEvent<HTMLDivElement>,kind:"photo"|"tab")=>{
  const s=kind==="photo"?photoDrag:pageDrag,g=s.current;
  if(!g||g.id!==event.pointerId)return;
  const dx=event.clientX-g.x,dy=event.clientY-g.y;
  if(g.axis==="pending"){
   if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;
   g.axis=Math.abs(dx)>Math.abs(dy)*1.2?"x":"y";
   if(g.axis!=="x")return;
   if(g.serial!==undefined&&!gestureArbiter?.claim(kind==="photo"?"hero":"tabs",g.serial))return;
   g.claimed=true;
   const node=kind==="photo"?photoTrack.current:pagesTrack.current;
   if(node){node.style.transition="none";}
   try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* optional */}
  }
  if(g.axis!=="x"||!g.claimed)return;
  if(event.cancelable)event.preventDefault();
  const viewport=kind==="photo"?photoViewport.current:root.current;
  const width=Math.max(1,viewport?.clientWidth??1);
  const max=(kind==="photo"?photos.length:tabs.length)-1;
  const p=clamp(g.start-dx/width,0,max);
  const track=kind==="photo"?photoTrack.current:pagesTrack.current;
  if(track)track.style.transform=`translate3d(-${p*100}%,0,0)`;
  if(kind==="tab"&&tabsRoot.current&&ink.current){
   const buttons=tabsRoot.current.querySelectorAll<HTMLButtonElement>(".pm-a2-tab");
   const left=Math.floor(p),right=Math.min(max,left+1),t=p-left,a=buttons[left],b=buttons[right];
   if(a&&b){ink.current.style.transition="none";
    ink.current.style.width=(a.offsetWidth+(b.offsetWidth-a.offsetWidth)*t)+"px";
    ink.current.style.transform=`translate3d(${a.offsetLeft+(b.offsetLeft-a.offsetLeft)*t}px,0,0)`;}
  }
  g.lastX=event.clientX;g.lastY=event.clientY;g.lastAt=performance.now();
 };
 const slideEnd=(event:ReactPointerEvent<HTMLDivElement>,kind:"photo"|"tab",cancelled=false)=>{
  const s=kind==="photo"?photoDrag:pageDrag,g=s.current;
  if(!g||g.id!==event.pointerId)return;
  s.current=null;
  if(g.serial!==undefined){
   if(g.claimed)gestureArbiter?.finish(kind==="photo"?"hero":"tabs",g.serial);
   else gestureArbiter?.finishCandidate(g.serial,kind==="photo"?"hero":"tabs");
  }
  const index=kind==="photo"?activeIndex:activeTabIndex;
  const width=Math.max(1,(kind==="photo"?photoViewport.current:root.current)?.clientWidth??1);
  const dx=event.clientX-g.x,dt=Math.max(1,performance.now()-g.at);
  const isChange=!cancelled&&g.axis==="x"&&(Math.abs(dx)>width*.19||Math.abs(dx)/dt>.42);
  const target=clamp(index+(isChange?(dx<0?1:-1):0),0,(kind==="photo"?photos.length:tabs.length)-1);
  if(kind==="photo")choosePhoto(target);
  else chooseTab(target);
  if(g.claimed)suppressClick.current=performance.now()+250;
  try{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}catch{/* implicit */}
 };
 const openPhoto=(id:string,element:HTMLImageElement|null)=>{
  const photo=photos.find(x=>x.id===id);
  if(!photo)return;
  const contextId=viewerPhotoContext(view);
  const source:ViewerSource|null=element?{photoId:id,contextId,resourceKey:resourceIdentity(photo),
   resolveElement:()=>element}:null;
  setViewer({photoId:id,source});
 };
 const openFace=(event:React.MouseEvent<HTMLDivElement>)=>{
  if(performance.now()<suppressClick.current)return;
  if((motion.current?.sample()??0)<.95){motion.current?.settle(1);return;}
  const img=event.currentTarget.querySelector<HTMLImageElement>('[data-photo-id="'+CSS.escape(photoIdLive.current??"")+'"]');
  if(photoIdLive.current)openPhoto(photoIdLive.current,img);
 };
 const closeTop=useCallback(():boolean=>{
  if(viewer){if(selectedViewerBack.current)return selectedViewerBack.current();setViewer(null);return true;}
  if(preview){if(selectedPreviewBack.current?.())return true;setPreview(false);return true;}
  if(onClose){onClose();return true;}
  return false;
 },[viewer,preview,onClose]);
 innerBack.current=()=>{closeTop();};
 useEffect(()=>{if(!active)return;registerBack?.(closeTop);return ()=>registerBack?.(null);},[active,closeTop,registerBack]);
 const p=view.profile,goal=p.goal&&p.goal!=="undecided"?goals.find(x=>x.id===p.goal):null;
 const name=<>{p.name||"Имя не указано"}{p.age!==null?", "+p.age:""}{p.verified&&<ShieldCheck size={19} aria-label="Подтверждено"/>}{p.premium&&<span className="pm-premium">◆</span>}</>;
 const location=<>{p.countryCode&&<Flag code={p.countryCode} size={18}/>}<span>{[p.city,p.country].filter(Boolean).join(", ")||"Город не указан"}</span></>;
 const inline=mode==="owner"||(mode==="local-self-preview"&&!onClose);
 const ownerActions=mode==="owner";
 return <section ref={root} className={"pm-shell pm-a2-root "+(inline?"pm-inline":"pm-dialog")}
  data-sheet-state={state==="compact"?"collapsed":"expanded"} data-morph-state={state}
  role={inline?undefined:"dialog"} aria-modal={inline?undefined:true}
  tabIndex={mode==="visitor"?-1:undefined} data-modal-initial={mode==="visitor"?"true":undefined}
  aria-label={mode==="owner"?"Мой профиль":mode==="visitor"?"Профиль":"Предпросмотр профиля"}>
   <div className="pm-a2-backing" aria-hidden="true"/>
   <div className="pm-hero pm-a2-hero">
    <div className="pm-a2-background-stage" ref={backdrop}>
     <ProfileMorphBackground photo={current??null}/>
    </div>
    <div className="pm-a2-face" ref={face} role="button" tabIndex={0}
      aria-label={state==="compact"?"Развернуть фото":"Открыть просмотр фото"}
      onClick={openFace}
      onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.currentTarget.click();}}}>
      <div className="pm-a2-photo-viewport" ref={photoViewport}
       onPointerDown={e=>slideStart(e,"photo")} onPointerMove={e=>slideMove(e,"photo")}
       onPointerUp={e=>slideEnd(e,"photo")} onPointerCancel={e=>slideEnd(e,"photo",true)}>
       {photos.length?<div className="pm-photo-track pm-a2-photo-track" ref={photoTrack}>
        {photos.map((photo,i)=><div className="pm-photo-slide pm-a2-photo-slide" key={photo.id}>
         <PhotoImage photo={photo} alt={"Фото "+(i+1)+" · "+p.name} loading={i===0?"eager":"lazy"}/>
        </div>)}
       </div>:<div className="pm-a2-no-photo"><Images size={38}/> Нет доступных фото</div>}
      </div>
      <div className="pm-a2-photo-ring" ref={photoRing} aria-hidden="true"/>
    </div>
    <div className="pm-a2-compact-identity" ref={compactText}>
     <h2>{name}</h2><p>{location}</p>
     {goal&&<span className="pm-a2-goal"><Heart size={15}/>{goal.label}</span>}
    </div>
    <div className="pm-a2-expanded-identity" ref={expandedText}>
     <h2>{name}</h2>
     <div className="pm-a2-expanded-row"><p>{location}</p>
      {goal&&<span className="pm-a2-goal"><Heart size={13}/>{goal.label}</span>}</div>
    </div>
    {photos.length>1&&<div className="pm-a2-photo-dots" ref={photoDots} aria-label="Фотографии профиля">
     {photos.map((photo,i)=><button type="button" key={photo.id} aria-label={"Фото "+(i+1)+" из "+photos.length}
      aria-current={i===activeIndex?"true":undefined}
      className={i===activeIndex?"active":""} onClick={()=>choosePhoto(i)}/>)}
    </div>}
    {p.source!=="server"&&<span className="pm-hero-demo">{p.source==="fixture"?"Демо":"Черновик"}</span>}
   </div>
   <div className="pm-a2-sheet" ref={sheet}>
    <div className="pm-a2-handle" role="button" tabIndex={0} aria-label={state==="compact"?"Раскрыть фото":"Свернуть фото"}
     onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();motion.current?.toggle();}}}
     onPointerDown={startSheet} onPointerMove={moveSheet} onPointerUp={e=>endSheet(e)}
     onPointerCancel={e=>endSheet(e,true)} onLostPointerCapture={e=>endSheet(e,true)}>
     <span/>
    </div>
    {ownerActions&&<div className="pm-owner-actions pm-a2-owner-actions">
      <button type="button" onClick={()=>{motion.current?.settle(0);chooseTab(2);}}><Images size={17}/> Мои фото</button>
      <button type="button" className="pm-owner-edit" onClick={onEdit}><PenLine size={17}/> Изменить</button>
      <button type="button" onClick={()=>setPreview(true)}><Eye size={17}/> Как видят</button>
     </div>}
    <div className="pm-a2-tabs" ref={tabsRoot} role="tablist" aria-label="Разделы профиля">
     {tabs.map(([id,label],i)=><button key={id} type="button" className={"pm-a2-tab"+(tab===id?" active":"")}
       role="tab" aria-selected={tab===id} tabIndex={tab===id?0:-1}
       onClick={()=>chooseTab(i)} onKeyDown={e=>{if(e.key==="ArrowRight"||e.key==="ArrowLeft"){
        e.preventDefault();const next=clamp(i+(e.key==="ArrowRight"?1:-1),0,4);chooseTab(next);
        tabsRoot.current?.querySelectorAll<HTMLButtonElement>(".pm-a2-tab")[next]?.focus({preventScroll:true});
       }}}>{label}</button>)}
     <span className="pm-a2-ink" ref={ink} aria-hidden="true"/>
    </div>
    <div className="pm-a2-pages" onPointerDown={e=>slideStart(e,"tab")}
     onPointerMove={e=>slideMove(e,"tab")} onPointerUp={e=>slideEnd(e,"tab")}
     onPointerCancel={e=>slideEnd(e,"tab",true)}>
     <div className="pm-a2-pages-track" ref={pagesTrack}>
      {tabs.map(([id,label])=><section key={id} className="pm-a2-page" role="tabpanel" aria-label={label}
       inert={tab!==id} aria-hidden={tab!==id}>
        {id==="about"?<About view={view}/>:id==="bliki"?<Bliki/>:id==="meta"?<Meta view={view}/>:
         id==="gifts"?<Gifts view={view}/>:photos.length?<div className="pm-photos-grid">
          {photos.map((photo,i)=><button type="button" className="pm-photo-tile" key={photo.id}
           aria-label={"Открыть фото "+(i+1)} onClick={e=>openPhoto(photo.id,e.currentTarget.querySelector("img"))}>
           <PhotoImage photo={photo} alt="" loading="lazy"/>
           {photo.status!=="published"&&<span>{photo.status==="draft"?"Черновик":"Проверка"}</span>}</button>)}
         </div>:<div className="pm-empty"><Images size={37}/><h3>Пока нет доступных фото</h3></div>}
       </section>)}
     </div>
    </div>
   </div>
   {nested&&<div className="pm-preview-toolbar"><button type="button" data-modal-initial onClick={onClose}>Закрыть предпросмотр</button></div>}
   {viewer&&<QaProfiler id="PhotoViewer"><PhotoViewer view={view} photos={photos} initialPhotoId={viewer.photoId}
     source={viewer.source} contextId={viewerPhotoContext(view)} onClose={returnId=>{
      if(returnId){const index=photos.findIndex(p=>p.id===returnId);if(index>=0)choosePhoto(index,false);}
      setViewer(null);
     }}
     registerBack={handler=>{selectedViewerBack.current=handler;}}/></QaProfiler>}
   {preview&&<ProfileMaster data={data} mode={data.source==="local-draft"?"local-self-preview":"preview"}
     onClose={()=>setPreview(false)} registerBack={handler=>{selectedPreviewBack.current=handler;}}
     active={active} onMotionProgress={onMotionProgress}/>}
  </section>;
});
