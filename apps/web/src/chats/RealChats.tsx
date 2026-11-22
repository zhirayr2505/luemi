import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from "react";
import type {MouseEvent,PointerEvent} from "react";
import {ArrowLeft,ArrowRight,Reply,Check,CheckCheck,Copy,Heart,ImagePlus,MoveDown,Menu,Bell,BellOff,ShieldBan,Search,Send,Trash2,X,MessagesSquare,ListFilter,Images,ChevronUp,ChevronDown} from "lucide-react";
import {createChatTransport,sumUnreadMessages,ChatTransportError,type ChatTransport,type ChatWireConversation} from "./chat-transport.js";
import {errorText,isNearBottom,messageKey,prependPage,reconcileMessages,type LocalMessage,validateChatImage} from "./chat-domain.js";
import type {ChatReactionEmoji,ChatReply} from "@luemi/contracts";
import {ChatMessageMenu} from "./ChatMessageMenu.js";
import {useChatGestures} from "./chat-gestures.js";
import {ChatAttachments} from "./ChatAttachments.js";
import {ChatPhotoViewer} from "./ChatPhotoViewer.js";
import {geoCsrf} from "../auth/session-adapter.js";
import {blockPublishedUser,getNewMatches,openNewMatch,type NewMatch} from "../registration/real-live-client.js";
import {LuemiAvatar,LuemiEmptyState,LuemiIconButton} from "../ui/LuemiV5.js";
import "./chats.css";
import "./surreal-chats.css";
import "./chat-conversation.css";

type Action={message:LocalMessage;kind:"edit"|"delete"}|null;
type ReactionJob={desired:ChatReactionEmoji|null;confirmed:ChatReactionEmoji|null;version:number;tail:Promise<void>};
const reactionSet=(message:LocalMessage,actorId:string,emoji:ChatReactionEmoji|null)=>[
 ...(message.reactions??[]).filter(item=>item.actorId!==actorId),...(emoji?[{actorId,emoji}]:[])
];
type MessageAnchor={id:string;node:HTMLElement};
const describePresence=(at:string|null)=>{
 if(!at)return "Не в сети";
 const age=Date.now()-Date.parse(at);
 if(age<40000)return "В сети";
 if(age<900000)return "Недавно в сети";
 return "Был(а) в сети "+dayKey(at)+" в "+time(at);
};
type Attachment={file:File;url:string;progress:number;error:string|null};
const dayKey=(iso:string)=>new Date(iso).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"});
const dayLabel=(day:string)=>{
 const now=new Date();
 if(day===dayKey(now.toISOString()))return "Сегодня";
 now.setDate(now.getDate()-1);
 return day===dayKey(now.toISOString())?"Вчера":day;
};
const time=(iso:string)=>new Date(iso).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
const status=(m:LocalMessage,own:boolean)=>!own?null:m.localState==="failed"?"Ошибка":m.localState==="sending"?"Отправка…":m.readAt?"Прочитано":m.deliveredAt?"Доставлено":"Отправлено";

type ProfileThread=NewMatch&{conversationId:string};
function conversationFromMatch(match:ProfileThread):ChatWireConversation{
 return {id:match.conversationId,matchId:match.id,peerId:match.peerId,peerProfileId:match.peerProfileId,
  peerName:match.peerName,peerPhotoUrl:match.peerPhotoUrl,lastMessage:null,lastActivityAt:match.createdAt,
  unreadCount:0,access:"active"};
}

type RealChatsProps={
 transport?:ChatTransport;
 onOpenProfile?:(profileId:string)=>void;
 onThreadChange?:(open:boolean)=>void;
 registerThreadBack?:(handler:(()=>void)|null)=>void;
 initialThread?:ProfileThread;
 onUnreadCount?:(count:number)=>void;
 onDiscover?:()=>void;
 onOpenDemo?:()=>void;
 onExitDemo?:()=>void;
 profileOpen?:boolean;
};

