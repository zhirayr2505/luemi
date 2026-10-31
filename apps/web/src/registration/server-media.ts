// REAL-REG-01C: explicit, opt-in PNG-only private media pilot.
// The browser never communicates with Supabase Storage or receives bucket keys.
import type {PhotoItem} from "./PhotoSorter";
import {geoCsrf} from "../auth/session-adapter";
import {remoteDraftPilot} from "./server-draft";
import {confirmedPrivateMediaCount} from "./private-media-confirmation";
export const remoteMediaPilot={
 enabled:remoteDraftPilot.enabled&&import.meta.env.VITE_LUEMI_PRIVATE_MEDIA_UI==="1"
};
// Leave space for server-side PNG re-encoding.
const MAX_BYTES=700_000;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clientKey=(photo:Pick<PhotoItem,"id">)=>"reg01c-photo-"+photo.id;
async function canvasPng(canvas:HTMLCanvasElement):Promise<Blob>{
 return new Promise((resolve,reject)=>{
  canvas.toBlob(result=>result?resolve(result):reject(new Error("png_encode_failed")),"image/png");
 });
}
async function normalizedPng(photo:PhotoItem,maxEdge=800):Promise<Blob>{
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
  for(const limit of [800,680,560,480,384,300].filter(edge=>edge<=maxEdge)){
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
 if(!res.ok){
  const body:unknown=await res.json().catch(()=>null);
  const reason=body&&typeof body==="object"&&!Array.isArray(body)&&
   typeof (body as {error?:unknown}).error==="string"?
   String((body as {error:string}).error):"request_failed";
  throw new Error("private_media_http_"+res.status+":"+reason);
 }
 return res;
}
export interface PrivatePhotoPlan{
 matched:Map<string,{assetId:string;state:"reserved"|"pending_review"|"approved"}>;
 staleAssetIds:string[];
}
/** Recover the per-photo idempotency mapping after a WebView reload and find
 * owner-private assets that no longer belong to the selected local gallery. */
export async function planPrivatePhotos(photos:readonly PhotoItem[],keepAssetIds:readonly string[]=[]):Promise<PrivatePhotoPlan>{
 if(!remoteMediaPilot.enabled||photos.length<1||photos.length>6||
   photos.some(photo=>photo.status!=="ready"||!photo.id)||
   new Set(photos.map(photo=>photo.id)).size!==photos.length)
  throw new Error("invalid_private_media_plan");
 const keys=photos.map(clientKey),localByKey=new Map(keys.map((key,index)=>[key,photos[index].id]));
 if(keepAssetIds.length>6||keepAssetIds.some(id=>!UUID.test(id)))throw new Error("invalid_keep_asset_ids");
 const response=await request("/api/v2/media/plan","POST",JSON.stringify({clientKeys:keys,keepAssetIds}),"application/json");
 const raw:unknown=await response.json();
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||
   !Array.isArray((raw as {assets?:unknown}).assets)||
   !Array.isArray((raw as {staleAssetIds?:unknown}).staleAssetIds))
  throw new Error("invalid_private_media_plan");
 const data=raw as {assets:Array<{clientKey?:unknown;assetId?:unknown;state?:unknown}>;staleAssetIds:unknown[]};
 const matched=new Map<string,{assetId:string;state:"reserved"|"pending_review"|"approved"}>();
 const assetIds=new Set<string>();
 for(const asset of data.assets){
  const localId=typeof asset.clientKey==="string"?localByKey.get(asset.clientKey):undefined;
  if(!localId||typeof asset.assetId!=="string"||!UUID.test(asset.assetId)||
    !["reserved","pending_review","approved"].includes(String(asset.state))||
    matched.has(localId)||assetIds.has(asset.assetId))throw new Error("invalid_private_media_plan");
  matched.set(localId,{assetId:asset.assetId,state:asset.state as "reserved"|"pending_review"|"approved"});
  assetIds.add(asset.assetId);
 }
 const staleAssetIds=data.staleAssetIds.map(id=>String(id));
 if(staleAssetIds.some(id=>!UUID.test(id)||assetIds.has(id))||
   new Set(staleAssetIds).size!==staleAssetIds.length)throw new Error("invalid_private_media_plan");
 return{matched,staleAssetIds};
}
export async function uploadPrivatePhoto(photo:PhotoItem):Promise<string>{
 if(!remoteMediaPilot.enabled||photo.status!=="ready"||!photo.id)
  throw new Error("ready_photo_required");
 // A rejected PNG should not strand an otherwise valid private reservation.
  // Retain the same idempotency key when retrying a smaller encoding.
  for(const edge of [800,384]){
   const png=await normalizedPng(photo,edge);
   const response=await request("/api/v2/media/intents","POST",
    JSON.stringify({bytes:png.size,mime:"image/png",clientKey:clientKey(photo)}),
    "application/json");
   const result:unknown=await response.json();
   if(!result||typeof result!=="object"||Array.isArray(result))
    throw new Error("invalid_private_intent");
   const intent=result as {assetId?:unknown;state?:unknown;upload?:unknown};
   if(typeof intent.assetId!=="string"||!UUID.test(intent.assetId)||
     intent.upload!=="private_proxy"||
     (intent.state!=="reserved"&&intent.state!=="received"))
    throw new Error("invalid_private_intent");
   if(intent.state==="received")return intent.assetId;
   try{
    const saved=await request("/api/v2/media/"+intent.assetId+"/bytes",
      "PUT",png,"image/png");
    const receipt:unknown=await saved.json();
    if(!receipt||typeof receipt!=="object"||Array.isArray(receipt)||
      !["pending_review","approved"].includes(String((receipt as {status?:unknown}).status))||
      (receipt as {published?:unknown}).published!==false)
     throw new Error("invalid_private_media_receipt");
    return intent.assetId;
   }catch(error){
    if(edge===800&&error instanceof Error&&
      error.message==="private_media_http_422:invalid_image")continue;
    throw error;
   }
  }
  throw new Error("invalid_image");
}
/** Removing a local photo also revokes it in private SQL and Storage. A failed
 * cleanup is surfaced to the user and can be retried with the same asset ID. */
