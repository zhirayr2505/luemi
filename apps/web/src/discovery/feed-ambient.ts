/** Preblur only a tiny decoded image, never the full-size WebView photo layer.
 * The bitmap has the SAME crop/aspect as the underlying photo and a feathered
 * alpha ramp baked into its pixels. No full-screen CSS mask, live GPU blur, or
 * hard horizontal seam can appear over a portrait while scrolling.
 */
const previews=new Map<string,Promise<string|null>>();
const MAX_PREVIEWS=12;
function previewSize(aspect:number):[number,number]{
 const width=120;
 const safeAspect=Math.max(.32,Math.min(1.5,Number.isFinite(aspect)?aspect:.46));
 return [width,Math.max(100,Math.min(340,Math.round(width/safeAspect)))];
}
async function rasterize(src:string,width:number,height:number):Promise<string|null>{
 if(typeof document==="undefined")return null;
 try{
  const source=new Image();
  source.crossOrigin="anonymous";
  source.decoding="async";
  source.src=src;
  await source.decode();
  const canvas=document.createElement("canvas");
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d",{alpha:true});
  if(!ctx||!source.naturalWidth||!source.naturalHeight)return null;
  // Exact equivalent of object-fit:cover;object-position:center 35%.
  const ratio=Math.max(width/source.naturalWidth,height/source.naturalHeight);
  const w=source.naturalWidth*ratio,h=source.naturalHeight*ratio;
  ctx.filter="blur(8px)";
  ctx.drawImage(source,(width-w)*.5,(height-h)*.35,w,h);
  ctx.filter="none";
  // Smoothly blend the *pixels* of the preblurred copy into the sharp photo.
  // A bottom-only JPG inside a 58%-height box had a hard line across faces.
  ctx.globalCompositeOperation="destination-in";
  const feather=ctx.createLinearGradient(0,0,0,height);
  feather.addColorStop(0,"rgba(0,0,0,0)");
  feather.addColorStop(.39,"rgba(0,0,0,0)");
  feather.addColorStop(.48,"rgba(0,0,0,.13)");
  feather.addColorStop(.62,"rgba(0,0,0,.62)");
  feather.addColorStop(.83,"rgba(0,0,0,1)");
  feather.addColorStop(1,"rgba(0,0,0,1)");
  ctx.fillStyle=feather;
  ctx.fillRect(0,0,width,height);
  ctx.globalCompositeOperation="source-over";
  return canvas.toDataURL("image/webp",.78);
 }catch{
  // CORS-denied media is shown by the normal photo carousel, WITHOUT a
  // duplicate unblurred overlay. This is safer than a mismatched face.
  return null;
 }
}
export function prepareFeedAmbient(src:string,aspect=.46):Promise<string|null>{
 const [width,height]=previewSize(aspect);
 const key=src+"::"+width+"x"+height;
 const hit=previews.get(key);
 if(hit)return hit;
 const task=rasterize(src,width,height);
 previews.set(key,task);
 if(previews.size>MAX_PREVIEWS)previews.delete(previews.keys().next().value!);
 return task;
}
