import {inspectPhoto,MAX_PREVIEW_SIDE,MAX_PREVIEW_SOURCE_PIXELS} from "./photo-header";

/** Only a screen preview. The unchanged original File remains owned by the caller/REM-01B.
 * A bounded format/dimension check ALWAYS precedes any full-size image decode.
 * No claim that WebView decoder performs a zero-copy/low-memory resize. */
export async function preparePhotoPreview(file:Blob,signal:AbortSignal):Promise<Blob>{
 const header=await inspectPhoto(file,signal);
 signal.throwIfAborted();
 const {width:originalWidth,height:originalHeight}=header;
 // A small image is safe to render directly; retain legacy quality and orientation.
 if(Math.max(originalWidth,originalHeight)<=MAX_PREVIEW_SIDE)return file;
 let bitmap:ImageBitmap|null=null,image:HTMLImageElement|null=null,url:string|null=null;
 let canvas:HTMLCanvasElement|null=null;
 try{
  if(typeof createImageBitmap==="function"){
   try{bitmap=await createImageBitmap(file,{imageOrientation:"from-image"});}
   catch{signal.throwIfAborted();}
  }
  signal.throwIfAborted();
  if(!bitmap){
   image=new Image();
   url=URL.createObjectURL(file);
   const node=image;
   await new Promise<void>((resolve,reject)=>{
    let settled=false;
    const finish=(error?:Error)=>{
     if(settled)return;
     settled=true;signal.removeEventListener("abort",onAbort);
     node.onload=null;node.onerror=null;
     if(error)reject(error);else resolve();
    };
    const onAbort=()=>finish(new DOMException("Photo preparation aborted","AbortError"));
    signal.addEventListener("abort",onAbort,{once:true});
    node.onerror=()=>finish(new Error("Photo decode failed"));
    // decode() is not universally available in older Telegram/WKWebView.
    node.onload=()=>{
     if(typeof node.decode==="function")
      void node.decode().then(()=>finish(),()=>finish(new Error("Photo decode failed")));
     else finish();
    };
    if(signal.aborted){onAbort();return;}
    node.src=url!;
   });
   signal.throwIfAborted();
  }
  const width=bitmap?bitmap.width:image!.naturalWidth;
  const height=bitmap?bitmap.height:image!.naturalHeight;
  if(!width||!height||width*height>MAX_PREVIEW_SOURCE_PIXELS)
   throw new Error("PHOTO_DIMENSIONS_UNSUPPORTED");
  // The decoder can apply EXIF rotation. Compare sides unordered, not w/h in JPEG header order.
  if(Math.min(width,height)!==Math.min(originalWidth,originalHeight)||
     Math.max(width,height)!==Math.max(originalWidth,originalHeight))
   throw new Error("PHOTO_DECODE_DIMENSIONS_MISMATCH");
  const scale=Math.min(1,MAX_PREVIEW_SIDE/Math.max(width,height));
  if(scale===1)return file;
  canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(width*scale));
  canvas.height=Math.max(1,Math.round(height*scale));
  const context=canvas.getContext("2d");
  if(!context)throw new Error("Canvas unavailable");
  context.imageSmoothingEnabled=true;context.imageSmoothingQuality="high";
  context.drawImage(bitmap??image!,0,0,canvas.width,canvas.height);
  signal.throwIfAborted();
  const prepared=await new Promise<Blob>((resolve,reject)=>{
   let done=false;
   const finish=(blob:Blob|null,error?:Error)=>{
    if(done)return;
    done=true;signal.removeEventListener("abort",onAbort);
    if(error)reject(error);else if(blob)resolve(blob);else reject(new Error("Photo encoding failed"));
   };
   const onAbort=()=>finish(null,new DOMException("Photo encoding aborted","AbortError"));
   signal.addEventListener("abort",onAbort,{once:true});
   if(signal.aborted){onAbort();return;}
   try{
    canvas!.toBlob(blob=>finish(blob),
     file.type==="image/png"?"image/png":"image/jpeg",.92);
   }catch(e){finish(null,e instanceof Error?e:new Error("Photo encoding failed"));}
  });
  signal.throwIfAborted();
  return prepared;
 }finally{
  bitmap?.close();
  if(image){image.onload=null;image.onerror=null;image.src="";}
  if(url)URL.revokeObjectURL(url);
  if(canvas){canvas.width=0;canvas.height=0;}
 }
}
