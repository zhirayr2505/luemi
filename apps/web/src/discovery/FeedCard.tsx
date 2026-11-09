import {useEffect,useLayoutEffect,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {Bookmark,ChevronDown,ChevronUp,Crown,Heart,Sparkles,Star,X,Undo2,MoreHorizontal,MapPin} from "lucide-react";
import {goals} from "../registration/model";
import {goalLabel} from "../ui/PersonalizedCopy";
import {PhotoCarousel} from "../ui/PhotoCarousel";
import {prepareFeedAmbient} from "./feed-ambient";
import type {PhotoCarouselHandle} from "../ui/PhotoCarousel";
import {InterestChip} from "../ui/InterestCatalog";
import {Flag} from "../ui/Flag";
import type {DemoKind,DemoPerson} from "./model";

const buttons=[
 ["pass","Пропустить",X],
 ["special","Особенная симпатия",Star],
 ["like","Нравится",Heart]
] as const;
type CardGesture={id:number;x:number;y:number;at:number;axis:"pending"|"photo"|"info"|"scroll";
 info:boolean;zone:"photo"|"browse";nativeScroll:boolean;startProgress:number;resumeTarget:0|1;
 scrollStart:number;samples:{y:number;t:number}[]};
type CardRun={from:number;target:0|1;start:number;duration:number;velocity:number;frame:number|null};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const position=(run:CardRun,now:number)=>{
 const t=clamp((now-run.start)/run.duration,0,1);
 const delta=run.target-run.from;
 return clamp(run.from+run.velocity*run.duration*(t-2*t*t+t*t*t)+
  delta*(3*t*t-2*t*t*t),0,1);
};

/** The keyed complete card remains mounted as it moves through the deck. */
export function FeedCard({person,saved,canUndo,active,busy,onAction,onOpenProfile,onInterests,onExitDemo,onCoverReady,real=false,onMore,demoDistanceKm}:{
 person:DemoPerson;saved:boolean;canUndo:boolean;active:boolean;busy:boolean;
 onAction:(kind:DemoKind|"undo")=>void;onOpenProfile:()=>void;onInterests:()=>void;
 /** The same approved card can render verified server users with no demo badges. */
 real?:boolean;onMore?:()=>void;onExitDemo?:()=>void;onCoverReady?:()=>void;demoDistanceKm?:number;
}){
 const goal=goals.find(g=>g.id===person.goal);
 const [expanded,setExpanded]=useState(false);
 const [activePhotoIndex,setActivePhotoIndex]=useState(0);
 // A separate, noninteractive photo glow changes only after carousel settlement.
 const ambientPhoto=person.photos[activePhotoIndex]?.src??person.photos[0]?.src;
 const nextAmbientPhoto=person.photos[activePhotoIndex+1]?.src;
 const card=useRef<HTMLElement>(null);
 const details=useRef<HTMLDivElement>(null);
 const glass=useRef<HTMLDivElement>(null);
 const ambientSlots=useRef<(HTMLImageElement|null)[]>([null,null]);
 const ambientLayer=useRef<HTMLDivElement>(null);
 const ambientVisible=useRef(1);
 const ambientRequest=useRef(0);
 const ambientDisplayedSource=useRef<string|null>(null);
 const ambientCurrentSource=useRef<string|null>(ambientPhoto??null);
 ambientCurrentSource.current=ambientPhoto??null;
 const ambientSwiping=useRef(false);
 const ambientRestoreTimer=useRef<number|null>(null);
 const hideAmbient=()=>{
  if(ambientRestoreTimer.current!==null){window.clearTimeout(ambientRestoreTimer.current);ambientRestoreTimer.current=null;}
  if(ambientLayer.current)ambientLayer.current.style.opacity="0";
 };
 const showAmbientIfReady=()=>{
  if(!ambientSwiping.current&&ambientRestoreTimer.current===null&&
   ambientDisplayedSource.current===ambientCurrentSource.current&&ambientLayer.current){
   ambientLayer.current.style.opacity="1";
  }
 };
 const restoreAmbientAfterCarousel=()=>{
  if(ambientRestoreTimer.current!==null)window.clearTimeout(ambientRestoreTimer.current);
  ambientRestoreTimer.current=window.setTimeout(()=>{
   ambientRestoreTimer.current=null;ambientSwiping.current=false;showAmbientIfReady();
  },340);
 };
 const onAmbientPhotoIndexChange=(index:number)=>{
  ambientCurrentSource.current=person.photos[index]?.src??person.photos[0]?.src??null;
  hideAmbient();ambientSwiping.current=true;
  setActivePhotoIndex(index);
  restoreAmbientAfterCarousel();
 };
 const dim=useRef<HTMLDivElement>(null);
 const scroll=useRef<HTMLDivElement>(null);
 const content=useRef<HTMLDivElement>(null);
 const about=useRef<HTMLDivElement>(null);
 const bioText=useRef<HTMLParagraphElement>(null);
 const interests=useRef<HTMLDivElement>(null);
 const extraInterests=useRef<HTMLDivElement>(null);
 const moreInterests=useRef<HTMLButtonElement>(null);
 const actionsView=useRef<HTMLDivElement>(null);
 const photo=useRef<PhotoCarouselHandle>(null);
 const gesture=useRef<CardGesture|null>(null);
 const blockClickUntil=useRef(0);
 const multiTouch=useRef(false);
 const progress=useRef(0),target=useRef<0|1>(0);
 const metrics=useRef({closed:225,open:430,reveal:0,lift:25,actions:83,canScroll:false,bioShort:0,bioFull:0});
 const run=useRef<CardRun|null>(null);
 const fingerFrame=useRef<number|null>(null);
 const fingerValue=useRef(0);
 const suspend=useRef<()=>void>(()=>{});
 const measureLive=useRef<()=>void>(()=>{});
 const measureDirty=useRef(false);
 const measuredCard=useRef({width:-1,height:-1});
 const setExpandedIfChanged=(next:boolean)=>setExpanded(previous=>previous===next?previous:next);
 const refreshIfDirty=()=>{if(measureDirty.current)requestAnimationFrame(()=>measureLive.current());};
 const markMoving=(moving:boolean)=>{if(glass.current)glass.current.dataset.moving=String(moving);};
 const paint=(value:number)=>{
  const p=progress.current=clamp(value,0,1),m=metrics.current;
  // The single sheet progress is also the CSS driver for button/chip opacity.
  // This hot path performs zero layout reads and never changes optical filters.
  card.current?.style.setProperty("--sheet-p",String(p));
  if(bioText.current)bioText.current.style.maxHeight=`${m.bioShort+(m.bioFull-m.bioShort)*p}px`;
  if(content.current)content.current.style.transform=
   `translate3d(0,${m.reveal*(1-p)-m.lift*p}px,0)`;
  if(dim.current)dim.current.style.opacity=String(p*.76);
  if(actionsView.current)actionsView.current.inert=p>.45;
  // One bounded surface contains text and optics; rounded corners cannot scale.
  if(glass.current)glass.current.style.height=`${m.closed+(m.open-m.closed)*p}px`;
 };
 const flushFinger=()=>{
  if(fingerFrame.current!==null){cancelAnimationFrame(fingerFrame.current);fingerFrame.current=null;}
  paint(fingerValue.current);
 };
 const scheduleFinger=(value:number)=>{
  fingerValue.current=value;
  if(fingerFrame.current!==null)return;
  fingerFrame.current=requestAnimationFrame(()=>{fingerFrame.current=null;paint(fingerValue.current);});
 };
 const freeze=()=>{
  const current=run.current;
  if(!current)return;
  if(current.frame!==null)cancelAnimationFrame(current.frame);
  run.current=null;paint(position(current,performance.now()));
 };
 const settle=(next:0|1,releaseVelocity=0)=>{
  freeze();target.current=next;markMoving(true);
  if(scroll.current)scroll.current.style.overflowY="hidden";
  if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){
   paint(next);setExpandedIfChanged(next===1);
   if(scroll.current)scroll.current.style.overflowY=next?"auto":"hidden";markMoving(false);refreshIfDirty();return;
  }
  if(Math.abs(progress.current-next)<.002){
   paint(next);setExpandedIfChanged(next===1);
   if(scroll.current)scroll.current.style.overflowY=next?"auto":"hidden";markMoving(false);refreshIfDirty();return;
  }
  const distance=Math.abs(next-progress.current);
  const duration=Math.max(160,Math.min(320,220+distance*90-Math.abs(releaseVelocity)*45));
  // Limit the release slope to the remaining travel so a fast flick cannot
  // overshoot the edge and then snap back on the terminal frame.
  const velocity=Math.sign(next-progress.current)*
   Math.min(Math.max(0,releaseVelocity*Math.sign(next-progress.current)),distance*2/duration);
  const motion:CardRun={from:progress.current,target:next,duration,
   velocity,start:performance.now(),frame:null};
  run.current=motion;
  const tick=(now:number)=>{
   if(run.current!==motion)return;
   const value=position(motion,now);paint(value);
   if(now-motion.start>=motion.duration){
    run.current=null;paint(next);setExpandedIfChanged(next===1);markMoving(false);refreshIfDirty();
    if(scroll.current)scroll.current.style.overflowY=next?"auto":"hidden";
   }else motion.frame=requestAnimationFrame(tick);
  };
  motion.frame=requestAnimationFrame(tick);
 };
 const measure=()=>{
  if(gesture.current||run.current){measureDirty.current=true;return;}
  const element=card.current;if(!element)return;
  measureDirty.current=false;
  const height=element.clientHeight;
  measuredCard.current={width:element.clientWidth,height};
  const size=height<320?"tiny":height<420?"compact":"regular";
  if(element.dataset.size!==size)element.dataset.size=size;
  const style=getComputedStyle(element);
  const actions=Number.parseFloat(style.getPropertyValue("--feed-actions-height"))||83;
  const root=element.closest<HTMLElement>(".discovery-app[data-feed-visible='true']");
  const nav=root?.querySelector<HTMLElement>(".discovery-bottom-nav");
  const clearance=nav?Math.max(0,element.getBoundingClientRect().bottom-nav.getBoundingClientRect().top+12):0;
  element.style.setProperty("--feed-nav-clearance",clearance+"px");
  const usableHeight=Math.max(280,height-clearance);
  // The sheet must grow only as much as the actual biography/interests need.
  // Previously 'open' was hard-coded to 75% of the photo, which produced an
  // enormous empty opaque panel over the person's face on Android Telegram.
  // Keep bio layout continuously interpolated with sheet progress: toggling
  // data-expanded only swaps the chevron, never reclamps text on the last frame.
  const bio=bioText.current;
  const bioFull=bio?.scrollHeight??0;
  const bioLineHeight=bio?Number.parseFloat(getComputedStyle(bio).lineHeight)||16:0;
  const bioShort=Math.min(bioFull,bioLineHeight*3+1);
  if(bio)bio.style.maxHeight="none";
  const full=content.current?.scrollHeight??0;
  if(bio)bio.style.maxHeight=bioShort+"px";
  const compact=content.current?.scrollHeight??0;
  const extras=extraInterests.current?.scrollHeight??0;
  // Compact copy ends on the first two interest chips. The remaining chips
  // stay in the DOM but are invisible until the sheet opens, avoiding reflow.
  const compactContent=Math.max(0,compact-(extras?extras+5:0));
  const maxClosed=Math.max(124,Math.min(usableHeight*.54,usableHeight-actions-18));
  const minClosed=Math.min(maxClosed,usableHeight<420?142:158);
  const desiredClosed=usableHeight<420?156:usableHeight<590?179:190;
  const closed=clamp(Math.max(desiredClosed,compactContent+18),minClosed,maxClosed);
  const openCap=Math.max(closed,usableHeight-actions-18);
  const open=Math.min(openCap,Math.max(full+32,closed+Math.min(145,usableHeight*.28)));
  element.style.setProperty("--feed-closed-height",closed+"px");
  // Both optics and contents share the only sheet box. paint() owns its height.
  // Match the content's upper edge to the inset glass surface while dragging.
  // This keeps the label/title visible rather than leaving a blank upper half.
  const reveal=extras?extras+5:0;
  const lift=Math.min(30,Math.max(9,(open-closed)*.22));
  metrics.current={closed,open,reveal,lift,actions,canScroll:full>open-2,bioShort,bioFull};
  paint(progress.current);
 };
 measureLive.current=measure;
 useLayoutEffect(()=>{
  const element=card.current;
  if(!element)return;
  const resize=new ResizeObserver(()=>{
   if(gesture.current||run.current){measureDirty.current=true;return;}
   const width=element.clientWidth,height=element.clientHeight;
   if(Math.abs(width-measuredCard.current.width)>1||Math.abs(height-measuredCard.current.height)>1)
    measureLive.current();
  });
  resize.observe(element);
  measureLive.current();
  // Fonts can finish after hydration without resizing the card itself.
  void document.fonts?.ready.then(()=>measureLive.current());
  const carousel=photo.current;
  return ()=>{resize.disconnect();carousel?.cancel();
   if(fingerFrame.current!==null){cancelAnimationFrame(fingerFrame.current);fingerFrame.current=null;}
   const current=run.current;if(current?.frame!=null)
    cancelAnimationFrame(current.frame);
   run.current=null;};
 },[person.id]);
 useEffect(()=>{
  const ticket=++ambientRequest.current;
  let cancelled=false;
  if(ambientPhoto){
   void (async()=>{
    const size=card.current?.getBoundingClientRect();
    const aspect=size&&size.height>0?size.width/size.height:.46;
    const preview=await prepareFeedAmbient(ambientPhoto,aspect);
    if(cancelled||ambientRequest.current!==ticket||!preview)return;
    const incomingIndex=1-ambientVisible.current;
    const incoming=ambientSlots.current[incomingIndex];
    const outgoing=ambientSlots.current[ambientVisible.current];
    if(!incoming)return;
    incoming.src=preview;
    try{await incoming.decode();}catch{return;}
    if(cancelled||ambientRequest.current!==ticket)return;
    // Double-buffer only fully decoded bitmaps; never show the old portrait
    // overlay when the sharp carousel is already moving to a new portrait.
    incoming.style.opacity="1";
    if(outgoing)outgoing.style.opacity="0";
    ambientVisible.current=incomingIndex;
    incoming.dataset.sourcePhoto=ambientPhoto;
    ambientDisplayedSource.current=ambientPhoto;
    showAmbientIfReady();
   })();
  }
  if(nextAmbientPhoto){
   const size=card.current?.getBoundingClientRect();
   void prepareFeedAmbient(nextAmbientPhoto,size&&size.height>0?size.width/size.height:.46);
  }
  return()=>{cancelled=true;};
 },[ambientPhoto,nextAmbientPhoto]);
 useEffect(()=>()=>{if(ambientRestoreTimer.current!==null)window.clearTimeout(ambientRestoreTimer.current);},[]);
 useEffect(()=>{
  const stop=()=>suspend.current();
  const hidden=()=>{if(document.hidden)stop();};
  window.addEventListener("blur",stop);
  document.addEventListener("visibilitychange",hidden);
  return ()=>{window.removeEventListener("blur",stop);document.removeEventListener("visibilitychange",hidden);};
 },[]);
 const updateExpanded=(next:boolean)=>{
  if(!active||busy)return;
  settle(next?1:0);
 };
 const down=(event:ReactPointerEvent<HTMLElement>)=>{
  if(!event.isPrimary){
   multiTouch.current=true;
   blockClickUntil.current=performance.now()+350;
   const old=gesture.current;gesture.current=null;
   if(old?.axis==="photo"){
    photo.current?.finish(old.id,old.x,true);
    restoreAmbientAfterCarousel();
   }
   if(old?.axis==="info"){flushFinger();settle(old.resumeTarget);}
   return;
  }
  multiTouch.current=false;
  if(!active||busy||(event.pointerType==="mouse"&&event.button!==0))return;
  const element=event.target as Element;
  const interactive=element.closest("button,a,input,textarea,select,[contenteditable]");
  if(interactive&&!interactive.matches(".discovery-name-button,.feed-v2-expand"))return;
  const info=!!element.closest(".feed-v2-details");
  // The entire non-interactive card belongs to its own photo recognizer.
  // The old 85% vertical cutoff delegated the lower portion to the tab pager.
  const zone=info?"browse":"photo";
  const now=performance.now();
  gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,at:now,
   axis:"pending",info,nativeScroll:!!element.closest(".feed-v2-scroll"),
   zone,
   startProgress:progress.current,resumeTarget:target.current,
   scrollStart:scroll.current?.scrollTop??0,samples:[{y:event.clientY,t:now}]};
 };
 const move=(event:ReactPointerEvent<HTMLElement>)=>{
  const g=gesture.current;
  if(!g||g.id!==event.pointerId||multiTouch.current)return;
  let dy=event.clientY-g.y;const dx=event.clientX-g.x;
  if(g.axis==="pending"){
   // Capture an in-range photo swipe before the parent tab pager's 6px claim.
   if(Math.max(Math.abs(dx),Math.abs(dy))<6)return;
   if(Math.abs(dx)>Math.abs(dy)*1.15){
    // A rightward gesture from the OS edge belongs to Telegram.
    if(dx>0&&g.x<26){gesture.current=null;return;}
    if(!(g.zone==="photo"||g.info)||!photo.current?.canAdvance(dx<0?1:-1)){
     gesture.current=null;return;
    }
    g.axis="photo";
    ambientSwiping.current=true;hideAmbient();
    photo.current?.begin(g.id,g.x,g.y,g.at);
   }else if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)*1.6&&(g.info||g.zone==="photo")){
    freeze();g.startProgress=progress.current;
    const canScroll=metrics.current.canScroll;
    g.axis=g.info&&g.startProgress>.99&&g.nativeScroll&&canScroll&&
     (dy<0||g.scrollStart>0)?"scroll":"info";
    if(g.axis==="info"){markMoving(true);g.y=event.clientY;dy=0;}
   }else return;
   blockClickUntil.current=performance.now()+350;
   try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* older WebView */}
  }
  if(g.axis==="photo")event.stopPropagation();
  if(event.cancelable)event.preventDefault();
  if(g.axis==="photo")photo.current?.move(g.id,event.clientX,event.clientY);
  else if(g.axis==="scroll"){
   if(scroll.current)scroll.current.scrollTop=Math.max(0,g.scrollStart-dy);
   if(dy>g.scrollStart){
    g.axis="info";markMoving(true);g.y+=g.scrollStart;g.startProgress=progress.current;
    dy=event.clientY-g.y;
   }else return;
  }
  if(g.axis==="info"){
   const travel=Math.max(1,metrics.current.open-metrics.current.closed);
   scheduleFinger(g.startProgress-dy/travel);
   const t=performance.now();g.samples.push({y:event.clientY,t});
   if(g.samples.length>10)g.samples.shift();
  }
 };
 const finish=(event:ReactPointerEvent<HTMLElement>,cancel=false)=>{
  const g=gesture.current;
  if(!g||g.id!==event.pointerId)return;
  gesture.current=null;
  if(g.axis==="photo"){
   photo.current?.finish(g.id,event.clientX,cancel);
   restoreAmbientAfterCarousel();
  }
  if(g.axis!=="info")refreshIfDirty();
  if(g.axis==="info"){
   flushFinger();
   if(cancel){settle(g.resumeTarget);return;}
   const t=performance.now(),samples=[...g.samples,{y:event.clientY,t}];
   let recent=samples[samples.length-1];
   for(let i=samples.length-2;i>=0;i--){
    if(t-samples[i].t>80)break;
    recent=samples[i];
   }
   const velocity=t-recent.t>0?(event.clientY-recent.y)/(t-recent.t):0;
   const travel=Math.max(1,metrics.current.open-metrics.current.closed);
   paint(g.startProgress-(event.clientY-g.y)/travel);
   const projected=progress.current-velocity*125/travel;
   settle((Math.abs(velocity)>.45?velocity<0:projected>=.5)?1:0,-velocity/travel);
  }
 };
 suspend.current=()=>{
  const g=gesture.current;gesture.current=null;multiTouch.current=false;
  if(g?.axis==="photo"){
   photo.current?.finish(g.id,g.x,true);
   restoreAmbientAfterCarousel();
  }
  if(g?.axis==="info")flushFinger();
  freeze();const resting=g?.axis==="info"?g.resumeTarget:target.current;
  target.current=resting;setExpandedIfChanged(resting===1);paint(resting);markMoving(false);refreshIfDirty();
  if(scroll.current)scroll.current.style.overflowY=resting?"auto":"hidden";
 };
 const available=active&&!busy;
 return <div className="discovery-deck-current feed-v2" aria-hidden={!active}>
   <article className="discovery-card feed-v2-card" ref={card} data-expanded={expanded}
     onPointerDownCapture={down} onPointerMoveCapture={move}
     onPointerUpCapture={event=>finish(event)} onPointerCancelCapture={event=>finish(event,true)}
     onLostPointerCapture={event=>{if(event.target===event.currentTarget)finish(event,true);}}
     onClickCapture={event=>{if(performance.now()<blockClickUntil.current){event.preventDefault();event.stopPropagation();}}}>
     <div className="discovery-photo feed-v2-photo">
       <PhotoCarousel ref={photo} photos={person.photos} name={person.name} age={person.age}
         externalGesture dots prioritize={active} onCoverReady={onCoverReady}
         onIndexChange={onAmbientPhotoIndexChange}/>
       {ambientPhoto&&<div className="feed-v2-photo-ambient" ref={ambientLayer} aria-hidden="true">
        <img ref={element=>{ambientSlots.current[0]=element;}} alt="" decoding="async" draggable={false}/>
        <img ref={element=>{ambientSlots.current[1]=element;}} alt="" decoding="async" draggable={false}/>
       </div>}
       <div className="feed-v2-photo-vignette" aria-hidden="true"/>
       {person.photos.length>1&&<span className="feed-v2-photo-count">
        {Math.min(activePhotoIndex+1,person.photos.length)} / {person.photos.length}
       </span>}
       {!real&&(onExitDemo?<button type="button" className="discovery-demo-label feed-v2-demo-exit"
         onClick={onExitDemo} title="Вернуться в настоящую ленту" aria-label="Вернуться в настоящую ленту">Демо</button>:
         <span className="discovery-demo-label">Демо</span>)}
       {canUndo&&<button type="button" className="feed-v2-undo" disabled={!available}
         aria-label="Отменить пропуск" title="Отменить пропуск"
         onClick={()=>onAction("undo")}><Undo2 size={18} strokeWidth={1.8}/></button>}
       {real?<button type="button" disabled={!available} className="discovery-save-control"
         aria-label="Действия с анкетой" onClick={onMore}>
         <MoreHorizontal size={21} strokeWidth={1.9}/>
       </button>:<button type="button" disabled={!available} className={"discovery-save-control"+(saved?" is-saved":"")}
         aria-label={saved?"Убрать из сохранённых":"Сохранить анкету"}
         aria-pressed={saved} title="Сохранить · демо" onClick={()=>onAction("save")}>
         <Bookmark size={19} fill={saved?"currentColor":"none"} strokeWidth={1.9}/>
       </button>}
     </div>
     <div className="feed-v2-dim" ref={dim} aria-hidden="true"/>
     <div className="feed-v2-information">
       <div className="feed-v2-glass feed-v2-sheet lg lg--card" ref={glass} data-moving="false">
        <div className="feed-v2-details" ref={details}>
         <div className="feed-v2-scroll" ref={scroll}>
          <div className="feed-v2-content" ref={content}>
           <button className="feed-v2-expand lg lg--pill lg--small" type="button" disabled={!available}
             aria-label={expanded?"Свернуть информацию":"Раскрыть информацию"} aria-expanded={expanded}
             onClick={()=>updateExpanded(target.current!==1)}>
             <ChevronDown size={15} className="feed-v2-collapse-icon"/>
             <ChevronUp size={15} className="feed-v2-expand-icon"/>
           </button>
           <div className="feed-v2-headrow">
            <div className="feed-v2-identity">
             <div className="discovery-name-row">
              <button className="discovery-name-button" type="button" onClick={onOpenProfile} disabled={!available}
               aria-label={"Посмотреть профиль "+person.name+", "+person.age}>
               <span>{person.name}, {person.age}</span>
              </button>
              {!real&&person.premium&&<span className="discovery-premium" title="Демо Premium" aria-label="Premium">
               <Crown size={19} strokeWidth={2} fill="#ffd878" color="#e8af35"/>
              </span>}
             </div>
             <div className="feed-v2-meta-row">
              <div className="discovery-place">{!real&&<Flag code={person.countryCode} size={14} title={person.country}/>}<MapPin size={14} strokeWidth={1.8}/>
               <span>{person.city}{person.country?", "+person.country:""}</span>
              </div>
              {goal&&<div className="feed-v2-goal"><Heart size={12}/>{goalLabel(goal.id,person.gender)}</div>}
               {!real&&typeof demoDistanceKm==="number"&&<span className="feed-v2-demo-distance">≈ {demoDistanceKm.toLocaleString("ru")} км · демо</span>}
             </div>
            </div>
           </div>
           {person.likedYouKind&&<div className={"feed-v2-liked-you "+(person.likedYouKind==="super"?"is-super":"")}>
            {person.likedYouKind==="super"?<Sparkles size={14}/>:<Heart size={14}/>} Уже выбрал(а) тебя · лайк создаст мэтч
           </div>}
           {person.about&&<div className="feed-v2-about" ref={about}>
             <p className="feed-v2-section-label">О СЕБЕ</p>
             <p className="discovery-short-about" ref={bioText}>{person.about}</p>
           </div>}
           {person.interests.length>0&&<div className="feed-v2-interests" ref={interests}>
             <p className="feed-v2-section-label">Интересы</p>
             <div className="discovery-interests feed-v2-primary-interests">
               {person.interests.slice(0,2).map((id,index)=><span className="feed-v2-interest-primary" key={`${id}-${index}`}><InterestChip id={id}/></span>)}
               {person.interests.length>2&&<button ref={moreInterests} type="button" className="discovery-more feed-v2-interest-count"
                 onClick={()=>{if(target.current===1)onInterests();else updateExpanded(true);}}
                 disabled={!available} aria-label={"Раскрыть ещё "+(person.interests.length-2)+" интереса"}>
                 +{person.interests.length-2}
               </button>}
             </div>
             {person.interests.length>2&&<div className="discovery-interests feed-v2-interests-rest" ref={extraInterests}>
               {person.interests.slice(2).map((id,index)=><span className="feed-v2-interest-extra" key={`${id}-${index+2}`}><InterestChip id={id}/></span>)}
             </div>}
           </div>}
          </div>
         </div>
        </div>
       </div>
       <div className="discovery-actions" ref={actionsView} aria-label={real?"Действия с анкетой":"Демо-действия с анкетой"}>
         {buttons.map(([kind,label,Icon])=><button type="button" key={kind}
           className={"discovery-action discovery-"+kind+" lg lg--pill"+(kind==="special"?" lg--accent":"")} aria-label={label} title={label}
           onClick={()=>onAction(kind)} disabled={!available}>
           <Icon size={kind==="like"?30:kind==="special"?24:22} strokeWidth={kind==="like"?1.9:1.8}/>
         </button>)}
       </div>
     </div>
   </article>
 </div>;
}
