import type {ChatConversationContract,ChatMessageContract,ChatMediaContract} from "@luemi/contracts";

export type ChatWireConversation=ChatConversationContract;
export type ChatWireMessage=ChatMessageContract;
export type ChatWireMedia=ChatMediaContract;
export type ChatMessagePage={messages:ChatWireMessage[];nextCursor:string|null};

export class ChatTransportError extends Error {
 constructor(readonly status:number,readonly code:string,readonly retryAfterMs?:number){super(code);}
 get retryable(){return this.status===0||this.status===408||this.status===429||this.status>=500;}
}

async function request<T>(path:string,csrf:string,init:RequestInit={}):Promise<T>{
 const headers=new Headers(init.headers);
 headers.set("X-Luemi-CSRF",csrf);
 if(init.body&&!(init.body instanceof FormData)&&!(init.body instanceof Blob))headers.set("Content-Type","application/json");
 let response:Response;
 try{response=await fetch("/api/v4/chats"+path,{...init,headers,credentials:"same-origin",cache:"no-store"});}
 catch{if(init.signal?.aborted)throw new DOMException("Aborted","AbortError");throw new ChatTransportError(0,"offline");}
 if(!response.ok){
  let code="request_failed",retryAfterMs:number|undefined;
  try{const body=await response.json() as {error?:unknown;retryAfterMs?:unknown};
   if(typeof body.error==="string")code=body.error;
   if(typeof body.retryAfterMs==="number")retryAfterMs=body.retryAfterMs;
  }catch{/* Fail without leaking response text. */}
  throw new ChatTransportError(response.status,code,retryAfterMs);
 }
 return response.json() as Promise<T>;
}

export interface ChatTransport {
 me(signal?:AbortSignal):Promise<{actorId:string}>;
 list(signal?:AbortSignal):Promise<{conversations:ChatWireConversation[]}>;
 messages(conversationId:string,before?:string,signal?:AbortSignal):Promise<ChatMessagePage>;
 send(conversationId:string,body:string,clientId:string,mediaIds?:string[],signal?:AbortSignal):Promise<{message:ChatWireMessage}>;
 edit(conversationId:string,messageId:string,body:string,signal?:AbortSignal):Promise<{message:ChatWireMessage}>;
 remove(conversationId:string,messageId:string,scope:"me"|"everyone",signal?:AbortSignal):Promise<{removed:true;scope:"me"|"everyone";messageId:string}>;
 clear(conversationId:string,scope:"me"|"everyone",signal?:AbortSignal):Promise<{removed:true;scope:"me"|"everyone";conversationId:string}>;
 markRead(conversationId:string,messageId:string,signal?:AbortSignal):Promise<{read:true;readAt:string}>;
 createMedia(conversationId:string,file:File,clientId:string,signal?:AbortSignal):Promise<{media:ChatWireMedia}>;
 mediaUrl(conversationId:string,mediaId:string,signal?:AbortSignal):Promise<{url:string;expiresAt:string}>;
}

export function createChatTransport(csrf:string):ChatTransport{
 if(!/^[A-Za-z0-9_-]{8,128}$/.test(csrf))throw new Error("Missing authenticated chat session");
 const id=(value:string)=>encodeURIComponent(value);
 return {
  me:signal=>request("/me",csrf,{signal}),
  list:signal=>request("",csrf,{signal}),
  messages:(conversationId,before,signal)=>request("/"+id(conversationId)+"/messages"+(before?"?before="+id(before):""),csrf,{signal}),
  send:(conversationId,body,clientId,mediaIds=[],signal)=>request("/"+id(conversationId)+"/messages",csrf,{method:"POST",body:JSON.stringify({body,clientId,mediaIds}),signal}),
  edit:(conversationId,messageId,body,signal)=>request("/"+id(conversationId)+"/messages/"+id(messageId),csrf,{method:"PATCH",body:JSON.stringify({body}),signal}),
  remove:(conversationId,messageId,scope,signal)=>request("/"+id(conversationId)+"/messages/"+id(messageId)+"/visibility",csrf,{method:"POST",body:JSON.stringify({scope}),signal}),
  clear:(conversationId,scope,signal)=>request("/"+id(conversationId)+"/clear",csrf,{method:"POST",body:JSON.stringify({scope}),signal}),
  markRead:(conversationId,messageId,signal)=>request("/"+id(conversationId)+"/read",csrf,{method:"POST",body:JSON.stringify({messageId}),signal}),
  createMedia:(conversationId,file,clientId,signal)=>request("/"+id(conversationId)+"/media",csrf,{method:"POST",body:file,headers:{"Content-Type":file.type,"X-Luemi-Client-Id":clientId},signal}),
  mediaUrl:(conversationId,mediaId,signal)=>request("/"+id(conversationId)+"/media/"+id(mediaId)+"/url",csrf,{signal})
 };
}
