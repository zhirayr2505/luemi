import {useEffect,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {ArrowLeft,Archive,BellOff,CheckCheck,Copy,Heart,ImagePlus,MoreVertical,Pin,Reply,Search,Send,ShieldBan,Trash2,X} from "lucide-react";
import "./chats.css";

/** Local UI fixture only. Never represents real matches, delivery, or persisted messages. */
type Message={id:string;mine:boolean;text:string;time:string;reaction?:string;reply?:string;image?:string;status?:"sent"|"read"};
type Conversation={id:string;name:string;avatar:string;last:string;unread:number;muted?:boolean;pinned?:boolean;archived?:boolean};
const seed:Conversation[]=[
 {id:"alina",name:"Алина",avatar:"А",last:"С удовольствием 💜",unread:2},
 {id:"mark",name:"Марк",avatar:"М",last:"Как проходит твой день?",unread:0},
 {id:"sofia",name:"София",avatar:"С",last:"Ахах, договорились 😄",unread:1}
];
const initial:Message[]=[
 {id:"a",mine:false,text:"Привет! Как проходит твой день? ☺️",time:"12:40"},
 {id:"b",mine:true,text:"Отлично! А твой? 💜",time:"12:41",status:"read"},
 {id:"c",mine:false,text:"Теперь ещё лучше 🥰",time:"12:42"}
];
const reactions=["❤️","🥰","😂","😍","😮","😢","👍"];
const uid=()=>typeof crypto!=="undefined"&&"randomUUID"in crypto?crypto.randomUUID():String(Date.now())+"-"+Math.random().toString(36).slice(2);
export function ChatsPreview({onOpenProfile}:{onOpenProfile?:(id:string)=>void}){
 const [chats,setChats]=useState(seed);
 const [active,setActive]=useState<string|null>(null);
 const [messages,setMessages]=useState<Record<string,Message[]>>({alina:initial});
 const [draft,setDraft]=useState("");
 const [search,setSearch]=useState("");
 const [archiveView,setArchiveView]=useState(false);
 const [menu,setMenu]=useState<{kind:"chat"|"message"|"person";id:string}|null>(null);
 const [reply,setReply]=useState<Message|null>(null);
 const [editing,setEditing]=useState<string|null>(null);
 const [photo,setPhoto]=useState<string|null>(null);
 const [confirmDelete,setConfirmDelete]=useState<string|null>(null);
 const [blocked,setBlocked]=useState<string[]>([]);
 const [notice,setNotice]=useState("");
 const [newBelow,setNewBelow]=useState(0);
 const [lightbox,setLightbox]=useState<string|null>(null);
 const list=useRef<HTMLDivElement>(null);
 const file=useRef<HTMLInputElement>(null);
 const touch=useRef<{x:number;y:number;id:string;kind:"message"|"screen";moved:boolean}|null>(null);
 const hold=useRef<ReturnType<typeof setTimeout>|null>(null);
 const holdFired=useRef(false);
 const lastTap=useRef<{id:string;at:number}>({id:"",at:0});
 const urls=useRef<string[]>([]);
 const nearBottom=useRef(true);
 const activeChat=chats.find(c=>c.id===active);
 const items=active?messages[active]??[]:[];
 const scrollBottom=()=>{requestAnimationFrame(()=>{if(list.current)list.current.scrollTop=list.current.scrollHeight;setNewBelow(0);});};
 useEffect(()=>{if(active)scrollBottom();},[active]);
 useEffect(()=>()=>{urls.current.forEach(u=>URL.revokeObjectURL(u));if(hold.current)clearTimeout(hold.current);},[]);
 const update=(fn:(m:Message[])=>Message[])=>{if(!active)return;setMessages(prev=>({...prev,[active]:fn(prev[active]??[])}));if(nearBottom.current)scrollBottom();else setNewBelow(v=>v+1);};
 const send=()=>{if(!active||blocked.includes(active))return;const text=draft.trim();if(!text&&!photo)return;
  if(editing){update(a=>a.map(m=>m.id===editing?{...m,text}:m));setEditing(null);}
  else update(a=>[...a,{id:uid(),mine:true,text,image:photo??undefined,reply:reply?.text,time:new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}),status:"sent"}]);
  setDraft("");setPhoto(null);setReply(null);};
 const react=(id:string,value:string)=>{update(a=>a.map(m=>m.id===id?{...m,reaction:m.reaction===value?undefined:value}:m));setMenu(null);};
 const handleAction=(action:string)=>{
  if(!menu)return;
  if(menu.kind==="chat"){setChats(prev=>prev.map(c=>c.id===menu.id?{...c,
   pinned:action==="pin"?!c.pinned:c.pinned,
   archived:action==="archive"?!c.archived:c.archived,
   muted:action==="mute"?!c.muted:c.muted,
   unread:action==="read"?0:c.unread}:c).filter(c=>!(action==="delete"&&c.id===menu.id)));
  }else if(menu.kind==="person"){if(action==="block")setBlocked(a=>a.includes(menu.id)?a.filter(x=>x!==menu.id):[...a,menu.id]);
   if(action==="report")setNotice("Жалоба: демонстрация интерфейса, отправка на сервер не выполняется.");
  }else{const m=items.find(x=>x.id===menu.id);if(!m)return;
   if(action==="reply")setReply(m);
   if(action==="copy"&&m.text)void navigator.clipboard?.writeText(m.text).catch(()=>setNotice("Не удалось скопировать"));
   if(action==="edit"){setDraft(m.text);setEditing(m.id);}
   if(action==="delete")update(a=>a.filter(x=>x.id!==m.id));
   if(action==="report")setNotice("Жалоба: демонстрация интерфейса, отправка на сервер не выполняется.");
  }
  setMenu(null);
 };
 const pointerDown=(e:ReactPointerEvent<HTMLElement>,id:string,kind:"message"|"screen")=>{
  if(e.pointerType==="mouse"&&e.button!==0)return;
  touch.current={x:e.clientX,y:e.clientY,id,kind,moved:false};holdFired.current=false;
  if(hold.current)clearTimeout(hold.current);
  if(kind==="message")hold.current=setTimeout(()=>{holdFired.current=true;setMenu({kind:"message",id});},470);
 };
 const pointerUp=(e:ReactPointerEvent<HTMLElement>)=>{
  if(hold.current)clearTimeout(hold.current);
  const g=touch.current;touch.current=null;if(!g||holdFired.current)return;
  const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(Math.abs(dx)>62&&Math.abs(dx)>Math.abs(dy)*1.3){
   if(g.kind==="message"&&dx<0){const m=items.find(x=>x.id===g.id);if(m)setReply(m);}
   if(g.kind==="screen"&&dx>0&&g.x<30){setActive(null);setMenu(null);}
   return;
  }
  if(g.kind==="message"&&Math.abs(dx)<12&&Math.abs(dy)<12){
   const now=performance.now();
   if(lastTap.current.id===g.id&&now-lastTap.current.at<320){react(g.id,"❤️");lastTap.current={id:"",at:0};}
   else lastTap.current={id:g.id,at:now};
  }
 };
 const open=(id:string)=>{setActive(id);setMenu(null);setReply(null);setEditing(null);setChats(a=>a.map(c=>c.id===id?{...c,unread:0}:c));};
 const visible=chats.filter(c=>!!c.archived===archiveView&&c.name.toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru"))).sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned));
 return <div className="luemi-chats" data-chat-preview="true">
  {!active?<><header className="lc-heading"><div><small>LUEMI · ДЕМО ИНТЕРФЕЙСА</small><h2>{archiveView?"Архив":"Чаты"}</h2></div><button type="button" aria-label="Архив" onClick={()=>setArchiveView(v=>!v)}>{archiveView?<ArrowLeft/>:<Archive/>}</button></header>
   <label className="lc-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск переписок" aria-label="Поиск переписок"/></label>
   <div className="lc-conversations">{visible.length?visible.map(c=><div className="lc-conversation" key={c.id} onContextMenu={e=>{e.preventDefault();setMenu({kind:"chat",id:c.id});}} onPointerDown={e=>pointerDown(e,c.id,"message")} onPointerUp={e=>{if(hold.current)clearTimeout(hold.current);touch.current=null;}} onPointerCancel={()=>{if(hold.current)clearTimeout(hold.current);}}>
    <button type="button" className="lc-chat-open" onClick={()=>{if(!holdFired.current)open(c.id);}}><span className="lc-avatar">{c.avatar}</span><span className="lc-chat-summary"><strong>{c.name} {c.pinned?"📌":""}</strong><span>{c.last}</span></span><span className="lc-meta"><small>12:45</small>{c.unread>0&&<b>{c.unread}</b>}{c.muted&&<BellOff size={13}/>}</span></button>
    <button type="button" aria-label={"Действия с чатом "+c.name} className="lc-ellipsis" onClick={()=>setMenu({kind:"chat",id:c.id})}><MoreVertical size={18}/></button>
   </div>):<p className="lc-empty">Здесь пока нет переписок.</p>}</div>
   <p className="lc-footnote">Демо-сообщения не отправляются другим людям.</p>
  </>:<><header className="lc-chat-header"><button type="button" aria-label="Назад" onClick={()=>setActive(null)}><ArrowLeft/></button><button type="button" className="lc-person" onClick={()=>onOpenProfile?onOpenProfile(active):setNotice("Профиль будет подключён к реальному мэтчу.")}><span className="lc-avatar">{activeChat?.avatar}</span><span><strong>{activeChat?.name}</strong><small>Демо-переписка</small></span></button><button type="button" aria-label="Меню собеседника" onClick={()=>setMenu({kind:"person",id:active})}><MoreVertical/></button></header>
   <div className="lc-history" ref={list} onScroll={e=>{const t=e.currentTarget;nearBottom.current=t.scrollHeight-t.scrollTop-t.clientHeight<95;if(nearBottom.current)setNewBelow(0);}} onPointerDown={e=>{if(e.target===e.currentTarget)pointerDown(e,"screen","screen");}} onPointerUp={pointerUp}>
    <div className="lc-day">Сегодня</div>
    {items.map(m=><div key={m.id} className={"lc-msg-line "+(m.mine?"lc-own":"")} onPointerDown={e=>{e.stopPropagation();pointerDown(e,m.id,"message");}} onPointerUp={e=>{e.stopPropagation();pointerUp(e);}} onPointerCancel={()=>{if(hold.current)clearTimeout(hold.current);touch.current=null;}} onContextMenu={e=>{e.preventDefault();setMenu({kind:"message",id:m.id});}}>
     <div className="lc-bubble">{m.reply&&<div className="lc-quote">{m.reply}</div>}{m.image&&<button type="button" className="lc-photo-open" onClick={()=>setLightbox(m.image!)}><img src={m.image} alt="Отправленное фото"/></button>}{m.text&&<div>{m.text}</div>}<small>{m.time} {m.mine?"✓✓":""}</small>{m.reaction&&<span className="lc-reaction">{m.reaction}</span>}</div>
    </div>)}
   </div>
   {newBelow>0&&<button className="lc-new" type="button" onClick={scrollBottom}>Новые сообщения · {newBelow} ↓</button>}
   {blocked.includes(active)?<p className="lc-blocked">Пользователь заблокирован. <button onClick={()=>setBlocked(a=>a.filter(x=>x!==active))}>Разблокировать</button></p>:<div className="lc-composer">
    {(reply||editing)&&<div className="lc-reply"><Reply size={16}/><span>{editing?"Редактирование сообщения":reply?.text}</span><button type="button" aria-label="Отменить" onClick={()=>{setReply(null);setEditing(null);setDraft("");}}><X size={16}/></button></div>}
    {photo&&<div className="lc-attachment"><img src={photo} alt="Фото перед отправкой"/><button type="button" onClick={()=>setPhoto(null)} aria-label="Удалить вложение"><X size={16}/></button></div>}
    <div className="lc-input-row"><input type="file" ref={file} accept="image/jpeg,image/png,image/webp" hidden onChange={e=>{const f=e.target.files?.[0];e.target.value="";if(!f)return;if(f.size>10*1024*1024||!["image/jpeg","image/png","image/webp"].includes(f.type)){setNotice("Фото должно быть JPG, PNG или WebP до 10 МБ");return;}const u=URL.createObjectURL(f);urls.current.push(u);setPhoto(u);}}/><button type="button" aria-label="Добавить фото" onClick={()=>file.current?.click()}><ImagePlus/></button><textarea rows={1} value={draft} placeholder="Сообщение..." onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}/><button type="button" className="lc-send" disabled={!draft.trim()&&!photo} aria-label="Отправить" onClick={send}><Send size={19}/></button></div>
   </div>}
  </>}
  {menu&&<div className="lc-overlay" onPointerDown={e=>{if(e.target===e.currentTarget)setMenu(null);}}><section className="lc-menu" role="dialog" aria-modal="true" aria-label="Действия">
   {menu.kind==="message"&&<div className="lc-reactions">{reactions.map(r=><button type="button" key={r} onClick={()=>react(menu.id,r)}>{r}</button>)}</div>}
   {(menu.kind==="chat"?[["pin","Закрепить",Pin],["mute","Уведомления",BellOff],["archive","Архивировать",Archive],["read","Отметить прочитанным",CheckCheck],["delete","Удалить переписку",Trash2]]:
    menu.kind==="person"?[["block",blocked.includes(menu.id)?"Разблокировать":"Заблокировать",ShieldBan],["report","Пожаловаться",Heart]]:
    [["reply","Ответить",Reply],["copy","Копировать",Copy],...(items.find(m=>m.id===menu.id)?.mine?[["edit","Редактировать",Pin],["delete","Удалить",Trash2]]:[["report","Пожаловаться",ShieldBan]])]
   ).map(([action,label,Icon])=><button type="button" key={String(action)} onClick={()=>{if(action==="delete"&&menu.kind==="chat"){setConfirmDelete(menu.id);setMenu(null);}else handleAction(String(action));}}><Icon size={18}/>{String(label)}</button>)}
   <button type="button" onClick={()=>setMenu(null)}>Отмена</button>
  </section></div>}
  {confirmDelete&&<div className="lc-overlay"><section className="lc-menu" role="alertdialog" aria-modal="true" aria-label="Удаление переписки"><p>Удалить переписку из демо?</p><button type="button" onClick={()=>{setChats(a=>a.filter(c=>c.id!==confirmDelete));setConfirmDelete(null);}}>Удалить</button><button type="button" onClick={()=>setConfirmDelete(null)}>Отмена</button></section></div>}
  {notice&&<div className="lc-notice" role="status">{notice}<button type="button" onClick={()=>setNotice("")}><X size={15}/></button></div>}
  {lightbox&&<div className="lc-overlay lc-lightbox" onClick={()=>setLightbox(null)}><button type="button" aria-label="Закрыть"><X/></button><img src={lightbox} alt="Просмотр фото"/></div>}
 </div>;
}
