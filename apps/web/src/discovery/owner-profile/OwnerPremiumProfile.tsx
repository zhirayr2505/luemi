import {useCallback,useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from "react";
import type {KeyboardEvent,PointerEvent as ReactPointerEvent} from "react";
import {ArrowLeft,CalendarDays,Eye,Gift,Heart,Images,MapPin,PenLine,Settings2,Sparkles,UserRound} from "lucide-react";
import {InterestChip} from "../../ui/InterestCatalog";
import {goals,type RegistrationDraft} from "../../registration/model";
import {goalLabel} from "../../ui/PersonalizedCopy";
import type {ProfileView} from "../ProfileModel";
import {resolvePhotoFocus} from "../profile-v3/geometry/ProfileGeometry";
import {createOwnerProfileLayout,ownerMorphFrame,ownerMorphProgress,type OwnerProfileLayout} from "./OwnerProfileGeometry";
import "./owner-premium-profile.css";

type OwnerTab="about"|"photos"|"bliki"|"gifts";
const tabs:[OwnerTab,string][]=[["about","О себе"],["photos","Фото"],["bliki","Блики"],["gifts","Подарки"]];

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
 const p=view.profile,photos=view.photos,mainPhoto=photos[0]??null,isOwner=view.mode==="owner";
 const [tab,setTab]=useState<OwnerTab>("about");
 const [heroIndex,setHeroIndex]=useState(0);
 // The selected tab indicator changes immediately; the still-mounted hero image
 // only swaps its src once its adjacent photo has finished sliding into place.
 const [renderIndex,setRenderIndex]=useState(0);
 const heroPhoto=photos[Math.min(renderIndex,Math.max(0,photos.length-1))]??mainPhoto;
 const previousPhoto=photos[renderIndex-1]??null,nextPhoto=photos[renderIndex+1]??null;
 const photoSwipe=useRef<{id:number;x:number;y:number;startScroll:number;width:number;axis:"horizontal"|"vertical"|null}|null>(null);
 const pageSwipe=useRef<{id:number;x:number;y:number}|null>(null);
 const suppressPhotoClick=useRef(false);
 const root=useRef<HTMLElement>(null),scroller=useRef<HTMLDivElement>(null);
 const mask=useRef<HTMLDivElement>(null),heroImage=useRef<HTMLImageElement>(null);
 const prevImage=useRef<HTMLDivElement>(null),nextImage=useRef<HTMLDivElement>(null);
 const photoSlideTimer=useRef<number|null>(null);
 const shade=useRef<HTMLDivElement>(null),expandedIdentity=useRef<HTMLDivElement>(null);
 const compactIdentity=useRef<HTMLDivElement>(null);
 const tablist=useRef<HTMLDivElement>(null),brandProbe=useRef<HTMLDivElement>(null);
 const compactBackdrop=useRef<HTMLDivElement>(null),pager=useRef<HTMLDivElement>(null);
 const topEdit=useRef<HTMLButtonElement>(null);
 const layout=useRef<OwnerProfileLayout>(createOwnerProfileLayout({width:393,height:852}));
 const paintRaf=useRef(0),lastState=useRef("expanded"),lastPaintedProgress=useRef(0);
 const compactPinned=useRef(false);
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
  lastPaintedProgress.current=progress;
  if(progress>=.999)compactPinned.current=true;
  else if(scrollTop<=1)compactPinned.current=false;
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
  if(compactIdentity.current){
   compactIdentity.current.style.opacity=String(frame.compactAlpha);
   compactIdentity.current.style.transform=`translate3d(-50%,${(1-progress)*8}px,0)`;
   compactIdentity.current.setAttribute("aria-hidden",progress<=.58?"true":"false");
  }
  if(compactBackdrop.current)compactBackdrop.current.style.opacity=String(Math.max(0,Math.min(1,(progress-.40)/.36)));
  if(pager.current){
   pager.current.style.opacity=String(Math.max(0,Math.min(1,(.43-progress)/.23)));
   pager.current.style.pointerEvents=progress<.31?"auto":"none";
   pager.current.toggleAttribute("inert",progress>=.31);
  }
  if(topEdit.current){
   topEdit.current.style.opacity=String(frame.actionsAlpha);
   topEdit.current.style.pointerEvents=progress<.29?"auto":"none";
   topEdit.current.toggleAttribute("inert",progress>=.29);
  }
  root.current?.style.setProperty("--owner-morph-progress",String(progress));
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
   // Measure a real element: getComputedStyle(custom-property) may return
   // unevaluated max() on Android WebView, so parseFloat() would give NaN.
   const brandY=brandProbe.current?brandProbe.current.getBoundingClientRect().top-rect.top:84;
   const next=createOwnerProfileLayout({width:rect.width,height:rect.height,
    topInset:Math.max(44,brandY),bottomInset:numericToken(host,"--bottom-safe")});
   // Telegram can shrink visualViewport and clamp scrollTop while backgrounded.
   // Preserve the LAST painted morph state before remeasuring; do not reopen
   // a compact portrait just because the WebView height changed.
   // A deliberate return to scrollTop=0 must win over a pending resize RAF.
   // Otherwise a just-collapsed viewport could re-pin the photo after the
   // user (or native route restoration) has already reopened the profile.
   const explicitlyExpanded=scroll.scrollTop<=1;
   if(explicitlyExpanded)compactPinned.current=false;
   const previousProgress=explicitlyExpanded?0:compactPinned.current?1:lastPaintedProgress.current;
   layout.current=next;
   host.style.setProperty("--owner-hero-height",`${next.hero.height}px`);
   host.style.setProperty("--owner-hero-top",`${next.hero.y}px`);
   host.style.setProperty("--owner-hero-bottom",`${next.hero.y+next.hero.height}px`);
   host.style.setProperty("--owner-compact-top",`${next.compactContentTop}px`);
   host.style.setProperty("--owner-compact-name-top",`${next.compactAvatar.y+next.compactAvatar.height+8}px`);
   host.style.setProperty("--owner-morph-distance",`${next.morphDistance}px`);
   if(previousProgress>.001)scroll.scrollTop=Math.max(scroll.scrollTop,previousProgress*next.morphDistance);
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
  root.current?.setAttribute("data-morph-state","expanded");compactPinned.current=false;setHeroIndex(0);setRenderIndex(0);paint(0);
 },[active,mainPhoto?.id,paint]);
 useEffect(()=>{
  if(!heroPhoto||!heroImage.current)return;
  const image=heroImage.current;
  image.loading="eager";
  void image.decode?.().catch(()=>{/* onLoad/onError keeps the visible surface authoritative */});
 },[heroPhoto]);

 const selectTab=(next:OwnerTab,focus=false)=>{
  // Native scroll extent changes when a short tab replaces a long one.
  // Preserve the sticky compact avatar; choosing a tab is not an expand gesture.
  const keepCompact=compactPinned.current||lastState.current==="compact";
  setTab(next);
  requestAnimationFrame(()=>{
   if(keepCompact&&scroller.current){
    compactPinned.current=true;
    scroller.current.scrollTop=Math.max(scroller.current.scrollTop,layout.current.morphDistance);
    schedulePaint();
   }
   const button=tablist.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(tabPrefix+"-"+next+"-tab")}`);
   if(focus)button?.focus({preventScroll:true});
   // Do not scroll the entire native viewport when moving between tabs.
   if(button&&tablist.current){const r=button.getBoundingClientRect(),t=tablist.current.getBoundingClientRect();
    if(r.left<t.left||r.right>t.right)button.scrollIntoView({block:"nearest",inline:"nearest"});}
  });
 };
 const tabKey=(event:KeyboardEvent<HTMLButtonElement>,index:number)=>{
  const next=event.key==="ArrowRight"?Math.min(tabs.length-1,index+1):
   event.key==="ArrowLeft"?Math.max(0,index-1):event.key==="Home"?0:event.key==="End"?tabs.length-1:-1;
  if(next<0)return;event.preventDefault();selectTab(tabs[next][0],true);
 };
 // Photo swipes keep the existing image element alive. Adjacent photographs
 // are already mounted, so the finger drags real pixels rather than triggering
 // a hard src replacement or a second carousel/morph authority.
 const resetPhotoTrack=()=>{
  for(const el of [heroImage.current,prevImage.current,nextImage.current]){
   if(!el)continue;el.style.removeProperty("transition");el.style.removeProperty("transform");
  }
 };
 const stopPhotoTimer=()=>{
  if(photoSlideTimer.current!==null){window.clearTimeout(photoSlideTimer.current);photoSlideTimer.current=null;}
 };
 const movePhotoTrack=(delta:number,width:number,animated:boolean)=>{
  const transition=animated?"transform 250ms cubic-bezier(.20,.82,.24,1)":"none";
  for(const [el,x] of [[heroImage.current,delta],[prevImage.current,delta-width],
   [nextImage.current,delta+width]] as const){
   if(!el)continue;el.style.transition=transition;
   el.style.transform="translate3d("+x+"px,0,0)";
  }
 };
 useLayoutEffect(()=>{resetPhotoTrack();},[renderIndex]);
 // Preload the neighboring images without adding duplicate <img> nodes:
 // accessibility, the photo viewer, and GPU/image identity still see one hero.
 const preloadPrevious=previousPhoto?.src,preloadNext=nextPhoto?.src;
 useEffect(()=>{
  for(const src of [preloadPrevious,preloadNext]){
   if(!src)continue;
   const image=new Image();image.src=src;
   void image.decode?.().catch(()=>{/* the visible hero retains its own fallback */});
  }
 },[preloadPrevious,preloadNext]);
 useEffect(()=>()=>{if(photoSlideTimer.current!==null)window.clearTimeout(photoSlideTimer.current);},[]);
 const choosePhoto=(index:number)=>{
  stopPhotoTimer();resetPhotoTrack();
  setHeroIndex(index);setRenderIndex(index);
 };
 // The photo is a floating morph layer (outside the native scroller).
 // Forward vertical finger travel to the scroll authority; otherwise a drag
 // starting on the big picture cannot ever collapse the profile on Android.
 const heroDown=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(!event.isPrimary||(event.pointerType==="mouse"&&event.button!==0))return;
  // Interrupt an unfinished slide by settling at its already selected image.
  if(photoSlideTimer.current!==null){stopPhotoTimer();setRenderIndex(heroIndex);resetPhotoTrack();}
  photoSwipe.current={id:event.pointerId,x:event.clientX,y:event.clientY,
   startScroll:scroller.current?.scrollTop??0,width:mask.current?.clientWidth??393,axis:null};
 };
 const heroMove=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const first=photoSwipe.current;
  if(!first||first.id!==event.pointerId)return;
  const dx=event.clientX-first.x,dy=event.clientY-first.y;
  if(!first.axis){
   if(Math.max(Math.abs(dx),Math.abs(dy))<9)return;
   first.axis=Math.abs(dx)>Math.abs(dy)*1.2?"horizontal":
    Math.abs(dy)>Math.abs(dx)*1.2?"vertical":null;
   if(!first.axis)return;
  }
  if(event.cancelable)event.preventDefault();
  if(first.axis==="vertical"&&scroller.current){
   scroller.current.scrollTop=Math.max(0,first.startScroll-dy);
   schedulePaint();
  }else if(first.axis==="horizontal"){
   const available=dx<0?renderIndex<photos.length-1:renderIndex>0;
   movePhotoTrack(available?dx:dx*.2,first.width,false);
  }
 };
 const heroUp=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const first=photoSwipe.current;photoSwipe.current=null;
  if(!first||first.id!==event.pointerId)return;
  const dx=event.clientX-first.x,dy=event.clientY-first.y;
  if(first.axis==="vertical"){
   suppressPhotoClick.current=true;
   if(scroller.current)scroller.current.scrollTop=Math.max(0,first.startScroll-dy);
  }else if(first.axis==="horizontal"){
   suppressPhotoClick.current=true;
   const target=renderIndex+(dx<0?1:-1);
   const valid=target>=0&&target<photos.length&&Math.abs(dx)>38&&Math.abs(dx)>Math.abs(dy)*1.25;
   if(valid)setHeroIndex(target);
   movePhotoTrack(valid?(dx<0?-first.width:first.width):0,first.width,true);
   stopPhotoTimer();
   photoSlideTimer.current=window.setTimeout(()=>{
    photoSlideTimer.current=null;
    if(valid)setRenderIndex(target);
    else resetPhotoTrack();
   },250);
  }
  if(suppressPhotoClick.current)requestAnimationFrame(()=>{suppressPhotoClick.current=false;});
 };
 const pageDown=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(!event.isPrimary||((event.target as HTMLElement).closest("button,a,input,textarea,select")))return;
  pageSwipe.current={id:event.pointerId,x:event.clientX,y:event.clientY};
 };
 const pageUp=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const first=pageSwipe.current;pageSwipe.current=null;
  if(!first||first.id!==event.pointerId)return;
  const dx=event.clientX-first.x,dy=event.clientY-first.y;
  if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.2){
   const index=tabs.findIndex(item=>item[0]===tab);
   selectTab(tabs[Math.max(0,Math.min(tabs.length-1,index+(dx<0?1:-1)))][0]);
  }
 };
 const showPhotos=()=>{
  selectTab("photos");
  const target=layout.current.morphDistance+110;
  scroller.current?.scrollTo({top:target,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
 };

 return <section ref={root} className="owner-premium-profile" data-morph-state="expanded"
  data-mode={isOwner?"owner":"visitor"} aria-label={isOwner?"Мой профиль":"Профиль"}>
  <div className="owner-profile-backdrop" aria-hidden="true"/>
  <div ref={brandProbe} className="owner-profile-brand-probe" aria-hidden="true"/>
  <div ref={compactBackdrop} className="owner-profile-compact-backdrop" aria-hidden="true">
   {heroPhoto&&<img src={heroPhoto.src} alt="" draggable={false} decoding="async"/>}
   <div className="owner-profile-compact-tint"/>
  </div>
  <div ref={mask} className="owner-profile-photo-mask" onPointerDown={heroDown}
    onPointerMove={heroMove} onPointerUp={heroUp}
    onPointerCancel={()=>{photoSwipe.current=null;stopPhotoTimer();resetPhotoTrack();}}>
   {heroPhoto?<img ref={heroImage} data-photo-id={heroPhoto.id} src={heroPhoto.src}
    alt={"Фото профиля "+p.name} draggable={false} loading="eager" decoding="async" fetchPriority="high"
    style={{objectPosition:(resolvePhotoFocus(1,2,heroPhoto.focalPoint).x*100)+"% "+(resolvePhotoFocus(1,2,heroPhoto.focalPoint).y*100)+"%"}}
    onLoad={event=>{const point=resolvePhotoFocus(event.currentTarget.naturalWidth,event.currentTarget.naturalHeight,heroPhoto.focalPoint);
     event.currentTarget.style.objectPosition=(point.x*100)+"% "+(point.y*100)+"%";}}
    onClick={()=>{if(!suppressPhotoClick.current)onPhotoOpen(heroPhoto.id,heroImage.current);}}
    onError={event=>{if(heroPhoto.fallback&&event.currentTarget.src!==heroPhoto.fallback)event.currentTarget.src=heroPhoto.fallback;}}/>:
    <div className="owner-profile-photo-empty"><UserRound size={42}/><span>Фото пока нет</span></div>}
   {previousPhoto&&<div ref={prevImage} className="owner-profile-photo-adjacent previous" aria-hidden="true"
    style={{backgroundImage:"url("+JSON.stringify(previousPhoto.src)+")",
     backgroundPosition:(resolvePhotoFocus(1,2,previousPhoto.focalPoint).x*100)+"% "+(resolvePhotoFocus(1,2,previousPhoto.focalPoint).y*100)+"%"}}/>}
   {nextPhoto&&<div ref={nextImage} className="owner-profile-photo-adjacent next" aria-hidden="true"
    style={{backgroundImage:"url("+JSON.stringify(nextPhoto.src)+")",
     backgroundPosition:(resolvePhotoFocus(1,2,nextPhoto.focalPoint).x*100)+"% "+(resolvePhotoFocus(1,2,nextPhoto.focalPoint).y*100)+"%"}}/>}
   <div ref={shade} className="owner-profile-photo-shade" aria-hidden="true"/>
  </div>
  {photos.length>1&&<div ref={pager} className="owner-profile-photo-pager" aria-label="Фотографии">
   {photos.map((photo,index)=><button key={photo.id} type="button" className={index===heroIndex?"active":""}
    aria-label={"Показать фото "+(index+1)} aria-current={index===heroIndex?"true":undefined}
    onClick={()=>choosePhoto(index)}/>)}
  </div>}
  <div className="owner-profile-brand" aria-label="Luemi">
   <img src="/assets/brand/wordmark_original_raster_alpha_W06.webp" alt="luemi" decoding="async"/>
  </div>
  <header className="owner-profile-topbar">
   <button type="button" className="owner-profile-glass owner-profile-back" onClick={onBack} aria-label="Назад"><ArrowLeft/></button>
   {isOwner&&<button ref={topEdit} type="button" className="owner-profile-glass owner-profile-edit-top" onClick={onEdit} aria-label="Редактировать профиль">
    <PenLine size={18}/>
   </button>}
  </header>
  <div ref={expandedIdentity} className="owner-profile-expanded-identity">
   <h1>{p.name||"Имя не указано"}{p.age!==null?", "+p.age:""}</h1>
   <p><MapPin size={15} aria-hidden="true"/>{location}</p>
  </div>

  <div ref={compactIdentity} className="owner-profile-compact-identity" aria-hidden="true">
   <strong>{p.name||"Имя не указано"}{p.age!==null?", "+p.age:""}</strong>
   <span><MapPin size={13} aria-hidden="true"/>{location}</span>
  </div>
  <div ref={scroller} className="owner-profile-scroll">
   <div className="owner-profile-hero-spacer" aria-hidden="true"/>
   <main className="owner-profile-content">
    <div ref={tablist} className="owner-profile-tabs" role="tablist" aria-label="Разделы профиля">
     {tabs.map(([id,label],index)=><button type="button" role="tab" key={id}
      id={tabPrefix+"-"+id+"-tab"} aria-controls={tabPrefix+"-"+id+"-panel"}
      aria-selected={tab===id} tabIndex={tab===id?0:-1}
      onClick={()=>selectTab(id)} onKeyDown={event=>tabKey(event,index)}>{label}</button>)}
    </div>
    <div className="owner-profile-pages" onPointerDown={pageDown} onPointerUp={pageUp}
      onPointerCancel={()=>{pageSwipe.current=null;}}>
     <section id={tabPrefix+"-about-panel"} role="tabpanel" aria-labelledby={tabPrefix+"-about-tab"}
      aria-label="О себе" hidden={tab!=="about"} className="owner-profile-panel owner-profile-about">
      <article><h2>О себе</h2><p>{p.about||"Описание пока не заполнено."}</p></article>
      <article><h2>Основное</h2><div className="owner-profile-basics">
       {p.age!==null&&<div><CalendarDays size={18} aria-hidden="true"/><span>{p.age} лет</span></div>}
       <div><MapPin size={18} aria-hidden="true"/><span>{location}</span></div>
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
   </main>
  </div>
 </section>;
}
