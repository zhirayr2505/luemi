import {useEffect,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent,ChangeEvent} from "react";
import {Plus,X,GripVertical,ArrowLeft,ArrowRight} from "lucide-react";
export interface PhotoItem {id:string;src:string;file:File}
interface Props {photos:PhotoItem[];addPhotos:(files:File[])=>void;removePhoto:(id:string)=>void;movePhoto:(from:number,to:number)=>void}
interface Drag {source:number;target:number;x:number;y:number}
interface Gesture {index:number;x:number;y:number;pointerId:number;started:boolean;timer:number}
export function PhotoSorter({photos,addPhotos,removePhoto,movePhoto}:Props){
 const input=useRef<HTMLInputElement>(null);
 const gesture=useRef<Gesture|null>(null);
 const [drag,setDrag]=useState<Drag|null>(null);
 const [error,setError]=useState("");
 const dragRef=useRef<Drag|null>(null);
 const clear=()=>{
   if(gesture.current)window.clearTimeout(gesture.current.timer);
   gesture.current=null;dragRef.current=null;setDrag(null);
 };
 useEffect(()=>()=>{if(gesture.current)window.clearTimeout(gesture.current.timer);},[]);
 const onDown=(event:ReactPointerEvent<HTMLDivElement>,index:number)=>{
   if(event.button!==0||!photos[index]||(event.target as HTMLElement).closest("button"))return;
   if(gesture.current)clear();
   const id=event.pointerId;
   const g:Gesture={index,x:event.clientX,y:event.clientY,pointerId:id,started:false,timer:0};
   g.timer=window.setTimeout(()=>{
     if(gesture.current!==g)return;
     g.started=true;
     const initial={source:index,target:index,x:g.x,y:g.y};
     dragRef.current=initial;setDrag(initial);
     // Context menus and long press selection are suppressed on the slot only.
   },275);
   gesture.current=g;
   try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* unsupported client */}
 };
 const onMove=(event:ReactPointerEvent<HTMLDivElement>)=>{
   const g=gesture.current;
   if(!g||g.pointerId!==event.pointerId)return;
   if(!g.started){
     if(Math.hypot(event.clientX-g.x,event.clientY-g.y)>11)clear();
     return;
   }
   event.preventDefault();
   const element=document.elementFromPoint(event.clientX,event.clientY)?.closest("[data-slot]");
   const target=element?.getAttribute("data-slot");
   const n=target===null||target===undefined?g.index:Number(target);
   const next:Drag={source:g.index,target:Number.isInteger(n)&&n>=0&&n<photos.length?n:g.index,x:event.clientX,y:event.clientY};
   dragRef.current=next;setDrag(next);
 };
 const onUp=(event:ReactPointerEvent<HTMLDivElement>)=>{
   const g=gesture.current;
   if(!g||g.pointerId!==event.pointerId)return;
   const finished=dragRef.current;
   clear();
   if(finished&&finished.source!==finished.target)movePhoto(finished.source,finished.target);
 };
 const onInput=(e:ChangeEvent<HTMLInputElement>)=>{
   const selected=Array.from(e.currentTarget.files??[]);
   e.currentTarget.value="";
   setError("");
   if(selected.length) addPhotos(selected);
 };
 return <div className="photo-sorter">
   <input ref={input} className="native-photo-input" type="file" accept="image/jpeg,image/png,image/webp" multiple
     onChange={onInput} aria-label="Добавить фотографии"/>
   <div className="mosaic" aria-label="Мозаика фотографий">{Array.from({length:6},(_,i)=>{
     const photo=photos[i];
     return <div key={photo?.id??"empty-"+i} data-slot={i}
       className={"mosaic-slot"+(i===0?" mosaic-main":"")+(drag?.target===i&&drag.source!==i?" drop-target":"")+(drag?.source===i?" drag-source":"")}
       onPointerDown={e=>onDown(e,i)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={clear}
       onContextMenu={e=>e.preventDefault()}>
       {photo?<><img src={photo.src} alt={"Фото "+(i+1)} draggable={false}/>
           <span className="slot-index">{i+1}</span>
           {i===0&&<span className="primary-photo">Главное</span>}
           <button className="remove-photo" type="button" aria-label={"Удалить фото "+(i+1)} onClick={()=>removePhoto(photo.id)}><X size={15}/></button>
           <div className="photo-reorder-buttons">
             <button type="button" disabled={i===0} aria-label={"Фото "+(i+1)+": раньше"} onClick={()=>movePhoto(i,i-1)}><ArrowLeft size={13}/></button>
             <button type="button" disabled={i===photos.length-1} aria-label={"Фото "+(i+1)+": позже"} onClick={()=>movePhoto(i,i+1)}><ArrowRight size={13}/></button>
           </div>
         </>:i===photos.length?
         <button className="add-photo" type="button" onClick={()=>input.current?.click()} aria-label="Добавить фотографии"><Plus size={31}/></button>:
         <span className="empty-number">{i+1}</span>}
     </div>})}</div>
   {drag&&photos[drag.source]&&<div className="photo-drag-ghost" style={{left:drag.x,top:drag.y}} aria-hidden="true">
     <img src={photos[drag.source].src} alt=""/><GripVertical size={18}/>
   </div>}
   <div className="sort-tip"><GripVertical size={16}/><span>Удерживай фото около 0,3 секунды, затем перенеси. Первое фото — главное.</span></div>
   <p className="photo-count" role="status">Выбрано: {photos.length} из 6</p>
   {error&&<p role="alert">{error}</p>}
   <p className="hint">Для публикации потребуется 3–6 разрешённых модерацией фото. Сейчас они хранятся только в памяти открытого приложения.</p>
 </div>;
}
