import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type PointerEvent} from "react";
import {createPortal} from "react-dom";
import {ChevronLeft,ChevronRight,Heart,MapPin,MessageCircle,MoreHorizontal,Star,UserRound,X} from "lucide-react";
import {getPublishedProfile} from "../registration/real-live-client";
import {selectionHaptic} from "../ui/haptic";
import {profileReactionAsset} from "./owner-profile/ProfileReactions";
import {fanSelection,fanTargets,likesDrag,LIKES_HOLD_MS,type LikesAction,type Point} from "./likes-gallery-gesture";

type Fan={origin:Point;targets:ReturnType<typeof fanTargets>;manual:boolean};
type Press={id:number;origin:Point;width:number;mode:"hold"|"photos"|"fan";timer:number;x:number;offset:number};
type Props={
 name:string;age?:number;city?:string;photoOwner?:string;photos:string[];indicator:Parameters<typeof profileReactionAsset>[0];
 pending:boolean;react?:(kind:LikesAction)=>void;onOpen:()=>void;onChat?:()=>void;error?:string;
};
const labels={skip:"Пропустить",super:"Суперлайк",ordinary:"Лайк"};
const icons={skip:X,super:Star,ordinary:Heart};

export function LikesGalleryCard({name,age,city,photoOwner,photos,indicator,pending,react,onOpen,onChat,error}:Props){
 const [index,setIndex]=useState(0);
 const [dots,setDots]=useState(false);
 const [summary,setSummary]=useState<{age:number;city:string}|null>(null);
 const [fan,setFan]=useState<Fan|null>(null);
 const media=useRef<HTMLButtonElement>(null),track=useRef<HTMLSpanElement>(null),popup=useRef<HTMLDivElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 const press=useRef<Press|null>(null),menu=useRef<Fan|null>(null),chosen=useRef<LikesAction|null>(null);
 const timeout=useRef(0),blockClick=useRef(0),selected=useRef(0);
 const latest=useRef({react,photos});
 latest.current={react,photos};
 const paint=(at:number,x=0,animate=false)=>{
  if(!track.current)return;
  track.current.style.transition=animate?"":"none";
  track.current.style.transform=`translate3d(calc(${-at*100}% + ${x}px),0,0)`;
 };
 const clearDots=()=>{clearTimeout(timeout.current);timeout.current=0;};
 const showDots=(linger=false)=>{
  clearDots();setDots(true);
  if(linger)timeout.current=window.setTimeout(()=>setDots(false),800);
 };
 const go=(direction:number)=>{
  const next=Math.max(0,Math.min(latest.current.photos.length-1,selected.current+direction));
  selected.current=next;paint(next,0,true);setIndex(next);
  if(latest.current.photos.length>1)showDots(true);
 };
 const closeMenu=()=>{
  const manual=menu.current?.manual;
  menu.current=null;chosen.current=null;setFan(null);
  if(manual)trigger.current?.focus({preventScroll:true});
 };
 const openMenu=(origin:Point,manual:boolean)=>{
  const next={origin,manual,targets:fanTargets(origin,window.innerWidth,window.innerHeight)};
  menu.current=next;chosen.current=null;setFan(next);
 };
 const choose=(kind:LikesAction)=>{
  if(!menu.current)return;
  blockClick.current=performance.now()+360;
  closeMenu();
  latest.current.react?.(kind);
 };

 useLayoutEffect(()=>{
  const node=media.current;if(!node)return;
  // pan-y leaves the gallery's native vertical scroll available before a hold.
  // Once the menu owns the finger, keep the next touchmove from scrolling it.
  const keepFinger=(event:TouchEvent)=>{
   if(press.current?.mode==="fan"&&event.cancelable)event.preventDefault();
  };
  const cancel=()=>{
   if(press.current?.mode==="photos")paint(selected.current,0,true);
   clearTimeout(press.current?.timer);
   clearDots();
   press.current=null;
   if(menu.current)closeMenu();
   setDots(false);
  };
  const onVisibility=()=>{if(document.hidden)cancel();};
  const escape=(event:KeyboardEvent)=>{
   if(event.key==="Escape"&&menu.current){event.preventDefault();event.stopImmediatePropagation();cancel();}
  };
  node.addEventListener("touchmove",keepFinger,{passive:false});
  window.addEventListener("keydown",escape,true);
  window.addEventListener("blur",cancel);
  document.addEventListener("visibilitychange",onVisibility);
  return ()=>{
   node.removeEventListener("touchmove",keepFinger);
   window.removeEventListener("keydown",escape,true);
   window.removeEventListener("blur",cancel);
   document.removeEventListener("visibilitychange",onVisibility);
   clearTimeout(press.current?.timer);clearDots();
  };
 },[]);
 useLayoutEffect(()=>{
  if(selected.current>=photos.length&&selected.current!==0){selected.current=0;paint(0);setIndex(0);}
 },[photos.length]);
 useEffect(()=>{
  const node=media.current;
  if(!photoOwner||!node)return;
  const request=new AbortController();
  const observer=new IntersectionObserver(entries=>{
   if(!entries.some(entry=>entry.isIntersecting))return;
   observer.disconnect();
   void getPublishedProfile(photoOwner,request.signal).then(profile=>{
    if(!request.signal.aborted)setSummary({age:profile.age,city:profile.city});
   }).catch(()=>{/* The album and name remain available independently. */});
  });
  observer.observe(node);
  return ()=>{observer.disconnect();request.abort();};
 },[photoOwner]);
 useEffect(()=>{if(fan?.manual)popup.current?.querySelector("button")?.focus({preventScroll:true});},[fan]);

 const down=(event:PointerEvent<HTMLButtonElement>)=>{
  if(!event.isPrimary){
   const current=press.current;
   if(current){
    press.current=null;clearTimeout(current.timer);blockClick.current=performance.now()+360;
    if(current.mode==="photos")go(0);
    if(current.mode==="fan")closeMenu();
   }
   return;
  }
  if(event.button!==0||menu.current)return;
  const node=event.currentTarget;
  const origin={x:event.clientX,y:event.clientY};
  const width=node.clientWidth||1;
  const matrix=track.current?getComputedStyle(track.current).transform:"none";
  const offset=matrix==="none"?0:new DOMMatrixReadOnly(matrix).m41+selected.current*width;
  const next:Press={id:event.pointerId,origin,mode:"hold",timer:0,width,x:0,offset};
  press.current=next;
  if(react)next.timer=window.setTimeout(()=>{
   if(press.current!==next||next.mode!=="hold"||!latest.current.react)return;
   next.mode="fan";selectionHaptic();
   try{node.setPointerCapture(next.id);}catch{/* Initial touch may have been cancelled. */}
   openMenu(origin,false);
  },LIKES_HOLD_MS);
 };
 const move=(event:PointerEvent<HTMLButtonElement>)=>{
  const current=press.current;if(!current||current.id!==event.pointerId)return;
  const point={x:event.clientX,y:event.clientY};
  const dx=point.x-current.origin.x,dy=point.y-current.origin.y;
  if(current.mode==="fan"){
   const active=menu.current;
   if(!active)return;
   const target=fanSelection(point,active.origin,active.targets);
   if(target!==chosen.current){
    chosen.current=target;
    if(popup.current)popup.current.dataset.selected=target??"";
    if(target)selectionHaptic();
   }
   return;
  }
  if(current.mode==="hold"){
   const motion=likesDrag(dx,dy);
   if(motion==="hold")return;
   clearTimeout(current.timer);
   if(motion==="scroll"||photos.length<2){
    press.current=null;blockClick.current=performance.now()+360;return;
   }
   current.mode="photos";
   try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* Native scroll can cancel capture. */}
   showDots();
  }
  const at=selected.current;
  const x=dx+current.offset;
  current.x=x;
  const limited=at===0&&x>0||at===photos.length-1&&x<0?x*.21:x;
  paint(at,Math.max(-current.width,Math.min(current.width,limited)));
 };
 const finish=(event:PointerEvent<HTMLButtonElement>,cancel=false)=>{
  const current=press.current;if(!current||current.id!==event.pointerId)return;
  press.current=null;clearTimeout(current.timer);
  if(current.mode==="hold")return;
  blockClick.current=performance.now()+360;
  if(current.mode==="fan"){
   const active=menu.current;
   const direction=!cancel&&active?fanSelection({x:event.clientX,y:event.clientY},active.origin,active.targets):null;
   if(direction)choose(direction);
   else closeMenu();
   return;
  }
  const threshold=current.width*.19;
  go(!cancel&&Math.abs(current.x)>threshold?Math.sign(-current.x):0);
 };
 const open=()=>{if(performance.now()>=blockClick.current&&!menu.current)onOpen();};
 const visibleAge=age??summary?.age,visibleCity=city??summary?.city;
 const nav=(direction:number)=>{if(photos.length>1)go(direction);};

 return <article className="likes-photo-card" data-pending={pending||undefined}>
  <div className="likes-photo-wrap">
   <button className="likes-photo-hit" ref={media} type="button" aria-label={"Открыть анкету "+name}
    onPointerDown={down} onPointerMove={move} onPointerUp={event=>finish(event)}
    onPointerCancel={event=>finish(event,true)} onLostPointerCapture={event=>{
     if(event.target===event.currentTarget&&event.buttons!==0)finish(event,true);
    }}
    onContextMenu={event=>event.preventDefault()} onClick={open} onKeyDown={event=>{
     if(event.key==="ArrowLeft"||event.key==="ArrowRight"){
      event.preventDefault();nav(event.key==="ArrowLeft"?-1:1);
     }
    }}>
    {photos.length?<span className="likes-photo-track" ref={track} aria-hidden="true">
     {photos.map((url,slot)=><span key={url+"-"+slot} className="likes-photo-slide">
      {Math.abs(slot-index)<=1&&<img src={url} alt="" draggable={false} loading="lazy" decoding="async"
       onError={event=>{event.currentTarget.hidden=true;}}/>}
     </span>)}
    </span>:<UserRound size={35} aria-hidden="true"/>}
   </button>
   {react&&<button className="likes-card-menu" ref={trigger} type="button" aria-label={"Действия для "+name}
    aria-haspopup="dialog" aria-expanded={fan?.manual===true} onClick={event=>{
     if(menu.current){closeMenu();return;}
     const box=event.currentTarget.getBoundingClientRect();
     openMenu({x:box.x+box.width/2,y:box.y+box.height/2},true);
    }}><MoreHorizontal size={20} aria-hidden="true"/></button>}
   {photos.length>1&&<span className="likes-photo-dots" aria-hidden="true" data-visible={dots||undefined}>
    {photos.map((_,i)=><i key={i} data-active={i===index||undefined}/>)}
   </span>}
   {photos.length>1&&<span className="likes-keyboard-photos">
    <button type="button" aria-label="Предыдущее фото" onClick={()=>nav(-1)} disabled={index===0}><ChevronLeft size={16}/></button>
    <button type="button" aria-label="Следующее фото" onClick={()=>nav(1)} disabled={index===photos.length-1}><ChevronRight size={16}/></button>
   </span>}
  </div>
  <div className="likes-card-meta">
   <button type="button" className="likes-card-person" onClick={open}>
    <strong>{name}{visibleAge?", "+visibleAge:""}</strong>
    {visibleCity&&<small><MapPin size={12} aria-hidden="true"/>{visibleCity}</small>}
   </button>
   <span className="likes-card-indicator" key={indicator}><img src={profileReactionAsset(indicator)} alt="" width="24" height="24"/></span>
  </div>
  {onChat&&<button type="button" className="likes-card-chat" aria-label={"Написать "+name} onClick={onChat}><MessageCircle size={15} aria-hidden="true"/>Написать</button>}
  {error&&<small className="likes-card-error" role="alert">{error}</small>}
  {fan&&createPortal(<div ref={popup} className="likes-fan" data-manual={fan.manual||undefined}
   role={fan.manual?"dialog":undefined} aria-label={fan.manual?"Действия с симпатией":undefined} aria-hidden={fan.manual?undefined:true}
   onClick={event=>{if(event.target===event.currentTarget&&fan.manual)closeMenu();}}>
   <span className="likes-fan-origin" style={{left:fan.origin.x,top:fan.origin.y}}/>
   {fan.targets.map(target=>{
    const Icon=icons[target.kind];
    return <button key={target.kind} type="button" className="likes-fan-option" data-kind={target.kind}
     aria-label={labels[target.kind]} tabIndex={fan.manual?0:-1}
     style={{left:target.x,top:target.y,"--fan-x":(fan.origin.x-target.x)+"px",
      "--fan-y":(fan.origin.y-target.y)+"px"} as CSSProperties} onClick={()=>choose(target.kind)}>
     <Icon size={23} aria-hidden="true"/><span>{labels[target.kind]}</span>
    </button>;
   })}
  </div>,document.body)}
 </article>;
}
