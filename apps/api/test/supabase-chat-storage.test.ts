import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {createSupabaseChatMediaStorage} from "../src/features/chats/supabase-chat-storage.js";

const settings={projectRef:"abcdefghijklmnopqrst",secret:"sb_secret_"+"x".repeat(32),
 namespace:"luemi",bucket:"luemi-chat-private" as const};
const path="chat-media/luemi/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.png";
const bytes=Buffer.from([137,80,78,71,13,10,26,10,0,0,0]);
const sha256=createHash("sha256").update(bytes).digest("hex");

test("server-only gateway writes private objects and signs at 60 seconds maximum",async()=>{
 const called:Array<{url:string;method:string;headers:Headers;body:BodyInit|null}>=[]; 
 const fetchMock:typeof fetch=async(input,init)=>{
  const url=String(input);called.push({url,method:init?.method??"",headers:new Headers(init?.headers),body:init?.body??null});
  if(url.includes("/object/sign/"))return Response.json({signedURL:"/object/sign/luemi-chat-private/"+path+"?token=opaque"});
  return new Response("",{status:201});
 };
 const store=createSupabaseChatMediaStorage(settings,fetchMock);
 await store.put({key:path,bytes,mime:"image/png",sha256});
 const signed=await store.signedRead(path,60);
 assert.equal(signed.url,"https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/sign/luemi-chat-private/"+path+"?token=opaque");
 assert.ok(Date.parse(signed.expiresAt)>Date.now());
 assert.equal(called[0]?.headers.get("apikey"),settings.secret);
 assert.equal(called[0]?.headers.get("Authorization"),null,"opaque API keys are not JWTs");
 assert.equal(called[0]?.headers.get("Content-Type"),"image/png");
 assert.equal(called[0]?.headers.get("x-upsert"),"false");
 assert.equal(called[1]?.method,"POST");
 assert.match(String(called[1]?.body),/expiresIn/);
 await assert.rejects(()=>store.signedRead(path,61),/invalid_chat_storage_ttl/);
 await assert.rejects(()=>store.put({key:path,bytes,mime:"image/png",sha256:"0".repeat(64)}),/invalid_chat_storage_bytes/);
});

test("gateway rejects foreign signed URL and arbitrary object paths",async()=>{
 const store=createSupabaseChatMediaStorage(settings,async()=>Response.json({signedURL:"https://evil.invalid/?token=bad"}));
 await assert.rejects(()=>store.signedRead(path,60),/chat_storage_sign_invalid/);
 await assert.rejects(()=>store.signedRead("../luemi-profile-private/secret",60),/invalid_chat_storage_path/);
 await assert.rejects(()=>store.signedRead(path.replace("luemi/","other/"),60),/invalid_chat_storage_path/);
});

test("gateway removes objects with strictly scoped keys",async()=>{
 let removed="";
 const store=createSupabaseChatMediaStorage(settings,async(input,init)=>{removed=String(input);assert.equal(init?.method,"DELETE");return new Response(null,{status:204});});
 await store.remove(path);
 assert.equal(removed,"https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/luemi-chat-private/"+path);
});

test("invalid credentials fail closed",()=>{
 assert.throws(()=>createSupabaseChatMediaStorage({...settings,secret:"anonymous"}),/invalid_chat_storage_configuration/);
 assert.throws(()=>createSupabaseChatMediaStorage({...settings,projectRef:"not-valid"}),/invalid_chat_storage_configuration/);
});
