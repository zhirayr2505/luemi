import {useLayoutEffect,useRef,useState} from "react";
import {CheckCheck,Copy,Pencil,Reply,Trash2} from "lucide-react";
import {chatReactionEmoji,type ChatReactionEmoji} from "@luemi/contracts";
import type {LocalMessage} from "./chat-domain.js";

const names=["Сердце","Нравится","Огонь","Влюблённость","Смех","Удивление","Грусть","Искры"];

export function ChatMessageMenu({message,anchor,actorId,writable,onCancel,onReply,onCopy,onEdit,onDelete,onReaction}:{
 message:LocalMessage;anchor:HTMLElement;actorId:string;writable:boolean;
 onCancel:()=>void;onReply:()=>void;onCopy:()=>void;onEdit:()=>void;onDelete:()=>void;
 onReaction:(emoji:ChatReactionEmoji)=>void;
}){
 const menu=useRef<HTMLDivElement>(null);
 const [position,setPosition]=useState<{left:number;top:number;maxHeight:number;side:"above"|"below"}>();
 const selected=message.reactions?.find(item=>item.actorId===actorId)?.emoji;
 const own=message.senderId===actorId;
 useLayoutEffect(()=>{
  const el=menu.current;
  const route=el?.offsetParent;
  if(!el||!route||!anchor.isConnected)return;
  const place=()=>{
   const frame=route.getBoundingClientRect();
   const bubble=anchor.getBoundingClientRect();
   const header=route.querySelector(".lc-chat-header")?.getBoundingClientRect();
   const minTop=Math.max(frame.top+8,(header?.bottom??frame.top)+6);
   const maxBottom=Math.min(frame.bottom-12,(window.visualViewport?.height??window.innerHeight)-8);
   const height=el.scrollHeight+2;
   const above=bubble.top-8-minTop;
   const below=maxBottom-bubble.bottom-8;
   const side=below>=height||below>=above?"below":"above";
   const top=side==="above"&&above>=height?bubble.top-8-height:
    side==="below"&&below>=height?bubble.bottom+8:Math.max(minTop,Math.min(bubble.top,maxBottom-height));
   const ideal=own?bubble.right-el.offsetWidth:bubble.left;
   setPosition({left:Math.max(8,Math.min(ideal-frame.left,frame.width-el.offsetWidth-8)),
    top:top-frame.top,maxHeight:Math.max(80,maxBottom-top),side});
  };
  place();
  window.addEventListener("resize",place);
  window.visualViewport?.addEventListener("resize",place);
  return()=>{
   window.removeEventListener("resize",place);
   window.visualViewport?.removeEventListener("resize",place);
  };
 },[anchor,own,message.readAt,message.body,writable]);

 return <>
  <button type="button" tabIndex={-1} className="lc-message-scrim" onClick={onCancel} aria-label="Закрыть меню сообщения"/>
  <div ref={menu} className="lc-message-actions" data-side={position?.side}
   style={position?{left:position.left,top:position.top,maxHeight:position.maxHeight}:{visibility:"hidden"}}
   role="dialog" aria-label="Действия с сообщением">
   {writable&&<div className="lc-emoji-bar" aria-label="Реакции">{chatReactionEmoji.map((emoji,index)=>
    <button key={emoji} type="button" aria-label={names[index]} aria-pressed={selected===emoji}
     onClick={()=>onReaction(emoji)}>{emoji}</button>)}</div>}
   <div className="lc-message-options">
    {own&&message.readAt&&<div className="lc-read-time"><CheckCheck size={17} aria-hidden="true"/><span>
     <strong>Прочитано</strong><time dateTime={message.readAt}>{new Intl.DateTimeFormat("ru-RU",{
      dateStyle:"long",timeStyle:"short"}).format(new Date(message.readAt))}</time>
    </span></div>}
    {writable&&<button type="button" onClick={onReply}><Reply size={18}/>Ответить</button>}
    {message.body&&<button type="button" onClick={onCopy}><Copy size={18}/>Копировать</button>}
    {writable&&own&&message.body&&<button type="button" onClick={onEdit}><Pencil size={18}/>Редактировать</button>}
    <button type="button" className="danger" onClick={onDelete}><Trash2 size={18}/>Удалить</button>
   </div>
  </div>
 </>;
}
