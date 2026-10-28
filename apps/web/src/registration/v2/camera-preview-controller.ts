/**
 * Camera is a *preview* only; do not transform a completed camera session
 * into biometric proof. Ensures an asynchronous getUserMedia result is stopped
 * if the user leaves, hides Telegram or retries while permission is pending.
 */
export interface PreviewStream {
 getTracks():ReadonlyArray<{stop():void}>;
}
export type PreviewOpenResult="preview"|"cancelled";
export class CameraPreviewController<T extends PreviewStream>{
 private version=0;
 private disposed=false;
 private stream:T|null=null;
 async open(request:()=>Promise<T>,attach:(stream:T)=>Promise<void>):Promise<PreviewOpenResult>{
  if(this.disposed)return "cancelled";
  const id=++this.version;
  const incoming=await request();
  if(this.disposed||this.version!==id){
   this.stop(incoming);
   return "cancelled";
  }
  this.stream=incoming;
  try{await attach(incoming);}
  catch(error){
   this.close();
   throw error;
  }
  if(this.disposed||this.version!==id){
   if(this.stream===incoming)this.stream=null;
   this.stop(incoming);
   return "cancelled";
  }
  return "preview";
 }
 close(){
  ++this.version;
  if(this.stream){
   this.stop(this.stream);
   this.stream=null;
  }
 }
 dispose(){
  this.disposed=true;
  this.close();
 }
 private stop(stream:T){
  for(const track of stream.getTracks()){
   try{track.stop();}catch{/* Ensure other tracks are still stopped. */}
  }
 }
}
