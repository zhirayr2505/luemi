import {useCallback,useEffect,useRef,useState} from "react";
import type {ChangeEvent,PointerEvent as ReactPointerEvent} from "react";
import {createPortal} from "react-dom";
import {ArrowLeft,Eye,Globe2,ImagePlus,LockKeyhole,Pause,Play,Sparkles,Volume2,VolumeX,X} from "lucide-react";
import {useModalLayer} from "../ui/modal-layer";
import {BlikMediaSession} from "./bliki-media-lifecycle";
import "./bliki-studio.css";

type Draft={id:string;url:string;kind:"image"|"video";name:string};
type Audience="public"|"matches";
const types=new Map([["image/jpeg","image"],["image/png","image"],
 ["image/webp","image"],["video/mp4","video"],["video/webm","video"]] as const);
const imageLimit=24*1024*1024,videoLimit=64*1024*1024;

/** Local authoring only. Object URLs must never become profile/Bliki publication URLs. */
export function BlikiStudio({name,canCreate,registerViewerBack}:{
 name:string;canCreate:boolean;registerViewerBack?:(back:(()=>boolean)|null)=>void;
}){
 const [drafts,setDrafts]=useState<Draft[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [audience,setAudience]=useState<Audience>("public"),[world,setWorld]=useState(false);
 const [viewer,setViewer]=useState<string|null>(null);
 const input=useRef<HTMLInputElement>(null),urls=useRef(new Set<string>()),draftsLive=useRef(drafts);
 const alive=useRef(true),processing=useRef(false);
 const railGesture=useRef<{id:number;x:number;left:number;moved:boolean}|null>(null),suppressClick=useRef(0);
 draftsLive.current=drafts;
 useEffect(()=>{alive.current=true;return ()=>{alive.current=false;
  for(const url of urls.current)URL.revokeObjectURL(url);urls.current.clear();};},[]);
 const remove=useCallback((id:string)=>{
  const item=draftsLive.current.find(d=>d.id===id);
  if(!item)return;
  setViewer(current=>current===id?null:current);
  setDrafts(current=>current.filter(d=>d.id!==id));
  urls.current.delete(item.url);URL.revokeObjectURL(item.url);
 },[]);
 const choose=async(event:ChangeEvent<HTMLInputElement>)=>{
  const files=Array.from(event.target.files??[]);event.target.value="";
  if(!files.length||processing.current)return;
  processing.current=true;setBusy(true);
  const accepted:Draft[]=[];
  for(const file of files){
   if(!alive.current)break;
   if(draftsLive.current.length+accepted.length>=5){setError("Одновременно можно подготовить не более пяти Бликов.");break;}
   const kind=types.get(file.type);
   if(!kind){setError("Для предпросмотра выбери JPG, PNG, WebP, MP4 или WebM.");continue;}
   if(file.size>(kind==="image"?imageLimit:videoLimit)){
    setError("Файл слишком большой для безопасного предпросмотра на устройстве.");continue;
   }
   const url=URL.createObjectURL(file);
   urls.current.add(url);
   if(kind==="video"){
    const duration=await new Promise<number|null>(resolve=>{
     const probe=document.createElement("video");let done=false;
     const finish=(value:number|null)=>{if(done)return;done=true;clearTimeout(timeout);
      probe.removeAttribute("src");probe.load();resolve(value);};
     const timeout=window.setTimeout(()=>finish(null),8000);
     probe.preload="metadata";probe.onloadedmetadata=()=>finish(probe.duration);
     probe.onerror=()=>finish(null);probe.src=url;
    });
    if(duration===null||!Number.isFinite(duration)||duration<=0||duration>30){
     urls.current.delete(url);URL.revokeObjectURL(url);
     if(alive.current)setError("Видео должно корректно открываться и длиться не более 30 секунд.");continue;
    }
   }
   if(!alive.current){urls.current.delete(url);URL.revokeObjectURL(url);break;}
   accepted.push({id:crypto.randomUUID(),url,kind,name:file.name});
  }
  if(alive.current&&accepted.length){setDrafts(current=>[...current,...accepted]);
   if(accepted.length===files.length)setError("");}
  processing.current=false;if(alive.current)setBusy(false);
 };
 return <div className="bliki-studio">
   <div className="bliki-studio-intro">
    <span className="bliki-studio-icon"><Sparkles size={25}/></span>
    <h3>{canCreate?"Твои Блики":"Блики"}</h3>
    <p>{canCreate?"Публикуемые моменты живут 24 часа. Здесь доступен только локальный предпросмотр: медиа не загружается и никому не показывается.":
     "Здесь появятся доступные моменты из жизни после запуска защищённой публикации."}</p>
   </div>
   {canCreate?<>
    <div className="bliki-studio-actions">
     <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
      multiple hidden onChange={event=>{void choose(event);}}/>
     <button type="button" onClick={()=>input.current?.click()} disabled={busy||drafts.length>=5}>
      <ImagePlus size={19}/> Добавить фото или видео</button>
     <span>{drafts.length}/5 · только на этом устройстве</span>
    </div>
    {error&&<p className="bliki-studio-error" role="alert">{error}</p>}
    {!!drafts.length&&<>
     <div className="bliki-studio-drafts" aria-label="Локальные предпросмотры"
      onPointerDown={e=>{e.stopPropagation();railGesture.current={id:e.pointerId,x:e.clientX,
       left:e.currentTarget.scrollLeft,moved:false};}}
      onPointerMove={e=>{e.stopPropagation();const g=railGesture.current;
       if(!g||g.id!==e.pointerId)return;
       if(Math.abs(e.clientX-g.x)>6&&!g.moved){g.moved=true;
        try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* implicit */}}
       if(g.moved)e.currentTarget.scrollLeft=g.left-(e.clientX-g.x);}}
      onPointerUp={e=>{e.stopPropagation();if(railGesture.current?.id===e.pointerId){
       if(railGesture.current.moved)suppressClick.current=performance.now()+250;
       railGesture.current=null;}}}
      onPointerCancel={e=>{e.stopPropagation();railGesture.current=null;}}
      onLostPointerCapture={e=>{e.stopPropagation();railGesture.current=null;}}
      onClickCapture={e=>{if(performance.now()<suppressClick.current){e.preventDefault();e.stopPropagation();}}}>
      {drafts.map((item,i)=><div className="bliki-studio-draft" key={item.id}>
       <button type="button" className="bliki-studio-thumb" onClick={()=>setViewer(item.id)}
        aria-label={"Предпросмотр Блика "+(i+1)+": "+item.name}>
        {item.kind==="image"?<img src={item.url} alt="" draggable={false}/>:
         <span className="bliki-studio-video"><Play size={25}/><small>Видео</small></span>}
        <span>Предпросмотр</span>
       </button>
       <button type="button" className="bliki-studio-remove" onClick={()=>remove(item.id)}
        aria-label={"Убрать "+item.name}><X size={16}/></button>
      </div>)}
     </div>
     <fieldset className="bliki-studio-audience">
      <legend>Кто сможет видеть после публикации</legend>
      <label><input type="radio" checked={audience==="public"}
       onChange={()=>setAudience("public")}/> Всем подходящим</label>
      <label><input type="radio" checked={audience==="matches"}
       onChange={()=>{setAudience("matches");setWorld(false);}}/> Только мэтчам</label>
      <label className="bliki-studio-world"><input type="checkbox" checked={world}
       disabled={audience!=="public"} onChange={event=>setWorld(event.target.checked)}/>
       <Globe2 size={16}/> Показывать в «Мире»</label>
     </fieldset>
     <p className="bliki-studio-notice"><LockKeyhole size={16}/>
      Выбор пока не сохраняется. Серверная публикация откроется после проверки приватности, модерации и хранения медиа.</p>
    </>}
   </>:<p className="bliki-studio-notice"><Eye size={16}/> У этого профиля пока нет доступных опубликованных Бликов.</p>}
   {viewer&&createPortal(<BlikiDraftViewer key={viewer} drafts={drafts} selected={viewer} name={name}
    onClose={()=>setViewer(null)} onSelect={setViewer} registerBack={registerViewerBack}/>,document.body)}
  </div>;
}

