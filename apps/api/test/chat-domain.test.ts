import assert from "node:assert/strict";
import test from "node:test";
import {errorText,reconcileMessages,validateChatImage} from "../../web/src/chats/chat-domain.js";

const message=(id:string,clientId=id)=>({id,clientId,conversationId:"c",senderId:"a",body:id,createdAt:"2026-10-27T00:00:00.000Z",editedAt:null,deletedAt:null,deliveredAt:null,readAt:null,media:[]});
test("server reconciliation replaces optimistic item by client id without duplicates",()=>{
 const optimistic={...message("local:x","x"),localState:"sending" as const};const server=message("server","x");
 assert.deepEqual(reconcileMessages([optimistic],[server]).map(x=>x.id),["server"]);
 assert.deepEqual(reconcileMessages([server],[server]).map(x=>x.id),["server"]);
});
test("chat errors and image validation stay explicit",()=>{
 assert.match(errorText(401,"unauthorized"),/Сессия/);assert.match(errorText(0,"offline"),/соединения/);
 assert.equal(validateChatImage({size:1024,type:"image/png"}),null);
 assert.notEqual(validateChatImage({size:11*1024*1024,type:"image/png"}),null);
 assert.notEqual(validateChatImage({size:1024,type:"image/gif"}),null);
});
