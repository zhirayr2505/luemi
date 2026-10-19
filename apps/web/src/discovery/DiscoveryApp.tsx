import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import type {TouchEvent as ReactTouchEvent} from "react";
import {Bookmark,X,Sparkles,Heart,Undo2,SlidersHorizontal,MessageCircle,Images,MessagesSquare,UserRound,MapPin,ChevronDown,ArrowRight,Sun,Moon,Layers3} from "lucide-react";
import type {RegistrationDraft} from "../registration/model";
import {goals} from "../registration/model";
import {PhotoCarousel} from "../ui/PhotoCarousel";
import {Flag} from "../ui/Flag";
import {InterestChip} from "../ui/InterestCatalog";
import {demoPeople} from "./demo-people";
import {commonInterests,demoAct,demoUndo,filterDemoPeople,freshDemoState,defaultFilters} from "./model";
import type {MainTab,DiscoveryTab,DemoKind,DiscoveryFilter,DemoPerson} from "./model";
import {DiscoveryFilters} from "./Filters";
import {DemoProfile} from "./DemoProfile";
import "./discovery.css";
const logoSrc="/assets/brand/wordmark_original_raster_alpha_W06.webp";
const navigation=[["discover","Знакомства",Images],["likes","Симпатии",Heart],["chats","Чаты",MessagesSquare],["profile","Профиль",UserRound]] as const;
const topTabs=[["feed","Лента"],["for-you","Для тебя"],["nearby","Рядом"]] as const;
const actions=[
 ["save","Сохранить",Bookmark],["pass","Пропустить",X],["special","Особенная симпатия",Sparkles],
 ["like","Нравится",Heart],["undo","Отменить последнее действие",Undo2]
] as const;
function Placeholder({title,text}:{title:string;text:string}){
 return <div className="discovery-placeholder"><Layers3 size={36} strokeWidth={1.2}/>
 <h2>{title}</h2><p>{text}</p><span>Следующий этап LUEMI</span></div>;
}
interface Props {draft:RegistrationDraft;theme:"light"|"dark";onTheme:()=>void;onExit:()=>void;registerBack:(handler:()=>void)=>void}
export function DiscoveryApp({draft,theme,onTheme,onExit,registerBack}:Props){
 const [mainTab,setMainTab]=useState<MainTab>("discover");
 const [discoveryTab,setDiscoveryTab]=useState<DiscoveryTab>("feed");
 const [filters,setFilters]=useState<DiscoveryFilter>(defaultFilters);
 const [filterOpen,setFilterOpen]=useState(false);
 const [personOpen,setPersonOpen]=useState<string|null>(null);
 const [feed,setFeed]=useState(freshDemoState);
 const [toast,setToast]=useState("");
 const toastTimer=useRef<number|null>(null);
 const scrollArea=useRef<HTMLDivElement>(null);
 const gesture=useRef<{x:number;y:number;t:number}|null>(null);
 const profiles=useMemo(()=>filterDemoPeople(demoPeople,filters,draft),[filters,draft]);
 const ids=useMemo(()=>profiles.map(p=>p.id),[profiles]);
 const person=profiles[feed.index];
 const selectedPerson=demoPeople.find(p=>p.id===personOpen);
 const indicate=useCallback((message:string)=>{
  if(toastTimer.current!==null)window.clearTimeout(toastTimer.current);
  setToast(message);
  toastTimer.current=window.setTimeout(()=>setToast(""),2100);
 },[]);
 useEffect(()=>()=>{if(toastTimer.current!==null)window.clearTimeout(toastTimer.current);},[]);
 const leave=useCallback(()=>{
  if(personOpen){setPersonOpen(null);return;}
  if(filterOpen){setFilterOpen(false);return;}
  if(mainTab!=="discover"){setMainTab("discover");return;}
  if(discoveryTab!=="feed"){setDiscoveryTab("feed");return;}
  onExit();
 },[personOpen,filterOpen,mainTab,discoveryTab,onExit]);
 useEffect(()=>{registerBack(leave);},[leave,registerBack]);
 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")leave();};
  window.addEventListener("keydown",onKey);
  return ()=>window.removeEventListener("keydown",onKey);
 },[leave]);
 const act=(kind:DemoKind|"undo")=>{
  if(kind==="undo"){
   if(!feed.history.length)return;
   setFeed(prev=>demoUndo(prev));indicate("Отменено · только демо");return;
  }
  if(!person)return;
  const saved=feed.saved.includes(person.id);
  setFeed(prev=>demoAct(prev,ids,kind));
  window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
  indicate(kind==="save"?(saved?"Удалено из сохранённых · демо":"Сохранено · демо"):
    kind==="pass"?"Анкета пропущена · демо":kind==="like"?"Симпатия · никому не отправлена":"Особенная симпатия · только демо");
 };
 const chooseDiscover=(tab:DiscoveryTab)=>{
  if(tab===discoveryTab)return;
  setDiscoveryTab(tab);
  window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
 };
 const chooseMain=(tab:MainTab)=>{setPersonOpen(null);setFilterOpen(false);setMainTab(tab);};
 const apply=(next:DiscoveryFilter)=>{setFilters(next);setFeed(freshDemoState());setFilterOpen(false);scrollArea.current?.scrollTo(0,0);indicate("Фильтры применены к демо-анкетам");};
 const onSwipeStart=(event:ReactTouchEvent<HTMLDivElement>)=>{
  // The photo carousel, scrollable interests and bottom sheet own their gestures.
  if((event.target as HTMLElement).closest(".discovery-photo,.carousel-frame,.discovery-filter-sheet,.discovery-bottom-nav"))return;
  const touch=event.touches[0];if(touch)gesture.current={x:touch.clientX,y:touch.clientY,t:Date.now()};
 };
 const onSwipeEnd=(event:ReactTouchEvent<HTMLDivElement>)=>{
  const start=gesture.current;gesture.current=null;if(!start||mainTab!=="discover")return;
  const touch=event.changedTouches[0];if(!touch)return;
  const dx=touch.clientX-start.x,dy=touch.clientY-start.y;
  if(Math.abs(dx)<74||Math.abs(dx)<Math.abs(dy)*1.7)return;
  const i=topTabs.findIndex(x=>x[0]===discoveryTab);
  const target=topTabs[Math.max(0,Math.min(topTabs.length-1,i+(dx<0?1:-1)))][0];
  chooseDiscover(target);
 };
 const badge=(person:DemoPerson)=> {
  const label=goals.find(g=>g.id===person.goal)?.label??"Знакомства";
  return <span className="discovery-goal-badge"><Heart size={13}/>{label}</span>;
 };
 return <div className="discovery-app" onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>
   <div className="discovery-ambient" aria-hidden="true"/>
   <header className="discovery-header">
     <button className="discovery-icon-action" aria-label="Открыть Чаты" onClick={()=>chooseMain("chats")} type="button"><MessageCircle size={21}/></button>
     <img className="discovery-brand" src={logoSrc} alt="luemi"/>
     <button className="discovery-icon-action" aria-label="Открыть фильтры" onClick={()=>setFilterOpen(true)} type="button"><SlidersHorizontal size={21}/></button>
   </header>
   <div className="discovery-main-panels">
     <section className="discovery-panel" hidden={mainTab!=="discover"}>
       <div className="discovery-top-tabs" role="tablist" aria-label="Разделы знакомств">
         {topTabs.map(([value,label])=><button key={value} type="button" role="tab" aria-selected={discoveryTab===value}
           className={discoveryTab===value?"active":""} onClick={()=>chooseDiscover(value)}>{label}</button>)}
         <span className="discovery-tab-underline" aria-hidden="true" style={{left:topTabs.findIndex(t=>t[0]===discoveryTab)*100/3+"%"}}/>
       </div>
       {discoveryTab==="feed"?<div className="discovery-feed-scroller" ref={scrollArea}>
         <div className="discovery-filter-row">
           <button type="button" className="discovery-city" onClick={()=>setFilterOpen(true)}><MapPin size={15}/>{draft.city||"Весь мир"} <ChevronDown size={14}/></button>
           <button type="button" className="discovery-filter-button" onClick={()=>setFilterOpen(true)}>Фильтры <SlidersHorizontal size={14}/></button>
         </div>
         <div className="discovery-demo-context">Тестовая Лента · только синтетические анкеты</div>
         {person?<div className="discovery-card-stack" key={person.id}>
           <article className="discovery-card">
             <div className="discovery-photo">
               <PhotoCarousel photos={person.photos} name={person.name} age={person.age}/>
               <span className="discovery-demo-label">Демо</span>
               <div className="discovery-card-info">
                 <button type="button" className="discovery-name-button" onClick={()=>setPersonOpen(person.id)}
                   aria-label={"Посмотреть профиль: "+person.name+", "+person.age}>
                   <strong>{person.name}, {person.age}</strong><ArrowRight size={18}/></button>
                 <div className="discovery-place"><Flag code={person.countryCode} size={18}/><span>{person.city}</span></div>
                 {badge(person)}
               </div>
             </div>
             <div className="discovery-card-facts">
               <div className="discovery-interests">
                 {(commonInterests(person,draft).length?commonInterests(person,draft):person.interests).slice(0,3).map(id=><InterestChip key={id} id={id}/>)}
                 {person.interests.length>3&&<button className="discovery-more" onClick={()=>setPersonOpen(person.id)} type="button">+{person.interests.length-3}</button>}
               </div>
               {commonInterests(person,draft).length>0&&<span className="discovery-common">У вас есть общие интересы</span>}
               <p className="discovery-short-about">{person.about}</p>
             </div>
           </article>
           <div className="discovery-actions" aria-label="Действия с демо-анкетой">
             {actions.map(([kind,label,Icon])=><button key={kind} type="button" aria-label={label}
               className={"discovery-action discovery-"+kind+(kind==="save"&&feed.saved.includes(person.id)?" selected":"")}
               onClick={()=>act(kind)} disabled={kind==="undo"&&!feed.history.length}
               title={label}><Icon size={kind==="special"?26:22} strokeWidth={1.8}/></button>)}
           </div>
           <p className="discovery-action-hint">Все действия демонстрационные — реальные пользователи их не получают</p>
           {profiles[feed.index+1]&&<div className="discovery-next-peek" aria-label="Следующая демо-анкета">
             <img src={profiles[feed.index+1].photos[0].src} alt=""/><span>Далее · {profiles[feed.index+1].name}</span>
           </div>}
         </div>:<div className="discovery-empty">
           <Heart size={38}/><h2>{profiles.length?"Ты посмотрел все демо-анкеты":"По этим фильтрам нет демо-анкет"}</h2>
           <p>Настоящие пользователи пока не подключены.</p>
           {feed.history.length>0&&<button type="button" className="discovery-glass-button" onClick={()=>act("undo")}><Undo2 size={16}/> Отменить действие</button>}
           <button type="button" className="discovery-glass-button" onClick={()=>apply(defaultFilters)}>Сбросить фильтры и начать сначала</button>
         </div>}
       </div>:<Placeholder title={discoveryTab==="for-you"?"Для тебя":"Рядом"} text={discoveryTab==="for-you"?"Персональные подборки появятся после приёмки Ленты.":"Здесь будет лента анкет поблизости — без карты и отслеживания людей."}/>}
     </section>
     <section className="discovery-panel" hidden={mainTab!=="likes"}><Placeholder title="Симпатии" text="Мэтчи и Входящие появятся после подключения безопасного сервера. Демо-симпатии никому не отправляются."/></section>
     <section className="discovery-panel" hidden={mainTab!=="chats"}><Placeholder title="Чаты" text="Сообщения будут доступны только после настоящего взаимного мэтча. Здесь нет вымышленных переписок."/></section>
     <section className="discovery-panel" hidden={mainTab!=="profile"}>
       <div className="discovery-own-profile">
         <h2>Мой профиль <span className="discovery-demo-label">Черновик</span></h2>
         <p><strong>{draft.name||"Имя ещё не указано"}</strong></p>
         <p>{draft.city?draft.city+", "+draft.country:"Город пока не выбран"}</p>
         <div className="discovery-own-buttons">
           <button type="button" className="discovery-glass-button" onClick={onExit}>Вернуться к регистрации <ArrowRight size={15}/></button>
           <button type="button" className="discovery-glass-button" onClick={onTheme}>{theme==="light"?<Moon size={16}/>:<Sun size={16}/>} {theme==="light"?"Тёмная":"Светлая"} тема</button>
         </div>
         <h3>Сохранённые · демо ({feed.saved.length})</h3>
         {feed.saved.length?feed.saved.map(id=>{
           const p=demoPeople.find(x=>x.id===id);return p?<button type="button" key={id} className="discovery-saved" onClick={()=>setPersonOpen(id)}><img src={p.photos[0].src} alt=""/><span>{p.name}, {p.age}</span><ArrowRight size={16}/></button>:null;
         }):<p className="hint">Пока никого не сохранил. Демо-сохранения остаются только здесь.</p>}
         <p className="hint">Твой настоящий профиль не опубликован и проходит только локальный предпросмотр.</p>
       </div>
     </section>
   </div>
   <nav className="discovery-bottom-nav" aria-label="Главная навигация LUEMI">
     {navigation.map(([value,label,Icon])=><button type="button" key={value} className={"discovery-nav-item"+(mainTab===value?" active":"")}
       aria-current={mainTab===value?"page":undefined} onClick={()=>chooseMain(value)}>
       <Icon size={23} strokeWidth={1.8}/><span>{label}</span></button>)}
   </nav>
   {toast&&<div className="discovery-toast" role="status">{toast}</div>}
   <DiscoveryFilters open={filterOpen} filter={filters} draft={draft} onClose={()=>setFilterOpen(false)} onApply={apply}/>
   {selectedPerson&&<DemoProfile person={selectedPerson} onClose={()=>setPersonOpen(null)}/>}
 </div>;
}
