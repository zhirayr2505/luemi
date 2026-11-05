import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from "react";
import {ArrowLeft,Check,CheckCheck,Copy,Heart,ImagePlus,MoreVertical,Pencil,RefreshCw,Search,Send,Trash2,X,MessagesSquare} from "lucide-react";
import {createChatTransport,ChatTransportError,type ChatTransport,type ChatWireConversation} from "./chat-transport.js";
import {errorText,isNearBottom,prependPage,reconcileMessages,type LocalMessage,validateChatImage} from "./chat-domain.js";
import {ChatPhotoViewer} from "./ChatPhotoViewer.js";
import {geoCsrf} from "../auth/session-adapter.js";
import {getNewMatches,openNewMatch,type NewMatch} from "../registration/real-live-client.js";
import {LuemiAvatar,LuemiEmptyState,LuemiGlassPanel,LuemiIconButton,LuemiSegmentedTabs} from "../ui/LuemiV5.js";
import "./chats.css";

type Action={message:LocalMessage;kind:"menu"|"edit"|"delete"}|null;
type Attachment={file:File;url:string;progress:number;error:string|null};
const dayKey=(iso:string)=>new Date(iso).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"});
const time=(iso:string)=>new Date(iso).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
const status=(m:LocalMessage,own:boolean)=>!own?null:m.localState==="failed"?"Ошибка":m.localState==="sending"?"Отправка…":m.readAt?"Прочитано":m.deliveredAt?"Доставлено":"Отправлено";

type ChatCategory="all"|"matches"|"bliki"|"archive";
const chatCategories=[
 {id:"all" as const,label:"Все"},{id:"matches" as const,label:"Матчи"},
 {id:"bliki" as const,label:"Блики",disabled:true,hint:"Чаты из бликов появятся после серверного запуска модуля"},
 {id:"archive" as const,label:"Архив",disabled:true,hint:"Архив пока не поддерживается сервером"}
] as const;

