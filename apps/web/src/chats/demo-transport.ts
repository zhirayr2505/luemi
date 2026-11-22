import type {ChatTransport,ChatWireConversation,ChatWireMedia,ChatWireMessage} from "./chat-transport.js";
import {ChatTransportError} from "./chat-transport.js";

const SELF="11111111-1111-4111-8111-111111111111",PEER="22222222-2222-4222-8222-222222222222",CHAT="33333333-3333-4333-8333-333333333333";
const now=Date.now();
const initial:Array<ChatWireMessage>=Array.from({length:64},(_,index)=>({id:`00000000-0000-4000-8000-${String(index+1).padStart(12,"0")}`,conversationId:CHAT,senderId:index%3===0?PEER:SELF,clientId:`10000000-0000-4000-8000-${String(index+1).padStart(12,"0")}`,body:index===63?"С удовольствием 💜":`Демо-сообщение ${index+1}`,createdAt:new Date(now-(64-index)*60000).toISOString(),editedAt:null,deletedAt:null,deliveredAt:new Date(now-(64-index)*59000).toISOString(),readAt:index<60?new Date(now-(64-index)*58000).toISOString():null,media:[]}));

const conversationStarters=[
 "Я сегодня нашла тихое кафе с классным кофе. Ты больше за кофе или за чай?",
 "Люблю вечерние прогулки. Есть место, куда тебе хочется возвращаться?",
 "У меня сегодня настроение включить музыку и долго гулять. Что у тебя сейчас на повторе?",
 "Я за разговоры, после которых хочется продолжить. Расскажешь что-нибудь о себе?"
];

function replyTo(body:string,index:number){
 const text=body.toLocaleLowerCase("ru-RU");
 if(/привет|здравствуй|как дела/.test(text))return "Привет! У меня хорошо. А как проходит твой день?";
 if(/кофе|чай/.test(text))return "Я за кофе. Особенно если есть время спокойно посидеть и поговорить ☕";
 if(/музык|песн|трек/.test(text))return "Я часто слушаю соул по вечерам. Какой трек мне включить первым?";
 if(/встрет|встреч|гуля|прогул/.test(text))return "Я люблю прогулки без спешки. Куда бы ты позвал меня гулять?";
 if(!text.trim())return "Фото получила. Расскажешь, что за момент?";
 return conversationStarters[index%conversationStarters.length];
}

