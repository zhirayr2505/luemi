import {getPublishedFeed,type PublishedFeedPage} from "./real-live-client";
import type {RegistrationDraft} from "./model";

/** Volatile cache only: no IndexedDB, localStorage or service worker.
 * Blobs belong to one logged-in UI session and are revoked on teardown.
 * Only authenticated/authorized published derivatives are requested.
 */
export interface WarmRecommendationSet{
 page:PublishedFeedPage;
 release:()=>void;
}
const TARGET_PROFILES=15;
const MAX_PAGES=4;
const MAX_IMAGES=24;
const MAX_TOTAL_IMAGE_BYTES=18_000_000;
const MAX_IMAGE_BYTES=1_500_000;
const ALLOWED=/^\/api\/v3\/discovery\/photo\/[0-9a-f-]{36}$/i;
type Preferences=Pick<RegistrationDraft,"city"|"countryCode"|"interests"|"ageMin"|"ageMax">;
/** The private published feed is now ranked across ALL eligible profiles in
 * PostgreSQL before pagination. Re-sorting only the first warm page on the
 * device would violate global ranking and make following pages inconsistent. */
export async function warmPublishedRecommendations(
 signal:AbortSignal,
 onStage?:(stage:"recommendations"|"nearby"|"photos")=>void,
 _preferences?:Preferences
):Promise<WarmRecommendationSet>{
 onStage?.("recommendations");
 const first=await getPublishedFeed(signal);
 if(signal.aborted)throw new DOMException("Aborted","AbortError");
 onStage?.("nearby");
 // Fetch a bounded number of consecutive SERVER-RANKED pages. Never invent
 // profiles, change ordering, or query unapproved media hosts.
 const profiles=[...first.profiles];
 const uniqueIds=new Set(profiles.map(person=>person.id));
 const seenCursors=new Set<string>();
 let cursor=first.nextCursor,iterations=1;
 while(cursor&&profiles.length<TARGET_PROFILES&&iterations<MAX_PAGES&&!signal.aborted){
  if(seenCursors.has(cursor))break;
  seenCursors.add(cursor);
  const next=await getPublishedFeed(signal,cursor);
  for(const person of next.profiles)if(!uniqueIds.has(person.id)){
   uniqueIds.add(person.id);profiles.push(person);
  }
  cursor=next.nextCursor;iterations++;
 }
 if(signal.aborted)throw new DOMException("Aborted","AbortError");
 const page:PublishedFeedPage={...first,profiles,nextCursor:cursor};
 // Warm 15 card covers and a handful of secondary photos for the swipe carousel.
 // A limited set of decoded object URLs prevents Android WebView memory spikes.
 const prioritised=[
  ...profiles.slice(0,TARGET_PROFILES).map(person=>person.photos[0]?.url),
  ...profiles.slice(0,9).map(person=>person.photos[1]?.url)
 ].filter((url):url is string=>!!url);
 const urls=prioritised
  .filter((url,i,all)=>ALLOWED.test(url)&&all.indexOf(url)===i)
  .slice(0,MAX_IMAGES);
 onStage?.("photos");
 const blobs=new Map<string,string>();
 let totalBytes=0;
 const release=()=>{
  for(const url of blobs.values())URL.revokeObjectURL(url);
  blobs.clear();
 };
 try{
  let index=0;
  const consume=async()=>{
   while(index<urls.length&&!signal.aborted){
    const url=urls[index++];
    try{
     const result=await fetch(url,{credentials:"same-origin",cache:"no-store",signal});
     const mime=result.headers.get("content-type")?.split(";")[0];
     if(!result.ok||mime!=="image/png")continue;
     const length=Number(result.headers.get("content-length")??0);
     if(length>MAX_IMAGE_BYTES)continue;
     const bytes=await result.blob();
     if(signal.aborted)return;
     if(bytes.size<1||bytes.size>MAX_IMAGE_BYTES||
        totalBytes+bytes.size>MAX_TOTAL_IMAGE_BYTES)continue;
     totalBytes+=bytes.size;
     blobs.set(url,URL.createObjectURL(bytes));
    }catch{
     if(signal.aborted)break;
     // A failed derivative prefetch must NOT block admission or replace
     // the server-backed photo URI with a broken cached resource.
    }
   }
  };
  await Promise.all([consume(),consume(),consume()]);
  if(signal.aborted)throw new DOMException("Aborted","AbortError");
  // Ask the browser to decode the first visible cards before their components
  // mount. Failed decode remains a normal photo-level fallback, never a blocker.
  await Promise.allSettled(prioritised.slice(0,4).map(async url=>{
   const src=blobs.get(url);if(!src)return;
   const image=new Image();image.src=src;
   if(typeof image.decode==="function")await image.decode();
  }));
  if(signal.aborted)throw new DOMException("Aborted","AbortError");
  return{page:{
   ...page,profiles:page.profiles.map(p=>({
    ...p,photos:p.photos.map(photo=>({...photo,url:blobs.get(photo.url)??photo.url}))
   }))
  },release};
 }catch(e){release();throw e;}
}
