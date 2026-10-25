import type {PrivateObjectStore} from "./rem05d-private.js";

/** Private server-to-Supabase gateway. No public URLs, signed links or browser secrets.
 * Only our database-generated, opaque sanitized derivative paths are valid. */
const MAX_OBJECT_BYTES=1_048_576;
const PROJECT=/^[a-z]{20}$/;
const ENVIRONMENT=/^[a-z0-9:_-]{1,96}$/i;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX=/^[0-9a-f]{48}$/;
export interface DurablePrivateStoreSettings {
 projectRef:string;namespace:string;secret:string;bucket:"luemi-profile-private";
}
function pathFor(key:string,namespace:string):string{
 const segments=key.split("/");
 if(segments.length!==6||segments[0]!=="private"||segments[1]!==namespace||
    !UUID.test(segments[2])||!UUID.test(segments[3])||!HEX.test(segments[4])||
    segments[5]!=="sanitized")throw new Error("invalid_private_storage_path");
 return segments.map(encodeURIComponent).join("/");
}
export function createDurablePrivateStore(
 settings:DurablePrivateStoreSettings,transport:typeof fetch=fetch
):PrivateObjectStore{
 const {projectRef,namespace,bucket,secret}=settings;
 if(!PROJECT.test(projectRef)||!ENVIRONMENT.test(namespace)||
    bucket!=="luemi-profile-private"||typeof secret!=="string"||
    secret.length<32||/\s/.test(secret)||secret.startsWith("sb_publishable_"))
  throw new Error("invalid_private_storage_configuration");
 const origin="https://"+projectRef+".supabase.co/storage/v1/object/";
 const headers=()=>({"Authorization":"Bearer "+secret,"apikey":secret});
 const remote=async(method:string,key:string,body?:Uint8Array):Promise<Response>=>{
  const path=pathFor(key,namespace),url=origin+
   (method==="GET"?"authenticated/":"")+bucket+"/"+path;
  try{
   return await transport(url,{
    method,headers:{...headers(),"Cache-Control":"no-store",
      ...(body?{"Content-Type":"image/png","x-upsert":"false"}:{})},
    ...(body?{body}:{}),redirect:"manual",cache:"no-store",
    signal:AbortSignal.timeout(12000)
   });
  }catch{throw new Error("private_storage_unavailable");}
 };
 return{
  put:async(key,bytes)=>{
   if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>MAX_OBJECT_BYTES)
    throw new Error("invalid_private_storage_bytes");
   const r=await remote("POST",key,new Uint8Array(bytes));
   if(r.status!==200&&r.status!==201)throw new Error("private_storage_put_denied");
   await r.body?.cancel();
  },
  get:async key=>{
   const r=await remote("GET",key);
   if(r.status===404)return null;
   if(r.status!==200||r.headers.get("content-type")?.split(";")[0].trim()!=="image/png")
    throw new Error("private_storage_get_denied");
   const size=r.headers.get("content-length");
   if(size!==null&&(!/^\d+$/.test(size)||Number(size)>MAX_OBJECT_BYTES))
    throw new Error("private_storage_invalid_size");
   if(!r.body)throw new Error("private_storage_empty_response");
   const reader=r.body.getReader(),parts:Uint8Array[]=[];
   let total=0;
   try{
    for(;;){
     const value=await reader.read();
     if(value.done)break;
     total+=value.value.length;
     if(total>MAX_OBJECT_BYTES)throw new Error("private_storage_too_large");
     parts.push(value.value);
    }
   }finally{await reader.cancel().catch(()=>{});}
   if(total<1)throw new Error("private_storage_empty_response");
   return Buffer.concat(parts.map(v=>Buffer.from(v)),total);
  },
  delete:async key=>{
   const r=await remote("DELETE",key);
   if(r.status!==200&&r.status!==204&&r.status!==404)
    throw new Error("private_storage_delete_denied");
   await r.body?.cancel();
  }
 };
}
