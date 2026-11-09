/** Tiny, pre-rasterized optical copy for the bottom of a Feed photo.
 * Generating it outside swipe frames keeps live CSS blur off Android GPU tiles.
 * Some external hosts deny CORS canvas reads; callers then use the unblurred
 * decoded source as a graceful fallback instead of risking a tainted canvas.
 */
const previews=new Map<string,Promise<string|null>>();
const MAX_PREVIEWS=12;

async function rasterize(src:string):Promise<string|null>{
 if(typeof document==="undefined")return null;
 try{
  const source=new Image();
  source.crossOrigin="anonymous";
  source.decoding="async";
  source.src=src;
  await source.decode();
  const canvas=document.createElement("canvas");
  canvas.width=96;canvas.height=160;
  const ctx=canvas.getContext("2d",{alpha:false});
  if(!ctx)return null;
  const ratio=Math.max(canvas.width/source.naturalWidth,canvas.height/source.naturalHeight);
  const w=source.naturalWidth*ratio,h=source.naturalHeight*ratio;
  ctx.fillStyle="#24182A";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.filter="blur(8px)";
  ctx.drawImage(source,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
  ctx.filter="none";
  return canvas.toDataURL("image/jpeg",.72);
 }catch{
  // Cross-origin media without ACAO and intermittent decode failures are
  // allowed to fall back to the already-cached real photo.
  return null;
 }
}
export function prepareFeedAmbient(src:string):Promise<string|null>{
 const hit=previews.get(src);
 if(hit)return hit;
 const task=rasterize(src);
 previews.set(src,task);
 if(previews.size>MAX_PREVIEWS)previews.delete(previews.keys().next().value!);
 return task;
}
