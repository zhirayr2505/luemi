import {useLayoutEffect,useRef,useState,useEffect} from "react";
import type {PointerEvent as ReactPointerEvent,ChangeEvent} from "react";
import {createPortal} from "react-dom";
import {Plus,X,GripVertical,ArrowLeft,ArrowRight} from "lucide-react";
export interface PhotoItem {id:string;src:string;file:File}
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
 const [drag,setDrag]=useState<Drag|null>(null);
 const display=drag?reorder(photos,drag.source,drag.target):photos;
 const cancel=()=>{
   if(pending.current)window.clearTimeout(pending.current.timer);
   pending.current=null;dragRef.current=null;setDrag(null);
 };
 useEffect(()=>()=>{if(pending.current)window.clearTimeout(pending.current.timer);},[]);
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
     dragRef.current=value;setDrag(value);
     try{mosaic.current?.setPointerCapture(pendingItem.pointer);}catch{/* Telegram WebView fallback */}
     window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
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
   const scrollRegion=mosaic.current?.closest(".onboard-body");
   if(scrollRegion){
     const rect=scrollRegion.getBoundingClientRect(),edge=47;
     if(event.clientY>rect.bottom-edge&&event.clientY<rect.bottom)scrollRegion.scrollBy(0,13);
     else if(event.clientY<rect.top+edge&&event.clientY>rect.top)scrollRegion.scrollBy(0,-13);
   }
   const under=document.elementFromPoint(event.clientX,event.clientY)?.closest("[data-photo-slot]");
   const index=under?.getAttribute("data-photo-slot");
   const target=index===undefined||index===null?dragRef.current?.target??0:Number(index);
   const current=dragRef.current;if(!current)return;
   const updated:Drag={...current,x:event.clientX,y:event.clientY,
     target:Number.isInteger(target)?Math.max(0,Math.min(photos.length-1,target)):current.target};
   dragRef.current=updated;
   setDrag(updated);
 };
 const up=(event:ReactPointerEvent<HTMLDivElement>)=>{
   const p=pending.current;if(!p||p.pointer!==event.pointerId)return;
   const completed=dragRef.current;cancel();
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
         className={"mosaic-slot"+(i===0?" mosaic-main":"")+(drag?.id===photo?.id?" drag-source":"")}>
         {photo?<><img src={photo.src} alt={"Фото "+(i+1)} draggable={false}/>
           <span className="slot-index">{i+1}</span>
           {i===0&&<span className="primary-photo">Главное</span>}
           <button className="remove-photo" type="button" onClick={()=>removePhoto(photo.id)} aria-label={"Удалить фото "+(i+1)}><X size={14}/></button>
           <div className="photo-reorder-buttons">
             <button type="button" disabled={i===0} onClick={()=>movePhoto(i,i-1)} aria-label={"Фото "+(i+1)+" раньше"}><ArrowLeft size={13}/></button>
             <button type="button" disabled={i===photos.length-1} onClick={()=>movePhoto(i,i+1)} aria-label={"Фото "+(i+1)+" позже"}><ArrowRight size={13}/></button>
           </div>
         </>:i===photos.length?<button type="button" className="add-photo" onClick={()=>input.current?.click()} aria-label="Добавить фотографии"><Plus size={30}/></button>:
           <span className="empty-number">{i+1}</span>}
       </div>;
     })}
   </div>
   {drag&&createPortal(<div className="photo-drag-ghost" aria-hidden="true"
     style={{left:drag.x,top:drag.y,width:drag.width,height:drag.height}}>
     <img src={photos[drag.source]?.src} alt=""/><GripVertical size={16}/>
   </div>,document.body)}
   <div className="sort-tip"><GripVertical size={16}/><span>Удерживай фотографию 0,3 секунды и перенеси. Соседние фото освободят место.</span></div>
   <p className="photo-count" role="status">Выбрано: {photos.length} / 6 · Первое фото главное</p>
   <p className="hint">Это локальный предпросмотр. Для будущей публикации потребуется 3–6 фото и модерация.</p>
 </div>;
}
