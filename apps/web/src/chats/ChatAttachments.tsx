import {useEffect,useRef,useState} from "react";
import {ArrowLeft,Gift,Image,Mic} from "lucide-react";
import type {ChatTransport,ChatWireMedia} from "./chat-transport";
import {useChatGestures} from "./chat-gestures";

const tabs=[
 {id:"photos",name:"Фото",empty:"В переписке пока нет фотографий",Icon:Image},
 {id:"voice",name:"Голосовые",empty:"Голосовых сообщений пока нет",Icon:Mic},
 {id:"gifts",name:"Подарки",empty:"Подарков пока нет",Icon:Gift}
] as const;

export function ChatAttachments({api,threadId,peerName,onBack,onPhoto,viewerOpen,nativeBack=false}:{
 api:ChatTransport;threadId:string;peerName:string;
 onBack:()=>void;onPhoto:(src:string)=>void;viewerOpen:boolean;nativeBack?:boolean;
}){
 const [section,setSection]=useState<(typeof tabs)[number]["id"]>("photos");
 const [photos,setPhotos]=useState<ChatWireMedia[]>([]);
 const [cursor,setCursor]=useState<string|null>(null);
 const [page,setPage]=useState<string|undefined>();
 const [pending,setPending]=useState(true);
 const [error,setError]=useState(false);
 const [retry,setRetry]=useState(0);
 const opening=useRef<AbortController|null>(null);
 useEffect(()=>()=>opening.current?.abort(),[]);
 const active=tabs.find(tab=>tab.id===section)??tabs[0];
 const gestures=useChatGestures({threadId,enabled:!viewerOpen,canBack:true,canReply:false,
  onOpen:()=>{},onHeart:()=>{},onHold:()=>{},onReply:()=>{},onBack});
 useEffect(()=>{
  const controller=new AbortController();
  setPending(true);setError(false);
  void api.photos(threadId,page,controller.signal).then(result=>{
   if(controller.signal.aborted)return;
   const loaded=result.messages.flatMap(message=>message.media).reverse();
   setPhotos(previous=>page?[...previous,...loaded.filter(item=>!previous.some(photo=>photo.id===item.id))]:loaded);
   setCursor(result.nextCursor);
  }).catch(()=>{if(!controller.signal.aborted)setError(true);}).finally(()=>{
   if(!controller.signal.aborted)setPending(false);
  });
  return()=>controller.abort();
 },[api,threadId,page,retry]);

 const refreshPhoto=async(photo:ChatWireMedia)=>{
  opening.current?.abort();
  const controller=new AbortController();
  opening.current=controller;
  try{
   const result=await api.mediaUrl(threadId,photo.id,controller.signal);
   if(!controller.signal.aborted)onPhoto(result.url);
  }catch{if(!controller.signal.aborted)setError(true);}
 };

 return <section ref={gestures.route} {...gestures.events} className="lc-attachments-route" aria-label="Вложения">
  <header className="lc-attachments-header">
   {!nativeBack&&<button type="button" className="lc-glass lc-island" aria-label="Назад" onClick={onBack}><ArrowLeft size={20}/></button>}
   <div><h2>Вложения</h2><p>{peerName}</p></div>
  </header>
  <div role="tablist" aria-label="Тип вложений" className="lc-attachment-tabs lc-glass" data-section={section}>{tabs.map(tab=>
   <button type="button" key={tab.id} role="tab" id={"lc-tab-"+tab.id} aria-selected={tab.id===section}
    aria-controls="lc-attachment-panel" onClick={()=>setSection(tab.id)}>{tab.name}</button>)}</div>
  <div key={section} role="tabpanel" id="lc-attachment-panel" aria-labelledby={"lc-tab-"+section} className="lc-attachment-panel">
   {section==="photos"&&photos.length>0&&<div className="lc-attachment-grid">
    {photos.map((photo,index)=><button type="button" key={photo.id} aria-label={`Открыть фото ${index+1}`}
     onClick={()=>{void refreshPhoto(photo);}}>
     {photo.url?<img alt="" src={photo.url} loading="lazy"/>:<Image size={23}/>}
    </button>)}
   </div>}
   {section==="photos"&&pending&&<div className="lc-attachment-skeleton" role="status" aria-label="Загружаем фотографии">{Array.from({length:6},(_,i)=><span key={i}/>)}</div>}
   {section==="photos"&&error&&<button type="button" className="lc-glass lc-attachments-more" onClick={()=>setRetry(value=>value+1)}>Повторить загрузку</button>}
   {(section!=="photos"||!photos.length&&!pending&&!error)&&<div className="lc-attachments-state">
    <active.Icon size={27} aria-hidden="true"/><p>{active.empty}</p>
   </div>}
   {section==="photos"&&cursor&&!pending&&!error&&<button type="button" className="lc-glass lc-attachments-more" onClick={()=>setPage(cursor)}>Более ранние фото</button>}
  </div>
 </section>;
}
