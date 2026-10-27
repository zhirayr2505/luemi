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
 const [error,setError]=useState("");
 const [sending,setSending]=useState(false);
 const [loading,setLoading]=useState(true);
 const bottom=useRef<HTMLDivElement>(null);
 const lastRead=useRef<string|null>(null);
 const pending=useRef<{conversationId:string;body:string;clientId:string}|null>(null);

 const csrf=geoCsrf();
 const api=csrf?createChatTransport(csrf):null;
 useEffect(()=>{
  if(!api){setError("Требуется авторизация Telegram");setLoading(false);return;}
  const controller=new AbortController();
  Promise.all([api.me(controller.signal),api.list(controller.signal)]).then(([me,data])=>{setActorId(me.actorId);setConversations(data.conversations);})
   .catch(()=>{if(!controller.signal.aborted)setError("Не удалось загрузить чаты");})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[csrf]);
 useEffect(()=>{
  if(!active||!api)return;
  const controller=new AbortController();
  let running=false;
  const load=async()=>{
   if(running||controller.signal.aborted)return;
   running=true;
   try{
    const data=await api.messages(active,undefined,controller.signal);
    if(!controller.signal.aborted){setMessages(data.messages);setError("");
     const newest=data.messages[data.messages.length-1];
     if(newest&&newest.senderId!==actorId&&document.visibilityState==="visible"&&lastRead.current!==newest.id){
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
 const send=async()=>{
  if(!api||!active||!draft.trim()||sending)return;
  const text=draft.trim();
  if(!pending.current||pending.current.conversationId!==active||pending.current.body!==text)
   pending.current={conversationId:active,body:text,clientId:crypto.randomUUID()};
  const clientId=pending.current.clientId;
  setSending(true);setError("");
  try{
   const result=await api.send(active,text,clientId);
   setMessages(old=>old.some(m=>m.id===result.message.id)?old:[...old,result.message]);
   pending.current=null;setDraft("");requestAnimationFrame(()=>bottom.current?.scrollIntoView({block:"end"}));
  }catch{setError("Сообщение не отправлено. Попробуйте ещё раз.");}
  finally{setSending(false);}
 };
 return <div className="luemi-chats" data-real-chats="true">
  {!active?<><header className="lc-heading"><div><small>LUEMI</small><h2>Чаты</h2></div></header>
   {loading?<p className="lc-empty">Загружаем переписки…</p>:conversations.length===0?<p className="lc-empty">Пока нет переписок. Они появятся после взаимного мэтча.</p>:
   <div className="lc-conversations">{conversations.map(c=><button className="lc-chat-open" key={c.id} onClick={()=>{pending.current=null;lastRead.current=null;setActive(c.id);setMessages([]);}}>
    <span className="lc-avatar">💜</span><span className="lc-chat-summary"><strong>{c.peerName||"Переписка"}</strong><span>{c.lastMessage??"Начните разговор"}</span></span>
   </button>)}</div>}
  </>:<><header className="lc-chat-header"><button type="button" onClick={()=>{pending.current=null;setActive(null);}} aria-label="Назад">←</button><strong>Переписка</strong></header>
   <div className="lc-history" role="log" aria-label="Сообщения">{messages.map(m=><div key={m.id} className={"lc-msg-line "+(m.senderId===actorId?"lc-own":"")}>
    <div className="lc-bubble">{m.deletedAt?<i>Сообщение удалено</i>:m.body}<small>{new Date(m.createdAt).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</small></div>
   </div>)}<div ref={bottom}/></div>
   <div className="lc-composer"><div className="lc-input-row"><textarea aria-label="Сообщение" maxLength={4000} value={draft} onChange={e=>{setDraft(e.target.value);if(pending.current?.body!==e.target.value.trim())pending.current=null;}} placeholder="Сообщение…"/><button type="button" disabled={sending||!draft.trim()} onClick={()=>void send()} aria-label="Отправить">➤</button></div></div>
  </>}
  {error&&<p className="lc-footnote" role="alert">{error}</p>}
 </div>;
}
