import assert from "node:assert/strict";
import test from "node:test";
import {createDurablePrivateStore} from "../src/real-private-storage.js";

const projectRef="abcdefghijklmnopqrst",namespace="ci_reg01",bucket="luemi-profile-private";
const secret="synthetic-secret-for-disposable-storage-tests-0001";
const key="private/"+namespace+"/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/"+
 "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/"+"a".repeat(48)+"/sanitized";

test("01C only deterministic private project and object path allowed",async()=>{
 const requests:string[]=[];
 const transport:typeof fetch=async input=>{requests.push(String(input));return new Response(null,{status:201});};
 const store=createDurablePrivateStore({projectRef,namespace,secret,bucket},transport);
 for(const bad of [key.replace("/sanitized","/original"),key.replace(namespace,"other"),
  key.replace("a".repeat(48),".."),key+"?public=true","https://evil.invalid"]){
  await assert.rejects(store.put(bad,Buffer.from("file")),/invalid_private_storage_path/);
 }
 assert.equal(requests.length,0);
 assert.throws(()=>createDurablePrivateStore({
  projectRef:"evil.invalid/path",namespace,secret,bucket},transport));
 assert.throws(()=>createDurablePrivateStore({
  projectRef,namespace,secret:"sb_publishable_not_a_server_secret",bucket},transport));
});
test("01C write/download/delete use private routes, no public URLs or upsert",async()=>{
 const events:Array<{url:string;method:string;headers:Headers;body:Uint8Array}>=[];
 let saved=new Uint8Array();
 const transport:typeof fetch=async(input,init)=>{
  const url=String(input),method=init?.method??"GET";
  const headers=new Headers(init?.headers);
  const incoming=init?.body instanceof Uint8Array?init.body:new Uint8Array();
  events.push({url,method,headers,body:incoming});
  if(method==="POST"){saved=new Uint8Array(incoming);return new Response("{}",{status:201});}
  if(method==="GET")return new Response(new Uint8Array(saved),{
   status:200,headers:{"Content-Type":"image/png","Content-Length":String(saved.length)}});
  if(method==="DELETE")return new Response(null,{status:204});
  return new Response(null,{status:405});
 };
 const store=createDurablePrivateStore({projectRef,namespace,secret,bucket},transport);
 const bytes=Buffer.from([137,80,78,71,13,10,26,10]);
 await store.put(key,bytes);
 const read=await store.get(key);
 assert.deepEqual(read,bytes);
 await store.delete(key);
 assert.deepEqual(events.map(x=>x.method),["POST","GET","DELETE"]);
 const root="https://"+projectRef+".supabase.co/storage/v1/object/";
 assert.equal(events[0].url,root+bucket+"/"+key);
 assert.equal(events[1].url,root+"authenticated/"+bucket+"/"+key);
 assert.equal(events[2].url,root+bucket+"/"+key);
 for(const event of events){
  assert.equal(event.headers.get("authorization"),"Bearer "+secret);
  assert.equal(event.headers.get("apikey"),secret);
  assert.equal(event.headers.get("cache-control"),"no-store");
  assert.equal(event.url.includes("/public/"),false);
  assert.equal(event.url.includes("/sign/"),false);
 }
 assert.equal(events[0].headers.get("x-upsert"),"false");
 assert.equal(events[0].headers.get("content-type"),"image/png");
});
test("01C fail closed on redirect, oversize and unexpected MIME",async()=>{
 const settings={projectRef,namespace,secret,bucket} as const;
 const bad:typeof fetch=async()=>new Response(null,{status:302,headers:{location:"https://evil.invalid"}});
 await assert.rejects(createDurablePrivateStore(settings,bad).put(key,Buffer.from([1])),/put_denied/);
 const oversized:typeof fetch=async()=>new Response(new Uint8Array(1_048_577),{
  status:200,headers:{"Content-Type":"image/png"}});
 await assert.rejects(createDurablePrivateStore(settings,oversized).get(key),/too_large/);
 const badMime:typeof fetch=async()=>new Response("secret",{status:200,headers:{"Content-Type":"text/html"}});
 await assert.rejects(createDurablePrivateStore(settings,badMime).get(key),/get_denied/);
 const missing:typeof fetch=async()=>new Response(null,{status:404});
 assert.equal(await createDurablePrivateStore(settings,missing).get(key),null);
 await assert.rejects(createDurablePrivateStore(settings,bad).delete(key),/delete_denied/);
});
test("01C network failures and invalid object lengths never leak bytes",async()=>{
 const settings={projectRef,namespace,secret,bucket} as const;
 const broken:typeof fetch=async()=>{throw new Error("transport offline: "+secret);};
 const store=createDurablePrivateStore(settings,broken);
 await assert.rejects(store.put(key,Buffer.from([1])),error=>{
  assert.ok(error instanceof Error);assert.equal(error.message,"private_storage_unavailable");return true;
 });
 await assert.rejects(store.put(key,Buffer.alloc(1_048_577)),/invalid_private_storage_bytes/);
});
