import {useCallback,useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from "react";
import type {KeyboardEvent} from "react";
import {ArrowLeft,Eye,Heart,Images,MapPin,PenLine,Settings2,SlidersHorizontal,UserRound} from "lucide-react";
import {Flag} from "../../ui/Flag";
import {InterestChip} from "../../ui/InterestCatalog";
import {goals,type RegistrationDraft} from "../../registration/model";
import {goalLabel} from "../../ui/PersonalizedCopy";
import type {ProfileView} from "../ProfileModel";
import {resolvePhotoFocus} from "../profile-v3/geometry/ProfileGeometry";
import {createOwnerProfileLayout,ownerMorphFrame,ownerMorphProgress,type OwnerProfileLayout} from "./OwnerProfileGeometry";
import "./owner-premium-profile.css";

type OwnerTab="photos"|"about"|"interests";
const tabs:[OwnerTab,string][]=[["photos","Фото"],["about","О себе"],["interests","Интересы"]];

type Props={
 view:ProfileView;ownerDetails?:RegistrationDraft;active?:boolean;
 onBack:()=>void;onEdit:()=>void;onSettings:()=>void;onPreview:()=>void;
 onPhotoOpen:(id:string,element:HTMLImageElement|null)=>void;
 onMotionProgress?:(progress:number,dragging:boolean)=>void;
};

const numericToken=(node:HTMLElement,name:string)=>{
 const value=Number.parseFloat(getComputedStyle(node).getPropertyValue(name));
 return Number.isFinite(value)?value:0;
};

export function OwnerPremiumProfile({view,ownerDetails,active=true,onBack,onEdit,onSettings,onPreview,
 onPhotoOpen,onMotionProgress}:Props){
 const p=view.profile,photos=view.photos,mainPhoto=photos[0]??null;
 const [tab,setTab]=useState<OwnerTab>("photos");
 const root=useRef<HTMLElement>(null),scroller=useRef<HTMLDivElement>(null);
 const mask=useRef<HTMLDivElement>(null),heroImage=useRef<HTMLImageElement>(null);
 const shade=useRef<HTMLDivElement>(null),expandedIdentity=useRef<HTMLDivElement>(null);
 const compactIdentity=useRef<HTMLDivElement>(null),actions=useRef<HTMLDivElement>(null);
 const tablist=useRef<HTMLDivElement>(null);
 const layout=useRef<OwnerProfileLayout>(createOwnerProfileLayout({width:393,height:852}));
 const paintRaf=useRef(0),lastState=useRef("expanded");
 const motionProgress=useRef(onMotionProgress);
 const tabPrefix=useId();
 const goal=p.goal&&p.goal!=="undecided"?goals.find(item=>item.id===p.goal):null;
 const goalText=goal?goalLabel(goal.id,ownerDetails?.gender??p.gender??""):"Цель не указана";
 const location=[p.city,p.country].filter(Boolean).join(", ")||"Город не указан";
 const details=useMemo(()=>{
  if(!ownerDetails)return [];
  return [
   ownerDetails.height?{label:"Рост",value:`${ownerDetails.height} см`}:null,
   ownerDetails.occupation?{label:"Работа",value:ownerDetails.occupation}:null,
   ownerDetails.education?{label:"Образование",value:ownerDetails.education}:null
  ].filter((item):item is {label:string;value:string}=>item!==null);
 },[ownerDetails]);

 useEffect(()=>{motionProgress.current=onMotionProgress;},[onMotionProgress]);

 const paint=useCallback((scrollTop:number)=>{
  const progress=ownerMorphProgress(scrollTop,layout.current.morphDistance);
  const frame=ownerMorphFrame(layout.current,progress);
  const surface=mask.current;
  if(surface){
   surface.style.transform=`translate3d(${frame.mask.x}px,${frame.mask.y}px,0)`;
   surface.style.width=`${frame.mask.width}px`;
   surface.style.height=`${frame.mask.height}px`;
   surface.style.borderRadius=`${frame.radius}px`;
  }
  if(shade.current)shade.current.style.opacity=String(frame.photoShadeAlpha);
  if(expandedIdentity.current){
   expandedIdentity.current.style.opacity=String(frame.expandedAlpha);
   expandedIdentity.current.style.transform=`translate3d(0,${-progress*18}px,0)`;
   expandedIdentity.current.setAttribute("aria-hidden",progress>.58?"true":"false");
  }
  if(actions.current){
   actions.current.style.opacity=String(frame.actionsAlpha);
   actions.current.style.transform=`translate3d(-50%,${-progress*14}px,0)`;
   actions.current.style.pointerEvents=progress<.44?"auto":"none";
   actions.current.toggleAttribute("inert",progress>=.44);
   actions.current.setAttribute("aria-hidden",progress>=.44?"true":"false");
  }
  if(compactIdentity.current){
   compactIdentity.current.style.opacity=String(frame.compactAlpha);
   compactIdentity.current.style.transform=`translate3d(-50%,${(1-progress)*8}px,0)`;
   compactIdentity.current.setAttribute("aria-hidden",progress<=.58?"true":"false");
  }
  const state=progress<=.001?"expanded":progress>=.999?"compact":"transition";
  if(root.current&&lastState.current!==state){root.current.dataset.morphState=state;lastState.current=state;}
  motionProgress.current?.(1-progress,false);
 },[]);
 const schedulePaint=useCallback(()=>{
  if(paintRaf.current)return;
  paintRaf.current=requestAnimationFrame(()=>{paintRaf.current=0;paint(scroller.current?.scrollTop??0);});
 },[paint]);

 useLayoutEffect(()=>{
  const host=root.current,scroll=scroller.current;if(!host||!scroll)return;
  let resizeRaf=0;
  const measure=()=>{
   const rect=host.getBoundingClientRect();if(rect.width<280||rect.height<360)return;
   const next=createOwnerProfileLayout({width:rect.width,height:rect.height,
    topInset:numericToken(host,"--top-safe"),bottomInset:numericToken(host,"--bottom-safe")});
   layout.current=next;
   host.style.setProperty("--owner-hero-height",`${next.hero.height}px`);
   host.style.setProperty("--owner-compact-top",`${next.compactContentTop}px`);
   host.style.setProperty("--owner-compact-name-top",`${next.compactAvatar.y+next.compactAvatar.height+8}px`);
   host.style.setProperty("--owner-morph-distance",`${next.morphDistance}px`);
   paint(scroll.scrollTop);
  };
  const resize=()=>{if(resizeRaf)return;resizeRaf=requestAnimationFrame(()=>{resizeRaf=0;measure();});};
  const observer=new ResizeObserver(resize);observer.observe(host);
  scroll.addEventListener("scroll",schedulePaint,{passive:true});
  window.visualViewport?.addEventListener("resize",resize);
  const web=window.Telegram?.WebApp;
  const viewportChanged=(event?:{isStateStable?:boolean})=>{if(event?.isStateStable!==false)resize();};
  web?.onEvent?.("viewportChanged",viewportChanged);web?.onEvent?.("safeAreaChanged",resize);
  measure();
  return()=>{
   observer.disconnect();scroll.removeEventListener("scroll",schedulePaint);
   window.visualViewport?.removeEventListener("resize",resize);
   web?.offEvent?.("viewportChanged",viewportChanged);web?.offEvent?.("safeAreaChanged",resize);
   if(resizeRaf)cancelAnimationFrame(resizeRaf);if(paintRaf.current)cancelAnimationFrame(paintRaf.current);
   resizeRaf=0;paintRaf.current=0;
  };
 },[paint,schedulePaint]);
 useLayoutEffect(()=>{
  if(!active||!scroller.current)return;
  scroller.current.scrollTop=0;lastState.current="expanded";
  root.current?.setAttribute("data-morph-state","expanded");paint(0);
 },[active,mainPhoto?.id,paint]);
 useEffect(()=>{
  if(!mainPhoto||!heroImage.current)return;
  const image=heroImage.current;
  image.loading="eager";
  void image.decode?.().catch(()=>{/* onLoad/onError keeps the visible surface authoritative */});
 },[mainPhoto]);

 const selectTab=(next:OwnerTab,focus=false)=>{
  setTab(next);
  requestAnimationFrame(()=>{
   const button=tablist.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(tabPrefix+"-"+next+"-tab")}`);
   if(focus)button?.focus({preventScroll:true});
   button?.scrollIntoView({block:"nearest",inline:"nearest"});
  });
 };
 const tabKey=(event:KeyboardEvent<HTMLButtonElement>,index:number)=>{
  const next=event.key==="ArrowRight"?Math.min(tabs.length-1,index+1):
   event.key==="ArrowLeft"?Math.max(0,index-1):event.key==="Home"?0:event.key==="End"?tabs.length-1:-1;
  if(next<0)return;event.preventDefault();selectTab(tabs[next][0],true);
 };
 const showPhotos=()=>{
  selectTab("photos");
  const target=layout.current.morphDistance+Math.max(0,layout.current.compactContentTop*.3);
  scroller.current?.scrollTo({top:target,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
 };

 return <section ref={root} className="owner-premium-profile" data-morph-state="expanded" aria-label="Мой профиль">
  <div className="owner-profile-backdrop" aria-hidden="true"/>
  <div ref={mask} className="owner-profile-photo-mask">
   {mainPhoto?<img ref={heroImage} data-photo-id={mainPhoto.id} src={mainPhoto.src}
     alt={`Главное фото профиля ${p.name}`} draggable={false} loading="eager" decoding="async" fetchPriority="high"
     style={{objectPosition:`${resolvePhotoFocus(1,2,mainPhoto.focalPoint).x*100}% ${resolvePhotoFocus(1,2,mainPhoto.focalPoint).y*100}%`}}
     onLoad={event=>{const point=resolvePhotoFocus(event.currentTarget.naturalWidth,event.currentTarget.naturalHeight,mainPhoto.focalPoint);
      event.currentTarget.style.objectPosition=`${point.x*100}% ${point.y*100}%`;}}
     onClick={()=>onPhotoOpen(mainPhoto.id,heroImage.current)}
     onError={event=>{if(mainPhoto.fallback&&event.currentTarget.src!==mainPhoto.fallback)event.currentTarget.src=mainPhoto.fallback;}}/>:
    <div className="owner-profile-photo-empty"><UserRound size={42}/><span>Добавь главное фото</span></div>}
   <div ref={shade} className="owner-profile-photo-shade" aria-hidden="true"/>
  </div>

  <header className="owner-profile-topbar">
   <button type="button" className="owner-profile-glass owner-profile-back" onClick={onBack} aria-label="Назад"><ArrowLeft/></button>
   <button type="button" className="owner-profile-glass owner-profile-edit-top" onClick={onEdit} aria-label="Редактировать профиль">
    <PenLine size={16}/><span>Изменить</span>
   </button>
  </header>

  <div ref={expandedIdentity} className="owner-profile-expanded-identity">
   <h1>{p.name||"Имя не указано"}{p.age!==null?`, ${p.age}`:""}</h1>
   <p>{view.published?"Анкета опубликована":"Анкета не опубликована"}</p>
  </div>
  <div ref={actions} className="owner-profile-actions" aria-label="Действия профиля">
   <button type="button" className="owner-profile-glass" onClick={onEdit} aria-label="Редактировать профиль"><PenLine/></button>
   <button type="button" className="owner-profile-glass" onClick={onPreview} aria-label="Посмотреть анкету глазами других"><Eye/></button>
   <button type="button" className="owner-profile-glass" onClick={showPhotos} aria-label="Управлять фотографиями"><Images/></button>
   <button type="button" className="owner-profile-glass" onClick={onSettings} aria-label="Настройки профиля"><Settings2/></button>
  </div>
  <div ref={compactIdentity} className="owner-profile-compact-identity" aria-hidden="true">
   <strong>{p.name||"Имя не указано"}{p.age!==null?`, ${p.age}`:""}</strong>
   <span>{location}</span>
  </div>

  <div ref={scroller} className="owner-profile-scroll">
   <div className="owner-profile-hero-spacer" aria-hidden="true"/>
   <main className="owner-profile-content">
    <section className="owner-profile-summary" aria-label="Основная информация">
     <div><MapPin size={17}/><span>{p.countryCode&&<Flag code={p.countryCode} size={20}/>} {location}</span></div>
     <div><Heart size={17}/><span>{goalText}</span></div>
     {p.about&&<p>{p.about}</p>}
    </section>

    <div ref={tablist} className="owner-profile-tabs" role="tablist" aria-label="Разделы профиля">
     {tabs.map(([id,label],index)=><button type="button" role="tab" key={id}
      id={`${tabPrefix}-${id}-tab`} aria-controls={`${tabPrefix}-${id}-panel`}
      aria-selected={tab===id} tabIndex={tab===id?0:-1}
      onClick={()=>selectTab(id)} onKeyDown={event=>tabKey(event,index)}>{label}</button>)}
    </div>

    <section id={`${tabPrefix}-photos-panel`} role="tabpanel" aria-labelledby={`${tabPrefix}-photos-tab`}
     aria-label="Фото" hidden={tab!=="photos"} className="owner-profile-panel">
     {photos.length?<div className="owner-profile-gallery">{photos.map((photo,index)=><button type="button" key={photo.id}
      className="owner-profile-photo-tile" aria-label={`Открыть фото ${index+1}`}
      onClick={event=>onPhotoOpen(photo.id,event.currentTarget.querySelector("img"))}>
      <img data-photo-id={photo.id} src={photo.src} alt="" draggable={false} loading="lazy" decoding="async"
       onError={event=>{if(photo.fallback&&event.currentTarget.src!==photo.fallback)event.currentTarget.src=photo.fallback;}}/>
      {index===0&&<span>Главное</span>}
     </button>)}</div>:<div className="owner-profile-empty"><Images/><p>Фотографии ещё не добавлены</p></div>}
     <button type="button" className="owner-profile-manage" onClick={onEdit}><SlidersHorizontal size={18}/> Управлять фотографиями</button>
    </section>

    <section id={`${tabPrefix}-about-panel`} role="tabpanel" aria-labelledby={`${tabPrefix}-about-tab`}
     aria-label="О себе" hidden={tab!=="about"} className="owner-profile-panel owner-profile-about">
     <article><h2>О себе</h2><p>{p.about||"Описание пока не заполнено."}</p></article>
     <article><h2>Основное</h2><dl><div><dt>Город</dt><dd>{location}</dd></div><div><dt>Цель знакомства</dt><dd>{goalText}</dd></div>
      {details.map(item=><div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></article>
     <button type="button" className="owner-profile-manage" onClick={onEdit}><PenLine size={18}/> Изменить информацию</button>
    </section>

    <section id={`${tabPrefix}-interests-panel`} role="tabpanel" aria-labelledby={`${tabPrefix}-interests-tab`}
     aria-label="Интересы" hidden={tab!=="interests"} className="owner-profile-panel">
     {p.interests.length?<div className="owner-profile-interests">{p.interests.map(id=><InterestChip key={id} id={id}/>)}</div>:
      <div className="owner-profile-empty"><Heart/><p>Интересы пока не выбраны</p></div>}
     <button type="button" className="owner-profile-manage" onClick={onEdit}><PenLine size={18}/> Управлять интересами</button>
    </section>
   </main>
  </div>
 </section>;
}
