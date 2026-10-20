import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {Bookmark,X,Sparkles,Heart,Undo2,SlidersHorizontal,Images,MessagesSquare,UserRound,ArrowRight,Sun,Moon,Layers3,Crown} from "lucide-react";
import type {RegistrationDraft} from "../registration/model";
import {goals} from "../registration/model";
import {PhotoCarousel} from "../ui/PhotoCarousel";
import {Flag} from "../ui/Flag";
import {InterestChip} from "../ui/InterestCatalog";
import {demoPeople} from "./demo-people";
import {forYouDemoPeople} from "./for-you-data";
import type {CollectionId} from "./for-you-ranking";
import {ForYou} from "./ForYou";
import {demoAct,demoUndo,filterDemoPeople,freshDemoState,defaultFilters} from "./model";
import type {MainTab,DiscoveryTab,DemoKind,DiscoveryFilter,DemoPerson} from "./model";
import {DiscoveryFilters} from "./Filters";
import {DiscoveryInterestsSheet} from "./InterestsSheet";
import {DemoProfile} from "./DemoProfile";
import "./discovery.css";

const logoSrc="/assets/brand/wordmark_original_raster_alpha_W06.webp";
const navigation=[["discover","Знакомства",Images],["likes","Симпатии",Heart],["chats","Чаты",MessagesSquare],["profile","Профиль",UserRound]] as const;
const topTabs=[["feed","Лента"],["for-you","Для тебя"],["nearby","Рядом"]] as const;
const actions=[
 ["undo","Отменить",Undo2],["pass","Пропустить",X],
 ["special","Особенная симпатия",Sparkles],["like","Нравится",Heart]
] as const;
type Gesture={id:number;x:number;y:number;started:number;tracking:boolean;index:number};
function Placeholder({title,text}:{title:string;text:string}){
 return <div className="discovery-placeholder"><Layers3 size={35} strokeWidth={1.4}/>
 <h2>{title}</h2><p>{text}</p><span>Следующий этап LUEMI</span></div>;
}
interface Props {draft:RegistrationDraft;theme:"light"|"dark";onTheme:()=>void;onExit:()=>void;registerBack:(handler:()=>void)=>void}