export function RealChats({
 transport:provided,onOpenProfile,onThreadChange,registerThreadBack,initialThread,onUnreadCount,
 onDiscover,onOpenDemo,onExitDemo,profileOpen=false,
}:RealChatsProps={}){
 const csrf=geoCsrf();const api=useMemo(()=>provided??(csrf?createChatTransport(csrf):null),[provided,csrf]);
 const [actorId,setActorId]=useState("");const [conversations,setConversations]=useState<ChatWireConversation[]>([]);const [active,setActive]=useState<ChatWireConversation|null>(()=>initialThread?conversationFromMatch(initialThread):null);
 const [newMatches,setNewMatches]=useState<NewMatch[]>([]);const [viewerGender,setViewerGender]=useState<"man"|"woman"|"other">("other");
 const [activeNewMatch,setActiveNewMatch]=useState<NewMatch|null>(initialThread??null);
 const [messages,setMessages]=useState<LocalMessage[]>([]);const [cursor,setCursor]=useState<string|null>(null);const [draft,setDraft]=useState("");const [attachment,setAttachment]=useState<Attachment|null>(null);
 const [deleteScope,setDeleteScope]=useState<"me"|"everyone">("me");const [chatMenu,setChatMenu]=useState(false);const [exportBusy,setExportBusy]=useState(false);const [clearDialog,setClearDialog]=useState(false);
 const [loading,setLoading]=useState(true);const [loadingOlder,setLoadingOlder]=useState(false);const [error,setError]=useState("");const [action,setAction]=useState<Action>(null);const [editValue,setEditValue]=useState("");const [viewer,setViewer]=useState<string|null>(null);const [newBelow,setNewBelow]=useState(0);
 const [replyTo,setReplyTo]=useState<ChatReply|null>(null);
 const [quotePreview,setQuotePreview]=useState<ChatReply|null>(null);
 const [showAttachments,setShowAttachments]=useState(false);
 const [muted,setMuted]=useState<boolean|null>(null);
 const [savingMute,setSavingMute]=useState(false);
 const [blockDialog,setBlockDialog]=useState(false);
 const [blocking,setBlocking]=useState(false);
 const [demoBlocked,setDemoBlocked]=useState(false);
 const quoteAnchor=useRef<{node:HTMLElement;top:number}|null>(null);
 const quoteMotion=useRef(false);
 const quoteTimer=useRef(0);
 const animateQuote=()=>{
  const el=history.current;
  if(!el)return;
  const top=el.getBoundingClientRect().top;
  const node=Array.from(el.querySelectorAll<HTMLElement>(".lc-msg-line")).find(row=>row.getBoundingClientRect().bottom>top+4);
  quoteAnchor.current=node?{node,top:node.getBoundingClientRect().top}:null;
  quoteMotion.current=true;
  window.clearTimeout(quoteTimer.current);
  quoteTimer.current=window.setTimeout(()=>{quoteAnchor.current=null;quoteMotion.current=false;},250);
 };
 useEffect(()=>()=>window.clearTimeout(quoteTimer.current),[]);
 const [messageMenu,setMessageMenu]=useState<MessageAnchor|null>(null);
 const [selected,setSelected]=useState<string[]>([]);
 const [bulkDelete,setBulkDelete]=useState(false);
 const [deleting,setDeleting]=useState(false);
 const [visibilityRevision,setVisibilityRevision]=useState<string|null>(null);
 const [peerLastSeen,setPeerLastSeen]=useState<string|null>(null);
 const [searchOpen,setSearchOpen]=useState(false);const [query,setQuery]=useState("");const [unreadOnly,setUnreadOnly]=useState(false);const [demoTyping,setDemoTyping]=useState(false);
 const [threadSearchOpen,setThreadSearchOpen]=useState(false);const [threadQuery,setThreadQuery]=useState("");const [threadSearchIndex,setThreadSearchIndex]=useState(0);
 const history=useRef<HTMLDivElement>(null);const fileInput=useRef<HTMLInputElement>(null);const activeId=useRef<string|null>(null);const requestGeneration=useRef(0);const observedVisibility=useRef<{id:string;revision:string|null}|null>(null);const nearBottom=useRef(true);const objectUrls=useRef(new Set<string>());const pendingFiles=useRef(new Map<string,File>());const pollAbort=useRef<AbortController|null>(null);
 const threadOpen=active!==null;
 const [historyLoaded,setHistoryLoaded]=useState(false);
 const autoScroll=useRef(false);
 const renderedMessages=useRef<LocalMessage[]>([]);
 const messageArrivals=useRef(new Set<string>());
 const oldPositions=useRef<Map<string,number>|null>(null);
 const lastRead=useRef<string|null>(null);
 const reactionJobs=useRef(new Map<string,ReactionJob>());
 const nativeBack=!!window.Telegram?.WebApp?.initData&&!!window.Telegram?.WebApp?.BackButton;
 const captureHistory=useCallback(()=>{
  const el=history.current;
  if(!el||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const bounds=el.getBoundingClientRect();
  const positions=new Map<string,number>();
  for(const row of el.querySelectorAll<HTMLElement>("[data-chat-motion-key]")){
   const rect=row.getBoundingClientRect();
   if(rect.bottom>=bounds.top&&rect.top<=bounds.bottom)positions.set(row.dataset.chatMotionKey!,rect.top);
  }
  oldPositions.current=positions;
 },[]);
 const sendField=useRef<HTMLTextAreaElement>(null);
 const buttonPress=useRef<{id:number;x:number;y:number;button:HTMLButtonElement}|null>(null);
 const lastTouch=useRef<{button:HTMLButtonElement;at:number}|null>(null);
 const touchFallback=useRef<number>(0);
 useEffect(()=>()=>window.clearTimeout(touchFallback.current),[]);
 const touchButton=(action:()=>void,keepKeyboard=false)=>({
  onPointerDown:(event:PointerEvent<HTMLButtonElement>)=>{
   if(keepKeyboard&&document.activeElement===sendField.current)event.preventDefault();
   if(event.pointerType==="touch"&&event.isPrimary){
    buttonPress.current={id:event.pointerId,x:event.clientX,y:event.clientY,button:event.currentTarget};
   }
  },
  onPointerCancel:()=>{buttonPress.current=null;},
  onPointerUp:(event:PointerEvent<HTMLButtonElement>)=>{
   const press=buttonPress.current;
   buttonPress.current=null;
   if(!press||press.id!==event.pointerId||press.button!==event.currentTarget||
     Math.hypot(event.clientX-press.x,event.clientY-press.y)>14||
     !press.button.contains(document.elementFromPoint(event.clientX,event.clientY)))return;
   // A click, when dispatched, handles activation before opening a new overlay.
   // Complete the tap when WebView suppresses that click.
   window.clearTimeout(touchFallback.current);
   touchFallback.current=window.setTimeout(()=>{
    if(!press.button.isConnected||press.button.disabled)return;
    lastTouch.current={button:press.button,at:performance.now()};
    action();
   },75);
  },
  onClick:(event:MouseEvent<HTMLButtonElement>)=>{
   window.clearTimeout(touchFallback.current);
   const last=lastTouch.current;
   if(event.detail!==0&&last?.button===event.currentTarget&&performance.now()-last.at<=450)return;
   action();
  }
 });
 const releaseAttachment=useCallback(()=>setAttachment(old=>{if(old){URL.revokeObjectURL(old.url);objectUrls.current.delete(old.url);}return null;}),[]);
 const showError=(e:unknown,fallback="Не удалось выполнить действие.")=>setError(e instanceof ChatTransportError?errorText(e.status,e.code):fallback);
 const updateConversations=useCallback((items:ChatWireConversation[])=>{
  setConversations([...items].sort((a,b)=>b.lastActivityAt.localeCompare(a.lastActivityAt)||a.id.localeCompare(b.id)));
  onUnreadCount?.(sumUnreadMessages(items));
 },[onUnreadCount]);
 const refreshList=useCallback(async(signal?:AbortSignal)=>{if(!api)return;const data=await api.list(signal);if(!signal?.aborted)updateConversations(data.conversations);},[api,updateConversations]);
 const refreshMatches=useCallback(async(signal?:AbortSignal)=>{
  if(provided)return;
  const data=await getNewMatches(signal);
  if(signal?.aborted)return;
  setNewMatches(data.matches);
  setViewerGender(data.viewerGender);
 },[provided]);
 useEffect(()=>{
  if(!api){setError("Требуется авторизация Telegram.");setLoading(false);return;}
  const controller=new AbortController();
  const {signal}=controller;
  void refreshMatches(signal).catch(()=>{});
  void Promise.all([api.me(signal),api.list(signal)])
   .then(([me,data])=>{
    if(signal.aborted)return;
    setActorId(me.actorId);
    updateConversations(data.conversations);
    if(onExitDemo)setActive(data.conversations[0]??null);
    setError("");
   })
   .catch(error=>{if(!signal.aborted)showError(error,"Не удалось загрузить чаты.");})
   .finally(()=>{if(!signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[api,onExitDemo,refreshMatches,updateConversations]);
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
 useEffect(()=>()=>{pollAbort.current?.abort();objectUrls.current.forEach(URL.revokeObjectURL);pendingFiles.current.clear();},[]);
 useLayoutEffect(()=>{
  if(!threadOpen)return;
  onThreadChange?.(true);
  return()=>onThreadChange?.(false);
 },[threadOpen,onThreadChange]);
 const applyIncoming=useCallback((incoming:LocalMessage[],animate:boolean)=>{
  const el=history.current;
  autoScroll.current=!!el&&(!animate||isNearBottom(el));
  if(animate){
   const known=new Set(renderedMessages.current.map(messageKey));
   const arrivals=incoming.map(messageKey).filter(key=>!known.has(key));
   if(arrivals.length&&autoScroll.current)captureHistory();
   if(autoScroll.current)arrivals.forEach(key=>messageArrivals.current.add(key));
   if(el&&!autoScroll.current&&arrivals.length)setNewBelow(count=>count+arrivals.length);
  }
  setMessages(old=>{
   const earliest=incoming[0]?.createdAt;
   const preserved=earliest?old.filter(message=>message.localState||message.createdAt<earliest):
    old.filter(message=>!!message.localState);
   return reconcileMessages(preserved,incoming.map(message=>{
    const job=reactionJobs.current.get(message.id);
    return job?{...message,reactions:reactionSet(message,actorId,job.desired)}:message;
   }));
  });
 },[actorId,captureHistory]);
 useLayoutEffect(()=>{
  renderedMessages.current=messages;
  const el=history.current;
  if(!el)return;
  if(autoScroll.current){
   autoScroll.current=false;
   el.scrollTop=el.scrollHeight;
   nearBottom.current=true;
   setNewBelow(0);
  }
  const previousPositions=oldPositions.current;
  oldPositions.current=null;
  if(previousPositions){
   const offsets=Array.from(el.querySelectorAll<HTMLElement>("[data-chat-motion-key]"),row=>{
    const before=previousPositions.get(row.dataset.chatMotionKey!);
    if(before===undefined)return null;
    row.getAnimations().forEach(animation=>animation.cancel());
    return {row,delta:before-row.getBoundingClientRect().top};
   });
   for(const item of offsets){
    if(item&&Math.abs(item.delta)>.5)item.row.animate([
     {translate:`0 ${item.delta}px`},{translate:"0 0"}
    ],{duration:310,easing:"cubic-bezier(.16,1,.3,1)"});
   }
  }
  const arrivals=messageArrivals.current;
  if(arrivals.size&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
   for(const row of el.querySelectorAll<HTMLElement>("[data-chat-message-key]")){
    if(!arrivals.has(row.dataset.chatMessageKey??""))continue;
    const bubble=row.querySelector<HTMLElement>(".lc-bubble");
    if(typeof bubble?.animate!=="function")continue;
    const direction=row.classList.contains("lc-own")?1:-1;
    bubble.animate([
     {opacity:0,transform:`translate3d(${direction*11}px, 14px, 0) scale(.965)`},
     {opacity:1,transform:"none"}
    ],{duration:310,easing:"cubic-bezier(.16,1,.3,1)"});
   }
  }
  arrivals.clear();
 },[messages]);
 useLayoutEffect(()=>{
  const el=history.current;
  if(!threadOpen||!el||typeof ResizeObserver==="undefined")return;
  const observer=new ResizeObserver(()=>{
   if(quoteMotion.current){
    const anchor=quoteAnchor.current;
    if(anchor?.node.isConnected)el.scrollTop+=anchor.node.getBoundingClientRect().top-anchor.top;
    return;
   }
   if(nearBottom.current)el.scrollTop=el.scrollHeight;
  });
  observer.observe(el);
  return()=>observer.disconnect();
 },[threadOpen]);
 useEffect(()=>{if(!api||!active||!actorId)return;const generation=++requestGeneration.current;activeId.current=active.id;pollAbort.current?.abort();const controller=new AbortController();pollAbort.current=controller;observedVisibility.current=null;messageArrivals.current.clear();oldPositions.current=null;lastRead.current=null;setPeerLastSeen(null);setHistoryLoaded(false);setMessages([]);setCursor(null);setError("");nearBottom.current=true;let busy=false;
  const load=async()=>{if(busy||controller.signal.aborted||document.visibilityState!=="visible")return;busy=true;try{const page=await api.messages(active.id,undefined,controller.signal);if(generation!==requestGeneration.current||controller.signal.aborted)return;const previous=observedVisibility.current;
    if(previous?.id===active.id&&previous.revision!==(page.visibilityRevision??null)){
      // Invalidate every already-loaded page when either peer hides old content.
      // A stale page must never resurrect a message removed for both members.
      autoScroll.current=false;
      const visible=new Set(page.messages.map(message=>message.id));
      setMessageMenu(old=>old&&!visible.has(old.id)?null:old);
      setReplyTo(old=>old&&!visible.has(old.id)?null:old);
      setSelected(old=>old.filter(id=>visible.has(id)));
      setMessages(old=>reconcileMessages(old.filter(m=>!!m.localState),page.messages));
      setCursor(page.nextCursor);
    }else{
      applyIncoming(page.messages,previous!==null);setCursor(old=>old??page.nextCursor);
    }
    observedVisibility.current={id:active.id,revision:page.visibilityRevision??null};setVisibilityRevision(page.visibilityRevision??null);
    setHistoryLoaded(true);
    if(onExitDemo)setDemoTyping(page.typing===true);
    setPeerLastSeen(page.peerLastSeenAt??null);
    const newest=[...page.messages].reverse().find(m=>m.senderId!==actorId&&!m.deletedAt);
    if(newest&&nearBottom.current&&active.access==="active"&&lastRead.current!==newest.id){
     const id=newest.id;
     lastRead.current=id;
     void api.markRead(active.id,id,controller.signal).catch(()=>{if(lastRead.current===id)lastRead.current=null;});
    }
    setError("");}catch(e){if(!controller.signal.aborted)showError(e,"Связь прервана.");}finally{busy=false;}};
  void load();const timer=window.setInterval(()=>void load(),onExitDemo?350:3500);return()=>{controller.abort();window.clearInterval(timer);};},[active,api,actorId,applyIncoming,onExitDemo]);
 const open=(chat:ChatWireConversation)=>{releaseAttachment();setDraft("");setAction(null);setReplyTo(null);setQuotePreview(null);setMessageMenu(null);setSelected([]);setBulkDelete(false);setChatMenu(false);setClearDialog(false);setThreadSearchOpen(false);setThreadQuery("");setActive(chat);activeId.current=chat.id;history.current?.scrollTo({top:0});};
 const openMatch=async(match:NewMatch)=>{if(!api)return;try{const conversationId=await openNewMatch(match.id);
  const opened={...match,seen:true,conversationId};setActiveNewMatch(opened);
  setNewMatches(old=>old.map(item=>item.id===match.id?opened:item));open(conversationFromMatch(opened));
 }catch(e){showError(e,"Не удалось открыть новое знакомство.");}};
 const close=useCallback(()=>{if(onExitDemo){onExitDemo();return;}pollAbort.current?.abort();requestGeneration.current++;activeId.current=null;setActive(null);setActiveNewMatch(null);setMessages([]);setNewBelow(0);setAction(null);setReplyTo(null);setQuotePreview(null);setMessageMenu(null);setSelected([]);setBulkDelete(false);setChatMenu(false);setClearDialog(false);setThreadSearchOpen(false);setThreadQuery("");releaseAttachment();void Promise.all([refreshList(),refreshMatches()]).catch(()=>{});},[onExitDemo,refreshList,refreshMatches,releaseAttachment]);
 const handleBack=useCallback(()=>{
  if(viewer){setViewer(null);return;}
  if(action){setAction(null);return;}
  if(bulkDelete){setBulkDelete(false);return;}
  if(clearDialog){setClearDialog(false);return;}
  if(blockDialog){setBlockDialog(false);return;}
  if(chatMenu){setChatMenu(false);return;}
  if(showAttachments){setShowAttachments(false);return;}
  if(messageMenu){setMessageMenu(null);return;}
  if(selected.length){setSelected([]);return;}
  close();
 },[viewer,action,bulkDelete,clearDialog,blockDialog,chatMenu,showAttachments,messageMenu,selected.length,close]);
 const threadBack=useRef(handleBack);
 useLayoutEffect(()=>{threadBack.current=handleBack;},[handleBack]);
 useEffect(()=>{
  if(!threadOpen||profileOpen)return;
  const back=()=>threadBack.current();
  if(registerThreadBack){
   registerThreadBack(back);
   return()=>registerThreadBack(null);
  }
  const button=window.Telegram?.WebApp?.BackButton;
  if(nativeBack){button?.show();button?.onClick(back);}
  const key=(event:KeyboardEvent)=>{if(event.key==="Escape")back();};
  window.addEventListener("keydown",key);
  return()=>{
   if(nativeBack){button?.offClick(back);button?.hide();}
   window.removeEventListener("keydown",key);
  };
 },[threadOpen,nativeBack,registerThreadBack,profileOpen]);
 const loadOlder=async()=>{if(!api||!active||!cursor||loadingOlder)return;const el=history.current;const oldHeight=el?.scrollHeight??0;setLoadingOlder(true);try{const page=await api.messages(active.id,cursor);if(activeId.current!==active.id)return;setMessages(old=>prependPage(old,page.messages));setCursor(page.nextCursor);requestAnimationFrame(()=>{if(el)el.scrollTop+=el.scrollHeight-oldHeight;});}catch(e){showError(e);}finally{setLoadingOlder(false);}};
 const chooseFile=(file:File|undefined)=>{if(!file)return;const problem=validateChatImage(file);if(problem){setError(problem);return;}releaseAttachment();const url=URL.createObjectURL(file);objectUrls.current.add(url);setAttachment({file,url,progress:0,error:null});setError("");};
 const send=async(existing?:LocalMessage)=>{if(!api||!active||!actorId||demoBlocked)return;const body=existing?.body??draft.trim();const clientId=existing?.clientId??crypto.randomUUID();const quoted=existing?existing.replyTo:replyTo;const mediaFile=existing?pendingFiles.current.get(clientId):attachment?.file;if(!body&&!mediaFile)return;const localId=existing?.id??"local:"+clientId;const createdAt=existing?.createdAt??new Date().toISOString();const preview=existing?.localPreviewUrl??attachment?.url;if(mediaFile)pendingFiles.current.set(clientId,mediaFile);const optimistic:LocalMessage={id:localId,conversationId:active.id,senderId:actorId,clientId,body,createdAt,editedAt:null,deletedAt:null,deliveredAt:null,readAt:null,media:[],replyTo:quoted,localState:"sending",localPreviewUrl:preview};
  if(!existing){captureHistory();messageArrivals.current.add(messageKey(optimistic));}
  autoScroll.current=true;setMessages(old=>reconcileMessages(old.filter(m=>m.id!==localId),[optimistic]));if(!existing){setDraft("");setAttachment(null);setReplyTo(null);}try{let mediaIds:string[]=[];if(mediaFile){const uploaded=await api.createMedia(active.id,mediaFile,clientId);mediaIds=[uploaded.media.id];}const result=await api.send(active.id,body,clientId,mediaIds,undefined,quoted?.id);if(activeId.current!==active.id)return;pendingFiles.current.delete(clientId);setMessages(old=>reconcileMessages(old,[result.message]));if(preview&&objectUrls.current.has(preview)){URL.revokeObjectURL(preview);objectUrls.current.delete(preview);}setNewMatches(old=>old.filter(match=>match.id!==active.matchId));setActiveNewMatch(null);void Promise.all([refreshList(),refreshMatches()]).catch(()=>{});}catch(e){if(activeId.current!==active.id)return;setMessages(old=>old.map(m=>m.id===localId?{...m,localState:"failed"}:m));showError(e,"Сообщение не отправлено.");}};
 const edit=async()=>{if(!api||!active||!action||action.kind!=="edit")return;const body=editValue.trim();if(!body||body.length>4000)return;try{const result=await api.edit(active.id,action.message.id,body);setMessages(old=>reconcileMessages(old,[result.message]));setAction(null);}catch(e){showError(e);}};
 const remove=async()=>{if(!api||!active||!action||action.kind!=="delete")return;try{await api.remove(active.id,action.message.id,deleteScope);const id=action.message.id;dropMessages(new Set([id]));setAction(null);void refreshList().catch(()=>{});}catch(e){showError(e);}};
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
 const beginReply=(id:string)=>{
  const message=renderedMessages.current.find(item=>item.id===id&&!item.localState&&!item.deletedAt);
  if(!message||active?.access!=="active")return;
  setMessageMenu(null);
  animateQuote();
  const quote={id,senderId:message.senderId,body:[...message.body].slice(0,160).join("")||"Фото"};
  setQuotePreview(quote);setReplyTo(quote);
  // Keep the keyboard closed during a swipe. The composer is ready for a tap.
 };
 const applyReaction=(id:string,emoji:ChatReactionEmoji)=>{
  if(!api||!active||active.access!=="active")return;
  const message=renderedMessages.current.find(item=>item.id===id&&!item.localState&&!item.deletedAt);
  if(!message)return;
  const own=message.reactions?.find(item=>item.actorId===actorId)?.emoji??null;
  const job=reactionJobs.current.get(id)??{desired:own,confirmed:own,version:0,tail:Promise.resolve()};
  reactionJobs.current.set(id,job);
  const next=job.desired===emoji?null:emoji;
  const version=++job.version;
  job.desired=next;
  const update=(value:ChatReactionEmoji|null)=>setMessages(old=>old.map(item=>
   item.id===id?{...item,reactions:reactionSet(item,actorId,value)}:item));
  update(next);
  job.tail=job.tail.then(async()=>{
   try{
    await api.setReaction(active.id,id,next);
    job.confirmed=next;
   }catch(e){
    if(job.version===version&&activeId.current===active.id){update(job.confirmed);showError(e);}
   }finally{
    if(job.version===version)reactionJobs.current.delete(id);
   }
  });
 };
 const toggleSelection=(id:string)=>setSelected(old=>old.includes(id)?old.filter(item=>item!==id):old.length<100?[...old,id]:old);
 const openMessage=(target:MessageAnchor)=>{
  if(selected.length){toggleSelection(target.id);return;}
  if(target.node.isConnected)setMessageMenu(target);
 };
 const dropMessages=(ids:Set<string>)=>{
  setMessages(old=>old.filter(item=>!ids.has(item.id)).map(item=>
   item.replyTo&&ids.has(item.replyTo.id)?{...item,replyTo:null}:item));
  setReplyTo(old=>old&&ids.has(old.id)?null:old);
 };
 const deleteSelected=async()=>{
  if(!api||!active||!selected.length||deleting)return;
  setDeleting(true);
  try{
   await api.removeMany(active.id,selected,deleteScope);
   if(activeId.current!==active.id)return;
   dropMessages(new Set(selected));
   setSelected([]);setBulkDelete(false);
   void refreshList().catch(()=>{});
  }catch(e){showError(e);}
  finally{setDeleting(false);}
 };
 useEffect(()=>{
  if(!chatMenu||!api||!active||active.access!=="active"||demoBlocked)return;
  const controller=new AbortController();
  setMuted(null);
  void api.notifications(active.id,controller.signal).then(result=>{if(!controller.signal.aborted)setMuted(result.muted);}).catch(()=>{
   if(!controller.signal.aborted)setError("Не удалось загрузить настройки уведомлений.");
  });
  return()=>controller.abort();
 },[chatMenu,api,active,demoBlocked]);
 const toggleMute=async()=>{
  if(!api||!active||muted===null||savingMute)return;
  setSavingMute(true);
  try{const result=await api.setNotifications(active.id,!muted);setMuted(result.muted);}
  catch(e){showError(e);}
  finally{setSavingMute(false);}
 };
 const toggleBlock=async()=>{
  if(!active||blocking)return;
  setBlocking(true);
  try{
   if(onExitDemo){setDemoBlocked(blocked=>!blocked);setBlockDialog(false);return;}
   await blockPublishedUser(active.peerProfileId);
   setBlockDialog(false);
   close();
  }catch(e){showError(e);}
  finally{setBlocking(false);}
 };
 const modalOpen=!!(viewer||action||chatMenu||clearDialog||bulkDelete||messageMenu||profileOpen||showAttachments||blockDialog);
 const gestures=useChatGestures({
  threadId:active?.id,enabled:threadOpen&&!modalOpen,canBack:!selected.length,
  canReply:active?.access==="active"&&!selected.length&&!demoBlocked,
  onOpen:openMessage,onHeart:target=>{if(selected.length)toggleSelection(target.id);else void applyReaction(target.id,"❤️");},
  onHold:target=>toggleSelection(target.id),onReply:target=>beginReply(target.id),onBack:close,
 });
 const menuMessage=messages.find(message=>message.id===messageMenu?.id);
 const grouped=messages.reduce<Array<{day:string;items:LocalMessage[]}>>((days,message)=>{const day=dayKey(message.createdAt);const last=days[days.length-1];if(last?.day===day)last.items.push(message);else days.push({day,items:[message]});return days;},[]);
 const normalizedQuery=query.trim().toLocaleLowerCase("ru-RU");
 const filteredConversations=conversations.filter(chat=>(!unreadOnly||chat.unreadCount>0)&&(!normalizedQuery||
  chat.peerName.toLocaleLowerCase("ru-RU").includes(normalizedQuery)||
  (chat.lastMessage??"").toLocaleLowerCase("ru-RU").includes(normalizedQuery)));
 const hasMatches=newMatches.length>0;
 const threadSearchMatches=threadQuery.trim()?messages.filter(message=>!message.deletedAt&&message.body.toLocaleLowerCase("ru-RU").includes(threadQuery.trim().toLocaleLowerCase("ru-RU"))):[];
 const jumpToMessage=(id:string)=>{
  const list=history.current;
  const row=Array.from(list?.querySelectorAll<HTMLElement>(".lc-msg-line[data-message-id]")??[]).find(item=>item.dataset.messageId===id);
  if(!row||!list){setError("Это сообщение находится в более ранней части истории. Нажми «Показать раньше».");return;}
  const before=row.getBoundingClientRect(),frame=list.getBoundingClientRect();
  list.scrollTo({top:list.scrollTop+before.top-frame.top-(list.clientHeight-before.height)/2,
   behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
  if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
   row.querySelector<HTMLElement>(".lc-bubble")?.animate([
    {filter:"brightness(1)"},{filter:"brightness(1.55)"},{filter:"brightness(1)"}
   ],{duration:850,easing:"ease-out"});
  }
 };
 const navigateThreadSearch=(delta:number)=>{
  if(!threadSearchMatches.length)return;
  const index=(threadSearchIndex+delta+threadSearchMatches.length)%threadSearchMatches.length;
  setThreadSearchIndex(index);jumpToMessage(threadSearchMatches[index].id);
 };
 const inbox=<section className="luemi-chats lc-route lc-list-route" data-real-chats="true" data-chat-theme="eclipse">
  <div className="lc-inbox-chrome">
   <div className="lc-inbox-brand">
    <img src="/assets/brand/wordmark_original_raster_alpha_W06.webp" alt="LUEMI" width="88" height="30" decoding="async"/>
   </div>
   <header className="lc-heading">
    <h2>Чаты</h2>
    {(conversations.length>0||searchOpen)&&<div className="lc-heading-actions">
     <LuemiIconButton label={unreadOnly?"Показать все чаты":"Только непрочитанные"} aria-pressed={unreadOnly}
      onClick={()=>setUnreadOnly(value=>!value)}><ListFilter size={19}/></LuemiIconButton>
     <LuemiIconButton label={searchOpen?"Закрыть поиск":"Найти чат"} aria-expanded={searchOpen}
      onClick={()=>{setSearchOpen(open=>!open);if(searchOpen)setQuery("");}}>
      {searchOpen?<X size={19}/>:<Search size={19}/>}
     </LuemiIconButton>
    </div>}
   </header>
   {searchOpen&&<label className="lc-search"><Search size={17} aria-hidden="true"/>
    <input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Поиск по чатам" aria-label="Поиск по чатам"/>
   </label>}
  </div>
  {hasMatches&&<section className="lc-new-matches" aria-label="Новые взаимные симпатии">
   <header className="lc-new-matches-head"><h3>Новые совпадения</h3><span>{newMatches.length}</span></header>
   <div className="lc-match-rail">{newMatches.map(match=><button type="button" key={match.id} className={match.seen?"is-seen":""}
    onClick={()=>void openMatch(match)}><LuemiAvatar name={match.peerName} src={match.peerPhotoUrl}/><span>{match.peerName}</span>
   </button>)}</div>
  </section>}
  {loading?<div className="lc-state" role="status"><span className="lc-spinner"/>Загружаем переписки…</div>:
   error&&conversations.length===0?<LuemiEmptyState icon={MessagesSquare} title="Чаты не загрузились" description={error}>
    <button type="button" className="lc-retry-list"
     onClick={()=>{setLoading(true);setError("");void refreshList().catch(showError).finally(()=>setLoading(false));}}>Повторить</button>
   </LuemiEmptyState>:filteredConversations.length===0?<div className="lc-inbox-empty">
    <div className="lc-inbox-mark" aria-hidden="true">{normalizedQuery?<Search size={27}/>:<MessagesSquare size={28}/>}</div>
    <h3>{normalizedQuery?"Ничего не найдено":unreadOnly?"Нет непрочитанных":"Пока нет переписок"}</h3>
    <p>{normalizedQuery?"Попробуй другой запрос.":unreadOnly?"Ты прочитал все новые сообщения.":hasMatches?"Выбери совпадение выше, чтобы написать.":"После взаимной симпатии здесь появится чат."}</p>
    {!unreadOnly&&!normalizedQuery&&!hasMatches&&onDiscover&&<button type="button" className="lc-inbox-primary" onClick={onDiscover}>
     Перейти к знакомствам <ArrowRight size={16} aria-hidden="true"/>
    </button>}
    {!normalizedQuery&&onOpenDemo&&<button type="button" className="lc-demo-link" onClick={onOpenDemo}>Тестовая переписка</button>}
    {onExitDemo&&<button type="button" className="lc-demo-link" onClick={onExitDemo}>Вернуться к чатам</button>}
   </div>:<div className="lc-conversations">{filteredConversations.map(chat=><button type="button" className="lc-chat-row"
    data-unread={chat.unreadCount>0||undefined} key={chat.id} onClick={()=>open(chat)}>
    <LuemiAvatar name={chat.peerName} src={chat.peerPhotoUrl}/>
    <span className="lc-chat-summary"><strong>{chat.peerName}</strong><span>{chat.lastMessage??"Начните разговор"}</span></span>
    <span className="lc-meta"><time>{time(chat.lastActivityAt)}</time>{chat.unreadCount>0&&<b>{Math.min(chat.unreadCount,99)}{chat.unreadCount>99?"+":""}</b>}</span>
   </button>)}</div>}
  {!loading&&onOpenDemo&&(filteredConversations.length>0||error&&conversations.length===0)&&
   <button type="button" className="lc-demo-link" onClick={onOpenDemo}>Тестовая переписка</button>}
 </section>;
 return <div className="lc-conversation-stack">
  <div className="lc-inbox-host" inert={!!active}>{inbox}</div>
  {active&&<section ref={gestures.route} {...gestures.events} data-native-back={nativeBack||undefined}
   inert={showAttachments} className="luemi-chats lc-route lc-thread-route" data-real-chats="true" data-chat-theme="luemi">
  <header className="lc-chat-header">
   <div className="lc-thread-logo"><img src="/assets/brand/wordmark_original_raster_alpha_W06.webp" alt="LUEMI" width="55" height="19"/></div>
   {selected.length>0?<div className="lc-selection lc-header-islands">
    <LuemiIconButton className="lc-island lc-glass" label="Снять выделение" onClick={()=>setSelected([])}><X size={21}/></LuemiIconButton>
    <strong className="lc-glass">Выбрано: {selected.length}</strong>
    <LuemiIconButton className="lc-island lc-glass" label="Удалить выбранные" onClick={()=>{setDeleteScope("me");setBulkDelete(true);}}><Trash2 size={20}/></LuemiIconButton>
   </div>:<div className="lc-header-islands">
    {!nativeBack&&<LuemiIconButton className="lc-island lc-glass" label="Назад" onClick={close}><ArrowLeft size={20}/></LuemiIconButton>}
    <button type="button" className="lc-island lc-glass lc-peer-avatar" aria-label={`Профиль · ${active.peerName}`}
     disabled={!onOpenProfile||active.access!=="active"||demoBlocked} {...touchButton(()=>onOpenProfile?.(active.peerProfileId))}>
     <LuemiAvatar name={active.peerName} src={active.peerPhotoUrl} size="small"/>
    </button>
    <button type="button" className="lc-peer lc-glass" aria-label={`Открыть профиль · ${active.peerName}`}
     disabled={!onOpenProfile||active.access!=="active"||demoBlocked}
     {...touchButton(()=>onOpenProfile?.(active.peerProfileId))}>
     <strong>{active.access==="profile_unavailable"?"Удалённый аккаунт":active.peerName}</strong><small role="status" data-online={describePresence(peerLastSeen)==="В сети"||undefined}>
      {active.access!=="active"?"Профиль недоступен":demoBlocked?"Пользователь заблокирован":demoTyping?"Алина печатает…":describePresence(peerLastSeen)}
     </small>
    </button>
    <LuemiIconButton className="lc-island lc-glass" label="Вложения переписки"
     {...touchButton(()=>{sendField.current?.blur();setShowAttachments(true);})}><Images size={19}/></LuemiIconButton>
    <LuemiIconButton className="lc-island lc-glass" label="Меню переписки" {...touchButton(()=>setChatMenu(true))}><Menu size={21}/></LuemiIconButton>
   </div>}
  </header>
  {threadSearchOpen&&<div className="lc-thread-search lc-glass" role="search">
   <Search size={17} aria-hidden="true"/><input autoFocus value={threadQuery}
    onChange={event=>{setThreadQuery(event.target.value);setThreadSearchIndex(0);}}
    onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();navigateThreadSearch(event.shiftKey?-1:1);}}}
    aria-label="Поиск по загруженным сообщениям" placeholder="Найти в переписке…"/>
   {threadQuery&&<span className="lc-thread-search-count">{threadSearchMatches.length?Math.min(threadSearchIndex+1,threadSearchMatches.length)+" / "+threadSearchMatches.length:"0"}</span>}
   <button type="button" onClick={()=>navigateThreadSearch(-1)} disabled={!threadSearchMatches.length} aria-label="Предыдущее совпадение"><ChevronUp size={17}/></button>
   <button type="button" onClick={()=>navigateThreadSearch(1)} disabled={!threadSearchMatches.length} aria-label="Следующее совпадение"><ChevronDown size={17}/></button>
   <button type="button" onClick={()=>{setThreadSearchOpen(false);setThreadQuery("");}} aria-label="Закрыть поиск"><X size={17}/></button>
  </div>}
  <div ref={history} className="lc-history" role="log" aria-live="polite" onScroll={e=>{nearBottom.current=isNearBottom(e.currentTarget);if(nearBottom.current)setNewBelow(0);setMessageMenu(null);}}>
   {!activeNewMatch&&messages.length===0&&!historyLoaded&&!error&&
    <div className="lc-state lc-history-loading" role="status"><span className="lc-spinner"/>Загружаем сообщения…</div>}
   {cursor&&<button className="lc-load-older" disabled={loadingOlder} onClick={()=>void loadOlder()}>{loadingOlder?"Загрузка…":"Показать раньше"}</button>}
   {activeNewMatch&&messages.length===0&&<div className="lc-match-welcome"><div className="lc-match-heart" aria-hidden="true"><Heart size={27}/></div><h2>У вас взаимная симпатия</h2><p>Начните ваше знакомство — первое сообщение появится в списке чатов только после отправки.</p><div className="lc-match-suggestions">{[
    `Привет! ${viewerGender==="woman"?"Я увидела":"Я увидел"}, что у нас есть общие интересы.`,
    activeNewMatch.interests[0]?`Привет! Тебе тоже нравится «${activeNewMatch.interests[0]}»?`:`Привет! ${viewerGender==="woman"?"Рада":"Рад"} нашей взаимной симпатии.`,
    "Как проходит твой день?"
   ].map(text=><button type="button" key={text} onClick={()=>{setDraft(text);sendField.current?.focus();}}>{text}</button>)}</div></div>}
   {grouped.map(group=><div className="lc-day-group" key={group.day}>
    <div className="lc-day" data-chat-motion-key={"date:"+group.day}>{dayLabel(group.day)}</div>
    {group.items.map((message,index)=>{
     const own=message.senderId===actorId, label=status(message,own);
     const key=messageKey(message);
     const previous=group.items[index-1], next=group.items[index+1];
     const joined=previous?.senderId===message.senderId;
     const last=next?.senderId!==message.senderId;
     const media=message.media[0];
     const photo=message.localPreviewUrl||media?.url;
     const interactive=!message.localState&&!message.deletedAt;
     const checked=selected.includes(message.id);
     return <div key={key} data-message-id={message.id} data-chat-message-key={key} data-chat-motion-key={key}
      data-selected={checked||undefined}
      data-joined={joined||undefined} data-run-end={last||undefined}
      className={`lc-msg-line${own?" lc-own":""}${message.localState?" "+message.localState:""}`}
      onContextMenu={event=>event.preventDefault()}>
      {checked&&interactive&&<button className="lc-select-mark" type="button" aria-label="Снять выделение сообщения" aria-pressed="true"
       onClick={()=>toggleSelection(message.id)}><Check size={14}/></button>}
      {interactive&&<Reply className="lc-swipe-reply" size={19} aria-hidden="true"/>}
      <div className="lc-bubble" data-interactive={interactive||undefined} data-message-id={message.id}
       onClick={event=>{
        if(!interactive||event.detail!==0||gestures.isPointerClick()||(event.target as Element).closest("button"))return;
        openMessage({id:message.id,node:event.currentTarget});
       }} onKeyDown={event=>{
        if(interactive&&event.target===event.currentTarget&&(event.key==="Enter"||event.key===" ")){
         event.preventDefault();openMessage({id:message.id,node:event.currentTarget});
        }
       }} tabIndex={interactive?0:undefined}>
       {message.replyTo&&<button type="button" className="lc-message-quote" aria-label="Перейти к исходному сообщению"
        onClick={event=>{event.stopPropagation();jumpToMessage(message.replyTo!.id);}}><strong>{message.replyTo.senderId===actorId?"Ты":active.peerName}</strong>
        <span>{message.replyTo.body}</span></button>}
       {message.deletedAt?<em>Сообщение удалено</em>:<>
        {photo&&<button type="button" className="lc-photo-open" onClick={()=>setViewer(photo)}><img src={photo} alt="Фото в сообщении" width={media?.width??undefined} height={media?.height??undefined} decoding="async"/></button>}
        {message.body&&<span>{message.body}</span>}
       </>}
       {!!message.reactions?.length&&<div className="lc-message-reactions">
        {[...new Set(message.reactions.map(item=>item.emoji))].map(emoji=>{
         const matching=message.reactions!.filter(item=>item.emoji===emoji);
         return <button type="button" key={emoji} data-own={matching.some(item=>item.actorId===actorId)||undefined}
          disabled={!interactive||active.access!=="active"||demoBlocked} aria-label={`Реакция ${emoji}`}
          className="lc-emoji" onClick={event=>{event.stopPropagation();void applyReaction(message.id,emoji);}}>{emoji}{matching.length>1&&<b>{matching.length}</b>}</button>;
        })}
       </div>}
       <small><time dateTime={message.createdAt}>{time(message.createdAt)}</time>{message.editedAt&&" · изм."}
        {label&&<span data-read={!!message.readAt||undefined} title={label} aria-label={label}>
         {message.readAt?<CheckCheck size={13}/>:<Check size={13}/>}
        </span>}
       </small>
       {message.localState==="failed"&&<button type="button" className="lc-retry" onClick={()=>void send(message)}>Повторить</button>}
      </div>
     </div>;
    })}
   </div>)}
  </div>
  {active.access==="active"&&!demoBlocked?<footer className="lc-composer lc-glass">
   {newBelow>0&&<button type="button" className="lc-new" onClick={()=>{
    const el=history.current;
    if(el)el.scrollTo({top:el.scrollHeight,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
    setNewBelow(0);
   }}><MoveDown size={14} aria-hidden="true"/>Новые сообщения · {newBelow}</button>}
   <div className="lc-quote-slot" data-open={!!replyTo||undefined} onTransitionEnd={event=>{
    if(event.target===event.currentTarget&&event.propertyName==="grid-template-rows"&&!replyTo)setQuotePreview(null);
   }}>
    <div className="lc-quote-clip" inert={!replyTo}>{quotePreview&&<div className="lc-reply-preview">
     <Reply size={17} aria-hidden="true"/><div><strong>{quotePreview.senderId===actorId?"Ответ на своё сообщение":"Ответ · "+active.peerName}</strong>
     <span>{quotePreview.body}</span></div><button type="button" onClick={()=>{animateQuote();setReplyTo(null);}} aria-label="Отменить ответ"><X size={18}/></button>
    </div>}</div>
   </div>
   {attachment&&<div className="lc-attachment"><img src={attachment.url} alt="Фото перед отправкой"/>
    <span style={{transform:`scaleX(${attachment.progress/100})`}}/>
    <button type="button" onClick={releaseAttachment} aria-label="Убрать фото"><X size={16}/></button>
   </div>}
   <div className="lc-input-row">
    <input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/webp"
     onChange={event=>{chooseFile(event.target.files?.[0]);event.target.value="";}}/>
    <button type="button" aria-label="Добавить фото" onClick={()=>fileInput.current?.click()}><ImagePlus size={22}/></button>
    <textarea ref={sendField} rows={1} value={draft} maxLength={4000} placeholder="Сообщение…" aria-label="Сообщение"
     onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{
      if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void send();}
     }}/>
    <button type="button" className="lc-send" disabled={!actorId||!draft.trim()&&!attachment}
     {...touchButton(()=>{void send();},true)} aria-label="Отправить"><Send size={19} aria-hidden="true" style={{pointerEvents:"none"}}/></button>
   </div>
  </footer>:<div className="lc-state lc-read-only" role="status">{demoBlocked?"Пользователь заблокирован":"Переписка доступна только для чтения. Аккаунт удалён."}</div>}
  {error&&<div className="lc-notice" role="alert">{error}<button onClick={()=>setError("")} aria-label="Закрыть"><X size={15}/></button></div>}
  {messageMenu&&menuMessage&&<ChatMessageMenu message={menuMessage} anchor={messageMenu.node} actorId={actorId}
   writable={active.access==="active"&&!demoBlocked} onCancel={()=>setMessageMenu(null)}
   onReply={()=>beginReply(menuMessage.id)}
   onCopy={()=>{void navigator.clipboard.writeText(menuMessage.body).then(()=>setMessageMenu(null)).catch(()=>setError("Не удалось скопировать."));}}
   onEdit={()=>{setEditValue(menuMessage.body);setMessageMenu(null);setAction({message:menuMessage,kind:"edit"});}}
   onDelete={()=>{setMessageMenu(null);setDeleteScope("me");setAction({message:menuMessage,kind:"delete"});}}
   onReaction={emoji=>{setMessageMenu(null);void applyReaction(menuMessage.id,emoji);}}/>}
  {bulkDelete&&<div className="lc-overlay"><div className="lc-dialog" role="alertdialog" aria-modal="true">
   <h3>Удалить выбранные сообщения?</h3><p>Выбрано: {selected.length}</p>
   <label className="lc-delete-choice"><input type="radio" name="selected-scope" checked={deleteScope==="me"} onChange={()=>setDeleteScope("me")}/>Только у меня</label>
   <label className="lc-delete-choice"><input type="radio" name="selected-scope" checked={deleteScope==="everyone"} onChange={()=>setDeleteScope("everyone")}/>У меня и собеседника</label>
   <div><button onClick={()=>setBulkDelete(false)} disabled={deleting}>Отмена</button>
   <button className="danger" onClick={()=>void deleteSelected()} disabled={deleting||!selected.length}>Удалить</button></div>
  </div></div>}
  {action?.kind==="edit"&&<div className="lc-overlay"><form className="lc-dialog" onSubmit={e=>{e.preventDefault();void edit();}}><h3>Редактировать сообщение</h3><textarea autoFocus maxLength={4000} value={editValue} onChange={e=>setEditValue(e.target.value)}/><div><button type="button" onClick={()=>setAction(null)}>Отмена</button><button type="submit" disabled={!editValue.trim()}>Сохранить</button></div></form></div>}
  {action?.kind==="delete"&&<div className="lc-overlay"><div className="lc-dialog" role="alertdialog" aria-modal="true"><h3>Удалить сообщение?</h3><p>Выбери, где убрать сообщение. Оба варианта доступны для своих и полученных сообщений.</p><label className="lc-delete-choice"><input type="radio" name="message-delete-scope" checked={deleteScope==="me"} onChange={()=>setDeleteScope("me")}/> Только у меня</label><label className="lc-delete-choice"><input type="radio" name="message-delete-scope" checked={deleteScope==="everyone"} onChange={()=>setDeleteScope("everyone")}/> У меня и собеседника</label><div><button onClick={()=>setAction(null)}>Отмена</button><button className="danger" onClick={()=>void remove()}>Удалить</button></div></div></div>}
  
  {chatMenu&&<div className="lc-overlay" onClick={e=>{if(e.target===e.currentTarget)setChatMenu(false);}}>
   <div className="lc-menu lc-glass" role="dialog" aria-label="Настройки чата" aria-modal="true">
    {active.access==="active"&&!demoBlocked&&<button disabled={muted===null||savingMute} onClick={()=>{void toggleMute();}}>
     {muted?<Bell size={18}/>:<BellOff size={18}/>} {muted?"Включить уведомления":"Отключить уведомления"}
    </button>}
    <button onClick={()=>void exportChat()} disabled={exportBusy}><Copy size={18}/>Скачать историю переписки</button>
    <button className="danger" onClick={()=>{setChatMenu(false);setDeleteScope("me");setClearDialog(true);}}><Trash2 size={18}/>Удалить переписку</button>
    {active.access==="active"&&<button className="danger" onClick={()=>{setChatMenu(false);setBlockDialog(true);}}>
     <ShieldBan size={18}/> {demoBlocked?"Разблокировать пользователя":"Заблокировать пользователя"}
    </button>}
    <button onClick={()=>setChatMenu(false)}>Отмена</button>
   </div>
  </div>}
  {blockDialog&&<div className="lc-overlay"><div className="lc-dialog lc-glass" role="alertdialog" aria-modal="true" aria-label="Подтверждение блокировки">
   <h3>{demoBlocked?"Разблокировать пользователя?":"Заблокировать пользователя?"}</h3>
   <p>{demoBlocked?"Переписка снова станет доступной.":"После блокировки вы больше не сможете обмениваться сообщениями."}</p>
   <div><button onClick={()=>setBlockDialog(false)}>Отмена</button>
    <button className="danger" disabled={blocking} onClick={()=>{void toggleBlock();}}>{demoBlocked?"Разблокировать":"Заблокировать"}</button></div>
  </div></div>}
  {clearDialog&&<div className="lc-overlay"><div className="lc-dialog" role="alertdialog" aria-modal="true"><h3>Удалить переписку?</h3><p>Удалить всю историю можно у себя или одновременно у обоих. Это нельзя отменить через интерфейс.</p><label className="lc-delete-choice"><input type="radio" name="chat-delete-scope" checked={deleteScope==="me"} onChange={()=>setDeleteScope("me")}/> Только у меня</label><label className="lc-delete-choice"><input type="radio" name="chat-delete-scope" checked={deleteScope==="everyone"} onChange={()=>setDeleteScope("everyone")}/> У меня и собеседника</label><div><button onClick={()=>setClearDialog(false)}>Отмена</button><button className="danger" onClick={()=>void clear()}>Удалить</button></div></div></div>}
 </section>}
 {active&&api&&showAttachments&&<ChatAttachments key={active.id+":"+(visibilityRevision??"")} api={api} threadId={active.id}
  peerName={active.peerName} viewerOpen={!!viewer} onPhoto={setViewer} onBack={()=>setShowAttachments(false)}/>}
 {viewer&&<ChatPhotoViewer src={viewer} onClose={()=>setViewer(null)}/>}
 </div>;
}
