import assert from "node:assert/strict";
import test from "node:test";
import {MemoryChatMediaStorage,chatObjectKey,validateChatImageBytes} from "../src/features/chats/chat-media.js";

test("chat media validates declared type against bytes and 10 MB limit",()=>{
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from("synthetic")]);
 const value=validateChatImageBytes(png,"image/png");
 assert.equal(value.mime,"image/png");assert.equal(value.size,png.length);assert.match(value.sha256,/^[0-9a-f]{64}$/);
 assert.throws(()=>validateChatImageBytes(png,"image/jpeg"),/invalid_media_signature/);
 assert.throws(()=>validateChatImageBytes(Buffer.alloc(10*1024*1024+1),"image/png"),/invalid_media_size/);
});

test("object keys never contain user filenames and local store uses expiring reads",async()=>{
 const key=chatObjectKey("luemi","33333333-3333-4333-8333-333333333333","11111111-1111-4111-8111-111111111111","image/webp");
 assert.match(key,/^chat-media\/luemi\/[0-9a-f-]+\/[0-9a-f-]+\/[0-9a-f-]+\.webp$/);
 const store=new MemoryChatMediaStorage();const bytes=Buffer.from("RIFFxxxxWEBPdemo");await store.put({key,bytes,mime:"image/webp",sha256:"a".repeat(64)});
 const signed=await store.signedRead(key,60);assert.match(signed.url,/^data:image\/webp;base64,/);assert.ok(Date.parse(signed.expiresAt)>Date.now());
 await store.remove(key);await assert.rejects(()=>store.signedRead(key,60),/not_found/);
});
