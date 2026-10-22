import {useEffect,useLayoutEffect,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {createPortal} from "react-dom";
import {X,MoreHorizontal,ChevronLeft,ChevronRight,Lock,Star,Share2,Link2,Flag as ReportIcon} from "lucide-react";
import type {ProfilePhoto,ProfileView} from "./ProfileModel";
import {canMakeMain,displayPhotoDate} from "./ProfileModel";
import {photoIndex,reconcilePhotoId,requestNavigation as navigatePhoto,resourceIdentity,
 sourceMatches,type ViewerSource,type NavigationRequest,type NavigationOrigin} from "./photo-viewer-state";
import {PhotoReadiness} from "./photo-readiness";

type Props={view:ProfileView;photos:ProfilePhoto[];initialPhotoId:string;source:ViewerSource|null;contextId:string;
 onClose:()=>void;onMain?:(id:string)=>boolean|Promise<boolean>;
 registerBack?:(handler:(()=>boolean)|null)=>void};
type Gesture={id:number;x:number;y:number;time:number;axis:""|"x"|"y";startPhotoId:string|null;pinch:boolean};
const duration=240;
export function PhotoViewer({view,photos,initialPhotoId,source,contextId,onClose,onMain,registerBack}:Props){
 const [committedPhotoId,setCommittedPhotoId]=useState<string|null>(initialPhotoId);
 const previousIds=useRef(photos.map(p=>p.id));
 const photoId=reconcilePhotoId(committedPhotoId,previousIds.current,photos);
 const index=photoIndex(photos,photoId);
 const show=index>=0?photos[index]:null;
 const mediaRef=useRef<PhotoReadiness|null>(null);
 const [,refreshMedia]=useState(0);
 if(!mediaRef.current||mediaRef.current.isDisposed())
  mediaRef.current=new PhotoReadiness(()=>refreshMedia(v=>v+1));
 const media=mediaRef.current.read(show);
 const resourceKey=show?resourceIdentity(show):null;
 const readyKey=media?.phase==="ready"?media.key+"|"+media.src+"|"+media.generation:null;
 const [displayReadyKey,setDisplayReadyKey]=useState<string|null>(null);
 const displayReady=!!readyKey&&displayReadyKey===readyKey;
 const [menu,setMenu]=useState(false);
 const [message,setMessage]=useState("");
 const stage=useRef<HTMLDivElement>(null);
 const image=useRef<HTMLImageElement>(null);
 const pointer=useRef(new Map<number,{x:number;y:number}>());
 const gesture=useRef<Gesture|null>(null);
 const zoom=useRef(1);
 const closing=useRef(false);
 const pinch=useRef<{distance:number;cx:number;cy:number}|null>(null);
 const sourceRef=useRef(source);
 const contextRef=useRef(contextId);
 const cleanup=useRef<number|null>(null);
 const openFrames=useRef<number[]>([]);
 const latest=useRef({photoId,photos,show,index,resourceKey,displayReady,view,onMain});
 latest.current={photoId,photos,show,index,resourceKey,displayReady,view,onMain};
 const handlers=useRef<{close:()=>void;navigate:(target:NavigationRequest,origin:NavigationOrigin)=>boolean}>({
  close:()=>{},navigate:()=>false
 });
 const animate=(out:boolean)=>{
  const layer=stage.current,img=image.current;if(!layer||!img)return;
  const valid=sourceMatches(sourceRef.current,latest.current.photoId,
   contextRef.current,latest.current.resourceKey);
  const from=valid?sourceRef.current?.resolveElement()?.getBoundingClientRect():null;
  const usable=from&&from.width>8&&from.height>8&&from.bottom>0&&from.top<innerHeight;
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(!usable||reduce){layer.style.opacity=out?"0":"1";img.style.transform="";return;}
  const sx=from.width/innerWidth,sy=from.height/innerHeight;
  const x=from.left+(from.width-innerWidth)/2;
  const y=from.top+(from.height-innerHeight)/2;
  img.style.transform=out?"translate3d("+x+"px,"+y+"px,0) scale("+sx+","+sy+")":"none";
  layer.style.opacity=out?"0":"1";
 };
 useLayoutEffect(()=>{
  const layer=stage.current,img=image.current;if(!layer||!img)return;
  layer.style.opacity="0";
  if(sourceRef.current)animate(true);
  openFrames.current.push(requestAnimationFrame(()=>{
   openFrames.current.push(requestAnimationFrame(()=>{if(!closing.current)animate(false);}));
  }));
  return ()=>{openFrames.current.forEach(cancelAnimationFrame);openFrames.current=[];};
 },[]);
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){
    event.stopImmediatePropagation();event.preventDefault();handlers.current.close();
   }else if(event.key==="ArrowRight"||event.key==="ArrowLeft"){
    event.stopImmediatePropagation();event.preventDefault();
    handlers.current.navigate({direction:event.key==="ArrowRight"?1:-1},"keyboard");
   }
  };
  window.addEventListener("keydown",key,true);
  return ()=>window.removeEventListener("keydown",key,true);
 },[]);
 useEffect(()=>{
  const old=document.body.style.overflow;document.body.style.overflow="hidden";
  return ()=>{
   document.body.style.overflow=old;
   if(cleanup.current!==null)clearTimeout(cleanup.current);
   mediaRef.current?.dispose();
  };
 },[]);
 useEffect(()=>{
  let cache=mediaRef.current;
  if(!cache||cache.isDisposed()){
   cache=new PhotoReadiness(()=>refreshMedia(v=>v+1));mediaRef.current=cache;
  }
  cache.updateWindow(photos,photoId);
 },[photos,photoId]);
 useLayoutEffect(()=>{
  previousIds.current=photos.map(p=>p.id);
  if(photoId!==committedPhotoId){
   sourceRef.current=null;
   setCommittedPhotoId(photoId);
  }
 },[photos,photoId,committedPhotoId]);
 useEffect(()=>{
  // If the last accessible photo disappears while its menu is open, first
  // dismiss the menu and then terminate the viewer on the following render.
  if(photoId===null)handlers.current.close();
 },[photoId,menu]);
 // The preloader's decode is only a cache hint. The actual displayed img
 // must decode under the same generation/key before its pixels are exposed.
 useEffect(()=>{
  if(!show||!readyKey||!media?.src)return;
  const node=image.current;
  if(!node||node.dataset.mediaKey!==readyKey)return;
  let cancelled=false;
  const success=()=>{
   if(cancelled||node!==image.current||node.dataset.mediaKey!==readyKey)return;
   if(node.naturalWidth>0&&node.naturalHeight>0)setDisplayReadyKey(readyKey);
   else mediaRef.current?.reportDisplayFailure(show,"display-dimensions-invalid");
  };
  Promise.resolve().then(()=>node.decode()).then(success).catch(()=>{
   if(!cancelled&&node===image.current&&node.dataset.mediaKey===readyKey)
    mediaRef.current?.reportDisplayFailure(show,"display-decode-failed");
  });
  return ()=>{cancelled=true;};
 },[show,readyKey,media?.src]);
 const requestClose=()=>{
  if(menu){setMenu(false);return;}
  if(closing.current)return;
  closing.current=true;
  openFrames.current.forEach(cancelAnimationFrame);openFrames.current=[];
  pointer.current.clear();pinch.current=null;zoom.current=1;
  const img=image.current;if(img){img.style.transition="transform "+duration+"ms cubic-bezier(.2,.8,.2,1)";img.style.transform="none";}
  animate(true);
  cleanup.current=window.setTimeout(onClose,matchMedia("(prefers-reduced-motion: reduce)").matches?0:duration+30);
 };
 useEffect(()=>{
  if(!registerBack)return;
  const handle=()=>{handlers.current.close();return true;};
  registerBack(handle);
  return ()=>registerBack(null);
 },[registerBack]);
 const resetGesture=()=>{
  gesture.current=null;pointer.current.clear();pinch.current=null;zoom.current=1;
  if(image.current){image.current.style.transition="transform 230ms cubic-bezier(.2,.75,.2,1)";image.current.style.transform="none";}
  if(stage.current)stage.current.style.opacity="1";
 };
 const requestNavigation=(request:NavigationRequest,_origin:NavigationOrigin):boolean=>{
  if(closing.current)return false;
  const selected=latest.current;
  const target=navigatePhoto(selected.photoId,selected.photos,request);
  if(!target||target===selected.photoId)return false;
  sourceRef.current=null;
  resetGesture();setMenu(false);setMessage("");
  setDisplayReadyKey(null);setCommittedPhotoId(target);
  return true;
 };
 handlers.current={close:requestClose,navigate:requestNavigation};
 const down=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(closing.current||menu||(e.pointerType==="mouse"&&e.button!==0))return;
  pointer.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointer.current.size===1){
   gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),axis:"",
    startPhotoId:latest.current.photoId,pinch:false};
  }else if(pointer.current.size===2){
   const g=gesture.current;if(g)g.pinch=true;
   const [a,b]=[...pointer.current.values()];
   pinch.current={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),cx:(a.x+b.x)/2,cy:(a.y+b.y)/2};
  }
 };
 const move=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(!pointer.current.has(e.pointerId)||closing.current||menu)return;
  pointer.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const active=[...pointer.current.values()];
  if(active.length>=2){
   const g=gesture.current;if(g)g.pinch=true;
   const origin=pinch.current;if(!origin)return;
   const dist=Math.hypot(active[0].x-active[1].x,active[0].y-active[1].y);
   const cx=(active[0].x+active[1].x)/2,cy=(active[0].y+active[1].y)/2;
   zoom.current=Math.max(1,Math.min(3.2,dist/origin.distance));
   const maxX=(zoom.current-1)*innerWidth/2,maxY=(zoom.current-1)*innerHeight/2;
   const x=Math.max(-maxX,Math.min(maxX,cx-origin.cx)),y=Math.max(-maxY,Math.min(maxY,cy-origin.cy));
   if(image.current){
    image.current.style.transition="none";
    image.current.style.transform="translate3d("+x+"px,"+y+"px,0) scale("+zoom.current+")";
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
   image.current.style.transform=g.axis==="x"?
    "translate3d("+(dx*.55)+"px,0,0)":
    "translate3d(0,"+(dy*.78)+"px,0) scale("+Math.max(.85,1-Math.abs(dy)/2300)+")";
  }
  if(g.axis==="y"&&stage.current)stage.current.style.opacity=String(Math.max(.35,1-Math.abs(dy)/700));
 };
 const finish=(e:ReactPointerEvent<HTMLDivElement>,cancel:boolean)=>{
  if(!pointer.current.has(e.pointerId))return;
  pointer.current.delete(e.pointerId);
  const g=gesture.current;if(pointer.current.size)return;
  pinch.current=null;
  if(!g){resetGesture();return;}
  gesture.current=null;
  if(g.pinch||zoom.current!==1){resetGesture();return;}
  const dx=e.clientX-g.x,dy=e.clientY-g.y,elapsed=Math.max(1,performance.now()-g.time);
  if(!cancel&&g.axis==="y"&&(Math.abs(dy)>110||Math.abs(dy)/elapsed>.8)){requestClose();return;}
  if(!cancel&&g.axis==="x"&&(Math.abs(dx)>innerWidth*.17||Math.abs(dx)/elapsed>.52)&&
   g.startPhotoId===latest.current.photoId)
   requestNavigation({direction:dx<0?1:-1},"swipe");
  resetGesture();
 };
 const action=(kind:"main"|"link"|"share"|"report")=>{
  const selected=latest.current;setMenu(false);
  if(kind==="main"){
   if(!selected.show||!selected.displayReady||!selected.onMain||
    !canMakeMain(selected.view,selected.show.id)){
    setMessage("Для изменения главной фотографии требуется подтверждённое сохранение.");return;
   }
   const id=selected.show.id,originalKey=resourceIdentity(selected.show);
   Promise.resolve(selected.onMain(id)).then(saved=>{
    if(closing.current||latest.current.photoId!==id||!latest.current.show||
     resourceIdentity(latest.current.show)!==originalKey)return;
    setMessage(saved?"Главная фотография сохранена":"Сохранение главной фотографии не подтверждено.");
   }).catch(()=>{
    if(!closing.current&&latest.current.photoId===id)setMessage("Не удалось сохранить главную фотографию.");
   });
   return;
  }
  setMessage(kind==="report"?"Жалобы станут доступны после запуска модерации. Ничего не отправлено.":
   kind==="link"?"Постоянная ссылка пока недоступна":"Публикация и отправка ссылки пока недоступны");
 };
 return createPortal(<section className="pm-viewer" role="dialog" aria-modal="true" aria-label="Просмотр фото">
  <div className="pm-viewer-stage" ref={stage} onPointerDown={down} onPointerMove={move}
    onPointerUp={e=>finish(e,false)} onPointerCancel={e=>{if(pointer.current.has(e.pointerId))resetGesture();}}>
   <img ref={image} key={readyKey??resourceKey??"no-photo"}
    data-photo-id={photoId??undefined} data-media-key={readyKey??undefined}
    className="pm-viewer-image" src={media?.phase==="ready"?media.src??undefined:undefined}
    style={{opacity:displayReady?1:0}} alt={show?"Фото "+(index+1):"Фото недоступно"}
    draggable={false} onError={()=>{if(show)mediaRef.current?.reportDisplayFailure(show,"display-load-failed");}}/>
   {!displayReady&&<div className="pm-viewer-media-status" role="status" data-photo-id={photoId??undefined}
     data-media-phase={media?.phase??"idle"}>
     {media?.phase==="error"?<>
      <span>Не удалось загрузить фотографию</span>
      <button type="button" className="pm-viewer-retry" onClick={()=>{if(show)mediaRef.current?.retry(show);}}>Повторить</button>
     </>:photoId===null?"Фотография недоступна":"Загрузка фотографии…"}
   </div>}
  </div>
  <header className="pm-viewer-top">
   <span className="pm-viewer-topspacer"/><span>{index>=0?index+1:0} / {photos.length}</span>
   <button type="button" onClick={requestClose} aria-label="Закрыть просмотр"><X size={22}/></button>
  </header>
  <footer className="pm-viewer-bottom">
   <span>{show?displayPhotoDate(show):"Дата не указана"}</span>
   <div className="pm-viewer-actions">
    <button type="button" disabled={index<=0||closing.current}
     onClick={()=>requestNavigation({direction:-1},"button")} aria-label="Предыдущее фото"><ChevronLeft size={21}/></button>
    <button type="button" disabled={index<0||index===photos.length-1||closing.current}
     onClick={()=>requestNavigation({direction:1},"button")} aria-label="Следующее фото"><ChevronRight size={21}/></button>
    <button type="button" onClick={()=>setMenu(v=>!v)} aria-label="Действия с фото"><MoreHorizontal size={23}/></button>
   </div>
  </footer>
  {menu&&<div className="pm-viewer-menu-backdrop" onClick={()=>setMenu(false)}>
    <div className="pm-viewer-menu" role="menu" onClick={e=>e.stopPropagation()}>
     {view.mode==="owner"&&<button type="button" role="menuitem" disabled={!show||!displayReady||!onMain||!canMakeMain(view,show.id)}
      onClick={()=>action("main")}><Star size={18}/> Сделать главным {!view.published&&<Lock size={14}/>}</button>}
     <button type="button" role="menuitem" disabled={!displayReady} onClick={()=>action("link")}><Link2 size={18}/> Скопировать ссылку</button>
     <button type="button" role="menuitem" disabled={!displayReady} onClick={()=>action("share")}><Share2 size={18}/> Поделиться</button>
     {view.mode==="visitor"&&<button type="button" role="menuitem" onClick={()=>action("report")}><ReportIcon size={18}/> Пожаловаться</button>}
     <button type="button" onClick={()=>setMenu(false)}>Отмена</button>
    </div>
   </div>}
   {message&&<div className="pm-viewer-message" role="status" onClick={()=>setMessage("")}>{message}</div>}
 </section>,document.body);
}
