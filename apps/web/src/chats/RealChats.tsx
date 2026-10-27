import {useEffect,useRef,useState} from "react";
import {createChatTransport} from "./chat-transport.js";
import type {ChatWireConversation,ChatWireMessage} from "./chat-transport.js";
import {geoCsrf} from "../auth/session-adapter.js";
import "./chats.css";

/** Explicitly opt-in real transport; never substitutes fixtures on errors. */
export function RealChats(){
 const [conversations,setConversations]=useState<ChatWireConversation[]>([]);
 const [active,setActive]=useState<string|null>(null);
 const [actorId,setActorId]=useState<string|null>(null);
 const [messages,setMessages]=useState<ChatWireMessage[]>([]);
 const [draft,setDraft]=useState("");
 const [editing,setEditing]=useState<string|null>(null);
 const [olderCursor,setOlderCursor]=useState<string|null>(null);
 const [loadingOlder,setLoadingOlder]=useState(false);
 const activeRef=useRef<string|null>(null);
 const [error,setError]=useState("");
 const [sending,setSending]=useState(false);
 const [loading,setLoading]=useState(true);
 const [selectedPeer,setSelectedPeer]=useState<ChatWireConversation|null>(null);
 const bottom=useRef<HTMLDivElement>(null);
 const lastRead=useRef<string|null>(null);
 const cursorInitialized=useRef(false);
 const pending=useRef<{conversationId:string;body:string;clientId:string}|null>(null);

 const csrf=geoCsrf();
 const api=csrf?createChatTransport(csrf):null;
 useEffect(()=>{
  if(!api){setError("Требуется авторизация Telegram");setLoading(false);return;}
  const controller=new AbortController();
  Promise.all([api.me(controller.signal),api.list(controller.signal)]).then(([me,data])=>{if(!controller.signal.aborted){setActorId(me.actorId);setConversations(data.conversations);}})
   .catch(()=>{if(!controller.signal.aborted)setError("Не удалось загрузить чаты");})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[csrf]);
 useEffect(()=>{
  if(!active||!api)return;
  const controller=new AbortController();
  lastRead.current=null;
  activeRef.current=active;
  setOlderCursor(null);
  cursorInitialized.current=false;
  let running=false;
  const load=async()=>{
   if(running||controller.signal.aborted)return;
   running=true;
   try{
    const data=await api.messages(active,undefined,controller.signal);
    if(!controller.signal.aborted&&activeRef.current===active){setMessages(previous=>{const byId=new Map(previous.map(m=>[m.id,m]));for(const m of data.messages)byId.set(m.id,m);return [...byId.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));});if(!cursorInitialized.current){cursorInitialized.current=true;setOlderCursor(data.nextCursor);}setError("");
     const newest=[...data.messages].reverse().find(message=>message.senderId!==actorId&&!message.deletedAt);
     if(actorId&&newest&&document.visibilityState==="visible"&&lastRead.current!==newest.id){
      lastRead.current=newest.id;
      void api.markRead(active,newest.id).catch(()=>{lastRead.current=null;});
     }
    }
   }catch{if(!controller.signal.aborted)setError("Связь прервана. Повторяем подключение…");}
   finally{running=false;}
  };
  void load();
  const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void load();},3500);
  return()=>{controller.abort();window.clearInterval(timer);};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[active,csrf,actorId]);
 useEffect(()=>{
  if(!csrf)return;
  const controller=new AbortController();
  let busy=false;
  const refresh=async()=>{
   if(busy||controller.signal.aborted||document.visibilityState!=="visible")return;
   busy=true;
   try{
    const data=await createChatTransport(csrf).list(controller.signal);
    if(!controller.signal.aborted)setConversations(data.conversations);
   }catch{/* The message poll reports active connectivity errors. */}
   finally{busy=false;}
  };
  const timer=window.setInterval(()=>void refresh(),5000);
  const onVisible=()=>{if(document.visibilityState==="visible")void refresh();};
  document.addEventListener("visibilitychange",onVisible);
  return()=>{controller.abort();window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisible);};
 },[csrf]);
 const loadOlder=async()=>{
  if(!api||!active||!olderCursor||loadingOlder)return;
  setLoadingOlder(true);
  try{const page=await api.messages(active,olderCursor);if(activeRef.current!==active)return;setMessages(old=>{const byId=new Map([...page.messages,...old].map(m=>[m.id,m]));return [...byId.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));});setOlderCursor(page.nextCursor);}catch{setError("Не удалось загрузить старые сообщения");}finally{setLoadingOlder(false);}
 };
 const editMessage=async(message:ChatWireMessage)=>{
  if(!api||!active||message.deletedAt)return;
  const body=window.prompt("Изменить сообщение",message.body);
  if(body===null||body===message.body)return;
  if(!body.trim()||body!==body.trim()||[...body].length>4000){setError("Введите текст до 4000 символов");return;}
  setEditing(message.id);
  try{const result=await api.edit(active,message.id,body);if(activeRef.current===active)setMessages(old=>old.map(m=>m.id===message.id?result.message:m));setError("");}catch{setError("Не удалось изменить сообщение");}finally{setEditing(null);}
 };
 const deleteMessage=async(message:ChatWireMessage)=>{
  if(!api||!active||message.deletedAt||!window.confirm("Удалить сообщение?"))return;
  setEditing(message.id);
  try{await api.remove(active,message.id);if(activeRef.current===active)setMessages(old=>old.map(m=>m.id===message.id?{...m,body:"",deletedAt:new Date().toISOString()}:m));setError("");}catch{setError("Не удалось удалить сообщение");}finally{setEditing(null);}
 };
 const send=async()=>{
  if(!api||!active||!draft.trim()||sending)return;
  const text=draft.trim();
  if(!pending.current||pending.current.conversationId!==active||pending.current.body!==text)
   pending.current={conversationId:active,body:text,clientId:crypto.randomUUID()};
  const clientId=pending.current.clientId;
  setSending(true);setError("");
  try{
   const result=await api.send(active,text,clientId);
   if(activeRef.current===active)setMessages(old=>old.some(m=>m.id===result.message.id)?old:[...old,result.message]);
   if(activeRef.current===active){pending.current=null;setDraft("");requestAnimationFrame(()=>bottom.current?.scrollIntoView({block:"end"}));}
  }catch{setError("Сообщение не отправлено. Попробуйте ещё раз.");}
  finally{setSending(false);}
 };
 return <div className="luemi-chats" data-real-chats="true">
  {!active?<><header className="lc-heading"><div><small>LUEMI</small><h2>Чаты</h2></div></header>
   {loading?<p className="lc-empty">Загружаем переписки…</p>:conversations.length===0?<p className="lc-empty">Пока нет переписок. Они появятся после взаимного мэтча.</p>:
   <div className="lc-conversations">{conversations.map(c=><button className="lc-chat-open" key={c.id} onClick={()=>{pending.current=null;lastRead.current=null;activeRef.current=c.id;setActive(c.id);setSelectedPeer(c);setMessages([]);}}>
    <span className="lc-avatar">💜</span><span className="lc-chat-summary"><strong>{c.peerName||"Переписка"}</strong><span>{c.lastMessage??"Начните разговор"}</span></span>{c.unreadCount>0&&<span className="lc-unread" aria-label={`${c.unreadCount} непрочитанных`}>{c.unreadCount>99?"99+":c.unreadCount}</span>}
   </button>)}</div>}
  </>:<><header className="lc-chat-header"><button type="button" onClick={()=>{pending.current=null;activeRef.current=null;setActive(null);setSelectedPeer(null);}} aria-label="Назад">←</button><strong>{selectedPeer?.peerName||"Переписка"}</strong></header>
   <div className="lc-history" role="log" aria-label="Сообщения">{olderCursor&&<button type="button" disabled={loadingOlder} onClick={()=>void loadOlder()} className="lc-load-older">{loadingOlder?"Загружаем…":"Показать старые сообщения"}</button>}{messages.map(m=><div key={m.id} className={"lc-msg-line "+(m.senderId===actorId?"lc-own":"")}>
    <div className="lc-bubble">{m.deletedAt?<i>Сообщение удалено</i>:m.body}<small>{new Date(m.createdAt).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</small>{m.senderId===actorId&&!m.deletedAt&&<span className="lc-msg-actions"><button type="button" disabled={editing===m.id} onClick={()=>void editMessage(m)} aria-label="Редактировать сообщение">Изменить</button><button type="button" disabled={editing===m.id} onClick={()=>void deleteMessage(m)} aria-label="Удалить сообщение">Удалить</button></span>}</div>
   </div>)}<div ref={bottom}/></div>
   <div className="lc-composer"><div className="lc-input-row"><textarea aria-label="Сообщение" maxLength={4000} value={draft} onChange={e=>{setDraft(e.target.value);if(pending.current?.body!==e.target.value.trim())pending.current=null;}} placeholder="Сообщение…"/><button type="button" disabled={sending||!draft.trim()} onClick={()=>void send()} aria-label="Отправить">➤</button></div></div>
  </>}
  {error&&<p className="lc-footnote" role="alert">{error}</p>}
 </div>;
}
