// REAL-REG-01C: explicit, opt-in PNG-only private media pilot.
// The browser never communicates with Supabase Storage or receives bucket keys.
import type {PhotoItem} from "./PhotoSorter";
import {geoCsrf} from "../auth/session-adapter";
import {remoteDraftPilot} from "./server-draft";
import {confirmedPrivateMediaCount} from "./private-media-confirmation";
export const remoteMediaPilot={
 enabled:remoteDraftPilot.enabled&&import.meta.env.VITE_LUEMI_PRIVATE_MEDIA_UI==="1"
};
const MAX_BYTES=1_048_576;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function canvasPng(canvas:HTMLCanvasElement):Promise<Blob>{
 return new Promise((resolve,reject)=>{
  canvas.toBlob(result=>result?resolve(result):reject(new Error("png_encode_failed")),"image/png");
 });
}
async function normalizedPng(photo:PhotoItem):Promise<Blob>{
 const file=photo.preview??photo.file;
 if(!["image/png","image/jpeg","image/webp"].includes(file.type)||
   file.size<1||file.size>12*1024*1024)throw new Error("unsupported_source_photo");
 // A decoded canvas export removes EXIF/geotags from the upload request.
 // The server MUST independently sanitize PNG and enforce its own pixel cap.
 let bitmap:ImageBitmap|null=null,image:HTMLImageElement|null=null,url:string|null=null;
 const canvas=document.createElement("canvas");
 try{
  if(typeof createImageBitmap==="function"){
   try{bitmap=await createImageBitmap(file,{imageOrientation:"from-image"});}
   catch{/* Fallback to HTMLImageElement in older Telegram WebViews. */}
  }
  if(!bitmap){
   image=new Image();url=URL.createObjectURL(file);
   const element=image;
   await new Promise<void>((resolve,reject)=>{
    element.onload=()=>resolve();element.onerror=()=>reject(new Error("photo_decode_failed"));
    element.src=url!;
   });
  }
  const width=bitmap?bitmap.width:image!.naturalWidth;
  const height=bitmap?bitmap.height:image!.naturalHeight;
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||
    width<1||height<1||width*height>24_000_000)
    throw new Error("photo_dimensions_denied");
  const ctx=canvas.getContext("2d");
  if(!ctx)throw new Error("canvas_unavailable");
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  for(const limit of [800,680,560,480,384,300]){
   const ratio=Math.min(1,limit/Math.max(width,height));
   canvas.width=Math.max(1,Math.round(width*ratio));
   canvas.height=Math.max(1,Math.round(height*ratio));
   ctx.drawImage(bitmap??image!,0,0,canvas.width,canvas.height);
   const png=await canvasPng(canvas);
   if(png.size>0&&png.size<=MAX_BYTES)return png;
  }
  throw new Error("photo_too_large_for_private_pilot");
 }finally{
  bitmap?.close();
  if(image){image.onload=null;image.onerror=null;image.src="";}
  if(url)URL.revokeObjectURL(url);
  canvas.width=0;canvas.height=0;
 }
}
async function request(url:string,method:"POST"|"PUT",body:BodyInit,mime:string,signal?:AbortSignal){
 const token=geoCsrf();
 if(!token)throw new Error("missing_session_csrf");
 const res=await fetch(url,{method,body,credentials:"same-origin",cache:"no-store",
  headers:{"Content-Type":mime,"X-Luemi-CSRF":token},signal});
 if(!res.ok)throw new Error("private_media_http_"+res.status);
 return res;
}
export async function uploadPrivatePhotos(
 photos:PhotoItem[],progress:(completed:number,total:number)=>void
):Promise<string[]>{
 if(!remoteMediaPilot.enabled)throw new Error("private_media_disabled");
 if(photos.length<3||photos.length>6||photos.some(p=>p.status!=="ready"||!p.id))
  throw new Error("three_to_six_ready_photos_required");
 let done=0;
 const assetIds:string[]=[];
 for(const photo of photos){
  const assetId=await uploadPrivatePhoto(photo);
  assetIds.push(assetId);done++;
  progress(done,photos.length);
 }
 if(new Set(assetIds).size!==assetIds.length)throw new Error("duplicate_upload_receipt");
 return assetIds;
}

/** Upload one processed photo as soon as the user selects it and has
 * granted consent. No hard minimum until final publication; idempotent key.
 */
