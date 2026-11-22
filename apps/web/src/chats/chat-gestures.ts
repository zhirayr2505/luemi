import {useEffect,useRef} from "react";
import type {PointerEvent} from "react";
import {computedTranslation,GestureArbiter} from "../ui/gesture-arbiter.js";

type MessageTarget={id:string;node:HTMLElement};
type Drag={
 pointer:number;serial:number;x:number;y:number;at:number;span:number;
 origin:number;dx:number;target:MessageTarget|null;mode:"back"|"reply"|null;held:boolean;
};

export function useChatGestures(callbacks:{
 threadId?:string;enabled:boolean;canBack:boolean;canReply:boolean;
 onOpen:(target:MessageTarget)=>void;onHeart:(target:MessageTarget)=>void;
 onHold:(target:MessageTarget)=>void;onReply:(target:MessageTarget)=>void;onBack:()=>void;
}){
 const latest=useRef(callbacks);
 useEffect(()=>{latest.current=callbacks;},[callbacks]);
 const route=useRef<HTMLElement>(null);
 const arbiter=useRef(new GestureArbiter());
 const drag=useRef<Drag|null>(null);
 const hold=useRef(0);
 const tap=useRef<{target:MessageTarget;timer:number}|null>(null);
 const routeMotion=useRef<Animation|null>(null);
 const closing=useRef(false);
 const frame=useRef(0);
 const tapBlock=useRef(0);

 const threadId=callbacks.threadId;
 useEffect(()=>{
  const reset=()=>{
   window.clearTimeout(hold.current);
   window.clearTimeout(tap.current?.timer);
   cancelAnimationFrame(frame.current);frame.current=0;
   tap.current=null;
   drag.current?.target?.node.style.removeProperty("--lc-reply-drag");
   drag.current=null;
   arbiter.current.cancel();
   if(!closing.current){routeMotion.current?.cancel();routeMotion.current=null;route.current?.style.removeProperty("transform");if(route.current)delete route.current.dataset.moving;}
  };
  window.addEventListener("resize",reset);
  document.addEventListener("visibilitychange",reset);
  return()=>{
   window.removeEventListener("resize",reset);
   document.removeEventListener("visibilitychange",reset);
   reset();
   routeMotion.current?.cancel();
   closing.current=false;
  };
 },[threadId]);

 const clearTap=()=>{window.clearTimeout(tap.current?.timer);tap.current=null;};
 const onPointerDown=(event:PointerEvent<HTMLElement>)=>{
  if(!event.isPrimary){
   end(null,true);
   return;
  }
  const options=latest.current;
  const node=event.target instanceof Element?event.target:null;
  if(!options.enabled||closing.current||event.button!==0||
   !node||node.closest("textarea,input,[role=dialog],a,.lc-composer")||
   node.closest("button")&&!node.closest(".lc-attachment-grid"))return;
  const bubble=node.closest<HTMLElement>(".lc-bubble[data-interactive]");
  const target=bubble?.dataset.messageId?{id:bubble.dataset.messageId,node:bubble}:null;
  const serial=arbiter.current.begin("pointer",event.pointerId,"route");
  if(serial===null)return;
  drag.current={pointer:event.pointerId,serial,x:event.clientX,y:event.clientY,at:performance.now(),
   span:route.current?.clientWidth??window.innerWidth,origin:0,dx:0,target,mode:null,held:false};
  if(!target)return;
  hold.current=window.setTimeout(()=>{
   if(!drag.current)return;
   drag.current.held=true;
   clearTap();
   latest.current.onHold(target);
  },470);
 };
 const onPointerMove=(event:PointerEvent<HTMLElement>)=>{
  const g=drag.current;
  if(!g||g.pointer!==event.pointerId||g.held)return;
  const dx=event.clientX-g.x,dy=event.clientY-g.y;
  if(!g.mode){
   if(Math.hypot(dx,dy)<9)return;
   window.clearTimeout(hold.current);
   const horizontal=Math.abs(dx)>Math.abs(dy)*1.26;
   const options=latest.current;
   const mode=horizontal&&dx>0&&options.canBack?"back":
    horizontal&&dx<0&&g.target&&options.canReply?"reply":null;
   if(!mode){
    arbiter.current.nativeScroll(g.serial);
    end(null,true);
    return;
   }
   if(!arbiter.current.claim("route",g.serial))return;
   g.mode=mode;
   if(mode==="back"&&route.current)route.current.dataset.moving="true";
   if(mode==="back"&&routeMotion.current){
    g.origin=computedTranslation(route.current);
    routeMotion.current.cancel();routeMotion.current=null;
   }
   clearTap();
   try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* Older WebView */}
  }
  if(!arbiter.current.owns("route",g.serial))return;
  g.dx=dx;
  if(frame.current)return;
  frame.current=requestAnimationFrame(()=>{
   frame.current=0;
   if(drag.current!==g)return;
   if(g.mode==="back"){
    const el=route.current;
    if(el)el.style.transform=`translate3d(${Math.max(0,Math.min(g.span,g.origin+g.dx))}px,0,0)`;
   }else g.target?.node.style.setProperty("--lc-reply-drag",Math.max(-84,Math.min(0,g.dx))+"px");
  });
 };
 const end=(event:PointerEvent<HTMLElement>|null,cancelled=false)=>{
  const g=drag.current;
  if(!g||event&&g.pointer!==event.pointerId)return;
  drag.current=null;
  window.clearTimeout(hold.current);
  cancelAnimationFrame(frame.current);frame.current=0;
  arbiter.current.cancel();
  const dx=event?event.clientX-g.x:0;
  if(g.mode==="back"&&route.current){
   const el=route.current;
   const x=Math.max(0,Math.min(g.span,g.origin+(event?dx:g.dx)));
   const commit=!cancelled&&(dx>g.span*.25||(dx>42&&dx/(performance.now()-g.at)>.58));
   const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
   const finish=()=>{delete el.dataset.moving;if(commit)latest.current.onBack();};
   closing.current=commit;
   routeMotion.current?.cancel();
   el.style.removeProperty("transform");
   if(reduced){finish();return;}
   routeMotion.current=el.animate([
    {transform:`translate3d(${x}px,0,0)`},
    {transform:`translate3d(${commit?g.span:0}px,0,0)`}
   ],{duration:Math.max(95,Math.round((commit?g.span-x:x)/g.span*(commit?210:180))),easing:"cubic-bezier(.2,.78,.24,1)",fill:commit?"forwards":"none"});
   routeMotion.current.onfinish=()=>{if(!commit)routeMotion.current=null;finish();};
  }else if(g.mode==="reply"&&g.target){
   g.target.node.style.removeProperty("--lc-reply-drag");
   if(!cancelled&&dx<-48)latest.current.onReply(g.target);
  }else if(!cancelled&&!g.held&&g.target){
   if(tap.current?.target.id===g.target.id){
    clearTap();
    latest.current.onHeart(g.target);
   }else{
    clearTap();
    const target=g.target;
    tap.current={target,timer:window.setTimeout(()=>{tap.current=null;latest.current.onOpen(target);},255)};
   }
  }
  // Touch also synthesizes an ordinary click. Pointer events own touch and mouse;
  // keyboard and accessibility clicks still open the message.
  if(event)tapBlock.current=performance.now()+350;
 };
 return {route,clearTap,isPointerClick:()=>performance.now()<tapBlock.current,
  events:{onPointerDown,onPointerMove,onPointerUp:(e:PointerEvent<HTMLElement>)=>end(e),
   onPointerCancel:(e:PointerEvent<HTMLElement>)=>end(e,true),
   onLostPointerCapture:(e:PointerEvent<HTMLElement>)=>{if(e.target===e.currentTarget)end(e,true);}}};
}