export function createDemoChatTransport({interactive=false}:{interactive?:boolean}={}){
 let offline=false,replyIndex=0;
 const messages=interactive?[{
  ...initial[0],body:"Привет! Я Алина. Напиши мне что-нибудь, и я отвечу 🙂",
  createdAt:new Date(Date.now()-1000).toISOString(),deliveredAt:null,readAt:null
 }]:initial.map(message=>({...message,media:[...message.media]}));
 const media=new Map<string,ChatWireMedia>();
 const replies:{after:number;sourceId:string;body:string}[]=[];
 const appendPeer=(body:string,createdAt=new Date().toISOString())=>{
  messages.push({id:crypto.randomUUID(),conversationId:CHAT,senderId:PEER,clientId:crypto.randomUUID(),
   body,createdAt,editedAt:null,deletedAt:null,deliveredAt:createdAt,readAt:null,media:[]});
 };
 const flushReplies=()=>{
  const now=Date.now();
  while(replies[0]&&replies[0].after<=now){
   const reply=replies.shift()!;
   const source=messages.find(message=>message.id===reply.sourceId);
   if(source&&!globalHidden.has(source.id)&&Date.parse(source.createdAt)>globalClear){
    source.readAt??=new Date(reply.after-450).toISOString();
    appendPeer(reply.body,new Date(reply.after).toISOString());
   }
  }
 };
 const localHidden=new Set<string>(),globalHidden=new Set<string>();
 let localClear=0,globalClear=0,visibilityRevision=0;
 const visible=()=>{
  flushReplies();
  return messages.filter(m=>!localHidden.has(m.id)&&!globalHidden.has(m.id)&&
   new Date(m.createdAt).getTime()>Math.max(localClear,globalClear))
   .sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
 };
 const pause=async(signal?:AbortSignal)=>{await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,70);signal?.addEventListener("abort",()=>{clearTimeout(timer);reject(new DOMException("Aborted","AbortError"));},{once:true});});if(offline)throw new ChatTransportError(0,"offline");};
 const conversation=():ChatWireConversation=>({id:CHAT,matchId:"44444444-4444-4444-8444-444444444444",peerId:PEER,peerProfileId:"55555555-5555-4555-8555-555555555555",peerName:"Алина",peerPhotoUrl:null,lastMessage:[...visible()].reverse().find(m=>!m.deletedAt)?.body??null,lastActivityAt:visible().at(-1)?.createdAt??new Date().toISOString(),unreadCount:visible().filter(m=>m.senderId===PEER&&!m.readAt).length,access:"active"});
 const transport:ChatTransport={
  async me(signal){await pause(signal);return {actorId:SELF};},async list(signal){await pause(signal);return {conversations:(localClear||globalClear)&&visible().length===0?[]:[conversation()]};},
  async messages(_conversation,before,signal){await pause(signal);const items=visible();const end=before?Math.max(0,items.findIndex(m=>m.id===before)):items.length;const start=Math.max(0,end-20);const visibleIds=new Set(items.map(m=>m.id));return {messages:items.slice(start,end).map(m=>({...m,
   replyTo:m.replyTo&&visibleIds.has(m.replyTo.id)?m.replyTo:null})),nextCursor:start>0?items[start].id:null,
   typing:interactive&&replies.length>0,visibilityRevision:String(visibilityRevision),peerLastSeenAt:interactive?new Date().toISOString():null};},
  async send(_conversation,body,clientId,mediaIds=[],signal,replyToId){await pause(signal);const found=messages.find(m=>m.clientId===clientId);if(found){if(found.body!==body)throw new ChatTransportError(409,"idempotency_conflict");return {message:found};}const replied=visible().find(m=>m.id===replyToId);if(replyToId&&!replied)throw new ChatTransportError(404,"invalid_reply");const created:ChatWireMessage={id:crypto.randomUUID(),conversationId:CHAT,senderId:SELF,clientId,body,createdAt:new Date().toISOString(),editedAt:null,deletedAt:null,deliveredAt:new Date().toISOString(),readAt:null,replyTo:replied?{id:replied.id,senderId:replied.senderId,body:replied.body||"Фото"}:null,media:mediaIds.map(id=>media.get(id)).filter((x):x is ChatWireMedia=>!!x)};messages.push(created);
   if(interactive){
    const after=Math.max(Date.now()+1450,(replies.at(-1)?.after??0)+900);
    replies.push({after,sourceId:created.id,body:replyTo(body,replyIndex++)});
   }
   return {message:created};},
  async setReaction(_conversation,id,emoji){await pause();const item=visible().find(m=>m.id===id);if(!item)throw new ChatTransportError(404,"not_found");
   item.reactions=[...(item.reactions??[]).filter(reaction=>reaction.actorId!==SELF),...(emoji?[{actorId:SELF,emoji}]:[])];return {emoji};},
  async removeMany(_conversation,ids,scope){await pause();if(!ids.every(id=>messages.some(m=>m.id===id)))throw new ChatTransportError(404,"not_found");
   ids.forEach(id=>(scope==="me"?localHidden:globalHidden).add(id));visibilityRevision++;return {removed:true};},
  async presence(){return {ok:true};},
  async edit(_conversation,id,body,signal){await pause(signal);const item=messages.find(m=>m.id===id&&m.senderId===SELF&&!m.deletedAt);if(!item)throw new ChatTransportError(404,"not_found");item.body=body;item.editedAt=new Date().toISOString();return {message:{...item}};},
  async remove(_conversation,id,scope,signal){await pause(signal);const item=messages.find(m=>m.id===id);if(!item)throw new ChatTransportError(404,"not_found");(scope==="me"?localHidden:globalHidden).add(id);visibilityRevision++;return {removed:true,scope,messageId:id};},
  async clear(_conversation,scope,signal){await pause(signal);if(scope==="me")localClear=Date.now();else globalClear=Date.now();visibilityRevision++;return {removed:true,scope,conversationId:CHAT};},
  async exportPage(_conversation,before,signal){await pause(signal);const items=visible();const end=before?Math.max(0,items.findIndex(m=>m.id===before)):items.length;const start=Math.max(0,end-100);return {format:"luemi-chat-export-v1" as const,conversationId:CHAT,generatedAt:new Date().toISOString(),notice:"Только доступная история",messages:items.slice(start,end).map(m=>({id:m.id,own:m.senderId===SELF,body:m.body,createdAt:m.createdAt,editedAt:m.editedAt})),nextCursor:start>0?items[start].id:null};},
  async markRead(_conversation,id,signal){await pause(signal);const at=new Date().toISOString();const target=messages.find(message=>message.id===id);
   if(target)for(const message of messages)if(message.senderId===PEER&&message.createdAt<=target.createdAt&&!message.readAt)message.readAt=at;return {read:true,readAt:at};},
  async createMedia(_conversation,file,_clientId,signal){await pause(signal);const id=crypto.randomUUID();const item:ChatWireMedia={id,messageId:null,mimeType:file.type as ChatWireMedia["mimeType"],byteSize:file.size,width:null,height:null,state:"ready",url:URL.createObjectURL(file)};media.set(id,item);return {media:item};},
  async mediaUrl(_conversation,id,signal){await pause(signal);const item=media.get(id);if(!item?.url)throw new ChatTransportError(404,"not_found");return {url:item.url,expiresAt:new Date(Date.now()+60000).toISOString()};}
 };
 return {
  transport,
  setOffline(value:boolean){offline=value;},
  pushIncoming(){appendPeer("Новое демо-сообщение ✨");},
  dispose(){
   for(const item of media.values())if(item.url)URL.revokeObjectURL(item.url);
   media.clear();
   replies.length=0;
  }
 };
}
