import type {PhotoItem,PhotoServerState} from "./PhotoSorter";
import {uploadPrivatePhoto,deletePrivateMedia,privateClientDigest,
 readPrivateMediaManifest,updatePrivatePhotoOrder} from "./server-media";

interface PhotoSyncDeps{
 getPhotos:()=>PhotoItem[];
 ensureDraft:()=>Promise<void>;
 onState:(id:string,state:PhotoServerState)=>void;
 onError:(message:string)=>void;
 upload?:(photo:PhotoItem)=>Promise<string>;
 remove?:(id:string)=>Promise<void>;
 manifest?:typeof readPrivateMediaManifest;
 digest?:typeof privateClientDigest;
 order?:typeof updatePrivatePhotoOrder;
}
/** All operations serialize. Upload/delete/reorder share the per-owner SQL lock,
 * and no operation starts until the owner has explicitly accepted media consent.
 * This controller never stores images in permanent browser caches.
 */
export class RegistrationMediaSync {
 private allowed=false;
 private queue:Promise<unknown>=Promise.resolve();
 private busy=new Set<string>();
 private removed=new Set<string>();
 private uploaded=new Map<string,string>();
 private prepared=false;
 private deps:Required<PhotoSyncDeps>;
 constructor(deps:PhotoSyncDeps){
  this.deps={...deps,upload:deps.upload??uploadPrivatePhoto,
   remove:deps.remove??deletePrivateMedia,
   manifest:deps.manifest??readPrivateMediaManifest,
   digest:deps.digest??privateClientDigest,
   order:deps.order??updatePrivatePhotoOrder};
 }
 setAllowed(allowed:boolean){this.allowed=allowed;}
 async idle():Promise<void>{await this.queue;}
 resetDraft(){this.prepared=false;this.uploaded.clear();this.removed.clear();}
 private enqueue<T>(operation:()=>Promise<T>):Promise<T>{
  const task=this.queue.then(operation);
  this.queue=task.catch(()=>undefined);
  return task;
 }
 private async prepare(){
  if(!this.prepared){await this.deps.ensureDraft();this.prepared=true;}
 }
 private selected(id:string){return this.deps.getPhotos().some(p=>p.id===id);}
 schedule(){
  if(!this.allowed)return;
  for(const photo of this.deps.getPhotos()){
   if(photo.status!=="ready"||this.busy.has(photo.id)||this.uploaded.has(photo.id)||
      this.removed.has(photo.id))continue;
   this.busy.add(photo.id);
   this.deps.onState(photo.id,"uploading");
   void this.enqueue(async()=>{
    if(!this.allowed||!this.selected(photo.id)||this.removed.has(photo.id))return;
    await this.prepare();
    if(!this.selected(photo.id)||this.removed.has(photo.id))return;
    const assetId=await this.deps.upload!(photo);
    if(!this.selected(photo.id)||this.removed.has(photo.id)){
     this.deps.onState(photo.id,"deleting");
     await this.deps.remove!(assetId);
     return;
    }
    this.uploaded.set(photo.id,assetId);
    this.deps.onState(photo.id,"uploaded");
    // Persist the chosen first photo as soon as the last active upload lands.
    if(this.deps.getPhotos().every(p=>p.status!=="ready"||this.uploaded.has(p.id)))
      this.syncOrder();
   }).catch(()=>{if(this.selected(photo.id)){
    this.deps.onState(photo.id,"failed");
    this.deps.onError("Не удалось загрузить фото. Повтори отправку.");
   }}).finally(()=>this.busy.delete(photo.id));
  }
 }
 /** Called before local removal, also works if the browser lost the receipt. */
 removePhoto(id:string){
  this.removed.add(id);this.uploaded.delete(id);
  this.deps.onState(id,"deleting");
  void this.enqueue(async()=>{
   if(!this.allowed)return;
   const hash=await this.deps.digest!(id);
   const item=(await this.deps.manifest!()).find(x=>x.clientDigest===hash);
   if(item)await this.deps.remove!(item.id);
  }).catch(()=>this.deps.onError("Фото скрыто локально, но удаление с сервера не подтверждено. Повтори при подключении к сети."));
 }
 /** Final commit reconciles all selected IDs with the authenticated server,
 * removes unselected legacy assets and persists the user's actual first photo.
 */
 async flush():Promise<string[]>{
  if(!this.allowed)throw new Error("photo_consent_required");
  const ready=this.deps.getPhotos().filter(p=>p.status==="ready");
  if(ready.length<3||ready.length>6)throw new Error("three_to_six_ready_photos_required");
  await this.queue;
  await this.prepare();
  // A previous failed background upload is retried with the SAME client key.
  for(const photo of ready){
   if(!this.uploaded.has(photo.id)){
    const asset=await this.deps.upload!(photo);
    this.uploaded.set(photo.id,asset);this.deps.onState(photo.id,"uploaded");
   }
  }
  const desired=new Map<string,string>();
  for(const photo of ready)desired.set(await this.deps.digest!(photo.id),photo.id);
  const manifest=await this.deps.manifest!();
  for(const item of manifest){
   if(!item.clientDigest||!desired.has(item.clientDigest)){
    await this.deps.remove!(item.id);
   }
  }
  const active=await this.deps.manifest!();
  const map=new Map(active.map(item=>[item.clientDigest,item]));
  const ids=await Promise.all(ready.map(async photo=>{
   const digest=await this.deps.digest!(photo.id);
   const match=map.get(digest);
   if(!match||match.state!=="approved"&&match.state!=="pending_review")
    throw new Error("incomplete_private_media");
   return match.id;
  }));
  if(new Set(ids).size!==ids.length||active.length!==ready.length)
   throw new Error("incomplete_private_media");
  await this.deps.order!(ids);
  return ids;
 }
 /** Best-effort reorder only after all chosen files have reached the server. */
 syncOrder(){
  if(!this.allowed)return;
  void this.enqueue(async()=>{
   const selected=this.deps.getPhotos().filter(p=>p.status==="ready");
   if(!selected.length||selected.some(p=>!this.uploaded.has(p.id)))return;
   const ordered=selected.map(p=>this.uploaded.get(p.id)!);
   const rows=await this.deps.manifest!();
   if(rows.length!==ordered.length)return;
   await this.deps.order!(ordered);
  }).catch(()=>this.deps.onError("Порядок фотографий сохранится после повторной синхронизации."));
 }
}
