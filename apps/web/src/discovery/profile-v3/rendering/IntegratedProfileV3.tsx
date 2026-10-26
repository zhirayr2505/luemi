import {useLayoutEffect,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent,ReactNode} from "react";
import {Images,Eye,PenLine,Heart,ShieldCheck} from "lucide-react";
import {Flag} from "../../../ui/Flag";
import {goals} from "../../../registration/model";
import type {ProfileView} from "../../ProfileModel";
type ProfileRouteMotionHandle={
 suspendForRoute:()=>void;rollbackRoute:()=>void;commitRouteClose:()=>void;
 suspendForBackground:()=>void;resumeFromBackground:()=>void;
};
import type {GestureArbiter} from "../../../ui/gesture-arbiter";
import {createProfileLayout,photoMask,photoOffset,clamp,type MorphLayout} from "../geometry/ProfileGeometry";
import {ProfileMotionEngine} from "../motion/ProfileMotionEngine";
import {ProfileGestureCoordinator,type Region,type Owner} from "../gestures/ProfileGestureCoordinator";

export type V3TabId="about"|"bliki"|"photos"|"meta"|"gifts";
const tabs=[["about","О себе"],["bliki","Блики"],["photos","Фото"],["meta","Аккаунт"],["gifts","Подарки"]] as const;
type SurfaceProps={
 view:ProfileView;photoId:string|null;onPhotoId:(id:string)=>void;
 onPhotoOpen:(id:string,element:HTMLImageElement|null)=>void;
 onState?:(expanded:boolean)=>void;onMotionProgress?:(progress:number,dragging:boolean)=>void;
 onEdit?:()=>void;onShowPreview?:()=>void;
 renderPage:(id:V3TabId)=>ReactNode;
 registerRouteMotion?:(handle:ProfileRouteMotionHandle|null)=>void;
 gestureArbiter?:GestureArbiter;
};
type Session={id:number;kind:"handle"|"photo"|"tabs";at:number;x:number;y:number;
 lastX:number;lastY:number;lastAt:number;velocity:number;claimed:boolean;
 startIndex:number;startOffset:number;buttons?:Array<{x:number;width:number}>};