export function DiscoveryApp({draft,theme,onTheme,onExit,registerBack}:Props){
 const [mainTab,setMainTab]=useState<MainTab>("discover");
 const [discoveryTab,setDiscoveryTab]=useState<DiscoveryTab>("feed");
 const [dragX,setDragX]=useState(0);
 const [swiping,setSwiping]=useState(false);
 const gesture=useRef<Gesture|null>(null);
 const clickBlockUntil=useRef(0);
 const pages=useRef<HTMLDivElement>(null);
 const [filters,setFilters]=useState<DiscoveryFilter>(defaultFilters);
 const [filterOpen,setFilterOpen]=useState(false);
 const [savedOpen,setSavedOpen]=useState(false);
 const [personOpen,setPersonOpen]=useState<string|null>(null);
 const [interestOpen,setInterestOpen]=useState<string|null>(null);
 const [forYouCollection,setForYouCollection]=useState<CollectionId|null>(null);
 const [forYouSettings,setForYouSettings]=useState(false);
 const [transitionKind,setTransitionKind]=useState<DemoKind|null>(null);
 const transitionRef=useRef<number|null>(null);
 const locked=useRef(false);
 const [feed,setFeed]=useState(freshDemoState);
 const [toast,setToast]=useState("");
 const timer=useRef<number|null>(null);
 const profiles=useMemo(()=>filterDemoPeople(demoPeople,filters,draft),[filters,draft]);
 const ids=useMemo(()=>profiles.map(p=>p.id),[profiles]);
 const person=profiles[feed.index];
 const selectedPerson=forYouDemoPeople.find(p=>p.id===personOpen);
 const tabIndex=topTabs.findIndex(x=>x[0]===discoveryTab);

 const indicate=useCallback((message:string)=>{
  if(timer.current!==null)window.clearTimeout(timer.current);
  setToast(message);
  timer.current=window.setTimeout(()=>setToast(""),2050);
 },[]);
 useEffect(()=>()=>{if(timer.current!==null)window.clearTimeout(timer.current);
  if(transitionRef.current!==null)window.clearTimeout(transitionRef.current);},[]);
 const leave=useCallback(()=>{
  if(personOpen){setPersonOpen(null);return;}
  if(interestOpen){setInterestOpen(null);return;}
  if(forYouSettings){setForYouSettings(false);return;}
  if(forYouCollection){setForYouCollection(null);return;}
  if(filterOpen){setFilterOpen(false);return;}
  if(savedOpen){setSavedOpen(false);return;}
  if(mainTab!=="discover"){setMainTab("discover");return;}
  if(discoveryTab!=="feed"){setDiscoveryTab("feed");return;}
  onExit();
 },[personOpen,interestOpen,forYouSettings,forYouCollection,filterOpen,savedOpen,mainTab,discoveryTab,onExit]);
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
    const saved=feed.saved.includes(person.id);
    setFeed(prev=>demoAct(prev,ids,kind));
    indicate(saved?"Убрано из сохранённых · демо":"Сохранено · демо");
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
    return;
  }
  locked.current=true;
  setTransitionKind(kind);
  const message=kind==="pass"?"Анкета пропущена · демо":
   kind==="like"?"Симпатия · никому не отправлена":"Особенная симпатия · только демо";
  window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
  transitionRef.current=window.setTimeout(()=>{
    setFeed(prev=>demoAct(prev,ids,kind));
    locked.current=false;setTransitionKind(null);transitionRef.current=null;
    indicate(message);
  },255);
 };
 const selectTab=(index:number)=>{
  setDiscoveryTab(topTabs[Math.max(0,Math.min(topTabs.length-1,index))][0]);
  window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
 };

 // A single horizontal gesture owner for the discovery pages AND the tabs.
 // PhotoCarousel owns its own pointer gesture. No Tinder-style card swipes.
 const down=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(event.pointerType==="mouse"&&event.button!==0)return;
  if((event.target as HTMLElement).closest(".discovery-photo,.carousel-frame,.discovery-action,[role=dialog],.discovery-filter-sheet"))return;
  gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,started:performance.now(),tracking:false,index:tabIndex};
 };
 const move=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const g=gesture.current;if(!g||g.id!==event.pointerId)return;
  const x=event.clientX-g.x,y=event.clientY-g.y;
  if(!g.tracking){
    if(Math.abs(y)>12&&Math.abs(y)>Math.abs(x)){gesture.current=null;return;}
    if(Math.abs(x)<6||Math.abs(x)<Math.abs(y)*1.2)return;
    g.tracking=true;
    try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* older Telegram WebView */}
    setSwiping(true);
  }
  event.preventDefault();
  const width=pages.current?.clientWidth||window.innerWidth;
  const limited=(g.index===0&&x>0)||(g.index===2&&x<0);
  setDragX(limited?x*.22:Math.max(-width,Math.min(width,x)));
 };
 const up=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const g=gesture.current;if(!g||g.id!==event.pointerId)return;
  gesture.current=null;
  if(g.tracking){
    const x=event.clientX-g.x;
    const elapsed=Math.max(1,performance.now()-g.started);
    const velocity=Math.abs(x)/elapsed;
    const target=Math.abs(x)>(pages.current?.clientWidth||320)*.18||velocity>.55
      ?g.index+(x<0?1:-1):g.index;
    clickBlockUntil.current=performance.now()+260;
    if(target!==g.index)selectTab(target);
    setSwiping(false);setDragX(0);
  }
 };
 const cancelSwipe=()=>{gesture.current=null;setSwiping(false);setDragX(0);};
 const apply=(next:DiscoveryFilter)=>{
  if(transitionRef.current!==null)window.clearTimeout(transitionRef.current);
  transitionRef.current=null;locked.current=false;setTransitionKind(null);
  setFilters(next);setFeed(prev=>({...freshDemoState(),saved:prev.saved}));setFilterOpen(false);
  indicate("Фильтры применены к демо-анкетам");
 };
 const openSaved=()=>{setSavedOpen(true);setFilterOpen(false);};
 const toggleForYouSave=(id:string)=>{
  if(!forYouDemoPeople.some(p=>p.id===id))return;
  const already=feed.saved.includes(id);
  setFeed(prev=>({...prev,saved:prev.saved.includes(id)?prev.saved.filter(value=>value!==id):[...prev.saved,id]}));
  indicate(already?"Убрано из сохранённых · демо":"Сохранено · демо");
  window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
 };

 function cardGoals(p:DemoPerson){
  if(p.goal==="undecided")return null;
  const title=goals.find(g=>g.id===p.goal)?.label??"Знакомства";
  return <span className="discovery-goal-badge"><Heart size={13}/>{title}</span>;
 }
 return <div className="discovery-app">
   <div className="discovery-ambient" aria-hidden="true"/>
   <header className="discovery-header">
     <img className="discovery-brand" src={logoSrc} alt="luemi"/>
     <div className="discovery-header-controls" aria-label="Инструменты Ленты">
       <button type="button" className="discovery-icon-action" onClick={()=>setFilterOpen(true)} aria-label="Фильтры" title="Фильтры"><SlidersHorizontal size={17}/></button>
       <button type="button" className="discovery-icon-action" onClick={onTheme} aria-label={theme==="light"?"Тёмная тема":"Светлая тема"} title="Сменить тему">
         {theme==="light"?<Moon size={17}/>:<Sun size={17}/>}</button>
       <button type="button" className="discovery-icon-action" onClick={openSaved} aria-label="Сохранённые анкеты" title="Сохранённые"><Bookmark size={17}/></button>
     </div>
   </header>
   <div className="discovery-main-panels">
     <section className="discovery-panel" hidden={mainTab!=="discover"}>
       <div className="discovery-top-tabs" role="tablist" aria-label="Разделы знакомств"
         onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancelSwipe}>
         {topTabs.map(([value,label],i)=><button type="button" role="tab" key={value}
           aria-selected={discoveryTab===value} onClick={()=>{if(performance.now()>=clickBlockUntil.current)selectTab(i);}}
           className={discoveryTab===value?"active":""}>{label}</button>)}
         <span className="discovery-tab-underline" aria-hidden="true" style={{
           transform:"translate3d(calc("+tabIndex*100+"% - "+dragX/3+"px),0,0)",
           transition:swiping?"none":undefined}}/>
       </div>
       <div className="discovery-pages" ref={pages} onPointerDown={down}
         onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
         <div className="discovery-page-track" style={{
           transform:"translate3d(calc(-"+tabIndex*100+"% + "+dragX+"px),0,0)",
           transition:swiping?"none":undefined}}>
           <section className="discovery-page" role="tabpanel" aria-label="Лента">
             {person?<div className={"discovery-card-stack"+(transitionKind?" deck-exiting":"")} key={person.id}>
               {profiles[feed.index+1]&&<div className="discovery-deck-next" aria-hidden="true">
                 <img src={profiles[feed.index+1].photos[0].src} alt=""/>
               </div>}
               <div className="discovery-deck-current">
                 <article className="discovery-card">
                   <div className="discovery-photo">
                     <PhotoCarousel photos={person.photos} name={person.name} age={person.age}/>
                     <span className="discovery-demo-label">Демо</span>
                     <button type="button"
                       className={"discovery-save-control"+(feed.saved.includes(person.id)?" is-saved":"")}
                       aria-label={feed.saved.includes(person.id)?"Убрать из сохранённых":"Сохранить анкету"}
                       aria-pressed={feed.saved.includes(person.id)}
                       title="Сохранить · демо" onClick={()=>act("save")}>
                       <Bookmark size={19} fill={feed.saved.includes(person.id)?"currentColor":"none"} strokeWidth={1.9}/>
                     </button>
                   </div>
                   <div className="discovery-card-overlay">
                     <div className="discovery-name-row">
                       <button type="button" className="discovery-name-button" onClick={()=>setPersonOpen(person.id)}
                         aria-label={"Посмотреть профиль "+person.name+", "+person.age}>
                         <span>{person.name}, {person.age}</span>
                       </button>
                       {person.premium&&<span className="discovery-premium" title="Демо Premium" aria-label="Premium">
                         <Crown size={19} strokeWidth={2} fill="#ffd878" color="#e8af35"/>
                       </span>}
                       {cardGoals(person)}
                     </div>
                     <div className="discovery-place"><Flag code={person.countryCode} size={19}/>{person.city}</div>
                     <div className="discovery-interests">
                       {person.interests.slice(0,3).map(id=><InterestChip key={id} id={id}/>)}
                       {person.interests.length>3&&<button type="button" className="discovery-more"
                         aria-label={"Показать все интересы "+person.name}
                         onClick={()=>setInterestOpen(person.id)}>+{person.interests.length-3}</button>}
                     </div>
                     <p className="discovery-short-about">{person.about}</p>
                   </div>
                 </article>
                 <div className="discovery-actions" aria-label="Демо-действия с анкетой">
                   {actions.map(([kind,label,Icon])=><button key={kind} type="button"
                     className={"discovery-action discovery-"+kind}
                     aria-label={label} title={label} onClick={()=>act(kind)}
                     disabled={kind==="undo"&&!feed.history.length||!!transitionKind}>
                     <Icon size={kind==="like"?28:kind==="special"?24:20} strokeWidth={1.85}/>
                   </button>)}
                 </div>
               </div>
               {profiles[feed.index+1]&&<div className="discovery-next-peek" aria-hidden="true">
                 <img src={profiles[feed.index+1].photos[0].src} alt=""/>
               </div>}
             </div>:<div className="discovery-empty">
               <Heart size={38}/><h2>{profiles.length?"Все демо-анкеты просмотрены":"Подходящих демо-анкет нет"}</h2>
               <p>Это тестовые персонажи, а не реальные пользователи.</p>
               {feed.history.length>0&&<button type="button" className="discovery-glass-button" onClick={()=>act("undo")}><Undo2 size={16}/> Отменить</button>}
               <button type="button" className="discovery-glass-button" onClick={()=>apply(defaultFilters)}>Начать заново</button>
             </div>}
           </section>
           <section className="discovery-page" role="tabpanel" aria-label="Для тебя">
             <ForYou draft={draft} filters={filters} saved={feed.saved} onSave={toggleForYouSave}
               onPerson={setPersonOpen} expanded={forYouCollection} onExpanded={setForYouCollection}
               settingsOpen={forYouSettings} onSettingsOpen={setForYouSettings}/>
           </section>
           <section className="discovery-page" role="tabpanel" aria-label="Рядом">
             <Placeholder title="Рядом" text="Здесь будет лента людей поблизости — без карты и радара."/>
           </section>
         </div>
       </div>
     </section>
     <section className="discovery-panel" hidden={mainTab!=="likes"}>
       <Placeholder title="Симпатии" text="Настоящие мэтчи и входящие появятся только после безопасного серверного запуска."/>
     </section>
     <section className="discovery-panel" hidden={mainTab!=="chats"}>
       <Placeholder title="Чаты" text="Реальные переписки будут доступны после взаимного мэтча."/>
     </section>
     <section className="discovery-panel" hidden={mainTab!=="profile"}>
       <div className="discovery-own-profile">
         <h2>Мой профиль <span className="discovery-demo-label">Черновик</span></h2>
         <p><strong>{draft.name||"Имя не указано"}</strong></p>
         <p>{draft.city?draft.city+", "+draft.country:"Город не выбран"}</p>
         <div className="discovery-own-buttons">
           <button type="button" className="discovery-glass-button" onClick={onExit}>Вернуться к регистрации <ArrowRight size={15}/></button>
           <button type="button" className="discovery-glass-button" onClick={openSaved}><Bookmark size={15}/> Сохранённые · демо ({feed.saved.length})</button>
         </div>
         <p className="hint">Твоя анкета ещё не опубликована.</p>
       </div>
     </section>
   </div>
   <nav className="discovery-bottom-nav" aria-label="Главная навигация LUEMI">
     {navigation.map(([value,label,Icon])=><button type="button" key={value}
       className={"discovery-nav-item"+(mainTab===value?" active":"")}
       aria-current={mainTab===value?"page":undefined} onClick={()=>setMainTab(value)}>
       <Icon size={22} strokeWidth={1.75}/><span>{label}</span></button>)}
   </nav>
   {toast&&<div role="status" className="discovery-toast">{toast}</div>}
   <DiscoveryFilters open={filterOpen} filter={filters} draft={draft} onClose={()=>setFilterOpen(false)} onApply={apply}/>
   {savedOpen&&<div className="discovery-modal-backdrop" onClick={()=>setSavedOpen(false)}>
     <section className="discovery-saved-sheet" role="dialog" aria-label="Сохранённые демо-анкеты" aria-modal="true"
       onClick={e=>e.stopPropagation()}>
       <header><h2>Сохранённые <span className="discovery-demo-label">Демо</span></h2>
         <button className="discovery-icon-action" type="button" onClick={()=>setSavedOpen(false)} aria-label="Закрыть"><X size={19}/></button>
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
   {selectedPerson&&<DemoProfile person={selectedPerson} onClose={()=>setPersonOpen(null)}/>}
 </div>;
}
