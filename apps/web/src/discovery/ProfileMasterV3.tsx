import {memo,useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from "react";
import {FileText,Sparkles,Images,UserRound,Heart,CalendarDays,ShieldCheck,Languages as LanguagesIcon,Info} from "lucide-react";
import {Flag} from "../ui/Flag";
import {InterestChip} from "../ui/InterestCatalog";
import {languages} from "../ui/Languages";
import {goals} from "../registration/model";
import type {ProfileMasterData,ProfilePhoto,ProfileView} from "./ProfileModel";
import {projectProfile} from "./ProfileModel";
import {PhotoViewer} from "./PhotoViewer";
import {QaProfiler} from "./qa-profiler";
import {resourceIdentity,viewerPhotoContext,reconcilePhotoId,type ViewerSource} from "./photo-viewer-state";
import {useModalLayer} from "../ui/modal-layer";
import type {GestureArbiter} from "../ui/gesture-arbiter";
import {IntegratedProfileV3,type V3TabId} from "./profile-v3/rendering/IntegratedProfileV3";
import "./profile-morph-a2.css";
import "./profile-v3/rendering/IntegratedProfileV3.css";

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


export const ProfileMaster=memo(function ProfileMaster({data,mode,onClose,onEdit,registerBack,
 active=true,onMotionProgress,registerRouteMotion,gestureArbiter}:Props){
 const view=useMemo(()=>projectProfile(data,mode),[data,mode]),photos=view.photos;
 const [photoId,setPhotoId]=useState<string|null>(photos[0]?.id??null);
 const [viewer,setViewer]=useState<{photoId:string;source:ViewerSource|null}|null>(null);
 const [preview,setPreview]=useState(false);
 const [expanded,setExpanded]=useState(false);
 const root=useRef<HTMLElement>(null);
 const selectedViewerBack=useRef<(()=>boolean)|null>(null),selectedPreviewBack=useRef<(()=>boolean)|null>(null);
 const innerBack=useRef<()=>void>(()=>{});
 const nested=mode==="preview"||(mode==="local-self-preview"&&!!onClose);
 const inline=mode==="owner"||(mode==="local-self-preview"&&!onClose);
 useModalLayer(nested,root,()=>innerBack.current());
 const oldIds=useRef(photos.map(p=>p.id));
 const photoIdLive=useRef(photoId);photoIdLive.current=photoId;
 useLayoutEffect(()=>{
  const ids=photos.map(p=>p.id);
  if(ids.join("\u0000")!==oldIds.current.join("\u0000")){
   const next=reconcilePhotoId(photoIdLive.current,oldIds.current,photos);
   oldIds.current=ids;
   setPhotoId(next);
  }
 },[photos]);
 const choosePhoto=useCallback((id:string)=>{
  if(photos.some(p=>p.id===id)){photoIdLive.current=id;setPhotoId(id);}
 },[photos]);
 const openPhoto=useCallback((id:string,element:HTMLImageElement|null)=>{
  const photo=photos.find(p=>p.id===id);
  if(!photo)return;
  const contextId=viewerPhotoContext(view);
  const source:ViewerSource|null=element?{photoId:id,contextId,
   resourceKey:resourceIdentity(photo),resolveElement:()=>element}:null;
  setViewer({photoId:id,source});
 },[photos,view]);
 const closeTop=useCallback(():boolean=>{
  if(viewer){if(selectedViewerBack.current)return selectedViewerBack.current();setViewer(null);return true;}
  if(preview){if(selectedPreviewBack.current?.())return true;setPreview(false);return true;}
  if(onClose){onClose();return true;}
  return false;
 },[viewer,preview,onClose]);
 innerBack.current=()=>{closeTop();};
 useEffect(()=>{if(!active)return;registerBack?.(closeTop);return ()=>registerBack?.(null);},[active,closeTop,registerBack]);
 const renderPage=(id:V3TabId)=>{
  if(id==="about")return <About view={view}/>;
  if(id==="bliki")return <Bliki/>;
  if(id==="meta")return <Meta view={view}/>;
  if(id==="gifts")return <Gifts view={view}/>;
  return photos.length?<div className="pm-photos-grid">{photos.map((photo,i)=>
   <button type="button" className="pm-photo-tile" key={photo.id}
    aria-label={"Открыть фото "+(i+1)}
    onClick={e=>openPhoto(photo.id,e.currentTarget.querySelector("img"))}>
    <PhotoImage photo={photo} alt="" loading="lazy"/>
    {photo.status!=="published"&&<span>{photo.status==="draft"?"Черновик":"Проверка"}</span>}
   </button>)}</div>:<div className="pm-empty"><Images size={37}/><h3>Пока нет доступных фото</h3></div>;
 };
 return <section ref={root} className={"pm-shell v3-profile-host "+(inline?"pm-inline":"pm-dialog")}
   data-sheet-state={expanded?"expanded":"collapsed"} data-morph-state={expanded?"expanded":"compact"}
   role={inline?undefined:"dialog"} aria-modal={inline?undefined:true}
   tabIndex={mode==="visitor"?-1:undefined} data-modal-initial={mode==="visitor"?"true":undefined}
   aria-label={mode==="owner"?"Мой профиль":mode==="visitor"?"Профиль":"Предпросмотр профиля"}>
   <IntegratedProfileV3 view={view} photoId={photoId} onPhotoId={choosePhoto}
    onPhotoOpen={openPhoto} onState={setExpanded} onMotionProgress={onMotionProgress}
    registerRouteMotion={registerRouteMotion} gestureArbiter={gestureArbiter}
    onEdit={onEdit} onShowPreview={()=>setPreview(true)} renderPage={renderPage}/>
   {nested&&<div className="pm-preview-toolbar"><button type="button" data-modal-initial onClick={onClose}>Закрыть предпросмотр</button></div>}
   {viewer&&<QaProfiler id="PhotoViewer"><PhotoViewer view={view} photos={photos} initialPhotoId={viewer.photoId}
     source={viewer.source} contextId={viewerPhotoContext(view)} onClose={returnId=>{
      if(returnId)choosePhoto(returnId);
      setViewer(null);
     }}
     registerBack={handler=>{selectedViewerBack.current=handler;}}/></QaProfiler>}
   {preview&&<ProfileMaster data={data} mode={data.source==="local-draft"?"local-self-preview":"preview"}
     onClose={()=>setPreview(false)} registerBack={handler=>{selectedPreviewBack.current=handler;}}
     active={active} onMotionProgress={onMotionProgress}/>}
  </section>;
});
