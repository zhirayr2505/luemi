/** Screen copy only. The caller retains the original File for persistence/API use. */
export async function preparePhotoPreview(file:Blob,signal:AbortSignal):Promise<Blob> {
 signal.throwIfAborted();
 let bitmap:ImageBitmap|null=null,image:HTMLImageElement|null=null,url:string|null=null;
 let canvas:HTMLCanvasElement|null=null;
 try {
  if(typeof createImageBitmap==="function"){
   try{bitmap=await createImageBitmap(file);}catch{signal.throwIfAborted();}
  }
  signal.throwIfAborted();
  if(!bitmap){
   image=new Image();url=URL.createObjectURL(file);image.src=url;
   await image.decode();signal.throwIfAborted();
  }
  const source=bitmap??image!;
  const width=bitmap?bitmap.width:image!.naturalWidth;
  const height=bitmap?bitmap.height:image!.naturalHeight;
  if(!width||!height)throw new Error("Empty photo");
  const scale=Math.min(1,2048/Math.max(width,height));
  if(scale===1)return file;
  canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(width*scale));
  canvas.height=Math.max(1,Math.round(height*scale));
  const context=canvas.getContext("2d");if(!context)throw new Error("Canvas unavailable");
  context.imageSmoothingEnabled=true;context.imageSmoothingQuality="high";
  context.drawImage(source,0,0,canvas.width,canvas.height);
  const result=await new Promise<Blob>((resolve,reject)=>{
   canvas!.toBlob(blob=>blob?resolve(blob):reject(new Error("Photo encoding failed")),
    file.type==="image/png"?"image/png":"image/jpeg",.92);
  });
  signal.throwIfAborted();
  return result;
 }finally{
  bitmap?.close();if(image)image.src="";
  if(url)URL.revokeObjectURL(url);
  if(canvas){canvas.width=0;canvas.height=0;}
 }
}
