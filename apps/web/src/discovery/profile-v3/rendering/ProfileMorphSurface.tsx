import {useLayoutEffect,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {createProfileLayout,photoMask,photoOffset,type MorphLayout,type Viewport} from "../geometry/ProfileGeometry";
import {ProfileMotionEngine} from "../motion/ProfileMotionEngine";
import {ProfileGestureCoordinator} from "../gestures/ProfileGestureCoordinator";
import {syntheticProfile} from "../prototype/synthetic-fixtures";
import "./ProfileMorphSurface.css";

export type ProfileSurfaceData={name:string;location:string;goal:string;photo:{id:string;src:string;width:number;height:number}};
export type ProfileMorphSurfaceProps={data?:ProfileSurfaceData;viewport?:Viewport};
const labels=["О себе","Блики","Фото","Аккаунт","Подарки"];
export function ProfileMorphSurface({data=syntheticProfile,viewport}:ProfileMorphSurfaceProps){
 const root=useRef<HTMLDivElement>(null),mask=useRef<HTMLDivElement>(null),img=useRef<HTMLImageElement>(null);
 const sheet=useRef<HTMLDivElement>(null),compact=useRef<HTMLDivElement>(null),expanded=useRef<HTMLDivElement>(null);
 const engine=useRef<ProfileMotionEngine|null>(null),gestures=useRef(new ProfileGestureCoordinator());
 const layout=useRef<MorphLayout>(createProfileLayout(viewport??{width:390,height:740}));
 const drag=useRef<{id:number;y:number;lastY:number;at:number;velocity:number;claimed:boolean}|null>(null);
 const [selected,setSelected]=useState(0);
 const photoRef=useRef(data.photo);photoRef.current=data.photo;
 const apply=(p:number)=>{
  const l=layout.current,m=photoMask(l,p),o=photoOffset(l,p,photoRef.current.width,photoRef.current.height);
  const surface=mask.current,image=img.current,panel=sheet.current;
  if(surface){surface.style.left=m.x+"px";surface.style.top=m.y+"px";
   surface.style.width=m.width+"px";surface.style.height=m.height+"px";
   surface.style.borderRadius=(1-p)*50+"%";}
  if(image){image.style.width=o.width+"px";image.style.height=o.height+"px";
   image.style.transform=`translate3d(${o.x}px,${o.y}px,0)`;}
  if(panel){panel.style.top=l.compactTop+"px";panel.style.height=Math.max(0,l.height-l.compactTop)+"px";
   panel.style.transform=`translate3d(0,${l.span*p}px,0)`;}
  if(compact.current)compact.current.style.opacity=String(Math.max(0,Math.min(1,1-p*2.5)));
  if(expanded.current)expanded.current.style.opacity=String(Math.max(0,Math.min(1,(p-.48)*2.4)));
  if(root.current)root.current.dataset.progress=p.toFixed(4);
 };
 const painter=useRef(apply);painter.current=apply;
 useLayoutEffect(()=>{
  const node=root.current;if(!node)return;
  const measure=()=>{
   const width=viewport?.width??node.clientWidth,height=viewport?.height??node.clientHeight;
   const next=createProfileLayout({...viewport,width,height});layout.current=next;
   node.style.setProperty("--v3-width",next.width+"px");node.style.setProperty("--v3-height",next.height+"px");
   node.style.setProperty("--v3-hero",next.expandedTop+"px");
   node.style.setProperty("--v3-compact-x",next.compactIdentity.x+"px");
   node.style.setProperty("--v3-compact-y",next.compactIdentity.y+"px");
   node.style.setProperty("--v3-expanded-y",next.expandedIdentity.y+"px");
   node.style.setProperty("--v3-logo-y",next.logo.y+"px");
   engine.current?.rebaseViewport(next);
  };
  measure();const motion=new ProfileMotionEngine(layout.current,p=>painter.current(p),
   undefined,()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  engine.current=motion;let pending=0;
  const schedule=()=>{if(pending)return;pending=requestAnimationFrame(()=>{pending=0;measure();});};
  const observer=new ResizeObserver(schedule);observer.observe(node);
  window.visualViewport?.addEventListener("resize",schedule);
  const visibility=()=>{if(document.visibilityState==="hidden")motion.suspend();else motion.resume();};
  const pagehide=()=>motion.suspend();
  document.addEventListener("visibilitychange",visibility);window.addEventListener("pagehide",pagehide);
  return ()=>{observer.disconnect();window.visualViewport?.removeEventListener("resize",schedule);
   document.removeEventListener("visibilitychange",visibility);window.removeEventListener("pagehide",pagehide);
   if(pending)cancelAnimationFrame(pending);motion.dispose();gestures.current.dispose();engine.current=null;};
 },[viewport]);
 const down=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(!e.isPrimary){gestures.current.secondFinger();engine.current?.cancelDrag();drag.current=null;return;}
  if(e.pointerType==="mouse"&&e.button!==0)return;
  if(!gestures.current.begin({id:e.pointerId,x:e.clientX,y:e.clientY,time:e.timeStamp},"handle"))return;
  drag.current={id:e.pointerId,y:e.clientY,lastY:e.clientY,at:e.timeStamp,velocity:0,claimed:false};
 };
 const move=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const g=drag.current;if(!g||g.id!==e.pointerId)return;
  const decision=gestures.current.move({id:e.pointerId,x:e.clientX,y:e.clientY,time:e.timeStamp});
  if(decision.owner!=="SHEET")return;
  if(!g.claimed){g.claimed=true;engine.current?.beginDrag(g.y);
   try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* host owns capture */}}
  const dt=e.timeStamp-g.at;if(dt>0&&dt<120)g.velocity=(e.clientY-g.lastY)/dt;
  g.lastY=e.clientY;g.at=e.timeStamp;engine.current?.updateDrag(e.clientY);
 };
 const end=(e:ReactPointerEvent<HTMLDivElement>,cancel=false)=>{
  const g=drag.current;if(!g||g.id!==e.pointerId){gestures.current.releaseSecondFinger();return;}
  drag.current=null;const decision=gestures.current.end(e.pointerId);
  if(g.claimed){if(cancel)engine.current?.cancelDrag();else engine.current?.endDrag(g.velocity);}
  else if(!cancel&&!decision.claimed&&Math.abs(decision.dy)<7)
   engine.current?.animateTo(engine.current.getProgress()>=.5?0:1);
  try{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}catch{/* implicit */}
 };
 return <div className="v3-root" ref={root} data-testid="v3-root" data-progress="0">
  <div className="v3-backing"/><div className="v3-ambient"/>
  <img className="v3-logo" src="/assets/brand/wordmark_original_raster_alpha_W06.webp" alt="LUEMI"/>
  <div className="v3-hero"><div className="v3-mask" ref={mask} data-testid="v3-photo-mask">
   <img ref={img} src={data.photo.src} data-photo-id={data.photo.id} alt="Синтетическое фото" draggable={false}/>
   <div className="v3-ring"/></div>
   <div className="v3-compact-identity" ref={compact}><h2>{data.name}</h2><p>{data.location}</p><span>{data.goal}</span></div>
   <div className="v3-expanded-identity" ref={expanded}><h2>{data.name}</h2><p>{data.location}</p><span>{data.goal}</span></div>
  </div>
  <div className="v3-sheet" ref={sheet} data-testid="v3-sheet">
   <div className="v3-handle" role="button" tabIndex={0} aria-label="Переключить профиль"
    onClick={e=>{if(e.detail===0)engine.current?.animateTo(engine.current.getProgress()>=.5?0:1);}}
    onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();engine.current?.animateTo(engine.current.getProgress()>=.5?0:1);}}}
    onPointerDown={down} onPointerMove={move} onPointerUp={e=>end(e)} onPointerCancel={e=>end(e,true)}
    onLostPointerCapture={e=>{if(e.target===e.currentTarget)end(e,true);}}><span/></div>
   <div className="v3-tabs" role="tablist">{labels.map((label,i)=><button role="tab" aria-selected={selected===i}
    key={label} onClick={()=>setSelected(i)}>{label}</button>)}</div>
   <div className="v3-content" role="tabpanel"><article><h3>{labels[selected]}</h3><p>Синтетический контент для проверки композиции.</p></article></div>
  </div>
 </div>;
}
