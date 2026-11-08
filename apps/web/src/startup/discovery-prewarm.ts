import {demoPeople} from "../discovery/demo-people";

/** Warm route chunks, shared typography and the immutable original brand asset
 * while the publication/returning-member curtain is still on screen.
 * These imports reuse Vite's module cache on the first actual render. */
export async function prewarmDiscoveryUi(signal:AbortSignal):Promise<void>{
 if(signal.aborted)return;
 const modules=Promise.allSettled([
  import("../discovery/RealDiscoveryHome"),
  import("../discovery/RealForYou"),
  import("../discovery/RealNearby"),
  import("../chats/RealChats"),
  import("../discovery/DemoFeedSandbox")
 ]);
 const brand=new Promise<void>(resolve=>{
  const image=new Image();
  const finish=()=>{image.onload=null;image.onerror=null;resolve();};
  if(signal.aborted){resolve();return;}
  image.onload=()=>{if(typeof image.decode==="function")void image.decode().then(finish,finish);else finish();};
  image.onerror=finish;
  image.src="/assets/brand/wordmark_original_raster_alpha_W06.webp";
 });
 await Promise.allSettled([modules,brand,document.fonts.ready]);
}

/** Illustrative demo media never goes to the live discovery or matching APIs.
 * Prewarm visible covers + alternate images with strict concurrency/time limits,
 * and keep authored SVG fallbacks for disconnected/offline test sessions. */
export async function prewarmDemoPhotos(signal:AbortSignal):Promise<void>{
 if(signal.aborted)return;
 const urls=[...new Set([
  ...demoPeople.map(person=>person.photos[0]?.src),
  ...demoPeople.slice(0,7).map(person=>person.photos[2]?.src)
 ].filter((url):url is string=>Boolean(url)))];
 let index=0;
 const load=async(url:string)=>new Promise<void>(resolve=>{
  if(signal.aborted){resolve();return;}
  const image=new Image();let finished=false;
  const finish=()=>{
   if(finished)return;finished=true;
   window.clearTimeout(timeout);signal.removeEventListener("abort",finish);
   image.onload=null;image.onerror=null;resolve();
  };
  const timeout=window.setTimeout(finish,2400);
  signal.addEventListener("abort",finish,{once:true});
  image.onload=()=>{if(typeof image.decode==="function")void image.decode().then(finish,finish);else finish();};
  image.onerror=finish;
  image.src=url;
 });
 await Promise.all(Array.from({length:4},async()=>{
  while(index<urls.length&&!signal.aborted)await load(urls[index++]);
 }));
}