export function IntegratedProfileV3({view,photoId,onPhotoId,onPhotoOpen,onState,onMotionProgress,
 onEdit,onShowPreview,renderPage,registerRouteMotion}:SurfaceProps){
 const p=view.profile,photos=view.photos;
 const root=useRef<HTMLDivElement>(null),mask=useRef<HTMLDivElement>(null);
 const rail=useRef<HTMLDivElement>(null),sheet=useRef<HTMLDivElement>(null),identityCompact=useRef<HTMLDivElement>(null);
 const identityExpanded=useRef<HTMLDivElement>(null),photoDots=useRef<HTMLDivElement>(null);
 const ambient=useRef<HTMLImageElement>(null),pagesTrack=useRef<HTMLDivElement>(null),tabsRoot=useRef<HTMLDivElement>(null);
 const ink=useRef<HTMLSpanElement>(null),refs=useRef(new Map<string,HTMLImageElement>());
 const current=useRef({photos,photoId,onPhotoId,onPhotoOpen,onState,onMotionProgress});
 current.current={photos,photoId,onPhotoId,onPhotoOpen,onState,onMotionProgress};
 const engine=useRef<ProfileMotionEngine|null>(null),layout=useRef<MorphLayout>(createProfileLayout({width:390,height:740}));
 const coordinator=useRef(new ProfileGestureCoordinator()),gesture=useRef<Session|null>(null);
 const suppressed=useRef(0),selectedTab=useRef(0),currentIndex=useRef(0);
 const pendingPhotoCommit=useRef<string|null>(null);
 const [tab,setTab]=useState<V3TabId>("about");
 const [expanded,setExpanded]=useState(false);
 const photoIndex=Math.max(0,photos.findIndex(item=>item.id===photoId));
 currentIndex.current=photoIndex;
 const activePhoto=photos[photoIndex]??null;
 const goal=p.goal&&p.goal!=="undecided"?goals.find(g=>g.id===p.goal):null;
 const title=<>{p.name||"Имя не указано"}{p.age!==null?", "+p.age:""}
  {p.verified&&<ShieldCheck size={18} aria-label="Подтверждено"/>}
  {p.premium&&<span className="pm-premium">◆</span>}</>;
 const location=<>{p.countryCode&&<Flag code={p.countryCode} size={17}/>}
  <span>{[p.city,p.country].filter(Boolean).join(", ")||"Город не указан"}</span></>;
 const goalView=goal?<span className="v3-int-goal"><Heart size={14}/>{goal.label}</span>:null;
 const paint=useRef<(progress:number)=>void>(()=>{});
 paint.current=progress=>{
  const l=layout.current,m=photoMask(l,progress);
  const surface=mask.current,move=sheet.current,track=rail.current;
  if(surface){surface.style.left=m.x+"px";surface.style.top=m.y+"px";
   surface.style.width=m.width+"px";surface.style.height=m.height+"px";
   surface.style.borderRadius=(1-progress)*50+"%";}
  // Only the active and immediately adjacent decoded images can enter
  // the clip. Avoid writing size/visibility for every photo at every frame.
  const idx=currentIndex.current;
  for(const [i,item] of current.current.photos.entries()){
   if(Math.abs(i-idx)>1)continue;
   const image=refs.current.get(item.id);if(!image)continue;
   if(!image.complete||image.naturalWidth<=0||image.naturalHeight<=0)continue;
   const frame=photoOffset(l,progress,image.naturalWidth,image.naturalHeight);
   const w=frame.width+"px",h=frame.height+"px";
   if(image.style.width!==w)image.style.width=w;
   if(image.style.height!==h)image.style.height=h;
   image.style.transform="translate3d("+frame.x+"px,"+frame.y+"px,0)";
  }
  if(track&&!gesture.current?.claimed)track.style.transform="translate3d("+(-currentIndex.current*l.width)+"px,0,0)";
  if(move){move.style.top=l.compactTop+"px";move.style.height=Math.max(0,l.height-l.compactTop)+"px";
   move.style.transform="translate3d(0,"+(l.span*progress)+"px,0)";}
  if(identityCompact.current){identityCompact.current.style.opacity=String(clamp((.63-progress)/.31,0,1));}
  if(identityExpanded.current){identityExpanded.current.style.opacity=String(clamp((progress-.36)/.31,0,1));}
  if(photoDots.current){photoDots.current.style.opacity=String(clamp((progress-.68)*3.4,0,1));
   photoDots.current.style.pointerEvents=progress>.98?"auto":"none";}
  if(ambient.current)ambient.current.style.opacity=String(clamp(1-progress*1.45,0,1));
  if(root.current)root.current.dataset.progress=progress.toFixed(4);
  current.current.onMotionProgress?.(1-progress,engine.current?.getSnapshot().phase==="DRAGGING");
 };
 const painter=useRef(paint.current);painter.current=paint.current;
 useLayoutEffect(()=>{
  const node=root.current;if(!node)return;
  const hostGestures=coordinator.current;
  let resizeRaf=0;
  const measure=()=>{
   const rect=node.getBoundingClientRect();
   if(rect.width<240||rect.height<260)return;
   const parent=node.closest(".discovery-visitor-route")??node.closest(".discovery-app");
   const header=parent?.querySelector(".lh-island img");
   const logoBottom=header?.getBoundingClientRect().bottom;
   const next=createProfileLayout({width:rect.width,height:rect.height,
    chromeBottom:logoBottom?logoBottom-rect.top:undefined});
   layout.current=next;
   node.style.setProperty("--v3-w",next.width+"px");
   node.style.setProperty("--v3-photo-height",next.expandedTop+"px");
   node.style.setProperty("--v3-identity-compact-x",next.compactIdentity.x+"px");
   node.style.setProperty("--v3-identity-compact-y",next.compactIdentity.y+"px");
   node.style.setProperty("--v3-identity-expanded-y",next.expandedIdentity.y+"px");
   node.style.setProperty("--v3-extra-scroll",next.span+24+"px");
   engine.current?.rebaseViewport(next);
   painter.current(engine.current?.getProgress()??0);
  };
  const schedule=()=>{if(resizeRaf)return;resizeRaf=requestAnimationFrame(()=>{resizeRaf=0;measure();});};
  measure();
  const controller=new ProfileMotionEngine(layout.current,progress=>painter.current(progress),to=>{
   setExpanded(to===1);current.current.onState?.(to===1);
  },()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  engine.current=controller;
  const ro=new ResizeObserver(schedule);ro.observe(node);
  window.addEventListener("resize",schedule);window.visualViewport?.addEventListener("resize",schedule);
  const web=window.Telegram?.WebApp;
  const stable=(event?:{isStateStable?:boolean})=>{if(event?.isStateStable!==false)schedule();};
  web?.onEvent?.("viewportChanged",stable);web?.onEvent?.("safeAreaChanged",schedule);
  const visibility=()=>{if(document.visibilityState==="hidden")controller.suspend();else controller.resume();};
  const suspend=()=>controller.suspend(),resume=()=>controller.resume();
  document.addEventListener("visibilitychange",visibility);window.addEventListener("pagehide",suspend);
  window.addEventListener("pageshow",resume);
  return ()=>{ro.disconnect();window.removeEventListener("resize",schedule);
   window.visualViewport?.removeEventListener("resize",schedule);
   web?.offEvent?.("viewportChanged",stable);web?.offEvent?.("safeAreaChanged",schedule);
   document.removeEventListener("visibilitychange",visibility);window.removeEventListener("pagehide",suspend);
   window.removeEventListener("pageshow",resume);
   if(resizeRaf)cancelAnimationFrame(resizeRaf);
   gesture.current=null;hostGestures.dispose();controller.dispose();engine.current=null;
  };
 },[]);
 const actions=useRef<ProfileRouteMotionHandle>({
  suspendForRoute:()=>engine.current?.suspend(),rollbackRoute:()=>engine.current?.resume(),
  commitRouteClose:()=>engine.current?.dispose(),suspendForBackground:()=>engine.current?.suspend(),
  resumeFromBackground:()=>engine.current?.resume()
 });
 useLayoutEffect(()=>{registerRouteMotion?.(actions.current);return ()=>registerRouteMotion?.(null);},[registerRouteMotion]);
 useLayoutEffect(()=>{
  // A gesture-driven photo change has already launched the track settle.
  // Do not cancel that visual transition on the parent's photoId React commit.
  if(photoId&&pendingPhotoCommit.current===photoId){
   pendingPhotoCommit.current=null;return;
  }
  pendingPhotoCommit.current=null;
  const idx=currentIndex.current;
  if(rail.current){rail.current.style.transition="none";
   rail.current.style.transform="translate3d("+(-idx*layout.current.width)+"px,0,0)";}
  painter.current(engine.current?.getProgress()??0);
 },[photoId,photos]);
 const setTabIndex=(index:number,animate=true)=>{
  const target=clamp(index,0,tabs.length-1);
  selectedTab.current=target;setTab(tabs[target][0]);
  const width=layout.current.width;
  if(pagesTrack.current){pagesTrack.current.style.transition=animate?"transform 220ms cubic-bezier(.2,.8,.2,1)":"none";
   pagesTrack.current.style.transform="translate3d("+(-target*width)+"px,0,0)";}
  const buttons=tabsRoot.current?.querySelectorAll<HTMLButtonElement>(".v3-int-tab");
  const button=buttons?.[target];
  if(ink.current&&button){ink.current.style.transition=animate?"transform 220ms ease,width 220ms ease":"none";
   ink.current.style.transform="translate3d("+button.offsetLeft+"px,0,0)";
   ink.current.style.width=button.offsetWidth+"px";}
 };
 useLayoutEffect(()=>{setTabIndex(selectedTab.current,false);},[]);
 const choosePhoto=(idx:number,animate=true)=>{
  const item=current.current.photos[idx];if(!item)return;
  // Decode/crop the new active and adjacent slides before the track slides.
  // Otherwise a previously offscreen 4th/5th/6th image has zero painted size
  // and briefly shows an empty/mismatched rectangle when touched on Android.
  const l=layout.current,p=engine.current?.getProgress()??0;
  for(const j of [idx-1,idx,idx+1]){
   const adjacent=current.current.photos[j];
   if(!adjacent)continue;
   const image=refs.current.get(adjacent.id);
   if(!image||!image.complete||!image.naturalWidth||!image.naturalHeight)continue;
   const offset=photoOffset(l,p,image.naturalWidth,image.naturalHeight);
   image.style.width=offset.width+"px";
   image.style.height=offset.height+"px";
   image.style.transform="translate3d("+offset.x+"px,"+offset.y+"px,0)";
  }
  if(rail.current){rail.current.style.transition=animate?"transform 210ms cubic-bezier(.2,.8,.2,1)":"none";
   rail.current.style.transform="translate3d("+(-idx*layout.current.width)+"px,0,0)";}
  currentIndex.current=idx;pendingPhotoCommit.current=item.id;current.current.onPhotoId(item.id);
 };
 const down=(e:ReactPointerEvent<HTMLDivElement>,kind:Session["kind"])=>{
  if(!e.isPrimary){coordinator.current.secondFinger();gesture.current=null;engine.current?.cancelDrag();return;}
  if(e.pointerType==="mouse"&&e.button!==0)return;
  if(kind==="photo"&&(engine.current?.getProgress()??0)<.95)return;
  if(kind!=="handle"&&(e.target as Element).closest("button"))return;
  const region:Region=kind==="handle"?"handle":kind==="photo"?"photo":"content";
  if(!coordinator.current.begin({id:e.pointerId,x:e.clientX,y:e.clientY,time:e.timeStamp},region))return;
  const offset=kind==="photo"?currentIndex.current:selectedTab.current;
  gesture.current={id:e.pointerId,kind,at:e.timeStamp,x:e.clientX,y:e.clientY,
   lastX:e.clientX,lastY:e.clientY,lastAt:e.timeStamp,velocity:0,claimed:false,startIndex:offset,
   startOffset:offset*layout.current.width,
   buttons:kind==="tabs"?Array.from(tabsRoot.current?.querySelectorAll<HTMLButtonElement>(".v3-int-tab")??[])
    .map(b=>({x:b.offsetLeft,width:b.offsetWidth})):undefined};
 };
 const move=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const g=gesture.current;if(!g||g.id!==e.pointerId)return;
  const decision=coordinator.current.move({id:e.pointerId,x:e.clientX,y:e.clientY,time:e.timeStamp});
  const needed:Owner=g.kind==="handle"?"SHEET":g.kind==="photo"?"PHOTO":"TABS";
  if(decision.owner!==needed)return;
  // For horizontal gestures in native-scroll pages, prevent browser panning
  // only after ownership was established. Vertical scroll is untouched.
  if(g.kind==="tabs"&&e.cancelable)e.preventDefault();
  if(!g.claimed){g.claimed=true;
   if(g.kind==="handle")engine.current?.beginDrag(g.y);
   else {const track=g.kind==="photo"?rail.current:pagesTrack.current;
    if(track)track.style.transition="none";}
   try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* Android implicit capture */}
  }
  const dt=e.timeStamp-g.lastAt;
  if(dt>0&&dt<125){const dy=g.kind==="handle"?e.clientY-g.lastY:e.clientX-g.lastX;
   g.velocity=dy/dt;}
  g.lastX=e.clientX;g.lastY=e.clientY;g.lastAt=e.timeStamp;
  if(g.kind==="handle"){engine.current?.updateDrag(e.clientY);return;}
  const width=Math.max(1,layout.current.width);
  const max=(g.kind==="photo"?current.current.photos.length:tabs.length)-1;
  const fractional=clamp(g.startIndex-(e.clientX-g.x)/width,0,max);
  const track=g.kind==="photo"?rail.current:pagesTrack.current;
  if(track)track.style.transform="translate3d("+(-fractional*width)+"px,0,0)";
  if(g.kind==="tabs"&&g.buttons&&ink.current){
   const a=g.buttons[Math.floor(fractional)],b=g.buttons[Math.min(max,Math.floor(fractional)+1)];
   if(a&&b){const t=fractional-Math.floor(fractional);
    ink.current.style.transition="none";
    ink.current.style.transform="translate3d("+(a.x+(b.x-a.x)*t)+"px,0,0)";
    ink.current.style.width=(a.width+(b.width-a.width)*t)+"px";}
  }
 };
 const up=(e:ReactPointerEvent<HTMLDivElement>,cancelled=false)=>{
  const g=gesture.current;if(!g||g.id!==e.pointerId)return;
  gesture.current=null;const decision=coordinator.current.end(e.pointerId);
  const dx=e.clientX-g.x,dy=e.clientY-g.y,elapsed=Math.max(1,e.timeStamp-g.at);
  if(g.claimed){
   if(g.kind==="handle"){if(cancelled)engine.current?.cancelDrag();else engine.current?.endDrag(g.velocity);}
   else {
    const changed=!cancelled&&(Math.abs(dx)>layout.current.width*.18||Math.abs(dx)/elapsed>.43);
    const max=(g.kind==="photo"?current.current.photos.length:tabs.length)-1;
    const target=clamp(g.startIndex+(changed?(dx<0?1:-1):0),0,max);
    if(g.kind==="photo")choosePhoto(target);else setTabIndex(target);
   }
   suppressed.current=performance.now()+260;
  }else if(!cancelled&&g.kind==="handle"&&!decision.claimed&&Math.hypot(dx,dy)<8)
   engine.current?.animateTo(engine.current.getProgress()>.5?0:1);
  try{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}catch{/* implicit */}
 };
 const openFace=()=>{
  if(performance.now()<suppressed.current)return;
  const id=current.current.photoId;
  if((engine.current?.getProgress()??0)<.95){engine.current?.animateTo(1);return;}
  if(!id)return;
  current.current.onPhotoOpen(id,refs.current.get(id)??null);
 };
 const imageLoaded=(event:React.SyntheticEvent<HTMLImageElement>)=>{
  if(event.currentTarget.naturalWidth>0){
   painter.current(engine.current?.getProgress()??0);
  }
 };
 return <div ref={root} className="v3-int-root" data-testid="v3-integrated" data-progress="0" data-sheet-state={expanded?"expanded":"collapsed"}>
  <div className="v3-int-opaque" aria-hidden="true"/>
  <div className="v3-int-hero pm-hero">
   <div className="v3-int-ambient" aria-hidden="true">
    {activePhoto&&<img ref={ambient} key={activePhoto.id} src={activePhoto.src} alt="" draggable={false}/>}
    <span/>
   </div>
   <div className="v3-int-mask" ref={mask} role="button" tabIndex={0}
    aria-label={expanded?"Открыть просмотр фото":"Развернуть фото"}
    onClick={openFace} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openFace();}}}
    onPointerDown={e=>down(e,"photo")} onPointerMove={move}
    onPointerUp={up} onPointerCancel={e=>up(e,true)}
    onLostPointerCapture={e=>{if(e.target===e.currentTarget)up(e,true);}}>
    <div className="v3-int-photo-rail pm-photo-track" ref={rail}>
     {photos.map((item,i)=><div className="v3-int-photo-slide" key={item.id} data-photo-id={item.id}
      style={{left:"calc(var(--v3-w) * "+i+")"}}>
      <img ref={el=>{if(el)refs.current.set(item.id,el);else refs.current.delete(item.id);}}
       data-photo-id={item.id} src={item.src} alt={"Фото "+(i+1)+" · "+p.name}
       loading={i===photoIndex?"eager":"lazy"} decoding="async" draggable={false}
       onLoad={e=>imageLoaded(e)} onError={e=>{
        if(item.fallback&&e.currentTarget.src!==item.fallback)e.currentTarget.src=item.fallback;
       }}/>
     </div>)}
    </div>
    {!activePhoto&&<div className="v3-int-no-photo"><Images size={30}/>Нет доступных фотографий</div>}
    <div className="v3-int-ring" aria-hidden="true"/>
   </div>
   <div className="v3-int-compact-identity" ref={identityCompact}>
    <h2>{title}</h2><p>{location}</p>{goalView}
   </div>
   <div className="v3-int-expanded-identity" ref={identityExpanded}>
    <h2>{title}</h2><div><p>{location}</p>{goalView}</div>
   </div>
   {photos.length>1&&<div className="v3-int-photo-dots" ref={photoDots} aria-label="Фотографии профиля">
    {photos.map((item,i)=><button key={item.id} type="button" aria-label={"Фото "+(i+1)+" из "+photos.length}
     className={i===photoIndex?"active":""} aria-current={i===photoIndex?"true":undefined}
     onClick={()=>choosePhoto(i)}/>)}
   </div>}
   {p.source!=="server"&&<span className="pm-hero-demo v3-int-source">
    {p.source==="fixture"?"Демо":"Черновик"}</span>}
  </div>
  <div className="v3-int-sheet" ref={sheet}>
   <div className="v3-int-handle" role="button" tabIndex={0}
    aria-label={expanded?"Свернуть фото":"Раскрыть фото"}
    onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();
     engine.current?.animateTo(engine.current.getProgress()>.5?0:1);}}}
    onPointerDown={e=>down(e,"handle")} onPointerMove={move}
    onPointerUp={up} onPointerCancel={e=>up(e,true)}
    onLostPointerCapture={e=>{if(e.target===e.currentTarget)up(e,true);}}>
    <span/>
   </div>
   {view.canEdit&&<div className="v3-int-owner-actions">
    <button type="button" onClick={()=>{engine.current?.animateTo(0);setTabIndex(2);}}>
     <Images size={17}/> Мои фото</button>
    <button type="button" className="v3-int-edit" onClick={onEdit}>
     <PenLine size={17}/> Изменить</button>
    <button type="button" onClick={onShowPreview}><Eye size={17}/> Как видят</button>
   </div>}
   <div className="v3-int-tabs pm-tabs" ref={tabsRoot} role="tablist" aria-label="Разделы профиля">
    {tabs.map(([id,label],i)=><button type="button" key={id}
     className={"v3-int-tab"+(tab===id?" active":"")} role="tab"
     aria-selected={tab===id} tabIndex={tab===id?0:-1}
     onClick={()=>setTabIndex(i)} onKeyDown={e=>{
      if(e.key==="ArrowRight"||e.key==="ArrowLeft"){e.preventDefault();
       const next=clamp(i+(e.key==="ArrowRight"?1:-1),0,4);setTabIndex(next);
       tabsRoot.current?.querySelectorAll<HTMLButtonElement>(".v3-int-tab")[next]?.focus({preventScroll:true});
      }}}>{label}</button>)}
    <span className="v3-int-ink" ref={ink} aria-hidden="true"/>
   </div>
   <div className="v3-int-pages pm-pages" onPointerDown={e=>down(e,"tabs")} onPointerMove={move}
    onPointerUp={up} onPointerCancel={e=>up(e,true)}
    onLostPointerCapture={e=>{if(e.target===e.currentTarget)up(e,true);}}>
    <div className="v3-int-pages-track" ref={pagesTrack}>
     {tabs.map(([id,label],i)=><section key={id} className="v3-int-page" role="tabpanel"
      style={{left:"calc(var(--v3-w) * "+i+")"}}
      aria-label={label} inert={tab!==id} aria-hidden={tab!==id}>
       {renderPage(id)}
      </section>)}
    </div>
   </div>
  </div>
 </div>;
}
