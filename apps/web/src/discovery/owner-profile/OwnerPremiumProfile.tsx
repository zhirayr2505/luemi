import {useCallback,useId,useLayoutEffect,useMemo,useRef,useState} from "react";
import type {CSSProperties,KeyboardEvent} from "react";
import {CalendarDays,Eye,Gift,Heart,Images,MapPin,PenLine,Settings2,Sparkles,UserRound} from "lucide-react";
import {InterestChip} from "../../ui/InterestCatalog";
import {Flag} from "../../ui/Flag";
import {goals,type RegistrationDraft} from "../../registration/model";
import {goalLabel} from "../../ui/PersonalizedCopy";
import {computedTranslation,type GestureArbiter} from "../../ui/gesture-arbiter";
import type {ProfileView} from "../ProfileModel";
import type {ProfileRouteMotionHandle} from "../ProfileV3Gateway";
import {resolvePhotoFocus} from "../profile-v3/geometry/ProfileGeometry";
import {clamp} from "./OwnerProfileGeometry";
import {useOwnerProfileMotion} from "./useOwnerProfileMotion";
import "./owner-premium-profile.css";

type OwnerTab="about"|"photos"|"bliki"|"gifts";
const tabs:[OwnerTab,string][]=[["about","О себе"],["photos","Фото"],["bliki","Блики"],["gifts","Подарки"]];
const slideDuration=230;
const loop=(index:number,count:number)=>(index+count)%count;

type Props={
 view:ProfileView;ownerDetails?:RegistrationDraft;active?:boolean;
 onEdit:()=>void;onSettings:()=>void;onPreview:()=>void;
 onPhotoOpen:(id:string,element:HTMLImageElement|null)=>void;
 onMotionProgress?:(progress:number,dragging:boolean)=>void;
 gestureArbiter?:GestureArbiter;
 registerRouteMotion?:(handle:ProfileRouteMotionHandle|null)=>void;
};

