import {useCallback,useEffect,useRef,useState} from "react";
import type {PointerEvent} from "react";
import {ArrowLeft,ArrowRight,X} from "lucide-react";

type Point={x:number;y:number};
type Gesture={x:number;y:number;distance:number;scale:number;offset:Point};
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const reduced=()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function ChatPhotoViewer({src,gallery=[],onClose}:{src:string;gallery?:string[];onClose:()=>void}){
 const photos=[...new Set([...gallery.filter(Boolean),src])];
 const [index,setIndex]=useState(()=>Math.max(0,photos.indexOf(src)));
 const [scale,setScale]=useState(1);
 const [offset,setOffset]=useState<Point>({x:0,y:0});
 const points=useRef(new Map<number,Point>());
 const gesture=useRef<Gesture|null>(null);
 const currentScale=useRef(1);
 const currentOffset=useRef<Point>({x:0,y:0});
 const lastTap=useRef(0);
 const moved=useRef(false);
 const img=useRef<HTMLImageElement>(null);
 const activeIndex=Math.min(index,photos.length-1);
 const setTransform=useCallback((nextScale:number,nextOffset:Point)=>{
  currentScale.current=nextScale;currentOffset.current=nextOffset;
  setScale(nextScale);setOffset(nextOffset);
 },[]);
 const reset=useCallback(()=>{setTransform(1,{x:0,y:0});points.current.clear();gesture.current=null;},[setTransform]);
 const go=useCallback((direction:number)=>{
  const next=activeIndex+direction;
  if(next<0||next>=photos.length)return;
  reset();setIndex(next);
 },[activeIndex,photos.length,reset]);
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{
   if(event.key==="Escape")onClose();
   if(event.key==="ArrowRight"&&activeIndex<photos.length-1)go(1);
   if(event.key==="ArrowLeft"&&activeIndex>0)go(-1);
  };
  window.addEventListener("keydown",key);
  return()=>window.removeEventListener("keydown",key);
 },[activeIndex,photos.length,onClose,go]);
 const startGesture=()=>{
  const values=[...points.current.values()];
  if(!values.length){gesture.current=null;return;}
  const center=values.length>1?{x:(values[0].x+values[1].x)/2,y:(values[0].y+values[1].y)/2}:values[0];
  gesture.current={x:center.x,y:center.y,distance:values.length>1?distance(values[0],values[1]):0,
   scale:currentScale.current,offset:{...currentOffset.current}};
 };
 const onDown=(event:PointerEvent<HTMLDivElement>)=>{
  if((event.target as Element).closest("button"))return;
  if(event.pointerType==="mouse"&&event.button!==0)return;
  try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* webview */}
  points.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
  moved.current=false;startGesture();
 };
 const onMove=(event:PointerEvent<HTMLDivElement>)=>{
  if(!points.current.has(event.pointerId)||!gesture.current)return;
  points.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
  const values=[...points.current.values()],start=gesture.current;
  if(values.length>=2&&start.distance>0){
   const ratio=distance(values[0],values[1])/Math.max(1,start.distance);
   const next=Math.max(1,Math.min(4,start.scale*ratio));
   const center={x:(values[0].x+values[1].x)/2,y:(values[0].y+values[1].y)/2};
   moved.current=true;
   setTransform(next,{x:start.offset.x+center.x-start.x,y:start.offset.y+center.y-start.y});
  }else if(values.length===1){
   const dx=values[0].x-start.x,dy=values[0].y-start.y;
   if(Math.hypot(dx,dy)>8)moved.current=true;
   const x=start.offset.x+dx,y=start.offset.y+dy;
   if(currentScale.current<=1)setTransform(1,{x,y});
   else {
    const limitX=window.innerWidth*(currentScale.current-1)/2;
    const limitY=window.innerHeight*(currentScale.current-1)/2;
    setTransform(currentScale.current,{x:Math.max(-limitX,Math.min(limitX,x)),y:Math.max(-limitY,Math.min(limitY,y))});
   }
  }
 };
 const onUp=(event:PointerEvent<HTMLDivElement>)=>{
  if(!points.current.has(event.pointerId))return;
  points.current.delete(event.pointerId);
  if(points.current.size){startGesture();return;}
  gesture.current=null;
  if(currentScale.current>1)return;
  const {x,y}=currentOffset.current;
  if(Math.abs(y)>110&&Math.abs(y)>Math.abs(x)*1.15){onClose();return;}
  if(Math.abs(x)>90&&Math.abs(x)>Math.abs(y)*1.1){
   if(x<0&&activeIndex<photos.length-1){go(1);return;}
   if(x>0&&activeIndex>0){go(-1);return;}
  }
  setTransform(1,{x:0,y:0});
 };
 const tap=()=>{
  if(moved.current){moved.current=false;return;}
  const now=performance.now();
  if(now-lastTap.current<320){
   const next=currentScale.current>1?1:2.5;
   setTransform(next,{x:0,y:0});lastTap.current=0;
  }else lastTap.current=now;
 };
 return <div className="lc-viewer" role="dialog" aria-modal="true" aria-label="Просмотр фотографии"
  onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
  onClick={tap} data-zoomed={scale>1||undefined} data-reduced={reduced()||undefined}>
  <div className="lc-viewer-top">
   <span className="lc-viewer-counter">{photos.length>1?`${activeIndex+1} / ${photos.length}`:"Фото"}</span>
   <button type="button" className="lc-viewer-close" aria-label="Закрыть" onClick={event=>{event.stopPropagation();onClose();}}><X size={22}/></button>
  </div>
  <img ref={img} src={photos[activeIndex]??src} alt="Фотография из сообщения" draggable={false}
   style={{transform:`translate3d(${offset.x}px,${offset.y}px,0) scale(${scale})`}}/>
  {photos.length>1&&scale===1&&<div className="lc-viewer-controls">
   <button type="button" aria-label="Предыдущее фото" disabled={activeIndex===0} onClick={event=>{event.stopPropagation();go(-1);}}><ArrowLeft size={20}/></button>
   <button type="button" aria-label="Следующее фото" disabled={activeIndex===photos.length-1} onClick={event=>{event.stopPropagation();go(1);}}><ArrowRight size={20}/></button>
  </div>}
 </div>;
}
