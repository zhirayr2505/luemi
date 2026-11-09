/** LUEMI discovery image readiness.
 * All bookkeeping is memory-only (no storage/cookies/service worker).
 * This cache is a bounded list of verified decoded sources, NOT bitmap copies.
 * Native browser/Blob caches own bytes and can evict them independently.
 */
export interface PreloadPhoto {src:string;fallback?:string}
export interface PreloadProfile {photos:readonly PreloadPhoto[]}
const MAX_READY=72;
const decoded=new Map<string,true>();
const inflight=new Map<string,Promise<boolean>>();
/* User can tap repeatedly while preloading. Keep already-started requests alive
 * across card changes and bound total simultaneous decodes across ALL effects. */
const MAX_CONCURRENT=4;
let activeDecodes=0;
const waiting:Array<()=>void>=[];
async function acquireSlot(){
 if(activeDecodes<MAX_CONCURRENT){activeDecodes++;return;}
 await new Promise<void>(resolve=>waiting.push(resolve));
 activeDecodes++;
}
function releaseSlot(){
 activeDecodes=Math.max(0,activeDecodes-1);
 waiting.shift()?.();
}
const keyOf=(url:string):string=>{
 try{return new URL(url,window.location.href).href;}catch{return url;}
};
export function isFeedImageDecoded(url:string):boolean{return decoded.has(keyOf(url));}
export function noteFeedImageDecoded(url:string):void{
 if(!url)return;
 url=keyOf(url);
 decoded.delete(url);decoded.set(url,true);
 while(decoded.size>MAX_READY){
  const oldest=decoded.keys().next().value;
  if(typeof oldest!=="string")break;
  decoded.delete(oldest);
 }
}
export function preloadFeedImage(url:string,signal?:AbortSignal):Promise<boolean>{
 if(!url||signal?.aborted)return Promise.resolve(false);
 url=keyOf(url);
 if(decoded.has(url))return Promise.resolve(true);
 const existing=inflight.get(url);
 if(existing)return existing;
 // Abort controls whether more tasks are scheduled, but does not destroy
 // an already-started shared image request when the user changes cards.
 const promise=(async()=>{
  await acquireSlot();
  try{
   if(signal?.aborted)return false;
   return await new Promise<boolean>(resolve=>{
    const image=new Image();let done=false;
    const finish=(ok:boolean)=>{
     if(done)return;done=true;
     clearTimeout(timeout);
     image.onload=null;image.onerror=null;
     if(ok)noteFeedImageDecoded(url);
     resolve(ok);
    };
    const timeout=window.setTimeout(()=>finish(false),6500);
    image.decoding="async";
    image.onload=()=>{
     if(typeof image.decode==="function"){
      void image.decode().then(()=>finish(image.naturalWidth>0),
       ()=>finish(image.naturalWidth>0));
     }else finish(image.naturalWidth>0);
    };
    image.onerror=()=>finish(false);
    image.src=url;
    if(image.complete&&image.naturalWidth>0)finish(true);
   });
  }finally{releaseSlot();}
 })().finally(()=>inflight.delete(url));
 inflight.set(url,promise);
 return promise;
}

/** Prioritize 1 cover per next card before additional gallery photos.
 * Bounded: at most 3 network/decode operations concurrently and 12 urls.
 * Does not block interaction and never displays a half-loaded card image. */
export async function preloadUpcomingFeedPhotos(
 people:readonly PreloadProfile[],signal?:AbortSignal
):Promise<void>{
 if(signal?.aborted)return;
 const urls=[...new Set([
  ...people.slice(0,5).map(person=>person.photos[0]?.src),
  ...people.slice(0,4).map(person=>person.photos[1]?.src),
  ...people.slice(0,3).map(person=>person.photos[2]?.src)
 ].filter((v):v is string=>typeof v==="string"&&!!v))].slice(0,12);
 let index=0;
 await Promise.all(Array.from({length:3},async()=>{
  while(index<urls.length&&!signal?.aborted){
   await preloadFeedImage(urls[index++],signal);
  }
 }));
}

/**
 * Transition gate for the ACTUAL img element in the already mounted queued
 * card. A different preload Image succeeding does not guarantee WebView has
 * decoded/painted the DOM element itself. Only promote after this returns true.
 * Loading an image does not construct or mount any new cards.
 */
export async function ensureMountedCoverReady(
 card:HTMLElement|null,signal?:AbortSignal,timeoutMs=8000
):Promise<boolean>{
 const cover=card?.querySelector<HTMLImageElement>(".carousel-track img:first-child");
 if(!cover||signal?.aborted)return false;
 const loaded=()=>cover.isConnected&&cover.naturalWidth>0&&cover.complete;
 if(cover.classList.contains("is-ready")&&loaded())return true;
 const result=await new Promise<boolean>(resolve=>{
  let finished=false;
  const finish=(ok:boolean)=>{
   if(finished)return;
   finished=true;window.clearTimeout(timeout);
   cover.removeEventListener("load",onLoad);
   signal?.removeEventListener("abort",onAbort);
   resolve(ok);
  };
  const onAbort=()=>finish(false);
  const onLoad=()=>{
   const source=cover.currentSrc||cover.src;
   if(typeof cover.decode==="function"){
    void cover.decode().then(()=>{
     if(!signal?.aborted&&loaded()&&(cover.currentSrc||cover.src)===source)finish(true);
    },()=>{if(loaded())finish(true);});
   }else if(loaded())finish(true);
  };
  const timeout=window.setTimeout(()=>finish(loaded()),timeoutMs);
  signal?.addEventListener("abort",onAbort,{once:true});
  cover.addEventListener("load",onLoad);
  if(loaded())onLoad();
 });
 if(!result||signal?.aborted)return false;
 cover.classList.add("is-ready");
 noteFeedImageDecoded(cover.currentSrc||cover.src);
 // React's 120ms opacity reveal must finish before deck compositor begins.
 await new Promise<void>(resolve=>window.setTimeout(resolve,140));
 return !signal?.aborted&&loaded();
}