export function OwnerPremiumProfile({view,ownerDetails,active=true,onEdit,onSettings,onPreview,
 onPhotoOpen,onMotionProgress,gestureArbiter,registerRouteMotion}:Props){
 const p=view.profile,photos=view.photos,isOwner=view.mode==="owner";
 const [tab,setTab]=useState<OwnerTab>("about");
 const [selectedId,setSelectedId]=useState(photos[0]?.id??null);
 const selectedIndex=Math.max(0,photos.findIndex(photo=>photo.id===selectedId));
 const heroPhoto=photos[selectedIndex];
 const previousPhoto=photos.length>1?photos[loop(selectedIndex-1,photos.length)]:null;
 const nextPhoto=photos.length>2?photos[loop(selectedIndex+1,photos.length)]:null;
 const track=useRef<HTMLDivElement>(null),heroImage=useRef<HTMLImageElement>(null);
 const photoTimer=useRef<number|undefined>(undefined);
 const drag=useRef({width:1,origin:0,offset:0});
 const tablist=useRef<HTMLDivElement>(null);
 const tabPrefix=useId();

 const goal=p.goal&&p.goal!=="undecided"?goals.find(item=>item.id===p.goal):null;
 const goalText=goal?goalLabel(goal.id,ownerDetails?.gender??p.gender??""):"Цель не указана";
 const location=p.city||p.country||"Город не указан";
 const countryCode=p.countryCode;
 const details=useMemo(()=>{
  if(!ownerDetails)return [];
  return [
   ownerDetails.height?{label:"Рост",value:`${ownerDetails.height} см`}:null,
   ownerDetails.occupation?{label:"Работа",value:ownerDetails.occupation}:null,
   ownerDetails.education?{label:"Образование",value:ownerDetails.education}:null
  ].filter((item):item is {label:string;value:string}=>item!==null);
 },[ownerDetails]);

 const cancelPhoto=useCallback(()=>{
  window.clearTimeout(photoTimer.current);
  photoTimer.current=undefined;
  const el=track.current;
  if(!el)return;
  el.style.removeProperty("transition");
  el.style.removeProperty("transform");
  delete el.dataset.direction;
 },[]);
 const pickPhoto=(index:number)=>{
  const next=photos[index];
  if(!next)return;
  cancelPhoto();
  setSelectedId(next.id);
 };
 const startPhoto=(visibleWidth:number,fullWidth:number)=>{
  const el=track.current;
  if(!el||photos.length<=1)return;
  window.clearTimeout(photoTimer.current);
  photoTimer.current=undefined;
  // Read the visible offset before interrupting the CSS transition. Once
  // claimed, movement uses the sampled width and an unscaled percentage.
  const offset=computedTranslation(el)/fullWidth;
  drag.current={width:visibleWidth,origin:offset,offset};
  el.style.transition="none";
  el.style.transform=`translate3d(${offset*100}%,0,0)`;
 };
 const movePhoto=(delta:number)=>{
  const el=track.current;
  if(!el||photos.length<=1)return;
  const offset=clamp(drag.current.origin+delta/drag.current.width,-1,1);
  drag.current.offset=offset;
  const direction=offset<0?"next":"previous";
  if(el.dataset.direction!==direction)el.dataset.direction=direction;
  el.style.transform=`translate3d(${offset*100}%,0,0)`;
 };
 const endPhoto=(swipe:-1|0|1)=>{
  const el=track.current;
  if(!el||photos.length<=1)return;
  const direction=swipe*drag.current.offset>0?swipe:0;
  const next=photos[loop(selectedIndex-direction,photos.length)];
  if(matchMedia("(prefers-reduced-motion: reduce)").matches){
   cancelPhoto();
   setSelectedId(next.id);
   return;
  }
  if(direction!==0)el.dataset.direction=direction<0?"next":"previous";
  el.style.transition=`transform ${slideDuration}ms cubic-bezier(.20,.82,.24,1)`;
  el.style.transform=`translate3d(${direction*100}%,0,0)`;
  photoTimer.current=window.setTimeout(()=>{
   photoTimer.current=undefined;
   if(direction===0)cancelPhoto();
   else setSelectedId(next.id);
  },slideDuration);
 };

 const selectTab=(next:OwnerTab,focus=false)=>{
  if(next!==tab){
   commands.current.resetCards();
   setTab(next);
  }
  if(focus)tablist.current?.querySelector<HTMLButtonElement>(`[data-tab-id="${next}"]`)?.focus({preventScroll:true});
 };
 const {root,commands}=useOwnerProfileMotion({
  active,profileId:p.id,gestureArbiter,registerRouteMotion,onMotionProgress,
  horizontal:{startPhoto,movePhoto,endPhoto,cancelPhoto,pageTab:direction=>{
   const index=tabs.findIndex(([id])=>id===tab);
   selectTab(tabs[clamp(index+direction,0,tabs.length-1)][0]);
  }}
 });
 const tabKey=(event:KeyboardEvent<HTMLButtonElement>,index:number)=>{
  const next=event.key==="ArrowRight"?Math.min(tabs.length-1,index+1):
   event.key==="ArrowLeft"?Math.max(0,index-1):event.key==="Home"?0:event.key==="End"?tabs.length-1:-1;
  if(next<0)return;
  event.preventDefault();
  selectTab(tabs[next][0],true);
 };
 const showPhotos=()=>{
  selectTab("photos");
  commands.current.compact();
 };
 useLayoutEffect(()=>{
  if(!active)return;
  setTab("about");
  setSelectedId(photos[0]?.id??null);
 // The view can refresh media without reopening the profile or resetting its selection.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[active,p.id]);
 const photoOrder=photos.map(photo=>photo.id).join("\u0000");
 useLayoutEffect(()=>{
  // Role positions and the track reset land in the same paint. The destination
  // slide stays keyed by its photo ID, so it keeps the decoded image.
  cancelPhoto();
  const availableId=heroPhoto?.id??null;
  if(selectedId!==availableId)setSelectedId(availableId);
 },[photoOrder,selectedId,heroPhoto?.id,cancelPhoto]);

 const openPhoto=()=>{if(heroPhoto)onPhotoOpen(heroPhoto.id,heroImage.current);};
 const visiblePhotos=[
  {photo:previousPhoto,slot:"previous"},
  {photo:heroPhoto,slot:"current"},
  {photo:nextPhoto,slot:"next"}
 ];

 return <section ref={root} className="owner-premium-profile" data-morph-state="expanded"
  data-mode={isOwner?"owner":"visitor"} aria-label={isOwner?"Мой профиль":"Профиль"}
  onClickCapture={event=>{
   if(event.detail!==0&&!commands.current.allowClick()){event.preventDefault();event.stopPropagation();}
  }}>
  <div className="owner-profile-backdrop" aria-hidden="true"/>
  <div className="owner-profile-photo-mask" role={heroPhoto?"button":undefined}
   tabIndex={heroPhoto?0:-1} aria-label={heroPhoto?"Открыть фотографию профиля":undefined}
   onClick={openPhoto} onKeyDown={event=>{
    if(heroPhoto&&(event.key==="Enter"||event.key===" ")){event.preventDefault();openPhoto();}
   }}>
   <div ref={track} className="owner-profile-photo-track" data-two-photos={photos.length===2?"true":undefined}>
    {visiblePhotos.map(({photo,slot})=>{
     if(!photo)return null;
     const selected=slot==="current",focus=resolvePhotoFocus(1,2,photo.focalPoint);
     return <img key={photo.id} ref={selected?heroImage:undefined} data-slot={slot} data-photo-id={photo.id}
      src={photo.src} alt={selected?"Фото профиля "+p.name:""} aria-hidden={selected?undefined:true}
      draggable={false} loading="eager" decoding="async" fetchPriority={selected?"high":"auto"}
      style={{objectPosition:`${focus.x*100}% ${focus.y*100}%`}}
      onLoad={event=>{
       const image=event.currentTarget,point=resolvePhotoFocus(image.naturalWidth,image.naturalHeight,photo.focalPoint);
       image.style.objectPosition=`${point.x*100}% ${point.y*100}%`;
      }}
      onError={event=>{
       if(photo.fallback&&event.currentTarget.getAttribute("src")!==photo.fallback)event.currentTarget.src=photo.fallback;
      }}/>;
    })}
    {!heroPhoto&&<div className="owner-profile-photo-empty"><UserRound size={42}/><span>Фото пока нет</span></div>}
   </div>
   <div className="owner-profile-photo-shade" aria-hidden="true"/>
  </div>
  <div className="owner-profile-photo-pager" hidden={photos.length<=1} aria-label="Фотографии">
   {photos.length>1&&photos.map((photo,index)=><button key={photo.id} type="button" className={index===selectedIndex?"active":""}
    aria-label={"Показать фото "+(index+1)} aria-current={index===selectedIndex?"true":undefined}
    onClick={()=>pickPhoto(index)}/>)}
  </div>
  <div className="owner-profile-brand" translate="no">
   <img src="/assets/brand/wordmark_original_raster_alpha_W06.webp" alt="LUEMI" decoding="async"/>
  </div>
  {isOwner&&<header className="owner-profile-topbar">
   <button type="button" className="owner-profile-glass owner-profile-edit-top" onClick={onEdit} aria-label="Редактировать профиль">
    <PenLine size={18}/>
   </button>
  </header>}
  <div className="owner-profile-identity">
   <h1>{p.name||"Имя не указано"}{p.age!==null?", "+p.age:""}</h1>
   <p><MapPin size={15} aria-hidden="true"/><span className="owner-profile-location">
    <span className="owner-profile-city">{location}</span>{countryCode?<Flag code={countryCode} size={17} title={"Флаг "+p.country}/>:null}
   </span></p>
  </div>

  <main className="owner-profile-sheet">
   <div ref={tablist} className="owner-profile-tabs" role="tablist" aria-label="Разделы профиля"
    style={{"--owner-tab-offset":`${tabs.findIndex(([id])=>id===tab)*25}%`} as CSSProperties}>
    {tabs.map(([id,label],index)=><button type="button" role="tab" key={id} data-tab-id={id}
     id={tabPrefix+"-"+id+"-tab"} aria-controls={tabPrefix+"-"+id+"-panel"}
     aria-selected={tab===id} tabIndex={tab===id?0:-1}
     onClick={()=>selectTab(id)} onKeyDown={event=>tabKey(event,index)}>{label}</button>)}
   </div>
   <div className="owner-profile-scroll">
    <div className="owner-profile-content">
     <div className="owner-profile-pages">
     <section id={tabPrefix+"-about-panel"} role="tabpanel" aria-labelledby={tabPrefix+"-about-tab"}
      aria-label="О себе" hidden={tab!=="about"} className="owner-profile-panel owner-profile-about">
      <article><h2>О себе</h2><p>{p.about||"Описание пока не заполнено."}</p></article>
      <article><h2>Основное</h2><div className="owner-profile-basics">
       {p.age!==null&&<div><CalendarDays size={18} aria-hidden="true"/><span>{p.age} лет</span></div>}
       <div><MapPin size={18} aria-hidden="true"/><span className="owner-profile-location">{location}{countryCode?<Flag code={countryCode} size={17} title={"Флаг "+p.country}/>:null}</span></div>
      </div>
      {goal&&<div className="owner-profile-goal"><Heart size={16} aria-hidden="true"/>{goalText}</div>}
      {details.length>0&&<dl>{details.map(item=><div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>}</article>
      {p.interests.length>0&&<article><h2>Интересы</h2><div className="owner-profile-interests">{p.interests.map(id=><InterestChip key={id} id={id}/>)}</div></article>}

      {p.source==="fixture"&&<p className="owner-profile-disclaimer">Демонстрационный профиль, не реальный пользователь.</p>}
     </section>
     <section id={tabPrefix+"-photos-panel"} role="tabpanel" aria-labelledby={tabPrefix+"-photos-tab"}
      aria-label="Фото" hidden={tab!=="photos"} className="owner-profile-panel">
      {photos.length?<div className="owner-profile-gallery">{photos.map((photo,index)=><button type="button" key={photo.id}
       className="owner-profile-photo-tile" aria-label={"Открыть фото "+(index+1)}
       onClick={event=>onPhotoOpen(photo.id,event.currentTarget.querySelector("img"))}>
       <img data-photo-id={photo.id} src={photo.src} alt="" draggable={false} loading="lazy" decoding="async"
        onError={event=>{if(photo.fallback&&event.currentTarget.src!==photo.fallback)event.currentTarget.src=photo.fallback;}}/>
       {index===0&&<span>Главное</span>}
      </button>)}</div>:<div className="owner-profile-empty"><Images/><p>Фотографии ещё не добавлены</p></div>}
     </section>
     <section id={tabPrefix+"-bliki-panel"} role="tabpanel" aria-labelledby={tabPrefix+"-bliki-tab"}
      aria-label="Блики" hidden={tab!=="bliki"} className="owner-profile-panel">
      <div className="owner-profile-empty"><Sparkles size={34}/><h2>Пока нет бликов</h2><p>Здесь появятся моменты из жизни.</p></div>
     </section>
     <section id={tabPrefix+"-gifts-panel"} role="tabpanel" aria-labelledby={tabPrefix+"-gifts-tab"}
      aria-label="Подарки" hidden={tab!=="gifts"} className="owner-profile-panel">
      <div className="owner-profile-empty"><Gift size={34}/><h2>Подарков пока нет</h2><p>Здесь будут отображаться полученные подарки.</p></div>
     </section>
    </div>
      {isOwner&&<div className="owner-profile-actions" aria-label="Действия профиля">
       <button type="button" className="owner-profile-glass" onClick={onEdit} aria-label="Изменить данные"><PenLine/></button>
       <button type="button" className="owner-profile-glass" onClick={onPreview} aria-label="Посмотреть анкету глазами других"><Eye/></button>
       <button type="button" className="owner-profile-glass" onClick={showPhotos} aria-label="Управлять фотографиями"><Images/></button>
       <button type="button" className="owner-profile-glass" onClick={onSettings} aria-label="Настройки профиля"><Settings2/></button>
      </div>}
    </div>
   </div>
  </main>
 </section>;
}
