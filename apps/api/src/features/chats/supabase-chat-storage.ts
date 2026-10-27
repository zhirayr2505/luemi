import {createHash} from "node:crypto";
import type {ChatMediaStorage,ChatImageMime} from "./chat-media.js";

/** Server-only Supabase Storage gateway. Chat objects live in a dedicated private bucket. */
export interface SupabaseChatStorageSettings{
 projectRef:string;
 secret:string;
 namespace:string;
 bucket:"luemi-chat-private";
}
const PROJECT=/^[a-z]{20}$/;
const NAMESPACE=/^[a-z0-9:_-]{1,96}$/i;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXTENSION:Record<ChatImageMime,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};

function objectPath(key:string,namespace:string):string{
 const parts=key.split("/");
 if(parts.length!==5||parts[0]!=="chat-media"||parts[1]!==namespace||
    !UUID.test(parts[2])||!UUID.test(parts[3])||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(parts[4]))
  throw new Error("invalid_chat_storage_path");
 return parts.map(encodeURIComponent).join("/");
}

export function createSupabaseChatMediaStorage(
 settings:SupabaseChatStorageSettings,transport:typeof fetch=fetch
):ChatMediaStorage{
 const {projectRef,namespace,secret,bucket}=settings;
 const jwt=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(secret);
 if(!PROJECT.test(projectRef)||!NAMESPACE.test(namespace)||
    bucket!=="luemi-chat-private"||
    !(jwt||/^sb_secret_[A-Za-z0-9_-]{24,}$/.test(secret)))
  throw new Error("invalid_chat_storage_configuration");

 const origin=`https://${projectRef}.supabase.co`;
 const base=`${origin}/storage/v1`;
 const pathFor=(key:string)=>objectPath(key,namespace);
 const headers=()=>{
  const h=new Headers({"apikey":secret,"Cache-Control":"no-store"});
  if(jwt)h.set("Authorization",`Bearer ${secret}`);
  return h;
 };
 async function remote(method:string,path:string,body?:Uint8Array|{expiresIn:number},mime?:string){
  const h=headers();let data:BodyInit|undefined;
  if(body instanceof Uint8Array){
   h.set("Content-Type",mime??"application/octet-stream");
   h.set("x-upsert","false");
   data=new Blob([Uint8Array.from(body)],{type:mime});
  }else if(body){
   h.set("Content-Type","application/json");
   data=JSON.stringify(body);
  }
  try{
   return await transport(`${base}/${path}`,{
    method,headers:h,...(data?{body:data}:{}),
    cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(15000)
   });
  }catch{throw new Error("chat_storage_unavailable");}
 }
 return {
  async put({key,bytes,mime,sha256}){
   const path=pathFor(key);
   if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>10*1024*1024||
      !key.endsWith("."+EXTENSION[mime])||
      createHash("sha256").update(bytes).digest("hex")!==sha256)
    throw new Error("invalid_chat_storage_bytes");
   const response=await remote("POST",`object/${bucket}/${path}`,new Uint8Array(bytes),mime);
   if(response.status!==200&&response.status!==201){
    await response.body?.cancel();throw new Error("chat_storage_put_denied");
   }
   await response.body?.cancel();
  },
  async signedRead(key,ttlSeconds){
   const path=pathFor(key);
   if(!Number.isInteger(ttlSeconds)||ttlSeconds<1||ttlSeconds>60)
    throw new Error("invalid_chat_storage_ttl");
   const response=await remote("POST",`object/sign/${bucket}/${path}`,{expiresIn:ttlSeconds});
   if(response.status!==200){await response.body?.cancel();throw new Error("chat_storage_sign_denied");}
   let data:unknown;
   try{data=await response.json();}catch{throw new Error("chat_storage_sign_invalid");}
   const signed=data&&typeof data==="object"&&"signedURL" in data?(data as {signedURL:unknown}).signedURL:null;
   if(typeof signed!=="string")throw new Error("chat_storage_sign_invalid");
   // The Storage API returns /object/sign/...; never allow a signed response to redirect to a foreign host.
   const url=new URL(signed.startsWith("/object/sign/")?"/storage/v1"+signed:signed,base+"/");
   if(url.origin!==origin||url.pathname!==`/storage/v1/object/sign/${bucket}/${path}`||
      !url.searchParams.has("token")||url.hash)
    throw new Error("chat_storage_sign_invalid");
   return {url:url.href,expiresAt:new Date(Date.now()+ttlSeconds*1000).toISOString()};
  },
  async remove(key){
   const response=await remote("DELETE",`object/${bucket}/${pathFor(key)}`);
   if(response.status!==200&&response.status!==204&&response.status!==404){
    await response.body?.cancel();throw new Error("chat_storage_remove_denied");
   }
   await response.body?.cancel();
  }
 };
}