function BlikiDraftViewer({drafts,selected,name,onClose,onSelect,registerBack}:{
 drafts:Draft[];selected:string;name:string;onClose:()=>void;onSelect:(id:string)=>void;
 registerBack?:(back:(()=>boolean)|null)=>void;
}){
 const root=useRef<HTMLDivElement>(null),media=useRef<HTMLVideoElement|null>(null);
 const [videoPaused,setVideoPaused]=useState(false),[mediaError,setMediaError]=useState(false);
 const [muted,setMuted]=useState(true);
 const progress=useRef<HTMLSpanElement>(null),session=useRef(new BlikMediaSession());
 const frame=useRef<number|null>(null),pointer=useRef<{id:number;x:number;y:number;t:number;held:boolean}|null>(null);
 const holdTimer=useRef<number|null>(null),visible=useRef(true),manualPaused=useRef(false);
 const index=drafts.findIndex(d=>d.id===selected),item=drafts[index];
 useModalLayer(true,root,onClose);
 useEffect(()=>{registerBack?.(()=>{onClose();return true;});return ()=>registerBack?.(null);},[onClose,registerBack]);
 const cancelFrame=()=>{if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null;}};
 const paintProgress=(p:number)=>{if(progress.current)progress.current.style.transform=`scaleX(${Math.max(0,Math.min(1,p))})`;};
 const next=()=>{if(index+1<drafts.length)onSelect(drafts[index+1].id);else onClose();};
 const previous=()=>{if(index>0)onSelect(drafts[index-1].id);};
 const nextLive=useRef(next);nextLive.current=next;
 const tick=()=>{
  frame.current=null;const token=session.current.currentGeneration(),snapshot=session.current.snapshot();
  if(snapshot.phase!=="playing")return;
  paintProgress(session.current.progress(performance.now()));
  if(session.current.progress()>=1){if(session.current.endedOnce(token))nextLive.current();return;}
  frame.current=requestAnimationFrame(tick);
 };
 const startClock=()=>{cancelFrame();if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  frame.current=requestAnimationFrame(tick);};
 useEffect(()=>{
  if(!item){onClose();return;}
  const token=session.current.begin(item.kind,6000);
  paintProgress(0);visible.current=!document.hidden;
  session.current.visibility(token,visible.current,performance.now());
  const onVisibility=()=>{
   const showing=!document.hidden;visible.current=showing;
   session.current.visibility(token,showing,performance.now());
   if(!showing){cancelFrame();media.current?.pause();pointer.current=null;
    if(holdTimer.current!==null){clearTimeout(holdTimer.current);holdTimer.current=null;}
    root.current?.classList.remove("is-dragging");root.current?.style.setProperty("--blik-pull","0px");}
   else if(item.kind==="image")startClock();
   else if(!manualPaused.current)void media.current?.play().catch(()=>{});
  };
  document.addEventListener("visibilitychange",onVisibility);
  return ()=>{document.removeEventListener("visibilitychange",onVisibility);
   cancelFrame();if(holdTimer.current!==null)clearTimeout(holdTimer.current);
   media.current?.pause();session.current.cleanup();};
 // The selected draft is keyed; each switch owns a fresh media generation.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[selected]);
 if(!item)return null;
 const releaseHold=()=>{
  if(holdTimer.current!==null){clearTimeout(holdTimer.current);holdTimer.current=null;}
  if(pointer.current?.held){pointer.current.held=false;
   session.current.hold(session.current.currentGeneration(),manualPaused.current,performance.now());
   if(item.kind==="video"&&!manualPaused.current&&visible.current)
    void media.current?.play().catch(()=>{});
   else if(item.kind==="image"&&visible.current)startClock();}
 };
 const down=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(!e.isPrimary||e.pointerType==="mouse"&&e.button!==0)return;
  pointer.current={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now(),held:false};
  root.current?.classList.add("is-dragging");
  holdTimer.current=window.setTimeout(()=>{
   if(!pointer.current||pointer.current.id!==e.pointerId)return;
   pointer.current.held=true;session.current.hold(session.current.currentGeneration(),true,performance.now());
   cancelFrame();media.current?.pause();
  },220);
  try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* implicit */}
 };
 const move=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const g=pointer.current;if(!g||g.id!==e.pointerId)return;
  if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>12&&holdTimer.current!==null){clearTimeout(holdTimer.current);holdTimer.current=null;}
  if(e.clientY-g.y>0&&Math.abs(e.clientY-g.y)>Math.abs(e.clientX-g.x))
   root.current?.style.setProperty("--blik-pull",Math.min(120,(e.clientY-g.y)*.55)+"px");
 };
 const up=(e:ReactPointerEvent<HTMLDivElement>,cancel=false)=>{
  const g=pointer.current;if(!g||g.id!==e.pointerId)return;
  const held=g.held;releaseHold();pointer.current=null;
  root.current?.classList.remove("is-dragging");
  root.current?.style.setProperty("--blik-pull","0px");
  if(cancel||held)return;
  const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(dy>75&&Math.abs(dy)>Math.abs(dx)){onClose();return;}
  if(Math.abs(dx)>55){if(dx<0)next();else previous();return;}
  if(Math.hypot(dx,dy)<12){if(e.clientX<window.innerWidth*.38)previous();else next();}
 };
 return <div className="bliki-viewer" ref={root} role="dialog" aria-modal="true"
  aria-label="Локальный предпросмотр Блика" tabIndex={-1}
  onPointerDown={e=>e.stopPropagation()} onPointerMove={e=>e.stopPropagation()}
  onPointerUp={e=>e.stopPropagation()} onPointerCancel={e=>e.stopPropagation()}
  onClick={e=>e.stopPropagation()}>
   <div className="bliki-viewer-motion">
    {item.kind==="image"?<img src={item.url} alt="Локальный предпросмотр"
     onLoad={e=>{const image=e.currentTarget,token=session.current.currentGeneration();
      session.current.loaded(token);
      void (image.decode?.()??Promise.resolve()).then(()=>{
       if(!session.current.decoded(token))return;
       session.current.imageReadyToPlay(token,performance.now());startClock();
      }).catch(()=>{
       if(token!==session.current.currentGeneration()||session.current.snapshot().closed)return;
       // Some WebViews reject decode() after onLoad despite retaining decoded pixels.
       if(image.complete&&image.naturalWidth>0&&session.current.decoded(token)){
        session.current.imageReadyToPlay(token,performance.now());startClock();return;
       }
       session.current.error(token);setMediaError(true);
      });}}
     onError={()=>{session.current.error(session.current.currentGeneration());setMediaError(true);}} draggable={false}/>:
     <video ref={media} src={item.url} playsInline preload="metadata" autoPlay muted
      onPlaying={()=>{const token=session.current.currentGeneration();
       session.current.videoReady(token,performance.now());session.current.playing(token,performance.now());
       setVideoPaused(false);}}
      onPause={()=>setVideoPaused(true)}
      onWaiting={()=>session.current.buffering(session.current.currentGeneration(),performance.now())}
      onTimeUpdate={e=>{session.current.videoTime(session.current.currentGeneration(),e.currentTarget.currentTime,e.currentTarget.duration);
       paintProgress(session.current.progress());}}
      onEnded={()=>{if(session.current.endedOnce(session.current.currentGeneration()))next();}}
      onError={()=>{session.current.error(session.current.currentGeneration());setMediaError(true);}}/>}
    <div className="bliki-viewer-shade" aria-hidden="true"/>
    {mediaError&&<div className="bliki-viewer-error" role="alert">Медиа не открывается на этом устройстве.
     <button type="button" onClick={onClose}>Закрыть</button></div>}
    <div className="bliki-viewer-touch" onPointerDown={down} onPointerMove={move}
     onPointerUp={up} onPointerCancel={e=>up(e,true)} onLostPointerCapture={e=>up(e,true)}/>
    <header className="bliki-viewer-header">
     <div className="bliki-viewer-segments" aria-label={"Блик "+(index+1)+" из "+drafts.length}>
      {drafts.map((d,i)=><span key={d.id}><i style={{transform:i<index?"scaleX(1)":i>index?"scaleX(0)":undefined}}
       ref={i===index?progress:undefined}/></span>)}
     </div>
     <div className="bliki-viewer-title"><Sparkles size={17}/><strong>{name||"Мой Блик"}</strong>
      <span>Локальный предпросмотр</span>
      <button type="button" data-modal-initial onClick={onClose} aria-label="Закрыть предпросмотр"><X size={23}/></button></div>
    </header>
    <footer className="bliki-viewer-footer">
     <button type="button" onClick={previous} disabled={index===0} aria-label="Предыдущий Блик"><ArrowLeft size={20}/></button>
     <span><Eye size={15}/> Не опубликовано</span>
     {item.kind==="video"&&<button type="button" onClick={()=>{
      const value=!muted;setMuted(value);if(media.current)media.current.muted=value;
     }} aria-label={muted?"Включить звук":"Выключить звук"}>
      {muted?<VolumeX size={20}/>:<Volume2 size={20}/>}</button>}
     <button type="button" onClick={()=>{
      const active=media.current;if(!active)return;
      manualPaused.current=!active.paused;
      session.current.hold(session.current.currentGeneration(),manualPaused.current,performance.now());
      if(active.paused)void active.play().catch(()=>{});else active.pause();
     }} disabled={item.kind!=="video"} aria-label="Пауза или воспроизведение видео">
      {videoPaused?<Play size={20}/>:<Pause size={20}/>}</button>
    </footer>
   </div>
  </div>;
}
