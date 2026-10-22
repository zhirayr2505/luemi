import {useLayoutEffect,useRef,useState,useEffect} from "react";
import type {PointerEvent as ReactPointerEvent,ChangeEvent} from "react";
import {createPortal} from "react-dom";
import {selectionHaptic} from "../ui/haptic";
import {Plus,X,GripVertical,CheckCircle2} from "lucide-react";
export interface PhotoItem {id:string;src:string;file:File;preview?:Blob;status?:"reading"|"success"|"ready"|"error";progress?:number}
interface Props {photos:PhotoItem[];addPhotos:(files:File[])=>void;removePhoto:(id:string)=>void;movePhoto:(from:number,to:number)=>void}
interface Drag {id:string;source:number;target:number;x:number;y:number;width:number;height:number}
type SortPhase="idle"|"press-pending"|"dragging"|"cancelled";
interface Pending {id:string;pointer:number;x:number;y:number;lastX:number;lastY:number;timer:number;started:boolean}
export const reorder=<T,>(items:T[],from:number,to:number)=>{
 if(from<0||to<0||from>=items.length||to>=items.length)return items;
 const next=[...items];const [value]=next.splice(from,1);next.splice(to,0,value);return next;
};
export function PhotoSorter({photos,addPhotos,removePhoto,movePhoto}:Props){
 const input=useRef<HTMLInputElement>(null),mosaic=useRef<HTMLDivElement>(null);
 const pending=useRef<Pending|null>(null),dragRef=useRef<Drag|null>(null);
 const [phase,setPhase]=useState<SortPhase>("idle");
 const contacts=useRef(new Set<number>());
 const photosRef=useRef(photos);photosRef.current=photos;
 const itemRefs=useRef(new Map<string,HTMLDivElement>());
 const rects=useRef(new Map<string,DOMRect>());
 const ghost=useRef<HTMLDivElement>(null),scrollFrame=useRef<number|null>(null);
 const lastFrameTime=useRef(0);
 const scrollBounds=useRef<{node:Element}|null>(null);
 const [drag,setDrag]=useState<Drag|null>(null);
 const display=drag?reorder(photos,drag.source,drag.target):photos;
 const stopFrame=()=>{
  if(scrollFrame.current!==null){cancelAnimationFrame(scrollFrame.current);scrollFrame.current=null;}
  lastFrameTime.current=0;
 };
 const cancel=(reason:"idle"|"cancelled"="cancelled")=>{
  const active=pending.current;
  if(active)window.clearTimeout(active.timer);
  stopFrame();
  pending.current=null;dragRef.current=null;scrollBounds.current=null;
  setDrag(null);setPhase(reason);
  if(active&&mosaic.current?.hasPointerCapture(active.pointer)){
   try{mosaic.current.releasePointerCapture(active.pointer);}catch{/* detached element */}
  }
 };
 const idsSignature=photos.map(item=>item.id).join("|");
 useEffect(()=>{
  const p=pending.current;
  if(p&&!photos.some(item=>item.id===p.id))cancel();
 },[idsSignature,photos]);
 useEffect(()=>{
  const node=mosaic.current;
  if(!node)return;
  // Native non-passive handler is installed BEFORE a gesture begins, never after
  // native scrolling has already claimed the touch. No default is prevented
  // while press-pending, so a normal fast pan remains the browser's scroll.
  const handle=(event:TouchEvent)=>{
   if(pending.current?.started&&event.touches.length===1&&event.cancelable)
    event.preventDefault();
   if(event.touches.length>1&&pending.current)cancel();
  };
  node.addEventListener("touchmove",handle,{capture:true,passive:false});
  return ()=>node.removeEventListener("touchmove",handle,true);
 },[]);
 useEffect(()=>()=>{if(pending.current)window.clearTimeout(pending.current.timer);
  if(scrollFrame.current!==null)cancelAnimationFrame(scrollFrame.current);
 },[]);
 useLayoutEffect(()=>{
  if(ghost.current&&dragRef.current){
   ghost.current.style.translate=dragRef.current.x+"px "+dragRef.current.y+"px";
  }
 },[drag?.id]);
 useLayoutEffect(()=>{
   // FLIP: old positions -> new positions; movable cards stay in one DOM tree.
   const newRects=new Map<string,DOMRect>();
   itemRefs.current.forEach((node,id)=>newRects.set(id,node.getBoundingClientRect()));
   for(const [id,rect] of newRects){
     const old=rects.current.get(id),node=itemRefs.current.get(id);
     if(!old||!node||id===drag?.id||!node.animate||window.matchMedia("(prefers-reduced-motion: reduce)").matches)continue;
     const x=old.left-rect.left,y=old.top-rect.top;
     if(Math.abs(x)>1||Math.abs(y)>1){
       node.getAnimations?.().forEach(animation=>animation.cancel());
       node.animate([{transform:"translate3d("+x+"px,"+y+"px,0)"},{transform:"translate3d(0,0,0)"}],
         {duration:230,easing:"cubic-bezier(.2,.8,.22,1)"});
     }
   }
   rects.current=newRects;
 },[display.map(x=>x.id).join("|"),drag?.id]);
 // Hit-testing uses viewport client coordinates; no stale rect cache after scroll.
 const hitTarget=(x:number,y:number,current:Drag):number=>{
  const hit=document.elementFromPoint(x,y)?.closest("[data-photo-slot]");
  const index=hit?.getAttribute("data-photo-slot");
  if(index===null||index===undefined)return current.target;
  const target=Number(index);
  return Number.isInteger(target)?Math.max(0,Math.min(photosRef.current.length-1,target)):current.target;
 };
 const repaintDrag=(x:number,y:number)=>{
  const current=dragRef.current;
  if(!current)return;
  const target=hitTarget(x,y,current);
  if(ghost.current)ghost.current.style.translate=x+"px "+y+"px";
  const changed=target!==current.target;
  const updated={...current,x,y,target};
  dragRef.current=updated;
  if(changed)setDrag(updated);
 };
 // Edge-scrolling is elapsed-time based and continues if the pointer is still.
 // One RAF owner, cancelled immediately when pointer exits, releases or is lost.
 const edgeVelocity=(y:number):number=>{
  const node=scrollBounds.current?.node;
  if(!node)return 0;
  const rect=node.getBoundingClientRect(),edge=47;
  if(y>rect.bottom-edge&&y<rect.bottom)
   return 330*Math.min(1,(y-(rect.bottom-edge))/edge);
  if(y<rect.top+edge&&y>rect.top)
   return -330*Math.min(1,(rect.top+edge-y)/edge);
  return 0;
 };
 const tick=(time:number)=>{
  scrollFrame.current=null;
  const active=pending.current,current=dragRef.current;
  if(!active?.started||!current||contacts.current.size!==1){stopFrame();return;}
  const velocity=edgeVelocity(active.lastY);
  if(velocity===0){stopFrame();return;}
  const delta=lastFrameTime.current?Math.min(50,time-lastFrameTime.current):16.67;
  lastFrameTime.current=time;
  const node=scrollBounds.current?.node;
  if(node){
   const before=node.scrollTop;
   node.scrollTop+=velocity*Math.max(0,delta)/1000;
   if(node.scrollTop!==before)repaintDrag(active.lastX,active.lastY);
  }
  scrollFrame.current=requestAnimationFrame(tick);
 };
 const scheduleScroll=()=>{
  const active=pending.current;
  if(!active?.started||edgeVelocity(active.lastY)===0){stopFrame();return;}
  if(scrollFrame.current===null)scrollFrame.current=requestAnimationFrame(tick);
 };
 const down=(event:ReactPointerEvent<HTMLDivElement>,id:string)=>{
  if(event.pointerType==="mouse"&&event.button!==0)return;
  if(event.isPrimary===false||contacts.current.size!==1)return;
  if((event.target as HTMLElement).closest("button"))return;
  if(pending.current)cancel();
  const element=itemRefs.current.get(id);if(!element)return;
  const pendingItem:Pending={
   id,pointer:event.pointerId,x:event.clientX,y:event.clientY,
   lastX:event.clientX,lastY:event.clientY,timer:0,started:false
  };
  setPhase("press-pending");
  pending.current=pendingItem;
  pendingItem.timer=window.setTimeout(()=>{
   if(pending.current!==pendingItem||contacts.current.size!==1)return;
   const source=photosRef.current.findIndex(item=>item.id===id);
   if(source<0){cancel();return;}
   pendingItem.started=true;
   const rect=element.getBoundingClientRect();
   const value:Drag={id,source,target:source,x:pendingItem.lastX,y:pendingItem.lastY,
    width:rect.width,height:rect.height};
   const region=mosaic.current?.closest(".onboard-body");
   scrollBounds.current=region?{node:region}:null;
   dragRef.current=value;setDrag(value);setPhase("dragging");
   try{mosaic.current?.setPointerCapture(pendingItem.pointer);}
   catch{/* native WebView may refuse capture, pointercancel still cleans up */}
   selectionHaptic();
   scheduleScroll();
  },275);
 };
 const move=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const p=pending.current;
  if(!p||p.pointer!==event.pointerId)return;
  p.lastX=event.clientX;p.lastY=event.clientY;
  if(!p.started){
   if(Math.hypot(event.clientX-p.x,event.clientY-p.y)>11)cancel();
   return;
  }
  if(event.cancelable)event.preventDefault();
  repaintDrag(event.clientX,event.clientY);
  scheduleScroll();
 };
 const up=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const p=pending.current;
  if(!p||p.pointer!==event.pointerId)return;
  const done=dragRef.current;
  if(done)done.target=hitTarget(event.clientX,event.clientY,done);
  // Disarm before releasing capture: lostpointercapture must never double-commit.
  cancel("idle");
  if(!done)return;
  const source=photosRef.current.findIndex(item=>item.id===done.id);
  if(source>=0&&done.target>=0&&done.target<photosRef.current.length&&source!==done.target)
   movePhoto(source,done.target);
 };
 const downCapture=(event:ReactPointerEvent<HTMLDivElement>)=>{
  contacts.current.add(event.pointerId);
  if(contacts.current.size>1)cancel();
 };
 const upCapture=(event:ReactPointerEvent<HTMLDivElement>)=>{
  contacts.current.delete(event.pointerId);
 };
 const cancelCapture=(event:ReactPointerEvent<HTMLDivElement>)=>{
  contacts.current.delete(event.pointerId);cancel();
 };
 const lostCapture=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(pending.current?.pointer===event.pointerId)cancel();
 };
 const onFile=(event:ChangeEvent<HTMLInputElement>)=>{
   const snapshot=Array.from(event.currentTarget.files??[]);
   event.currentTarget.value="";
   if(snapshot.length)addPhotos(snapshot);
 };
 return <div className="photo-sorter">
   <input ref={input} className="native-photo-input" type="file" accept="image/jpeg,image/png,image/webp"
     multiple onChange={onFile} aria-label="Добавить фотографии"/>
   <div className="mosaic" ref={mosaic} data-drag-phase={phase}
     onPointerDownCapture={downCapture} onPointerUpCapture={upCapture}
     onPointerCancelCapture={cancelCapture} onLostPointerCapture={lostCapture}
     onPointerMove={move} onPointerUp={up}
     onDragStart={event=>event.preventDefault()} aria-label="Порядок фотографий">
     {Array.from({length:6},(_,i)=>{
       const photo=display[i];
       return <div key={photo?.id??"slot-"+i} data-photo-slot={i}
         ref={photo?element=>{if(element)itemRefs.current.set(photo.id,element);else itemRefs.current.delete(photo.id);}:undefined}
         onPointerDown={photo?event=>down(event,photo.id):undefined}
         onContextMenu={event=>{if(photo)event.preventDefault();}}
         tabIndex={photo?0:undefined}
         role={photo?"group":undefined}
         aria-label={photo?"Фото "+(i+1)+(i===0?", главное":"")+". Alt+стрелки для перестановки":undefined}
         onKeyDown={photo?event=>{
           if(!event.altKey)return;
           if(event.key==="ArrowLeft"||event.key==="ArrowUp"){event.preventDefault();movePhoto(i,Math.max(0,i-1));}
           if(event.key==="ArrowRight"||event.key==="ArrowDown"){event.preventDefault();movePhoto(i,Math.min(photos.length-1,i+1));}
         }:undefined}
         className={"mosaic-slot"+(i===0?" mosaic-main":"")+(drag?.id===photo?.id?" drag-source":"")}>
         {photo?<>{photo.src&&<img src={photo.src} alt={"Фото "+(i+1)} draggable={false} decoding="async"/>}
           <span className="slot-index">{i+1}</span>
           {i===0&&<span className="primary-photo">Главное</span>}
           <button className="remove-photo" type="button" onClick={()=>removePhoto(photo.id)} aria-label={"Удалить фото "+(i+1)}><X size={14}/></button>
           {photo.status==="reading"&&<div className="photo-processing" aria-label="Подготовка фотографии">
             <div className="photo-processing-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100}
               aria-valuenow={photo.progress??0}><span style={{width:(photo.progress??0)+"%"}}/></div>
             <small>Подготовка {photo.progress??0}%</small>
           </div>}
           {photo.status==="success"&&<div className="photo-processed" aria-label="Фотография готова"><CheckCircle2 size={25}/></div>}
           {photo.status==="error"&&<span className="photo-processing-error">Ошибка фото</span>}
         </>:i===photos.length?<button type="button" className="add-photo" onClick={()=>input.current?.click()} aria-label="Добавить фотографии"><Plus size={30}/></button>:
           <span className="empty-number">{i+1}</span>}
       </div>;
     })}
   </div>
   {drag&&createPortal(<div className="photo-drag-ghost" ref={ghost} aria-hidden="true"
     style={{left:0,top:0,width:drag.width,height:drag.height}}>
     <img src={photos[drag.source]?.src} alt=""/><GripVertical size={16}/>
   </div>,document.body)}
   <div className="sort-tip"><GripVertical size={16}/><span>Удерживай фотографию 0,3 секунды и перенеси. Также доступно Alt + стрелки на клавиатуре. Индикатор показывает только локальную подготовку фото, не загрузку на сервер.</span></div>
   <p className="photo-count" role="status">Выбрано: {photos.length} / 6 · Первое фото главное</p>
   <p className="hint">Это локальный предпросмотр. Для будущей публикации потребуется 3–6 фото и модерация.</p>
 </div>;
}
