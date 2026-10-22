/** REM-03A / LU-02. Per-viewer bounded image decode cache. No motion/DOM writer.
 * A preloader's 'ready' is NOT proof that the displayed <img> has decoded.
 * The view performs a second, key-guarded decode before exposing its pixels.
 */
import type {ProfilePhoto} from "./ProfileModel";
import {resourceIdentity,photoIndex} from "./photo-viewer-state";

export type MediaPhase="idle"|"loading"|"decoding"|"ready"|"error";
export interface MediaState{
 key:string;photoId:string;phase:MediaPhase;src:string|null;
 width:number;height:number;reason:string|null;fallback:boolean;generation:number;
}
type Entry={photo:ProfilePhoto;state:MediaState;image:HTMLImageElement|null;token:number;disposed:boolean};
const snapshot=(entry:Entry):MediaState=>({...entry.state});
const validDimensions=(image:Pick<HTMLImageElement,"naturalWidth"|"naturalHeight">):boolean=>
 Number.isFinite(image.naturalWidth)&&Number.isFinite(image.naturalHeight)&&
 image.naturalWidth>0&&image.naturalHeight>0;
export class PhotoReadiness{
 private entries=new Map<string,Entry>();
 private disposed=false;
 private revision=0;
 constructor(private notify:()=>void,private makeImage:()=>HTMLImageElement=()=>new Image()){}
 private publish(entry:Entry,patch:Partial<MediaState>){
  if(this.disposed||entry.disposed)return;
  entry.state={...entry.state,...patch,generation:++this.revision};
  this.notify();
 }
 private detach(entry:Entry){
  entry.disposed=true;entry.token++;
  if(entry.image){entry.image.onload=null;entry.image.onerror=null;
   entry.image.removeAttribute("src");entry.image=null;}
 }
 private start(entry:Entry,preferFallback=false){
  if(this.disposed||entry.disposed)return;
  entry.token++;
  const ticket=entry.token;
  const fallback=entry.photo.fallback?.trim();
  const primary=entry.photo.src.trim();
  const useFallback=preferFallback&&!!fallback&&fallback!==primary;
  const url=useFallback?fallback!:primary;
  const fail=(reason:string)=>{
   if(this.disposed||entry.disposed||entry.token!==ticket)return;
   if(!useFallback&&fallback&&fallback!==primary){
    this.detachImage(entry);this.start(entry,true);return;
   }
   this.detachImage(entry);
   this.publish(entry,{phase:"error",src:null,width:0,height:0,reason,fallback:useFallback});
  };
  this.detachImage(entry);
  if(!url){fail("empty-src");return;}
  const img=this.makeImage();entry.image=img;
  this.publish(entry,{phase:"loading",src:null,width:0,height:0,reason:null,fallback:useFallback});
  img.onload=()=>{
   if(this.disposed||entry.disposed||entry.token!==ticket)return;
   if(!validDimensions(img)){fail("invalid-dimensions");return;}
   this.publish(entry,{phase:"decoding"});
   Promise.resolve().then(()=>typeof img.decode==="function"?img.decode():Promise.reject(new Error("decode-unavailable")))
    .then(()=>{
     if(this.disposed||entry.disposed||entry.token!==ticket)return;
     if(!validDimensions(img)){fail("invalid-decoded-dimensions");return;}
     this.publish(entry,{phase:"ready",src:url,width:img.naturalWidth,height:img.naturalHeight,
      reason:null,fallback:useFallback});
    }).catch(()=>fail("decode-failed"));
  };
  img.onerror=()=>fail("load-failed");
  img.src=url;
 }
 private detachImage(entry:Entry){
  if(entry.image){
   entry.image.onload=null;entry.image.onerror=null;
   entry.image.removeAttribute("src");entry.image=null;
  }
 }
 /** Always at most current + one previous + one next. All others are released. */
 updateWindow(photos:readonly ProfilePhoto[],photoId:string|null){
  if(this.disposed)return;
  const center=photoIndex(photos,photoId);
  const wanted=center<0?[]:photos.slice(Math.max(0,center-1),Math.min(photos.length,center+2));
  const keys=new Set(wanted.map(resourceIdentity));
  let changed=false;
  for(const [key,entry] of this.entries){
   if(!keys.has(key)){this.detach(entry);this.entries.delete(key);changed=true;}
  }
  for(const photo of wanted){
   const key=resourceIdentity(photo);
   if(!this.entries.has(key)){
    const entry:Entry={photo,image:null,token:0,disposed:false,
     state:{key,photoId:photo.id,phase:"idle",src:null,width:0,height:0,
      reason:null,fallback:false,generation:++this.revision}};
    this.entries.set(key,entry);this.start(entry);changed=true;
   }
  }
  if(changed)this.notify();
 }
 read(photo:ProfilePhoto|null|undefined):MediaState|null{
  if(!photo)return null;
  const e=this.entries.get(resourceIdentity(photo));return e?snapshot(e):null;
 }
 retry(photo:ProfilePhoto):boolean{
  const e=this.entries.get(resourceIdentity(photo));
  if(!e||e.state.phase!=="error"||this.disposed)return false;
  this.start(e);return true;
 }
 /** Actual displayed DOM image failed to decode: a preloader was not enough. */
 reportDisplayFailure(photo:ProfilePhoto,reason="display-decode-failed"):void{
  const entry=this.entries.get(resourceIdentity(photo));
  if(!entry||entry.state.phase!=="ready"||this.disposed)return;
  const fallback=photo.fallback?.trim();
  if(!entry.state.fallback&&fallback&&fallback!==photo.src.trim()){
   this.start(entry,true);return;
  }
  this.detachImage(entry);
  this.publish(entry,{phase:"error",src:null,width:0,height:0,reason});
 }
 isDisposed():boolean{return this.disposed;}
 size():number{return this.entries.size;}
 dispose(){
  if(this.disposed)return;this.disposed=true;
  for(const e of this.entries.values())this.detach(e);
  this.entries.clear();
 }
}