export function RealChats({transport:provided,onOpenProfile,onThreadChange,registerThreadBack}:{transport?:ChatTransport;onOpenProfile?:(profileId:string)=>void;onThreadChange?:(open:boolean)=>void;registerThreadBack?:(handler:(()=>void)|null)=>void}={}){
 const csrf=geoCsrf();const api=useMemo(()=>provided??(csrf?createChatTransport(csrf):null),[provided,csrf]);
 const [actorId,setActorId]=useState("");const [conversations,setConversations]=useState<ChatWireConversation[]>([]);const [active,setActive]=useState<ChatWireConversation|null>(null);
 const [newMatches,setNewMatches]=useState<NewMatch[]>([]);const [viewerGender,setViewerGender]=useState<"man"|"woman"|"other">("other");
 const [activeNewMatch,setActiveNewMatch]=useState<NewMatch|null>(null);
 const [messages,setMessages]=useState<LocalMessage[]>([]);const [cursor,setCursor]=useState<string|null>(null);const [draft,setDraft]=useState("");const [attachment,setAttachment]=useState<Attachment|null>(null);
 const [deleteScope,setDeleteScope]=useState<"me"|"everyone">("me");const [chatMenu,setChatMenu]=useState(false);const [exportBusy,setExportBusy]=useState(false);const [clearDialog,setClearDialog]=useState(false);
 const [loading,setLoading]=useState(true);const [loadingOlder,setLoadingOlder]=useState(false);const [error,setError]=useState("");const [action,setAction]=useState<Action>(null);const [editValue,setEditValue]=useState("");const [viewer,setViewer]=useState<string|null>(null);const [newBelow,setNewBelow]=useState(0);
 const [searchOpen,setSearchOpen]=useState(false);const [query,setQuery]=useState("");const [category,setCategory]=useState<ChatCategory>("all");
 const history=useRef<HTMLDivElement>(null);const fileInput=useRef<HTMLInputElement>(null);const activeId=useRef<string|null>(null);const requestGeneration=useRef(0);const observedVisibility=useRef<{id:string;revision:string|null}|null>(null);const nearBottom=useRef(true);const objectUrls=useRef(new Set<string>());const pendingFiles=useRef(new Map<string,File>());const pollAbort=useRef<AbortController|null>(null);const hold=useRef<number|null>(null);const pointer=useRef<{x:number;y:number;id:string}|null>(null);
 const listPositions=useRef(new Map<string,number>());const autoScroll=useRef(false);
 const releaseAttachment=useCallback(()=>setAttachment(old=>{if(old){URL.revokeObjectURL(old.url);objectUrls.current.delete(old.url);}return null;}),[]);
 const showError=(e:unknown,fallback="Не удалось выполнить действие.")=>setError(e instanceof ChatTransportError?errorText(e.status,e.code):fallback);
 const refreshList=useCallback(async(signal?:AbortSignal)=>{if(!api)return;const data=await api.list(signal);setConversations([...data.conversations].sort((a,b)=>b.lastActivityAt.localeCompare(a.lastActivityAt)||a.id.localeCompare(b.id)));},[api]);
 const refreshMatches=useCallback(async(signal?:AbortSignal)=>{const data=await getNewMatches(signal);setNewMatches(data.matches);setViewerGender(data.viewerGender);},[]);
 useEffect(()=>{if(!api){setError("Требуется авторизация Telegram.");setLoading(false);return;}const controller=new AbortController();Promise.all([api.me(controller.signal),api.list(controller.signal),getNewMatches(controller.signal)]).then(([me,data,matches])=>{if(controller.signal.aborted)return;setActorId(me.actorId);setConversations([...data.conversations].sort((a,b)=>b.lastActivityAt.localeCompare(a.lastActivityAt)));setNewMatches(matches.matches);setViewerGender(matches.viewerGender);setError("");}).catch(e=>{if(!controller.signal.aborted)showError(e,"Не удалось загрузить чаты.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[api]);
 // Discover new mutual matches and unread badges even when the user has not opened a thread.
 useEffect(()=>{
  if(!api||active)return;
  const controller=new AbortController();let busy=false;
  const refresh=()=>{
   if(controller.signal.aborted||busy||document.visibilityState!=="visible")return;
   busy=true;
   void Promise.all([refreshList(controller.signal),refreshMatches(controller.signal)]).catch(()=>{/* Initial/retry state handles visible errors. */})
    .finally(()=>{busy=false;});
  };
  const timer=window.setInterval(refresh,5000);
  document.addEventListener("visibilitychange",refresh);
  return()=>{controller.abort();window.clearInterval(timer);document.removeEventListener("visibilitychange",refresh);};
 },[api,active,refreshList,refreshMatches]);
 useEffect(()=>()=>{pollAbort.current?.abort();objectUrls.current.forEach(URL.revokeObjectURL);pendingFiles.current.clear();if(hold.current!==null)window.clearTimeout(hold.current);onThreadChange?.(false);},[onThreadChange]);
 const applyIncoming=useCallback((incoming:LocalMessage[])=>{const el=history.current;autoScroll.current=!!el&&isNearBottom(el);if(el)listPositions.current=new Map([...el.querySelectorAll<HTMLElement>("[data-message-id]")].map(node=>[node.dataset.messageId??"",node.getBoundingClientRect().top]));setMessages(old=>{if(el&&!autoScroll.current&&incoming.some(message=>!old.some(current=>current.id===message.id)))setNewBelow(n=>n+1);const earliest=incoming.length?incoming.reduce((min,m)=>m.createdAt<min?m.createdAt:min,incoming[0].createdAt):null;
 const preserved=earliest?old.filter(m=>m.localState||m.createdAt<earliest):old.filter(m=>!!m.localState);
 return reconcileMessages(preserved,incoming);});},[]);
 useLayoutEffect(()=>{const el=history.current;if(!el)return;if(autoScroll.current){el.scrollTop=el.scrollHeight;setNewBelow(0);}else if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches){for(const node of el.querySelectorAll<HTMLElement>("[data-message-id]")){const before=listPositions.current.get(node.dataset.messageId??"");if(before===undefined)continue;const delta=before-node.getBoundingClientRect().top;if(Math.abs(delta)>1&&Math.abs(delta)<700)node.animate([{transform:`translateY(${delta}px)`},{transform:"translateY(0)"}],{duration:240,easing:"cubic-bezier(.2,.72,.2,1)"});}}listPositions.current.clear();},[messages]);
 useEffect(()=>{if(!api||!active)return;const generation=++requestGeneration.current;activeId.current=active.id;pollAbort.current?.abort();const controller=new AbortController();pollAbort.current=controller;observedVisibility.current=null;setMessages([]);setCursor(null);setError("");nearBottom.current=true;let busy=false;
  const load=async()=>{if(busy||controller.signal.aborted||document.visibilityState!=="visible")return;busy=true;try{const page=await api.messages(active.id,undefined,controller.signal);if(generation!==requestGeneration.current||controller.signal.aborted)return;const previous=observedVisibility.current;
    if(previous?.id===active.id&&previous.revision!==(page.visibilityRevision??null)){
      // Invalidate every already-loaded page when either peer hides old content.
      // A stale page must never resurrect a message removed for both members.
      autoScroll.current=false;
      setMessages(old=>reconcileMessages(old.filter(m=>!!m.localState),page.messages));
      setCursor(page.nextCursor);
    }else{
      applyIncoming(page.messages);setCursor(old=>old??page.nextCursor);
    }
    observedVisibility.current={id:active.id,revision:page.visibilityRevision??null};
    const newest=[...page.messages].reverse().find(m=>m.senderId!==actorId&&!m.deletedAt);if(newest)void api.markRead(active.id,newest.id,controller.signal).catch(()=>{});setError("");}catch(e){if(!controller.signal.aborted)showError(e,"Связь прервана.");}finally{busy=false;}};
  void load();const timer=window.setInterval(()=>void load(),3500);return()=>{controller.abort();window.clearInterval(timer);};},[active,api,actorId,applyIncoming]);
 const open=(chat:ChatWireConversation)=>{releaseAttachment();setDraft("");setAction(null);setChatMenu(false);setClearDialog(false);setActive(chat);onThreadChange?.(true);activeId.current=chat.id;history.current?.scrollTo({top:0});};
 const openMatch=async(match:NewMatch)=>{if(!api)return;try{const conversationId=await openNewMatch(match.id);const chat:ChatWireConversation={
  id:conversationId,matchId:match.id,peerId:match.peerId,peerProfileId:match.peerProfileId,
  peerName:match.peerName,peerPhotoUrl:match.peerPhotoUrl,lastMessage:null,lastActivityAt:match.createdAt,
  unreadCount:0,access:"active"};setActiveNewMatch({...match,seen:true,conversationId});
  setNewMatches(old=>old.map(item=>item.id===match.id?{...item,seen:true,conversationId}:item));open(chat);
 }catch(e){showError(e,"Не удалось открыть новое знакомство.");}};
 const close=useCallback(()=>{pollAbort.current?.abort();requestGeneration.current++;activeId.current=null;setActive(null);setActiveNewMatch(null);onThreadChange?.(false);setMessages([]);setAction(null);setChatMenu(false);setClearDialog(false);releaseAttachment();void Promise.all([refreshList(),refreshMatches()]).catch(()=>{});},[onThreadChange,refreshList,refreshMatches,releaseAttachment]);
 useEffect(()=>{if(!active){registerThreadBack?.(null);return;}registerThreadBack?.(close);
  const button=window.Telegram?.WebApp?.BackButton;button?.show();button?.onClick(close);
  return()=>{registerThreadBack?.(null);button?.offClick(close);button?.hide();};
 },[active,close,registerThreadBack]);
 const loadOlder=async()=>{if(!api||!active||!cursor||loadingOlder)return;const el=history.current;const oldHeight=el?.scrollHeight??0;setLoadingOlder(true);try{const page=await api.messages(active.id,cursor);if(activeId.current!==active.id)return;setMessages(old=>prependPage(old,page.messages));setCursor(page.nextCursor);requestAnimationFrame(()=>{if(el)el.scrollTop+=el.scrollHeight-oldHeight;});}catch(e){showError(e);}finally{setLoadingOlder(false);}};
 const chooseFile=(file:File|undefined)=>{if(!file)return;const problem=validateChatImage(file);if(problem){setError(problem);return;}releaseAttachment();const url=URL.createObjectURL(file);objectUrls.current.add(url);setAttachment({file,url,progress:0,error:null});setError("");};
 const send=async(existing?:LocalMessage)=>{if(!api||!active)return;const body=existing?.body??draft.trim();const clientId=existing?.clientId??crypto.randomUUID();const mediaFile=existing?pendingFiles.current.get(clientId):attachment?.file;if(!body&&!mediaFile)return;const localId=existing?.id??"local:"+clientId;const createdAt=existing?.createdAt??new Date().toISOString();const preview=existing?.localPreviewUrl??attachment?.url;if(mediaFile)pendingFiles.current.set(clientId,mediaFile);const optimistic:LocalMessage={id:localId,conversationId:active.id,senderId:actorId,clientId,body,createdAt,editedAt:null,deletedAt:null,deliveredAt:null,readAt:null,media:[],localState:"sending",localPreviewUrl:preview};
  autoScroll.current=true;setMessages(old=>reconcileMessages(old.filter(m=>m.id!==localId),[optimistic]));if(!existing){setDraft("");setAttachment(null);}try{let mediaIds:string[]=[];if(mediaFile){const uploaded=await api.createMedia(active.id,mediaFile,clientId);mediaIds=[uploaded.media.id];}const result=await api.send(active.id,body,clientId,mediaIds);if(activeId.current!==active.id)return;pendingFiles.current.delete(clientId);setMessages(old=>reconcileMessages(old,[result.message]));if(preview&&objectUrls.current.has(preview)){URL.revokeObjectURL(preview);objectUrls.current.delete(preview);}setNewMatches(old=>old.filter(match=>match.id!==active.matchId));setActiveNewMatch(null);void Promise.all([refreshList(),refreshMatches()]);}catch(e){if(activeId.current===active.id)setMessages(old=>old.map(m=>m.id===localId?{...m,localState:"failed"}:m));showError(e,"Сообщение не отправлено.");}};
 const edit=async()=>{if(!api||!active||!action||action.kind!=="edit")return;const body=editValue.trim();if(!body||body.length>4000)return;try{const result=await api.edit(active.id,action.message.id,body);setMessages(old=>reconcileMessages(old,[result.message]));setAction(null);}catch(e){showError(e);}};
 const remove=async()=>{if(!api||!active||!action||action.kind!=="delete")return;try{await api.remove(active.id,action.message.id,deleteScope);const id=action.message.id;setMessages(old=>old.filter(message=>message.id!==id));setAction(null);void refreshList().catch(()=>{});}catch(e){showError(e);}};
 const exportChat=async()=>{if(!api||!active||exportBusy)return;setChatMenu(false);setExportBusy(true);try{
  const rows:Array<{id:string;own:boolean;body:string;createdAt:string;editedAt:string|null}>=[];
  let before:string|undefined;const cursors=new Set<string>();
  for(let page=0;page<200;page++){
   const result=await api.exportPage(active.id,before);
   rows.push(...result.messages);
   if(!result.nextCursor){before=undefined;break;}
   if(cursors.has(result.nextCursor))throw new Error("export_cursor_loop");
   cursors.add(result.nextCursor);before=result.nextCursor;
  }
  if(before)throw new Error("export_too_large");
  const file=new Blob([JSON.stringify({format:"luemi-chat-export-v1",generatedAt:new Date().toISOString(),
   notice:"Только доступная вам история. Удалённые для обоих сообщения не экспортируются.",
   messages:rows.reverse()},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(file),link=document.createElement("a");
  link.href=url;link.download="luemi-chat-"+active.id+".json";link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),10000);
 }catch{setError("Не удалось экспортировать переписку. Повтори позже.");}finally{setExportBusy(false);}};
 const clear=async()=>{if(!api||!active)return;try{await api.clear(active.id,deleteScope);setClearDialog(false);close();}catch(e){showError(e);}};
 const pointerDown=(e:React.PointerEvent,id:string)=>{if(e.pointerType==="mouse"&&e.button!==0)return;pointer.current={x:e.clientX,y:e.clientY,id};hold.current=window.setTimeout(()=>{const message=messages.find(m=>m.id===id);if(message&&!message.localState)setAction({message,kind:"menu"});},470);};
 const pointerMove=(e:React.PointerEvent)=>{if(pointer.current&&Math.hypot(e.clientX-pointer.current.x,e.clientY-pointer.current.y)>12&&hold.current!==null){window.clearTimeout(hold.current);hold.current=null;}};
 const pointerEnd=()=>{if(hold.current!==null)window.clearTimeout(hold.current);hold.current=null;pointer.current=null;};
 const grouped=messages.reduce<Array<{day:string;items:LocalMessage[]}>>((days,message)=>{const day=dayKey(message.createdAt);const last=days[days.length-1];if(last?.day===day)last.items.push(message);else days.push({day,items:[message]});return days;},[]);
 const normalizedQuery=query.trim().toLocaleLowerCase("ru-RU");
 const filteredConversations=conversations.filter(chat=>(category==="all"||category==="matches")&&
  (!normalizedQuery||chat.peerName.toLocaleLowerCase("ru-RU").includes(normalizedQuery)||(chat.lastMessage??"").toLocaleLowerCase("ru-RU").includes(normalizedQuery)));
 if(!active)return <section className="luemi-chats lc-route lc-list-route" data-real-chats="true">
  <header className="lc-heading"><h2>Чаты</h2><div className="lc-heading-actions">
   <LuemiIconButton label={searchOpen?"Закрыть поиск":"Найти чат"} onClick={()=>{setSearchOpen(open=>!open);if(searchOpen)setQuery("");}}><Search size={19}/></LuemiIconButton>
   <LuemiIconButton label="Обновить чаты" onClick={()=>void refreshList().catch(showError)}><RefreshCw size={18}/></LuemiIconButton>
  </div></header>
  {searchOpen&&<label className="lc-search"><Search size={17}/><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Поиск по чатам"/><button type="button" aria-label="Закрыть поиск" onClick={()=>{setSearchOpen(false);setQuery("");}}><X size={16}/></button></label>}
  {newMatches.length>0&&<section className="lc-new-matches" aria-label="Новые взаимные симпатии"><div className="lc-new-matches-head"><h3>Новые совпадения</h3><span>{newMatches.length}</span></div><div className="lc-match-rail">{newMatches.map(match=><button type="button" key={match.id} className={match.seen?"is-seen":""} onClick={()=>void openMatch(match)}><LuemiAvatar name={match.peerName} src={match.peerPhotoUrl}/><span>{match.peerName}</span></button>)}</div></section>}
  <LuemiGlassPanel className="lc-categories-panel"><LuemiSegmentedTabs items={chatCategories} value={category} onChange={setCategory} label="Категории чатов" className="lc-categories"/></LuemiGlassPanel>
  {loading?<div className="lc-state" role="status"><span className="lc-spinner"/>Загружаем переписки…</div>:error&&conversations.length===0?<LuemiEmptyState icon={MessagesSquare} title="Чаты не загрузились" description={error}><button className="lc-retry-list" onClick={()=>{setLoading(true);setError("");void refreshList().catch(showError).finally(()=>setLoading(false));}}>Повторить</button></LuemiEmptyState>:filteredConversations.length===0?<LuemiEmptyState icon={normalizedQuery?Search:MessagesSquare} title={normalizedQuery?"Ничего не найдено":"Пока тихо"} description={normalizedQuery?"Попробуй изменить запрос.":"Переписка появится после взаимной симпатии."}/>:<div className="lc-conversations">{filteredConversations.map(chat=><button className="lc-chat-row" key={chat.id} onClick={()=>open(chat)}><LuemiAvatar name={chat.peerName} src={chat.peerPhotoUrl}/><span className="lc-chat-summary"><strong>{chat.peerName}</strong><span>{chat.lastMessage??"Начните разговор"}</span></span><span className="lc-meta"><time>{time(chat.lastActivityAt)}</time>{chat.unreadCount>0&&<b>{Math.min(chat.unreadCount,99)}{chat.unreadCount>99?"+":""}</b>}</span></button>)}</div>}
 </section>;
 return <section className="luemi-chats lc-route lc-thread-route" data-real-chats="true"><header className="lc-chat-header"><LuemiIconButton label="Назад" onClick={close}><ArrowLeft/></LuemiIconButton><button type="button" className="lc-person" disabled={active.peerName==="Удалённый аккаунт"} onClick={()=>{if(active.peerName!=="Удалённый аккаунт")onOpenProfile?.(active.peerProfileId);}}><LuemiAvatar name={active.peerName} src={active.peerPhotoUrl} size="small"/><span><strong>{active.peerName}</strong><small>{active.peerName==="Удалённый аккаунт"?"Профиль недоступен":"Открыть профиль"}</small></span></button><LuemiIconButton label="Меню переписки" onClick={()=>setChatMenu(true)}><MoreVertical/></LuemiIconButton></header>
  <div ref={history} className="lc-history" role="log" aria-live="polite" onScroll={e=>{nearBottom.current=isNearBottom(e.currentTarget);if(nearBottom.current)setNewBelow(0);}} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}>
   {cursor&&<button className="lc-load-older" disabled={loadingOlder} onClick={()=>void loadOlder()}>{loadingOlder?"Загрузка…":"Показать раньше"}</button>}
   {activeNewMatch&&messages.length===0&&<div className="lc-match-welcome"><div className="lc-match-heart"><Heart size={25}/></div><h2>У вас взаимная симпатия</h2><p>Начните ваше знакомство — первое сообщение появится в списке чатов только после отправки.</p><div className="lc-match-suggestions">{[
    `Привет! ${viewerGender==="woman"?"Я увидела":"Я увидел"}, что у нас есть общие интересы.`,
    activeNewMatch.interests[0]?`Привет! Тебе тоже нравится «${activeNewMatch.interests[0]}»?`:`Привет! ${viewerGender==="woman"?"Рада":"Рад"} нашей взаимной симпатии.`,
    "Как проходит твой день?"
   ].map(text=><button type="button" key={text} onClick={()=>setDraft(text)}>{text}</button>)}</div></div>}
   {grouped.map(group=><div className="lc-day-group" key={group.day}><div className="lc-day">{group.day}</div>{group.items.map(message=>{const own=message.senderId===actorId;const label=status(message,own);return <div data-message-id={message.id} key={message.id} className={"lc-msg-line "+(own?"lc-own ":"")+(message.localState??"")} onPointerDown={e=>pointerDown(e,message.id)} onContextMenu={e=>{e.preventDefault();if(!message.localState)setAction({message,kind:"menu"});}}><div className="lc-bubble">{message.deletedAt?<em>Сообщение удалено</em>:<>{(message.localPreviewUrl||message.media[0]?.url)&&<button className="lc-photo-open" onClick={()=>setViewer(message.localPreviewUrl||message.media[0]?.url||null)}><img src={message.localPreviewUrl||message.media[0]?.url||""} alt="Фото в сообщении"/></button>}{message.body&&<span>{message.body}</span>}</>}<small><time>{time(message.createdAt)}</time>{message.editedAt&&" · изм."}{label&&<span title={label}>{message.readAt?<CheckCheck size={13}/>:<Check size={13}/>}</span>}</small>{message.localState==="failed"&&<button className="lc-retry" onClick={()=>void send(message)}>Повторить</button>}</div></div>;})}</div>)}
  </div>
  {newBelow>0&&<button className="lc-new" onClick={()=>{if(history.current)history.current.scrollTop=history.current.scrollHeight;setNewBelow(0);}}>Новые сообщения · {newBelow}</button>}
  {active.access==="active"?<footer className="lc-composer">{attachment&&<div className="lc-attachment"><img src={attachment.url} alt="Фото перед отправкой"/><span style={{width:`${attachment.progress}%`}}/><button onClick={releaseAttachment} aria-label="Убрать фото"><X size={16}/></button></div>}<div className="lc-input-row"><input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{chooseFile(e.target.files?.[0]);e.target.value="";}}/><button type="button" aria-label="Добавить фото" onClick={()=>fileInput.current?.click()}><ImagePlus/></button><textarea rows={1} value={draft} maxLength={4000} placeholder="Сообщение…" aria-label="Сообщение" onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send();}}}/><button type="button" className="lc-send" disabled={!draft.trim()&&!attachment} onClick={()=>void send()} aria-label="Отправить"><Send size={18}/></button></div></footer>:<div className="lc-state" role="status">Переписка доступна только для чтения. Аккаунт удалён.</div>}
  {error&&<div className="lc-notice" role="alert">{error}<button onClick={()=>setError("")} aria-label="Закрыть"><X size={15}/></button></div>}
  {action?.kind==="menu"&&<div className="lc-overlay" onClick={e=>{if(e.target===e.currentTarget)setAction(null);}}><div className="lc-menu" role="dialog" aria-modal="true"><button onClick={()=>void navigator.clipboard.writeText(action.message.body).then(()=>setAction(null)).catch(()=>setError("Не удалось скопировать."))}><Copy size={18}/>Копировать</button>{action.message.senderId===actorId&&!action.message.deletedAt&&<button onClick={()=>{setEditValue(action.message.body);setAction({...action,kind:"edit"});}}><Pencil size={18}/>Редактировать</button>}{!action.message.deletedAt&&<button className="danger" onClick={()=>{setDeleteScope("me");setAction({...action,kind:"delete"});}}><Trash2 size={18}/>Удалить</button>}<button onClick={()=>setAction(null)}>Отмена</button></div></div>}
  {action?.kind==="edit"&&<div className="lc-overlay"><form className="lc-dialog" onSubmit={e=>{e.preventDefault();void edit();}}><h3>Редактировать сообщение</h3><textarea autoFocus maxLength={4000} value={editValue} onChange={e=>setEditValue(e.target.value)}/><div><button type="button" onClick={()=>setAction(null)}>Отмена</button><button type="submit" disabled={!editValue.trim()}>Сохранить</button></div></form></div>}
  {action?.kind==="delete"&&<div className="lc-overlay"><div className="lc-dialog" role="alertdialog" aria-modal="true"><h3>Удалить сообщение?</h3><p>Выбери, где убрать сообщение. Оба варианта доступны для своих и полученных сообщений.</p><label className="lc-delete-choice"><input type="radio" name="message-delete-scope" checked={deleteScope==="me"} onChange={()=>setDeleteScope("me")}/> Только у меня</label><label className="lc-delete-choice"><input type="radio" name="message-delete-scope" checked={deleteScope==="everyone"} onChange={()=>setDeleteScope("everyone")}/> У меня и собеседника</label><div><button onClick={()=>setAction(null)}>Отмена</button><button className="danger" onClick={()=>void remove()}>Удалить</button></div></div></div>}
  
  {chatMenu&&<div className="lc-overlay" onClick={e=>{if(e.target===e.currentTarget)setChatMenu(false);}}><div className="lc-menu" role="dialog" aria-modal="true"><button onClick={()=>void exportChat()} disabled={exportBusy}><Copy size={18}/>Скачать историю переписки</button><button className="danger" onClick={()=>{setChatMenu(false);setDeleteScope("me");setClearDialog(true);}}><Trash2 size={18}/>Удалить переписку</button><button onClick={()=>setChatMenu(false)}>Отмена</button></div></div>}
  {clearDialog&&<div className="lc-overlay"><div className="lc-dialog" role="alertdialog" aria-modal="true"><h3>Удалить переписку?</h3><p>Удалить всю историю можно у себя или одновременно у обоих. Это нельзя отменить через интерфейс.</p><label className="lc-delete-choice"><input type="radio" name="chat-delete-scope" checked={deleteScope==="me"} onChange={()=>setDeleteScope("me")}/> Только у меня</label><label className="lc-delete-choice"><input type="radio" name="chat-delete-scope" checked={deleteScope==="everyone"} onChange={()=>setDeleteScope("everyone")}/> У меня и собеседника</label><div><button onClick={()=>setClearDialog(false)}>Отмена</button><button className="danger" onClick={()=>void clear()}>Удалить</button></div></div></div>}
  {viewer&&<ChatPhotoViewer src={viewer} onClose={()=>setViewer(null)}/>}
 </section>;
}
