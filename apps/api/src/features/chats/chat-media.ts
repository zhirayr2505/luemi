import {createHash,randomUUID} from "node:crypto";

export type ChatImageMime="image/jpeg"|"image/png"|"image/webp";
export interface ChatMediaStorage {
 put(input:{key:string;bytes:Buffer;mime:ChatImageMime;sha256:string}):Promise<void>;
 signedRead(key:string,ttlSeconds:number):Promise<{url:string;expiresAt:string}>;
 remove(key:string):Promise<void>;
}
export interface ValidatedChatImage {mime:ChatImageMime;size:number;sha256:string;bytes:Buffer;}

const signatures:Record<ChatImageMime,(b:Buffer)=>boolean>={
 "image/jpeg":b=>b.length>=4&&b[0]===0xff&&b[1]===0xd8&&b[b.length-2]===0xff&&b[b.length-1]===0xd9,
 "image/png":b=>b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
 "image/webp":b=>b.length>=12&&b.subarray(0,4).toString("ascii")==="RIFF"&&b.subarray(8,12).toString("ascii")==="WEBP"
};
export function validateChatImageBytes(value:unknown,declared:string|undefined):ValidatedChatImage{
 if(!Buffer.isBuffer(value)||value.length<1||value.length>10*1024*1024)throw new Error("invalid_media_size");
 if(!declared||!(declared in signatures))throw new Error("invalid_media_type");
 const mime=declared as ChatImageMime;if(!signatures[mime](value))throw new Error("invalid_media_signature");
 return {mime,size:value.length,bytes:value,sha256:createHash("sha256").update(value).digest("hex")};
}
export function chatObjectKey(environment:string,conversationId:string,ownerId:string,mime:ChatImageMime){
 const extension:mimeExtension= mime==="image/jpeg"?"jpg":mime==="image/png"?"png":"webp";
 return `chat-media/${encodeURIComponent(environment)}/${conversationId}/${ownerId}/${randomUUID()}.${extension}`;
}
type mimeExtension="jpg"|"png"|"webp";

/** Test/dev-only adapter. Production must inject a private object-store driver. */
export class MemoryChatMediaStorage implements ChatMediaStorage{
 private readonly objects=new Map<string,{bytes:Buffer;mime:ChatImageMime}>();
 async put(input:{key:string;bytes:Buffer;mime:ChatImageMime}){this.objects.set(input.key,{bytes:Buffer.from(input.bytes),mime:input.mime});}
 async signedRead(key:string,ttlSeconds:number){const item=this.objects.get(key);if(!item)throw new Error("not_found");return {url:`data:${item.mime};base64,${item.bytes.toString("base64")}`,expiresAt:new Date(Date.now()+ttlSeconds*1000).toISOString()};}
 async remove(key:string){this.objects.delete(key);}
}
