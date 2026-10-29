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
async function request(url:string,method:"POST"|"PUT",body:BodyInit,mime:string){
 const token=geoCsrf();
 if(!token)throw new Error("missing_session_csrf");
 const res=await fetch(url,{method,body,credentials:"same-origin",cache:"no-store",
  headers:{"Content-Type":mime,"X-Luemi-CSRF":token}});
 if(!res.ok)throw new Error("private_media_http_"+res.status);
 return res;
}
/** One stable local photo UUID maps to exactly one private server asset.
 * Called by the background queue as soon as the user consents and selects it.
 */
export async function uploadPrivatePhoto(photo:PhotoItem):Promise<string>{
 if(!remoteMediaPilot.enabled)throw new Error("private_media_disabled");
 if(photo.status!=="ready"||!UUID.test(photo.id))throw new Error("photo_not_ready");
 const png=await normalizedPng(photo);
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
  const saved=await request("/api/v2/media/"+intent.assetId+"/bytes",
   "PUT",png,"image/png");
  const receipt:unknown=await saved.json();
  if(!receipt||typeof receipt!=="object"||Array.isArray(receipt)||
    !["pending_review","approved"].includes(String((receipt as {status?:unknown}).status))||
    (receipt as {published?:unknown}).published!==false)
   throw new Error("invalid_private_media_receipt");
 }
 return intent.assetId;
}
/** Idempotent delete. Only the owner of an UNPUBLISHED photo can revoke it. */
export async function deletePrivatePhoto(localId:string):Promise<void>{
 if(!remoteMediaPilot.enabled||!UUID.test(localId))throw new Error("invalid_photo_id");
 const csrf=geoCsrf();if(!csrf)throw new Error("missing_session_csrf");
 const result=await fetch("/api/v2/media/by-photo/"+localId,{
  method:"DELETE",credentials:"same-origin",cache:"no-store",
  headers:{"X-Luemi-CSRF":csrf}
 });
 if(!result.ok)throw new Error("delete_private_media_http_"+result.status);
}
/** Owner-approved selection reconciliation; unpublished, unselected and
 * abandoned private assets are revoked before new upload intents take slots.
 */
export async function syncPrivateSelectedPhotos(localIds:readonly string[]):Promise<void>{
 if(!remoteMediaPilot.enabled||localIds.length>6||
    localIds.some(id=>!UUID.test(id))||new Set(localIds).size!==localIds.length)
  throw new Error("invalid_photo_selection");
 const csrf=geoCsrf();if(!csrf)throw new Error("missing_session_csrf");
 const response=await fetch("/api/v2/media/sync-selection",{
  method:"PUT",credentials:"same-origin",cache:"no-store",
  headers:{"Content-Type":"application/json","X-Luemi-CSRF":csrf},
  body:JSON.stringify({photoIds:localIds})
 });
 if(!response.ok)throw new Error("photo_selection_sync_failed_"+response.status);
}
export async function orderPrivatePhotos(ids:readonly string[]):Promise<void>{
 if(!remoteMediaPilot.enabled||ids.length<3||ids.length>6||
    ids.some(x=>!UUID.test(x))||new Set(ids).size!==ids.length)
  throw new Error("invalid_photo_order");
 const csrf=geoCsrf();if(!csrf)throw new Error("missing_session_csrf");
 const response=await fetch("/api/v2/media/order",{
  method:"PUT",credentials:"same-origin",cache:"no-store",
  headers:{"Content-Type":"application/json","X-Luemi-CSRF":csrf},
  body:JSON.stringify({assetIds:ids})
 });
 if(!response.ok)throw new Error("photo_order_failed_"+response.status);
}
export async function uploadPrivatePhotos(
 photos:PhotoItem[],progress:(completed:number,total:number)=>void
):Promise<string[]>{
 if(photos.length<3||photos.length>6)throw new Error("three_to_six_ready_photos_required");
 const ids:string[]=[];
 for(const photo of photos){
  ids.push(await uploadPrivatePhoto(photo));
  progress(ids.length,photos.length);
 }
 if(new Set(ids).size!==ids.length)throw new Error("duplicate_upload_receipt");
 return ids;
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
