import {useEffect,useLayoutEffect,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {createPortal} from "react-dom";
import {X,MoreHorizontal,ChevronLeft,ChevronRight,Lock,Star,Share2,Link2,Flag as ReportIcon} from "lucide-react";
import type {ProfilePhoto,ProfileView} from "./ProfileModel";
import {canMakeMain,displayPhotoDate} from "./ProfileModel";

type Props={view:ProfileView;photos:ProfilePhoto[];initial:number;source:HTMLElement|null;
 onClose:()=>void;onMain?:(id:string)=>void};
type Gesture={id:number;x:number;y:number;time:number;axis:""|"x"|"y";startIndex:number;pinch:boolean};
const duration=240;
export function PhotoViewer({view,photos,initial,source,onClose,onMain}:Props){
 const [index,setIndex]=useState(Math.min(initial,Math.max(0,photos.length-1)));
 const [menu,setMenu]=useState(false);
 const [message,setMessage]=useState("");
 const stage=useRef<HTMLDivElement>(null);
 const image=useRef<HTMLImageElement>(null);
 const pointer=useRef(new Map<number,{x:number;y:number}>());
 const gesture=useRef<Gesture|null>(null);
 const zoom=useRef(1);
 const closing=useRef(false);
 const suppress=useRef(false);
 const sourceRef=useRef(source);
 const cleanup=useRef<number|null>(null);
 const show=photos[index];
 const animate=(out:boolean)=>{
  const layer=stage.current,img=image.current;if(!layer||!img)return;
  const from=sourceRef.current?.isConnected?sourceRef.current.getBoundingClientRect():null;
  const usable=from&&from.width>8&&from.height>8&&from.bottom>0&&from.top<innerHeight;
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(!usable||reduce){layer.style.opacity=out?"0":"1";img.style.transform="";return;}
  const sx=from.width/innerWidth,sy=from.height/innerHeight;
  const x=from.left+(from.width-innerWidth)/2;
  const y=from.top+(from.height-innerHeight)/2;
  img.style.transform=out?`translate3d(${x}px,${y}px,0) scale(${sx},${sy})`:"none";
  layer.style.opacity=out?"0":"1";
 };
 useLayoutEffect(()=>{
  const layer=stage.current,img=image.current;
  if(!layer||!img)return;
  layer.style.opacity="0";
  if(sourceRef.current?.isConnected)animate(true);
  const id=requestAnimationFrame(()=>requestAnimationFrame(()=>animate(false)));
  return ()=>cancelAnimationFrame(id);
 // Source is intentionally captured at opening.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{
  const old=document.body.style.overflow;
  document.body.style.overflow="hidden";
  const key=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.stopImmediatePropagation();event.preventDefault();requestClose();}
   if(event.key==="ArrowRight"&&index<photos.length-1)setIndex(i=>i+1);
   if(event.key==="ArrowLeft"&&index>0)setIndex(i=>i-1);
  };
  window.addEventListener("keydown",key,true);
  return ()=>{document.body.style.overflow=old;window.removeEventListener("keydown",key,true);
   if(cleanup.current!==null)clearTimeout(cleanup.current);};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[index,menu]);
 useEffect(()=>{
  for(const i of [index-1,index+1])if(photos[i]){
   const prefetch=new Image();prefetch.src=photos[i].src;
  }
 },[index,photos]);
 const requestClose=()=>{
  if(menu){setMenu(false);return;}
  if(closing.current)return;
  closing.current=true;
  pointer.current.clear();zoom.current=1;
  const img=image.current;if(img){img.style.transition=`transform ${duration}ms cubic-bezier(.2,.8,.2,1)`;img.style.transform="none";}
  animate(true);
  cleanup.current=window.setTimeout(onClose,matchMedia("(prefers-reduced-motion: reduce)").matches?0:duration+30);
 };
 const resetGesture=()=>{
  gesture.current=null;pointer.current.clear();zoom.current=1;
  if(image.current){image.current.style.transition="transform 230ms cubic-bezier(.2,.75,.2,1)";image.current.style.transform="none";}
  if(stage.current)stage.current.style.opacity="1";
 };
 const down=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(closing.current||menu||(e.pointerType==="mouse"&&e.button!==0))return;
  pointer.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointer.current.size===1){
   gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),axis:"",startIndex:index,pinch:false};
  } else if(pointer.current.size===2){
   const g=gesture.current;if(g)g.pinch=true;
   suppress.current=true;
  }
 };
 const move=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(!pointer.current.has(e.pointerId)||closing.current||menu)return;
  pointer.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const active=[...pointer.current.values()];
  if(active.length>=2){
   const g=gesture.current;if(g)g.pinch=true;
   const dist=Math.hypot(active[0].x-active[1].x,active[0].y-active[1].y);
   const start=gesture.current;
   // The first two distances establish a baseline; no React renders during zoom.
   if(start){
    const base=(stage.current as HTMLDivElement & {__distance?:number})?.__distance;
    if(!base){if(stage.current)(stage.current as HTMLDivElement & {__distance?:number}).__distance=dist;return;}
    zoom.current=Math.max(1,Math.min(3.2,dist/Math.max(1,base)));
    if(image.current){image.current.style.transition="none";image.current.style.transform=`scale(${zoom.current})`;}
   }
   return;
  }
  const g=gesture.current;if(!g||g.id!==e.pointerId||g.pinch)return;
  const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(!g.axis){
   if(Math.max(Math.abs(dx),Math.abs(dy))<9)return;
   g.axis=Math.abs(dx)>Math.abs(dy)*1.18?"x":"y";
  }
  if(e.cancelable)e.preventDefault();
  try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* Android WebView fallback */}
  if(image.current){
   image.current.style.transition="none";
   image.current.style.transform=g.axis==="x"?`translate3d(${dx*.55}px,0,0)`:`translate3d(0,${dy*.78}px,0) scale(${Math.max(.85,1-Math.abs(dy)/2300)})`;
  }
  if(g.axis==="y"&&stage.current)stage.current.style.opacity=String(Math.max(.35,1-Math.abs(dy)/700));
 };
 const finish=(e:ReactPointerEvent<HTMLDivElement>,cancel:boolean)=>{
  if(!pointer.current.has(e.pointerId))return;
  pointer.current.delete(e.pointerId);
  const g=gesture.current;
  if(pointer.current.size){return;}
  if(stage.current)(stage.current as HTMLDivElement & {__distance?:number}).__distance=undefined;
  if(!g){resetGesture();return;}
  gesture.current=null;
  if(g.pinch||zoom.current!==1){suppress.current=true;resetGesture();return;}
  const dx=e.clientX-g.x,dy=e.clientY-g.y,elapsed=Math.max(1,performance.now()-g.time);
  if(!cancel&&g.axis==="y"&&(Math.abs(dy)>110||Math.abs(dy)/elapsed>.8)){requestClose();return;}
  if(!cancel&&g.axis==="x"&&(Math.abs(dx)>innerWidth*.17||Math.abs(dx)/elapsed>.52)){
   const newIndex=Math.min(photos.length-1,Math.max(0,g.startIndex+(dx<0?1:-1)));
   if(newIndex!==index){sourceRef.current=null;setIndex(newIndex);}
  }
  suppress.current=g.axis!=="";
  resetGesture();
 };
 const action=(kind:"main"|"link"|"share"|"report")=>{
  setMenu(false);
  if(kind==="main"&&show&&canMakeMain(view,show.id)){onMain?.(show.id);setMessage("Главное фото изменено в локальном предпросмотре");return;}
  setMessage(kind==="report"?"Жалобы станут доступны после запуска модерации. Ничего не отправлено.":kind==="link"?"Постоянная ссылка пока недоступна":kind==="share"?"Публикация и отправка ссылки пока недоступны":"Это фото пока нельзя сделать главным");
 };
 if(!show)return null;
 return createPortal(<section className="pm-viewer" role="dialog" aria-modal="true" aria-label="Просмотр фото">
  <div className="pm-viewer-stage" ref={stage} onPointerDown={down} onPointerMove={move}
    onPointerUp={e=>finish(e,false)} onPointerCancel={e=>finish(e,true)}>
   <img ref={image} className="pm-viewer-image" src={show.src} alt={"Фото "+(index+1)} draggable={false}
    onError={e=>{if(show.fallback)e.currentTarget.src=show.fallback;}}/>
  </div>
  <header className="pm-viewer-top">
   <button type="button" onClick={requestClose} aria-label="Закрыть просмотр"><X size={22}/></button>
   <span>{index+1} / {photos.length}</span><span className="pm-viewer-topspacer"/>
  </header>
  <footer className="pm-viewer-bottom">
   <span>{displayPhotoDate(show)}</span>
   <div className="pm-viewer-actions">
    <button type="button" disabled={index===0} onClick={()=>{sourceRef.current=null;setIndex(i=>i-1);}} aria-label="Предыдущее фото"><ChevronLeft size={21}/></button>
    <button type="button" disabled={index===photos.length-1} onClick={()=>{sourceRef.current=null;setIndex(i=>i+1);}} aria-label="Следующее фото"><ChevronRight size={21}/></button>
    <button type="button" onClick={()=>setMenu(v=>!v)} aria-label="Действия с фото"><MoreHorizontal size={23}/></button>
   </div>
  </footer>
  {menu&&<div className="pm-viewer-menu-backdrop" onClick={()=>setMenu(false)}>
    <div className="pm-viewer-menu" role="menu" onClick={e=>e.stopPropagation()}>
     {view.mode==="owner"&&<button type="button" role="menuitem" disabled={!canMakeMain(view,show.id)} onClick={()=>action("main")}><Star size={18}/> Сделать главным {!view.published&&<Lock size={14}/>}</button>}
     <button type="button" role="menuitem" onClick={()=>action("link")}><Link2 size={18}/> Скопировать ссылку</button>
     <button type="button" role="menuitem" onClick={()=>action("share")}><Share2 size={18}/> Поделиться</button>
     {view.mode==="visitor"&&<button type="button" role="menuitem" onClick={()=>action("report")}><ReportIcon size={18}/> Пожаловаться</button>}
     <button type="button" onClick={()=>setMenu(false)}>Отмена</button>
    </div>
   </div>}
   {message&&<div className="pm-viewer-message" role="status" onClick={()=>setMessage("")}>{message}</div>}
 </section>,document.body);
}