// Stable bytes across retries preserve the per-photo server idempotency digest.
// Bounded to a maximum of six local pictures; never written to browser storage.
const pendingPng=new Map<string,Promise<Blob>>();
async function stablePng(photo:PhotoItem){
 let job=pendingPng.get(photo.id);
 if(!job){job=normalizedPng(photo);pendingPng.set(photo.id,job);}
 try{return await job;}catch(e){pendingPng.delete(photo.id);throw e;}
}
export async function uploadPrivatePhoto(photo:PhotoItem):Promise<string>{
 if(!remoteMediaPilot.enabled)throw new Error("private_media_disabled");
 if(photo.status!=="ready"||!photo.id)throw new Error("photo_not_ready");
 const png=await stablePng(photo);
 const response=await request("/api/v2/media/intents","POST",
  JSON.stringify({bytes:png.size,mime:"image/png",clientKey:"reg01c-photo-"+photo.id}),
  "application/json");
 const result:unknown=await response.json();
 if(!result||typeof result!=="object"||Array.isArray(result))throw new Error("invalid_private_intent");
 const intent=result as {assetId?:unknown;state?:unknown;upload?:unknown};
 if(typeof intent.assetId!=="string"||!UUID.test(intent.assetId)||
   intent.upload!=="private_proxy"||
   (intent.state!=="reserved"&&intent.state!=="received"))
  throw new Error("invalid_private_intent");
 if(intent.state==="reserved"){
  const saved=await request("/api/v2/media/"+intent.assetId+"/bytes","PUT",png,"image/png");
  const receipt:unknown=await saved.json();
  if(!receipt||typeof receipt!=="object"||Array.isArray(receipt)||
    !["pending_review","approved"].includes(String((receipt as {status?:unknown}).status))||
    (receipt as {published?:unknown}).published!==false)
   throw new Error("invalid_private_media_receipt");
 }
 return intent.assetId;
}

/** Remove by upload's stable client key, even if the original response
 * was lost or the app was interrupted after reserving the slot.
 */
export async function deletePrivatePhoto(photoId:string):Promise<void>{
 if(!remoteMediaPilot.enabled)throw new Error("private_media_disabled");
 if(!UUID.test(photoId))throw new Error("invalid_photo_id");
 pendingPng.delete(photoId);
 const csrf=geoCsrf();if(!csrf)throw new Error("missing_session_csrf");
 const response=await fetch("/api/v2/media/by-client-key/reg01c-photo-"+photoId,{
  method:"DELETE",credentials:"same-origin",cache:"no-store",
  headers:{"X-Luemi-CSRF":csrf}});
 if(!response.ok)throw new Error("delete_private_photo_http_"+response.status);
}
/** Remove old server-side photos not present in this explicit, confirmed
 * 3–6-photo selection. This is needed after interrupted prior signups. */
export async function reconcilePrivatePhotos(ids:string[]):Promise<void>{
 if(!remoteMediaPilot.enabled)throw new Error("private_media_disabled");
 if(ids.length<3||ids.length>6||new Set(ids).size!==ids.length||ids.some(id=>!UUID.test(id)))
  throw new Error("invalid_photo_selection");
 const response=await request("/api/v2/media/reconcile","POST",
  JSON.stringify({assetIds:ids}),"application/json");
 if(!response.ok)throw new Error("private_media_reconcile_failed");
}
export async function orderPrivatePhotos(ids:string[]):Promise<void>{
 if(!remoteMediaPilot.enabled)throw new Error("private_media_disabled");
 if(ids.length<1||ids.length>6||new Set(ids).size!==ids.length||ids.some(id=>!UUID.test(id)))
  throw new Error("invalid_photo_order");
 const csrf=geoCsrf();if(!csrf)throw new Error("missing_session_csrf");
 const response=await request("/api/v2/media/order","PUT",
  JSON.stringify({assetIds:ids}),"application/json");
 if(!response.ok)throw new Error("order_private_photo_failed");
}

/** Verify server-side media state instead of trusting an upload progress bar. */
export async function readConfirmedPrivateMediaCount(expected:number,uploadedIds:readonly string[]=[]):Promise<number>{
 if(!remoteMediaPilot.enabled)throw new Error("private_media_disabled");
 const response=await fetch("/api/v2/profile/preview",{
  method:"GET",credentials:"same-origin",cache:"no-store"
 });
 if(!response.ok)throw new Error("private_manifest_unavailable");
 return confirmedPrivateMediaCount(await response.json(),expected,uploadedIds);
}
