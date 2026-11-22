import {useLayoutEffect,useRef,useState} from "react";
import {CheckCheck,ChevronDown,Copy,Pencil,Reply,Trash2,CheckCircle2} from "lucide-react";
import {chatReactionEmoji,type ChatReactionEmoji} from "@luemi/contracts";
import {useModalLayer} from "../ui/modal-layer";
import type {LocalMessage} from "./chat-domain.js";

const names=["Сердце","Нравится","Огонь","Влюблённость","Смех","Удивление","Грусть","Искры",
 "Браво","Восторг","Звёзды в глазах","Ура","Спасибо","Сто баллов","Праздник","Белое сердце",
 "Разбитое сердце","Задумчивость","Круто","Трогательно","Рукопожатие","Глаза","Сердце руками","Роза"];

export function ChatMessageMenu({message,anchor,actorId,writable,onCancel,onReply,onCopy,onEdit,onDelete,onSelect,onReaction}:{
 message:LocalMessage;anchor:HTMLElement;actorId:string;writable:boolean;
 onCancel:()=>void;onReply:()=>void;onCopy:()=>void;onEdit:()=>void;onDelete:()=>void;onSelect:()=>void;
 onReaction:(emoji:ChatReactionEmoji)=>void;
}){
 const menu=useRef<HTMLDivElement>(null);
 const layer=useRef<HTMLDivElement>(null);
 const focus=useRef<HTMLDivElement>(null);
 const [expanded,setExpanded]=useState(false);
 useLayoutEffect(()=>{
  const layer=focus.current;
  if(!layer)return;
  layer.replaceChildren(anchor.cloneNode(true));
  return()=>layer.replaceChildren();
 },[anchor,message]);
 const [position,setPosition]=useState<{left:number;top:number;maxHeight:number;bubbleWidth:number}>();
 const selected=message.reactions?.find(item=>item.actorId===actorId)?.emoji;
 const own=message.senderId===actorId;
 useLayoutEffect(()=>{
  const el=menu.current;
  const route=el?.closest(".lc-thread-route");
  if(!el||!route||!anchor.isConnected)return;
  const place=()=>{
   const frame=route.getBoundingClientRect();
   const bubble=anchor.getBoundingClientRect();
   const header=route.querySelector(".lc-chat-header")?.getBoundingClientRect();
   const topBoundary=Math.max(frame.top+8,(header?.bottom??frame.top)+8);
   const bottomBoundary=Math.min(frame.bottom-12,(window.visualViewport?.height??window.innerHeight)-8);
   const available=Math.max(110,bottomBoundary-topBoundary);
   // One measured floating stack: reactions → raised message → actions.
   // Shift the stack into the viewport on short screens, never overlap Telegram chrome.
   const contentHeight=el.scrollHeight+2;
   const visibleHeight=Math.min(contentHeight,available);
   const preferredTop=bubble.top-(writable?62:12);
   const top=Math.max(topBoundary,Math.min(preferredTop,bottomBoundary-visibleHeight));
   const ideal=own?bubble.right-el.offsetWidth:bubble.left;
   setPosition({left:Math.max(8,Math.min(ideal-frame.left,frame.width-el.offsetWidth-8)),
    top:top-frame.top,maxHeight:available,bubbleWidth:Math.min(bubble.width,el.offsetWidth)});
  };
  place();
  window.addEventListener("resize",place);
  window.visualViewport?.addEventListener("resize",place);
  return()=>{
   window.removeEventListener("resize",place);
   window.visualViewport?.removeEventListener("resize",place);
  };
 },[anchor,own,message.readAt,message.body,writable,expanded]);

 useModalLayer(true,layer,onCancel);

 return <div className="lc-message-layer" ref={layer} tabIndex={-1}>
  <button type="button" tabIndex={-1} className="lc-message-scrim" onClick={onCancel} aria-label="Закрыть меню сообщения"/>
  <div ref={menu} className="lc-message-actions" data-vivid-stack="true"
   style={position?{left:position.left,top:position.top,maxHeight:position.maxHeight}:{visibility:"hidden"}}
   role="dialog" aria-modal="true" aria-label="Действия с сообщением">
   {writable&&<div className="lc-emoji-bar" aria-label="Реакции" data-expanded={expanded||undefined}>
    {(expanded?chatReactionEmoji:chatReactionEmoji.slice(0,6)).map((emoji,index)=>
    <button key={emoji} type="button" data-emoji aria-label={names[index]} aria-pressed={selected===emoji}
     onClick={()=>onReaction(emoji)}>{emoji}</button>)}
    <button type="button" className="lc-emoji-expand" aria-label={expanded?"Свернуть реакции":"Все реакции"}
     aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}><ChevronDown size={17}/></button>
   </div>}
   <div ref={focus} className={`lc-focus-bubble${own?" lc-own":""}`} inert aria-hidden="true"
    style={position?{width:position.bubbleWidth}:{visibility:"hidden"}}/>
   <div className="lc-message-options">
    {own&&message.readAt&&<div className="lc-read-time"><CheckCheck size={17} aria-hidden="true"/><span>
     <strong>Прочитано</strong><time dateTime={message.readAt}>{new Intl.DateTimeFormat("ru-RU",{
      dateStyle:"long",timeStyle:"short"}).format(new Date(message.readAt))}</time>
    </span></div>}
    {writable&&<button type="button" onClick={onReply}><Reply size={18}/>Ответить</button>}
    {message.body&&<button type="button" onClick={onCopy}><Copy size={18}/>Копировать</button>}
    {writable&&own&&message.body&&<button type="button" onClick={onEdit}><Pencil size={18}/>Редактировать</button>}
    <button type="button" onClick={onSelect}><CheckCircle2 size={18}/>Выбрать</button>
    <button type="button" className="danger" onClick={onDelete}><Trash2 size={18}/>Удалить</button>
   </div>
  </div>
 </div>;
}
