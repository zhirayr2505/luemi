/**
 * LUEMI Chats transport. No fixtures, no fallback to demo when authentication fails.
 * Server routes are deliberately gated and must be provisioned separately.
 */
export type ChatWireMessage = {
 id:string;conversationId:string;senderId:string;body:string;
 createdAt:string;editedAt:string|null;deletedAt:string|null;
};
export type ChatWireConversation = {
 id:string;peerId:string;peerName:string;lastMessage:string|null;unreadCount:number;
};
export class ChatTransportError extends Error {
 constructor(readonly status:number,readonly code:string){super(code);}
}
async function request<T>(path:string,csrf:string,init?:RequestInit):Promise<T>{
 const response=await fetch("/api/v4/chats"+path,{
  ...init,credentials:"same-origin",cache:"no-store",
  headers:{"X-Luemi-CSRF":csrf,...(init?.body?{"Content-Type":"application/json"}:{}),...init?.headers}
 });
 if(!response.ok){
  let code="request_failed";
  try{const body:unknown=await response.json();if(body&&typeof body==="object"&&"error"in body&&typeof body.error==="string")code=body.error;}catch{/* do not leak response */}
  throw new ChatTransportError(response.status,code);
 }
 return response.json() as Promise<T>;
}
export function createChatTransport(csrf:string){
 if(!/^[A-Za-z0-9_-]{8,128}$/.test(csrf))throw new Error("Missing authenticated chat session");
 return {
  list:(signal?:AbortSignal)=>request<{conversations:ChatWireConversation[]}>("",csrf,{signal}),
  messages:(conversationId:string,before?:string,signal?:AbortSignal)=>{
   const query=before?"?before="+encodeURIComponent(before):"";
   return request<{messages:ChatWireMessage[];nextCursor:string|null}>("/"+encodeURIComponent(conversationId)+"/messages"+query,csrf,{signal});
  },
  send:(conversationId:string,body:string,clientId:string)=>
   request<{message:ChatWireMessage}>("/"+encodeURIComponent(conversationId)+"/messages",csrf,{
    method:"POST",body:JSON.stringify({body,clientId})
   }),
  edit:(conversationId:string,messageId:string,body:string)=>
   request<{message:ChatWireMessage}>("/"+encodeURIComponent(conversationId)+"/messages/"+encodeURIComponent(messageId),csrf,{
    method:"PATCH",body:JSON.stringify({body})
   }),
  remove:(conversationId:string,messageId:string)=>
   request<{deleted:true}>("/"+encodeURIComponent(conversationId)+"/messages/"+encodeURIComponent(messageId),csrf,{method:"DELETE"}),
  markRead:(conversationId:string,messageId:string)=>
   request<{read:true}>("/"+encodeURIComponent(conversationId)+"/read",csrf,{method:"POST",body:JSON.stringify({messageId})})
 };
}