export async function deletePrivatePhoto(assetId:string):Promise<void>{
 if(!UUID.test(assetId))throw new Error("invalid_asset_id");
 const token=geoCsrf();
 if(!token)throw new Error("missing_session_csrf");
 const res=await fetch("/api/v2/media/"+assetId,{
  method:"DELETE",credentials:"same-origin",cache:"no-store",
  headers:{"X-Luemi-CSRF":token}
 });
 if(!res.ok)throw new Error("photo_delete_http_"+res.status);
}
export async function orderPrivatePhotos(assetIds:readonly string[]):Promise<void>{
 if(assetIds.length<1||assetIds.length>6||assetIds.some(id=>!UUID.test(id))||
  new Set(assetIds).size!==assetIds.length)throw new Error("invalid_photo_order");
 await request("/api/v2/media/order","PUT",JSON.stringify({ids:assetIds}),"application/json");
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
  assetIds.push(assetId);
  done++;
  progress(done,photos.length);
 }
 if(new Set(assetIds).size!==assetIds.length)throw new Error("duplicate_upload_receipt");
 return assetIds;
}

/** Final user-selected photos are authoritative. Before publication, revoke
 * old private assets from a previous interrupted session, not selected now.
 * Only the owner-private manifest is exposed. Never touch published assets.
 */
export async function reconcilePrivatePhotos(selectedIds:readonly string[]):Promise<void>{
 if(selectedIds.length<3||selectedIds.length>6||selectedIds.some(id=>!UUID.test(id)))
  throw new Error("invalid_selected_photos");
 const response=await fetch("/api/v2/profile/preview",{
  credentials:"same-origin",cache:"no-store"
 });
 if(!response.ok)throw new Error("private_manifest_unavailable");
 const json:unknown=await response.json();
 if(!json||typeof json!=="object"||Array.isArray(json)||
  !Array.isArray((json as {photos?:unknown}).photos))throw new Error("invalid_private_media_manifest");
 const photos=(json as {photos:Array<{id?:unknown;state?:unknown}>}).photos;
 for(const asset of photos){
  if(typeof asset.id!=="string"||!UUID.test(asset.id))
   throw new Error("invalid_private_media_manifest");
  if(!selectedIds.includes(asset.id))await deletePrivatePhoto(asset.id);
 }
 await orderPrivatePhotos(selectedIds);
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
/** Download only owner-approved private derivatives when a Telegram account
 * resumes on a second device. No public Storage URL or client-supplied actor ID. */
export async function restorePrivatePhotos():Promise<Array<{assetId:string;blob:Blob}>>{
 if(!remoteMediaPilot.enabled)throw new Error("private_media_disabled");
 const manifest=await fetch("/api/v2/profile/preview",{credentials:"same-origin",cache:"no-store"});
 if(!manifest.ok)throw new Error("private_manifest_unavailable");
 const json:unknown=await manifest.json();
 if(!json||typeof json!=="object"||!Array.isArray((json as {photos?:unknown}).photos))
  throw new Error("invalid_private_media_manifest");
 const entries=(json as {photos:unknown[]}).photos;
 if(entries.length>6)throw new Error("invalid_private_media_manifest");
 const result:Array<{assetId:string;blob:Blob}>=[];
 for(const entry of entries){
  if(!entry||typeof entry!=="object")throw new Error("invalid_private_media_manifest");
  const {id,state}=entry as {id?:unknown;state?:unknown};
  if(typeof id!=="string"||!UUID.test(id))throw new Error("invalid_private_media_manifest");
  if(state!=="approved")continue;
  const response=await fetch("/api/v2/media/"+id,{credentials:"same-origin",cache:"no-store"});
  if(!response.ok)throw new Error("private_media_restore_failed");
  const blob=await response.blob();
  if(blob.type!=="image/png"||blob.size<1||blob.size>6*1024*1024)
   throw new Error("invalid_private_media_restore");
  result.push({assetId:id,blob});
 }
 return result;
}
