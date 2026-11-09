import {useEffect,useLayoutEffect,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {Bookmark,ChevronDown,ChevronUp,Crown,Heart,Sparkles,Star,X,Undo2,MoreHorizontal,MapPin} from "lucide-react";
import {goals} from "../registration/model";
import {goalLabel} from "../ui/PersonalizedCopy";
import {PhotoCarousel} from "../ui/PhotoCarousel";
import type {PhotoCarouselHandle} from "../ui/PhotoCarousel";
import {InterestChip} from "../ui/InterestCatalog";
import {Flag} from "../ui/Flag";
import type {DemoKind,DemoPerson} from "./model";

const buttons=[
 ["pass","Пропустить",X],
 ["like","Нравится",Heart],
 ["special","Особенная симпатия",Star]
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
export function FeedCard({person,saved,canUndo,active,busy,onAction,onOpenProfile,onInterests,onExitDemo,real=false,onMore,demoDistanceKm}:{
 person:DemoPerson;saved:boolean;canUndo:boolean;active:boolean;busy:boolean;
 onAction:(kind:DemoKind|"undo")=>void;onOpenProfile:()=>void;onInterests:()=>void;
 /** The same approved card can render verified server users with no demo badges. */
 real?:boolean;onMore?:()=>void;onExitDemo?:()=>void;demoDistanceKm?:number;
}){
 const goal=goals.find(g=>g.id===person.goal);
 const [expanded,setExpanded]=useState(false);
 const [activePhotoIndex,setActivePhotoIndex]=useState(0);
 // A separate, noninteractive photo glow changes only after carousel settlement.
 const ambientPhoto=person.photos[activePhotoIndex]?.src??person.photos[0]?.src;
 const card=useRef<HTMLElement>(null);
 const details=useRef<HTMLDivElement>(null);
 const glass=useRef<HTMLDivElement>(null);
 const dim=useRef<HTMLDivElement>(null);
 const scroll=useRef<HTMLDivElement>(null);
 const content=useRef<HTMLDivElement>(null);
 const about=useRef<HTMLDivElement>(null);
 const interests=useRef<HTMLDivElement>(null);
 const extraInterests=useRef<HTMLDivElement>(null);
 const moreInterests=useRef<HTMLButtonElement>(null);
 const actionsView=useRef<HTMLDivElement>(null);
 const photo=useRef<PhotoCarouselHandle>(null);
 const gesture=useRef<CardGesture|null>(null);
 const blockClickUntil=useRef(0);
 const multiTouch=useRef(false);
 const progress=useRef(0),target=useRef<0|1>(0);
 const metrics=useRef({closed:225,open:430,reveal:0,lift:25,actions:83});
 const run=useRef<CardRun|null>(null);
 const fingerFrame=useRef<number|null>(null);
 const fingerValue=useRef(0);
 const suspend=useRef<()=>void>(()=>{});
 const measureLive=useRef<()=>void>(()=>{});
 const paint=(value:number)=>{
  const p=progress.current=clamp(value,0,1),m=metrics.current;
  // A single small text surface moves behind the fixed information viewport.
  // Its layout, clipping rectangle, photograph and action buttons stay fixed.
  if(content.current)content.current.style.transform=
   `translate3d(0,${m.reveal*(1-p)-m.lift*p}px,0)`;
  if(dim.current)dim.current.style.opacity=String(p*.76);
  // Keep the information above the buttons; only the photo itself sits
  // behind the free-floating controls. Fade controls continuously with finger.
  if(actionsView.current){
   actionsView.current.style.opacity=String(Math.pow(1-p,1.4));
   actionsView.current.style.transform=`translate3d(0,${8*p}px,0) scale(${1-.025*p})`;
   actionsView.current.style.pointerEvents=p>.45?"none":"auto";
  }
  if(extraInterests.current){
   extraInterests.current.style.opacity=String(clamp((p-.18)/.60,0,1));
   extraInterests.current.style.transform=`translate3d(0,${7*(1-p)}px,0)`;
   extraInterests.current.style.pointerEvents=p>.8?"auto":"none";
  }
  if(moreInterests.current){
   moreInterests.current.style.opacity=String(clamp(1-p*2.3,0,1));
   moreInterests.current.style.pointerEvents=p>.32?"none":"auto";
  }
  // Composite transforms only in the hot RAF path. No layout reads or blur.
  if(glass.current){
   glass.current.style.transform=`translate3d(0,${(m.open-m.closed)*(1-p)}px,0)`;
   glass.current.style.opacity=String(.12+p*.80);
  }
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
  freeze();target.current=next;
  if(scroll.current)scroll.current.style.overflowY="hidden";
  if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){
   paint(next);setExpanded(next===1);
   if(scroll.current)scroll.current.style.overflowY=next?"auto":"hidden";return;
  }
  if(Math.abs(progress.current-next)<.002){
   paint(next);setExpanded(next===1);
   if(scroll.current)scroll.current.style.overflowY=next?"auto":"hidden";return;
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
    run.current=null;paint(next);setExpanded(next===1);
    if(scroll.current)scroll.current.style.overflowY=next?"auto":"hidden";
   }else motion.frame=requestAnimationFrame(tick);
  };
  motion.frame=requestAnimationFrame(tick);
 };
 const measure=()=>{
  const element=card.current;if(!element)return;
  const height=element.clientHeight;
  const size=height<320?"tiny":height<420?"compact":"regular";
  if(element.dataset.size!==size)element.dataset.size=size;
  const style=getComputedStyle(element);
  const actions=Number.parseFloat(style.getPropertyValue("--feed-actions-height"))||83;
  // The sheet must grow only as much as the actual biography/interests need.
  // Previously 'open' was hard-coded to 75% of the photo, which produced an
  // enormous empty opaque panel over the person's face on Android Telegram.
  const full=content.current?.scrollHeight??0;
  const extras=extraInterests.current?.scrollHeight??0;
  // Compact copy ends on the first two interest chips. The remaining chips
  // stay in the DOM but are invisible until the sheet opens, avoiding reflow.
  const compactContent=Math.max(0,full-(extras?extras+5:0));
  const maxClosed=Math.max(124,Math.min(height*.52,height-actions-24));
  const minClosed=Math.min(maxClosed,height<420?148:183);
  const desiredClosed=height<420?180:height<560?206:228;
  const closed=clamp(Math.max(desiredClosed,compactContent+9),minClosed,maxClosed);
  const openCap=Math.max(closed,height-actions-19);
  const open=Math.min(openCap,Math.max(full+30,closed+Math.min(148,height*.29)));
  element.style.setProperty("--feed-closed-height",closed+"px");
  details.current?.style.setProperty("height",open+"px");
  // Resizing updates geometry once; all subsequent RAF paints stay composited.
  glass.current?.style.setProperty("height",(open+actions+14)+"px");
  // Match the content's upper edge to the inset glass surface while dragging.
  // This keeps the label/title visible rather than leaving a blank upper half.
  const reveal=extras?extras+5:0;
  const lift=Math.min(30,Math.max(9,(open-closed)*.22));
  metrics.current={closed,open,reveal,lift,actions};
  paint(progress.current);
 };
 measureLive.current=measure;
 useLayoutEffect(()=>{
  const element=card.current;
  if(!element)return;
  const resize=new ResizeObserver(()=>measureLive.current());
  resize.observe(element);
  if(content.current)resize.observe(content.current);
  measureLive.current();
  const carousel=photo.current;
  return ()=>{resize.disconnect();carousel?.cancel();
   if(fingerFrame.current!==null){cancelAnimationFrame(fingerFrame.current);fingerFrame.current=null;}
   const current=run.current;if(current?.frame!=null)
    cancelAnimationFrame(current.frame);
   run.current=null;};
 },[]);
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
   if(old?.axis==="photo")photo.current?.finish(old.id,old.x,true);
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
    g.axis="photo";photo.current?.begin(g.id,g.x,g.y,g.at);
   }else if(Math.abs(dy)>Math.abs(dx)*1.15&&(g.info||g.zone==="photo")){
    freeze();g.startProgress=progress.current;
    const canScroll=!!scroll.current&&scroll.current.scrollHeight>scroll.current.clientHeight+1;
    g.axis=g.info&&g.startProgress>.99&&g.nativeScroll&&canScroll&&
     (dy<0||g.scrollStart>0)?"scroll":"info";
    if(g.axis==="info"){g.y=event.clientY;dy=0;}
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
    g.axis="info";g.y+=g.scrollStart;g.startProgress=progress.current;
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
  if(g.axis==="photo")photo.current?.finish(g.id,event.clientX,cancel);
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
  if(g?.axis==="photo")photo.current?.finish(g.id,g.x,true);
  if(g?.axis==="info")flushFinger();
  freeze();const resting=g?.axis==="info"?g.resumeTarget:target.current;
  target.current=resting;setExpanded(resting===1);paint(resting);
  if(scroll.current)scroll.current.style.overflowY=resting?"auto":"hidden";
 };
 const available=active&&!busy;
 return <div className="discovery-deck-current feed-v2" aria-hidden={!active}>
   {ambientPhoto&&<div className="feed-v2-photo-ambient" aria-hidden="true">
    <img src={ambientPhoto} alt="" loading={active?"eager":"lazy"} decoding="async" draggable={false}
       onError={event=>{const fallback=person.photos[activePhotoIndex]?.fallback;
        if(fallback&&event.currentTarget.src!==fallback)event.currentTarget.src=fallback;}}/>
   </div>}
   <article className="discovery-card feed-v2-card" ref={card} data-expanded={expanded}
     onPointerDownCapture={down} onPointerMoveCapture={move}
     onPointerUpCapture={event=>finish(event)} onPointerCancelCapture={event=>finish(event,true)}
     onLostPointerCapture={event=>{if(event.target===event.currentTarget)finish(event,true);}}
     onClickCapture={event=>{if(performance.now()<blockClickUntil.current){event.preventDefault();event.stopPropagation();}}}>
     <div className="discovery-photo feed-v2-photo">
       <PhotoCarousel ref={photo} photos={person.photos} name={person.name} age={person.age}
         externalGesture dots onIndexChange={setActivePhotoIndex}/>
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
       <div className="feed-v2-glass" ref={glass} aria-hidden="true"/>
       <div className="feed-v2-details" ref={details}>
         <div className="feed-v2-scroll" ref={scroll}>
          <div className="feed-v2-content" ref={content}>
           <button className="feed-v2-expand" type="button" disabled={!available}
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
             <p className="discovery-short-about">{person.about}</p>
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
       <div className="discovery-actions" ref={actionsView} aria-label={real?"Действия с анкетой":"Демо-действия с анкетой"}>
         {buttons.map(([kind,label,Icon])=><button type="button" key={kind}
           className={"discovery-action discovery-"+kind} aria-label={label} title={label}
           onClick={()=>onAction(kind)} disabled={!available}>
           <Icon size={kind==="like"?30:kind==="special"?24:22} strokeWidth={kind==="like"?1.9:1.8}/>
         </button>)}
       </div>
     </div>
   </article>
 </div>;
}
