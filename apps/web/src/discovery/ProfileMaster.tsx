import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {PenLine,Eye,FileText,Sparkles,Images,Gift,UserRound,Heart,CalendarDays,ShieldCheck,Languages as LanguagesIcon,Info} from "lucide-react";
import {Flag} from "../ui/Flag";
import {InterestChip} from "../ui/InterestCatalog";
import {languages} from "../ui/Languages";
import {goals} from "../registration/model";
import type {ProfileMasterData,ProfilePhoto,ProfileView} from "./ProfileModel";
import {projectProfile} from "./ProfileModel";
import {PhotoViewer} from "./PhotoViewer";
import {BlikViewer} from "./BlikViewer";
import "./profile-master.css";

type TabId="about"|"bliki"|"photos"|"gifts"|"meta";
type Props={
 data:ProfileMasterData;mode:ProfileView["mode"];onClose?:()=>void;onEdit?:()=>void;
 registerBack?:(handler:(()=>boolean)|null)=>void;
 active?:boolean;
};
const tabs=[["about","О себе",FileText],["bliki","Блики",Sparkles],["photos","Фото",Images],
 ["gifts","Подарки",Gift],["meta","О профиле",UserRound]] as const;
type Swipe={id:number;x:number;y:number;t:number;axis:""|"x"|"y";index:number;width:number};
function PhotoImage({photo,alt,loading="lazy"}:{photo:ProfilePhoto;alt:string;loading?:"lazy"|"eager"}){
 return <img src={photo.src} alt={alt} draggable={false} loading={loading} decoding="async"
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
     <p>{view.canEdit?"Расскажи о себе в редакторе анкеты.":"Здесь появится информация, когда владелец её добавит."}</p></div>}
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
export function ProfileMaster({data,mode,onClose,onEdit,registerBack,active=true}:Props){
 const [preview,setPreview]=useState(false);
 const [tab,setTab]=useState<TabId>("about");
 const [viewer,setViewer]=useState<{index:number;source:HTMLElement|null}|null>(null);
 const [blikOpen,setBlikOpen]=useState(false);
 const [collapsed,setCollapsed]=useState(false);
 const [mainId,setMainId]=useState<string|null>(null);
 const view=useMemo(()=>projectProfile(data,mode),[data,mode]);
 const photos=useMemo(()=>{
  if(!mainId)return view.photos;
  const selected=view.photos.find(p=>p.id===mainId);
  return selected?[selected,...view.photos.filter(p=>p.id!==mainId)]:view.photos;
 },[mainId,view.photos]);
 const [activePhoto,setActivePhoto]=useState(0);
 const current=photos[Math.min(activePhoto,Math.max(0,photos.length-1))];
 const shell=useRef<HTMLElement>(null),sheet=useRef<HTMLDivElement>(null);
 const hero=useRef<HTMLDivElement>(null),photoTrack=useRef<HTMLDivElement>(null);
 const tabBar=useRef<HTMLDivElement>(null),pages=useRef<HTMLDivElement>(null),pageTrack=useRef<HTMLDivElement>(null);
 const ink=useRef<HTMLSpanElement>(null),contentPages=useRef<HTMLDivElement[]>([]);
 const dragFrame=useRef<number|null>(null);
 const photoSwipe=useRef<Swipe|null>(null),tabSwipe=useRef<Swipe|null>(null);
 const clickBlocked=useRef(0),expandedY=useRef(385),collapsedRef=useRef(false);
 const viewerBack=useRef<(()=>boolean)|null>(null);
 const selectedIndex=tabs.findIndex(x=>x[0]===tab);
 const setTransform=(idx:number,delta=0)=>{
  if(photoTrack.current)photoTrack.current.style.transform=`translate3d(calc(-${idx*100}% + ${delta}px),0,0)`;
 };
 const settleSheet=useCallback((next:boolean)=>{
  collapsedRef.current=next;
  const pane=sheet.current;
  if(pane){
   pane.style.transition="";
   pane.style.setProperty("--pm-sheet-y",(next?0:expandedY.current)+"px");
  }
  setCollapsed(next);
 },[]);
 useLayoutEffect(()=>{
  const measure=()=>{
   const frame=hero.current,pane=sheet.current;
   if(!frame||!pane)return;
   expandedY.current=Math.max(180,frame.getBoundingClientRect().height-43);
   pane.style.setProperty("--pm-sheet-y",(collapsedRef.current?0:expandedY.current)+"px");
  };
  measure();
  const ro=new ResizeObserver(measure);
  if(hero.current)ro.observe(hero.current);
  if(shell.current)ro.observe(shell.current);
  window.addEventListener("resize",measure);
  return ()=>{ro.disconnect();window.removeEventListener("resize",measure);};
 },[]);
 useEffect(()=>{
  const pane=sheet.current;if(!pane)return;
  type SheetGesture={x:number;y:number;start:number;down:boolean;scrollTop:number;dragging:boolean;blocked:boolean};
  let gesture:SheetGesture|null=null;
  const start=(e:TouchEvent)=>{
   if(e.touches.length!==1)return;
   const t=e.touches[0];
   gesture={x:t.clientX,y:t.clientY,start:performance.now(),
    down:collapsedRef.current,scrollTop:contentPages.current[selectedIndex]?.scrollTop||0,
    dragging:false,blocked:false};
  };
  const move=(e:TouchEvent)=>{
   const g=gesture;if(!g||e.touches.length!==1)return;
   const t=e.touches[0],dx=t.clientX-g.x,dy=t.clientY-g.y;
   if(g.blocked)return;
   if(Math.abs(dx)>Math.abs(dy)*1.15&&Math.abs(dx)>8){g.blocked=true;return;}
   if(Math.abs(dy)<7)return;
   if(g.down?(g.scrollTop>1||dy<0):dy>0)return;
   if(e.cancelable)e.preventDefault();
   g.dragging=true;
   const distance=expandedY.current;
   const offset=g.down?Math.max(0,Math.min(distance,dy)):
     Math.max(0,Math.min(distance,distance+dy));
   pane.style.transition="none";
   pane.style.setProperty("--pm-sheet-y",offset+"px");
  };
  const end=(e:TouchEvent)=>{
   const g=gesture;gesture=null;if(!g||!g.dragging)return;
   const t=e.changedTouches[0];const dy=t.clientY-g.y,dt=Math.max(1,performance.now()-g.start);
   const threshold=Math.min(90,Math.max(65,expandedY.current*.2));
   const commit=g.down?(dy>threshold||dy/dt>.65):(dy< -threshold||dy/dt<-.65);
   settleSheet(g.down?!commit:commit);
  };
  const cancel=()=>{const g=gesture;gesture=null;if(g?.dragging)settleSheet(g.down);};
  pane.addEventListener("touchstart",start,{passive:true});
  pane.addEventListener("touchmove",move,{passive:false});
  pane.addEventListener("touchend",end,{passive:true});
  pane.addEventListener("touchcancel",cancel,{passive:true});
  return ()=>{
   pane.removeEventListener("touchstart",start);pane.removeEventListener("touchmove",move);
   pane.removeEventListener("touchend",end);pane.removeEventListener("touchcancel",cancel);
  };
 },[selectedIndex,settleSheet]);
 useEffect(()=>()=>{if(dragFrame.current!==null)cancelAnimationFrame(dragFrame.current);},[]);
 const closeTop=useCallback(():boolean=>{
  if(viewer){if(viewerBack.current)return viewerBack.current();setViewer(null);return true;}
  if(preview){setPreview(false);return true;}
  if(blikOpen){setBlikOpen(false);return true;}
  if(onClose){onClose();return true;}
  return false;
 },[viewer,preview,blikOpen,onClose]);
 useEffect(()=>{registerBack?.(closeTop);return ()=>registerBack?.(null);},[closeTop,registerBack]);
 const openPhoto=(index:number,element:HTMLElement|null)=>{
  if(performance.now()<clickBlocked.current||!photos[index])return;
  setViewer({index,source:element});
 };
 const photoStart=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if((e.target as HTMLElement).closest("button")||(e.pointerType==="mouse"&&e.button!==0))return;
  photoSwipe.current={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now(),axis:"",index:activePhoto,width:hero.current?.clientWidth||innerWidth};
 };
 const photoMove=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const g=photoSwipe.current;if(!g||g.id!==e.pointerId)return;
  const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(!g.axis){if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;g.axis=Math.abs(dx)>Math.abs(dy)*1.2?"x":"y";}
  if(g.axis!=="x")return;
  if(e.cancelable)e.preventDefault();
  try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* fallback */}
  if(photoTrack.current)photoTrack.current.style.transition="none";
  const edge=(g.index===0&&dx>0)||(g.index===photos.length-1&&dx<0);
  if(dragFrame.current!==null)cancelAnimationFrame(dragFrame.current);
  dragFrame.current=requestAnimationFrame(()=>{dragFrame.current=null;setTransform(g.index,edge?dx*.18:dx);});
 };
 const photoEnd=(e:ReactPointerEvent<HTMLDivElement>,cancel=false)=>{
  const g=photoSwipe.current;if(!g||g.id!==e.pointerId)return;
  photoSwipe.current=null;
  if(dragFrame.current!==null)cancelAnimationFrame(dragFrame.current);
  const dx=e.clientX-g.x,dt=Math.max(1,performance.now()-g.t);
  const target=!cancel&&g.axis==="x"&&(Math.abs(dx)>g.width*.2||Math.abs(dx)/dt>.55)?
   Math.max(0,Math.min(photos.length-1,g.index+(dx<0?1:-1))):g.index;
  if(photoTrack.current)photoTrack.current.style.transition="transform 290ms cubic-bezier(.2,.76,.22,1)";
  setTransform(target);setActivePhoto(target);
  if(g.axis==="x")clickBlocked.current=performance.now()+280;
 };
 const paintTabs=(i:number,dx=0)=>{
  const track=pageTrack.current;if(track)track.style.transform=`translate3d(calc(-${i*100}% + ${dx}px),0,0)`;
  const bar=tabBar.current,indicator=ink.current;if(!bar||!indicator)return;
  const btns=bar.querySelectorAll<HTMLButtonElement>(".pm-tab");
  const a=btns[i],b=btns[Math.max(0,Math.min(btns.length-1,i+(dx<0?1:-1)))];
  if(!a||!b)return;
  const fraction=Math.min(1,Math.abs(dx)/(pages.current?.clientWidth||innerWidth));
  const lx=a.offsetLeft+(b.offsetLeft-a.offsetLeft)*fraction;
  const width=a.offsetWidth+(b.offsetWidth-a.offsetWidth)*fraction;
  indicator.style.width=width+"px";indicator.style.transform=`translate3d(${lx}px,0,0)`;
 };
 const chooseTab=(newIndex:number)=>{
  const i=Math.min(4,Math.max(0,newIndex));
  if(dragFrame.current!==null)cancelAnimationFrame(dragFrame.current);
  if(pageTrack.current)pageTrack.current.style.transition="transform 310ms cubic-bezier(.22,.77,.23,1)";
  paintTabs(i);
  setTab(tabs[i][0]);
  const bar=tabBar.current,button=bar?.querySelectorAll<HTMLButtonElement>(".pm-tab")[i];
  if(button&&bar)bar.scrollTo({left:Math.max(0,button.offsetLeft+button.offsetWidth/2-bar.clientWidth/2),behavior:"smooth"});
 };
 useLayoutEffect(()=>{paintTabs(selectedIndex);},[selectedIndex]);
 const tabDown=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if((e.target as HTMLElement).closest("button,.pm-photos-grid,.pm-gift-grid")||(e.pointerType==="mouse"&&e.button!==0))return;
  tabSwipe.current={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now(),axis:"",index:selectedIndex,width:pages.current?.clientWidth||innerWidth};
 };
 const tabMove=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const g=tabSwipe.current;if(!g||g.id!==e.pointerId)return;
  const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(!g.axis){if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;g.axis=Math.abs(dx)>Math.abs(dy)*1.18?"x":"y";}
  if(g.axis!=="x")return;
  if(e.cancelable)e.preventDefault();
  if(pageTrack.current)pageTrack.current.style.transition="none";
  const edge=(g.index===0&&dx>0)||(g.index===4&&dx<0);
  if(dragFrame.current!==null)cancelAnimationFrame(dragFrame.current);
  dragFrame.current=requestAnimationFrame(()=>{dragFrame.current=null;paintTabs(g.index,edge?dx*.2:dx);});
 };
 const tabEnd=(e:ReactPointerEvent<HTMLDivElement>,cancel=false)=>{
  const g=tabSwipe.current;if(!g||g.id!==e.pointerId)return;
  tabSwipe.current=null;
  const dx=e.clientX-g.x,dt=Math.max(1,performance.now()-g.t);
  const next=!cancel&&g.axis==="x"&&(Math.abs(dx)>g.width*.17||Math.abs(dx)/dt>.52)?
   g.index+(dx<0?1:-1):g.index;
  if(g.axis==="x")clickBlocked.current=performance.now()+240;
  chooseTab(next);
 };
 const openMyPhotos=()=>{chooseTab(2);settleSheet(true);};
 const openAvatar=()=>{
  if(view.profile.activeBlik){setBlikOpen(true);return;}
  settleSheet(false);
 };
 const nameLine=<>{view.profile.name||"Имя не указано"}{view.profile.age!==null?", "+view.profile.age:""}</>;
 const location=<>{view.profile.city||view.profile.country?<>{view.profile.countryCode&&<Flag code={view.profile.countryCode} size={19}/>}<span>{[view.profile.city,view.profile.country].filter(Boolean).join(", ")}</span></>:"Город не указан"}</>;
 const goal=view.profile.goal&&view.profile.goal!=="undecided"?goals.find(x=>x.id===view.profile.goal):null;
 return <section ref={shell} data-sheet-state={collapsed?"collapsed":"expanded"} className={"pm-shell "+(mode==="owner"?"pm-inline":"pm-dialog")} role={mode==="owner"?undefined:"dialog"}
   aria-modal={mode==="owner"?undefined:true} aria-label={mode==="owner"?"Мой профиль":mode==="preview"?"Посмотреть глазами других":"Демо-профиль"}>
  {mode==="preview"&&<div className="pm-preview-toolbar"><button type="button" onClick={onClose}>Закрыть предпросмотр</button></div>}
   <div className="pm-hero" ref={hero} onPointerDown={photoStart} onPointerMove={photoMove}
    onPointerUp={e=>photoEnd(e)} onPointerCancel={e=>photoEnd(e,true)}>
    {photos.length?<div className="pm-photo-track" ref={photoTrack} style={{transform:`translate3d(-${activePhoto*100}%,0,0)`}}>
      {photos.map((p,i)=><div className="pm-photo-slide" key={p.id} onClick={event=>openPhoto(i,event.currentTarget.querySelector("img"))}>
       <PhotoImage photo={p} alt={"Фото "+(i+1)+" · "+view.profile.name} loading={i===0?"eager":"lazy"}/></div>)}
     </div>:<div className="pm-hero-no-photo"><Images size={40}/><span>{view.profile.source==="local-draft"?"В локальном черновике нет фото":"Публичных фотографий пока нет"}</span></div>}
    <div className="pm-hero-gradient" aria-hidden="true"/>
    {photos.length>1&&<div className="pm-photo-progress" aria-label="Фотографии">{photos.map((p,i)=>
     <button type="button" key={p.id} aria-label={"Фото "+(i+1)} aria-current={i===activePhoto?"true":undefined}
       className={i===activePhoto?"active":""} onClick={()=>{setTransform(i);setActivePhoto(i);}}/>)}</div>}
    {view.profile.source!=="server"&&<span className="pm-hero-demo">{view.profile.source==="fixture"?"Демо":"Черновик"}</span>}
   </div>
   <div className="pm-profile-sheet" ref={sheet}>
    <button type="button" className="pm-sheet-grab" onClick={()=>settleSheet(!collapsed)}
      aria-label={collapsed?"Раскрыть фото профиля":"Развернуть анкету"}><span/></button>
    <div className="pm-identity">
     <div className="pm-identity-core">
      <div className="pm-identity-text">
       <h2>{nameLine} {view.profile.premium&&<span className="pm-premium">◆</span>}{view.profile.verified&&<ShieldCheck size={19} aria-label="Подтверждён"/>}</h2>
       <p className="pm-identity-location">{location}</p>
      </div>
      {current&&<button type="button" className={"pm-mini-avatar"+(view.profile.activeBlik?" has-blik":"")}
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
     <button type="button" onClick={()=>setPreview(true)}><Eye size={17}/> Как видят</button>
    </div>}
   <div className="pm-tabs" ref={tabBar} role="tablist" aria-label="Разделы профиля">
    {tabs.map(([id,label,Icon],i)=><button type="button" key={id} className={"pm-tab"+(id===tab?" active":"")} role="tab"
      aria-selected={id===tab} onClick={()=>chooseTab(i)}><Icon size={16}/><span>{label}</span></button>)}
    <span className="pm-tab-ink" ref={ink} aria-hidden="true"/>
   </div>
   <div className="pm-pages" ref={pages} onPointerDown={tabDown} onPointerMove={tabMove}
     onPointerUp={e=>tabEnd(e)} onPointerCancel={e=>tabEnd(e,true)}>
    <div className="pm-pages-track" ref={pageTrack} style={{transform:`translate3d(-${selectedIndex*100}%,0,0)`}}>
     <div className="pm-page" ref={e=>{if(e)contentPages.current[0]=e;}}><About view={view}/></div>
     <div className="pm-page" ref={e=>{if(e)contentPages.current[1]=e;}}><Bliki/></div>
     <div className="pm-page" ref={e=>{if(e)contentPages.current[2]=e;}}>
      {photos.length?<div className="pm-photos-grid">{photos.map((p,i)=><button type="button" key={p.id} className="pm-photo-tile"
       onClick={e=>openPhoto(i,e.currentTarget.querySelector("img"))} aria-label={"Открыть фото "+(i+1)}>
       <PhotoImage photo={p} alt="" loading={i<9?"eager":"lazy"}/>{p.status!=="published"&&<span>{p.status==="draft"?"Черновик":"Проверка"}</span>}
       </button>)}</div>:<div className="pm-empty"><Images size={38}/><h3>Пока нет опубликованных фото</h3>
        <p>Фото на модерации и приватные снимки не видны другим.</p></div>}
     </div>
     <div className="pm-page" ref={e=>{if(e)contentPages.current[3]=e;}}><Gifts view={view}/></div>
     <div className="pm-page" ref={e=>{if(e)contentPages.current[4]=e;}}><Meta view={view}/></div>
    </div>
   </div>
  </div>
  {viewer&&<PhotoViewer view={view} photos={photos} initial={viewer.index} source={viewer.source}
    onClose={()=>setViewer(null)} registerBack={handler=>{viewerBack.current=handler;}} onMain={id=>{if(view.canReorderMain)setMainId(id);}}
    />}
  {blikOpen&&view.profile.activeBlik&&<BlikViewer blik={view.profile.activeBlik} name={view.profile.name} onClose={()=>setBlikOpen(false)}/>}
  {preview&&<ProfileMaster data={data} mode="preview" onClose={()=>setPreview(false)} registerBack={registerBack}/>}
 </section>;
}
