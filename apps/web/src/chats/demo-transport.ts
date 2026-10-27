import type {ChatTransport,ChatWireConversation,ChatWireMedia,ChatWireMessage} from "./chat-transport.js";
import {ChatTransportError} from "./chat-transport.js";

const SELF="11111111-1111-4111-8111-111111111111",PEER="22222222-2222-4222-8222-222222222222",CHAT="33333333-3333-4333-8333-333333333333";
const now=Date.now();
const initial:Array<ChatWireMessage>=Array.from({length:64},(_,index)=>({id:`00000000-0000-4000-8000-${String(index+1).padStart(12,"0")}`,conversationId:CHAT,senderId:index%3===0?PEER:SELF,clientId:`10000000-0000-4000-8000-${String(index+1).padStart(12,"0")}`,body:index===63?"С удовольствием 💜":`Демо-сообщение ${index+1}`,createdAt:new Date(now-(64-index)*60000).toISOString(),editedAt:null,deletedAt:null,deliveredAt:new Date(now-(64-index)*59000).toISOString(),readAt:index<60?new Date(now-(64-index)*58000).toISOString():null,media:[]}));

export function createDemoChatTransport(){
 let offline=false;const messages=[...initial];const media=new Map<string,ChatWireMedia>();
 const pause=async(signal?:AbortSignal)=>{await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,70);signal?.addEventListener("abort",()=>{clearTimeout(timer);reject(new DOMException("Aborted","AbortError"));},{once:true});});if(offline)throw new ChatTransportError(0,"offline");};
 const conversation=():ChatWireConversation=>({id:CHAT,matchId:"44444444-4444-4444-8444-444444444444",peerId:PEER,peerProfileId:"55555555-5555-4555-8555-555555555555",peerName:"Алина",peerPhotoUrl:null,lastMessage:[...messages].reverse().find(m=>!m.deletedAt)?.body??null,lastActivityAt:messages.at(-1)?.createdAt??new Date().toISOString(),unreadCount:messages.filter(m=>m.senderId===PEER&&!m.readAt).length,access:"active"});
 const transport:ChatTransport={
  async me(signal){await pause(signal);return {actorId:SELF};},async list(signal){await pause(signal);return {conversations:[conversation()]};},
  async messages(_conversation,before,signal){await pause(signal);const end=before?Math.max(0,messages.findIndex(m=>m.id===before)):messages.length;const start=Math.max(0,end-20);return {messages:messages.slice(start,end),nextCursor:start>0?messages[start].id:null};},
  async send(_conversation,body,clientId,mediaIds=[],signal){await pause(signal);const found=messages.find(m=>m.clientId===clientId);if(found){if(found.body!==body)throw new ChatTransportError(409,"idempotency_conflict");return {message:found};}const created:ChatWireMessage={id:crypto.randomUUID(),conversationId:CHAT,senderId:SELF,clientId,body,createdAt:new Date().toISOString(),editedAt:null,deletedAt:null,deliveredAt:new Date().toISOString(),readAt:null,media:mediaIds.map(id=>media.get(id)).filter((x):x is ChatWireMedia=>!!x)};messages.push(created);return {message:created};},
  async edit(_conversation,id,body,signal){await pause(signal);const item=messages.find(m=>m.id===id&&m.senderId===SELF&&!m.deletedAt);if(!item)throw new ChatTransportError(404,"not_found");item.body=body;item.editedAt=new Date().toISOString();return {message:{...item}};},
  async remove(_conversation,id,signal){await pause(signal);const item=messages.find(m=>m.id===id&&m.senderId===SELF&&!m.deletedAt);if(!item)throw new ChatTransportError(404,"not_found");item.body="";item.deletedAt=new Date().toISOString();return {message:{...item}};},
  async markRead(_conversation,id,signal){await pause(signal);const at=new Date().toISOString();for(const message of messages)if(message.senderId===PEER&&message.id<=id)message.readAt=at;return {read:true,readAt:at};},
  async createMedia(_conversation,file,_clientId,signal){await pause(signal);const id=crypto.randomUUID();const item:ChatWireMedia={id,messageId:null,mimeType:file.type as ChatWireMedia["mimeType"],byteSize:file.size,width:null,height:null,state:"ready",url:URL.createObjectURL(file)};media.set(id,item);return {media:item};},
  async mediaUrl(_conversation,id,signal){await pause(signal);const item=media.get(id);if(!item?.url)throw new ChatTransportError(404,"not_found");return {url:item.url,expiresAt:new Date(Date.now()+60000).toISOString()};}
 };
 return {transport,setOffline(value:boolean){offline=value;},pushIncoming(){messages.push({id:crypto.randomUUID(),conversationId:CHAT,senderId:PEER,clientId:crypto.randomUUID(),body:"Новое демо-сообщение ✨",createdAt:new Date().toISOString(),editedAt:null,deletedAt:null,deliveredAt:new Date().toISOString(),readAt:null,media:[]});}};
}
