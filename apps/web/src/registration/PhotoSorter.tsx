import {useLayoutEffect,useRef,useState,useEffect} from "react";
import type {PointerEvent as ReactPointerEvent,ChangeEvent} from "react";
import {createPortal} from "react-dom";
import {selectionHaptic} from "../ui/haptic";
import {Plus,X,GripVertical,CheckCircle2} from "lucide-react";
export interface PhotoItem {id:string;src:string;file:File;preview?:Blob;status?:"reading"|"success"|"ready"|"error";progress?:number}
interface Props {photos:PhotoItem[];addPhotos:(files:File[])=>void;removePhoto:(id:string)=>void;movePhoto:(from:number,to:number)=>void}
interface Drag {id:string;source:number;target:number;x:number;y:number;width:number;height:number}
interface Pending {id:string;pointer:number;x:number;y:number;timer:number;started:boolean}
export const reorder=<T,>(items:T[],from:number,to:number)=>{
 if(from<0||to<0||from>=items.length||to>=items.length)return items;
 const next=[...items];const [value]=next.splice(from,1);next.splice(to,0,value);return next;
};
export function PhotoSorter({photos,addPhotos,removePhoto,movePhoto}:Props){
 const input=useRef<HTMLInputElement>(null),mosaic=useRef<HTMLDivElement>(null);
 const pending=useRef<Pending|null>(null),dragRef=useRef<Drag|null>(null);
 const itemRefs=useRef(new Map<string,HTMLDivElement>());
 const rects=useRef(new Map<string,DOMRect>());
 const ghost=useRef<HTMLDivElement>(null),moveFrame=useRef<number|null>(null);
 const scrollBounds=useRef<{node:Element;top:number;bottom:number}|null>(null);
 const [drag,setDrag]=useState<Drag|null>(null);
 const display=drag?reorder(photos,drag.source,drag.target):photos;
 const cancel=()=>{
   if(pending.current)window.clearTimeout(pending.current.timer);
   if(moveFrame.current!==null){cancelAnimationFrame(moveFrame.current);moveFrame.current=null;}
   pending.current=null;dragRef.current=null;scrollBounds.current=null;setDrag(null);
 };
 useEffect(()=>()=>{if(pending.current)window.clearTimeout(pending.current.timer);
  if(moveFrame.current!==null)cancelAnimationFrame(moveFrame.current);
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
 const down=(event:ReactPointerEvent<HTMLDivElement>,id:string)=>{
   if(event.pointerType==="mouse"&&event.button!==0)return;
   if((event.target as HTMLElement).closest("button"))return;
   cancel();
   const element=itemRefs.current.get(id);
   if(!element)return;
   const pendingItem:Pending={id,pointer:event.pointerId,x:event.clientX,y:event.clientY,timer:0,started:false};
   pendingItem.timer=window.setTimeout(()=>{
     if(pending.current!==pendingItem)return;
     const source=photos.findIndex(x=>x.id===id);
     if(source<0)return;
     pendingItem.started=true;
     const rect=element.getBoundingClientRect();
     const value={id,source,target:source,x:pendingItem.x,y:pendingItem.y,width:rect.width,height:rect.height};
     const region=mosaic.current?.closest(".onboard-body"),bounds=region?.getBoundingClientRect();
     scrollBounds.current=region&&bounds?{node:region,top:bounds.top,bottom:bounds.bottom}:null;
     dragRef.current=value;setDrag(value);
     try{mosaic.current?.setPointerCapture(pendingItem.pointer);}catch{/* Telegram WebView fallback */}
     selectionHaptic();
   },275);
   pending.current=pendingItem;
 };
 const move=(event:ReactPointerEvent<HTMLDivElement>)=>{
   const p=pending.current;
   if(!p||p.pointer!==event.pointerId)return;
   if(!p.started){
     if(Math.hypot(event.clientX-p.x,event.clientY-p.y)>11)cancel();
     return;
   }
   event.preventDefault();
   const clientX=event.clientX,clientY=event.clientY;
   if(moveFrame.current!==null)cancelAnimationFrame(moveFrame.current);
   moveFrame.current=requestAnimationFrame(()=>{
   moveFrame.current=null;
   if(!pending.current?.started)return;
   const bounds=scrollBounds.current;
   if(bounds){
     const edge=47;
     if(clientY>bounds.bottom-edge&&clientY<bounds.bottom)bounds.node.scrollBy(0,13);
     else if(clientY<bounds.top+edge&&clientY>bounds.top)bounds.node.scrollBy(0,-13);
   }
   const under=document.elementFromPoint(clientX,clientY)?.closest("[data-photo-slot]");
   const index=under?.getAttribute("data-photo-slot");
   const target=index===undefined||index===null?dragRef.current?.target??0:Number(index);
   const current=dragRef.current;if(!current)return;
   const updated:Drag={...current,x:clientX,y:clientY,
     target:Number.isInteger(target)?Math.max(0,Math.min(photos.length-1,target)):current.target};
   dragRef.current=updated;
   if(ghost.current)ghost.current.style.translate=clientX+"px "+clientY+"px";
   if(updated.target!==current.target)setDrag(updated);
   });
 };
 const up=(event:ReactPointerEvent<HTMLDivElement>)=>{
   const p=pending.current;if(!p||p.pointer!==event.pointerId)return;
   const completed=dragRef.current;
   const slot=document.elementFromPoint(event.clientX,event.clientY)?.closest("[data-photo-slot]")?.getAttribute("data-photo-slot");
   if(completed&&slot!==undefined&&slot!==null)completed.target=Math.max(0,Math.min(photos.length-1,Number(slot)));
   cancel();
   try{mosaic.current?.releasePointerCapture(event.pointerId);}catch{/* ignore */}
   if(completed&&completed.source!==completed.target)movePhoto(completed.source,completed.target);
 };
 const onFile=(event:ChangeEvent<HTMLInputElement>)=>{
   const snapshot=Array.from(event.currentTarget.files??[]);
   event.currentTarget.value="";
   if(snapshot.length)addPhotos(snapshot);
 };
 return <div className="photo-sorter">
   <input ref={input} className="native-photo-input" type="file" accept="image/jpeg,image/png,image/webp"
     multiple onChange={onFile} aria-label="Добавить фотографии"/>
   <div className="mosaic" ref={mosaic} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
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
