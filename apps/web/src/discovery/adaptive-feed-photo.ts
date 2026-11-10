/**
 * Turns square and landscape feed photos into one portrait bitmap.
 *
 * The expensive blur is painted once on a small canvas before the DOM image is
 * revealed. Discovery therefore keeps one fullscreen <img> per slide instead
 * of compositing a sharp foreground and a second blurred GPU layer while the
 * user swipes on Android WebView.
 */
const OUTPUT_ASPECT=6/13;
const ADAPTIVE_SOURCE_ASPECT=.88;
const MAX_OUTPUT_WIDTH=900;
const MIN_OUTPUT_WIDTH=540;
const MAX_CACHE_ENTRIES=18;

const prepared=new Map<string,Promise<Blob|null>>();

export function needsAdaptiveFeedPhoto(width:number,height:number):boolean{
 return width>0&&height>0&&width/height>=ADAPTIVE_SOURCE_ASPECT;
}

function canvasBlob(canvas:HTMLCanvasElement,type:string,quality:number):Promise<Blob|null>{
 return new Promise(resolve=>canvas.toBlob(resolve,type,quality));
}

async function bitmapFromBlob(blob:Blob):Promise<ImageBitmap|HTMLImageElement>{
 if(typeof createImageBitmap==="function")return createImageBitmap(blob,{imageOrientation:"from-image"});
 const url=URL.createObjectURL(blob);
 try{
  const image=new Image();image.decoding="async";image.src=url;
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("adaptive_photo_decode_failed"));});
  if(typeof image.decode==="function")await image.decode().catch(()=>undefined);
  return image;
 }finally{URL.revokeObjectURL(url);}
}

async function renderAdaptivePhoto(source:string):Promise<Blob|null>{
 const response=await fetch(source,{credentials:"omit",cache:"force-cache"});
 if(!response.ok)throw new Error("adaptive_photo_fetch_"+response.status);
 const bitmap=await bitmapFromBlob(await response.blob());
 const sourceWidth=bitmap.width,sourceHeight=bitmap.height;
 if(!needsAdaptiveFeedPhoto(sourceWidth,sourceHeight)){
  if("close" in bitmap)bitmap.close();
  return null;
 }
 const outputWidth=Math.round(Math.min(MAX_OUTPUT_WIDTH,Math.max(MIN_OUTPUT_WIDTH,sourceWidth)));
 const outputHeight=Math.round(outputWidth/OUTPUT_ASPECT);
 const canvas=document.createElement("canvas");canvas.width=outputWidth;canvas.height=outputHeight;
 const context=canvas.getContext("2d",{alpha:false});
 if(!context){if("close" in bitmap)bitmap.close();return null;}
 try{
  // Overscan prevents transparent/dark seams at the edges of the canvas blur.
  const cover=Math.max(outputWidth/sourceWidth,outputHeight/sourceHeight)*1.08;
  const backdropWidth=sourceWidth*cover,backdropHeight=sourceHeight*cover;
  context.save();
  context.filter=`blur(${Math.round(outputWidth*.052)}px) saturate(.88)`;
  context.globalAlpha=.92;
  context.drawImage(bitmap,(outputWidth-backdropWidth)/2,(outputHeight-backdropHeight)/2,backdropWidth,backdropHeight);
  context.restore();
  context.fillStyle="rgba(16,19,23,.25)";context.fillRect(0,0,outputWidth,outputHeight);

  // The original photo remains complete. A short alpha feather removes the
  // visible rectangular boundary without softening the face or body.
  const contain=Math.min(outputWidth/sourceWidth,outputHeight/sourceHeight);
  const sharpWidth=sourceWidth*contain,sharpHeight=sourceHeight*contain;
  const sharpX=(outputWidth-sharpWidth)/2,sharpY=(outputHeight-sharpHeight)/2;
  const foreground=document.createElement("canvas");foreground.width=outputWidth;foreground.height=outputHeight;
  const sharp=foreground.getContext("2d");
  if(!sharp)return null;
  sharp.drawImage(bitmap,sharpX,sharpY,sharpWidth,sharpHeight);
  const feather=Math.max(12,Math.round(outputWidth*.022));
  const mask=sharp.createLinearGradient(0,sharpY,0,sharpY+sharpHeight);
  mask.addColorStop(0,"rgba(0,0,0,0)");
  mask.addColorStop(Math.min(.12,feather/sharpHeight),"rgba(0,0,0,1)");
  mask.addColorStop(Math.max(.88,1-feather/sharpHeight),"rgba(0,0,0,1)");
  mask.addColorStop(1,"rgba(0,0,0,0)");
  sharp.globalCompositeOperation="destination-in";sharp.fillStyle=mask;
  sharp.fillRect(sharpX,sharpY,sharpWidth,sharpHeight);
  context.drawImage(foreground,0,0);
  foreground.width=0;foreground.height=0;

  return await canvasBlob(canvas,"image/webp",.9)??await canvasBlob(canvas,"image/jpeg",.92);
 }finally{
  if("close" in bitmap)bitmap.close();
  canvas.width=0;canvas.height=0;
 }
}

/** Cached compressed pixels only; every mounted carousel owns and revokes its object URLs. */
export function prepareAdaptiveFeedPhoto(source:string,width:number,height:number):Promise<Blob|null>{
 if(!needsAdaptiveFeedPhoto(width,height))return Promise.resolve(null);
 const existing=prepared.get(source);if(existing)return existing;
 const task=renderAdaptivePhoto(source).catch(()=>null);
 prepared.set(source,task);
 while(prepared.size>MAX_CACHE_ENTRIES){
  const oldest=prepared.keys().next().value;
  if(typeof oldest!=="string")break;
  prepared.delete(oldest);
 }
 return task;
}
