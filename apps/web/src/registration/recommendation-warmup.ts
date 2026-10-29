import {getPublishedFeed,type PublishedFeedPage} from "./real-live-client";

/** Volatile cache only: no IndexedDB, localStorage or service worker.
 * Blobs belong to one logged-in UI session and are revoked on teardown.
 * Only authenticated/authorized published derivatives are requested.
 */
export interface WarmRecommendationSet{
 page:PublishedFeedPage;
 release:()=>void;
}
const MAX_IMAGES=6;
const MAX_IMAGE_BYTES=1_500_000;
const ALLOWED=/^\/api\/v3\/discovery\/photo\/[0-9a-f-]{36}$/i;

export async function warmPublishedRecommendations(
 signal:AbortSignal,
 onStage?:(stage:"recommendations"|"nearby"|"photos")=>void
):Promise<WarmRecommendationSet>{
 onStage?.("recommendations");
 const page=await getPublishedFeed(signal);
 if(signal.aborted)throw new DOMException("Aborted","AbortError");
 onStage?.("nearby");
 // The server already filters eligibility, age, blocks and publication.
 // Nearby/common-interest subsets are computed in the existing LUEMI tabs.
 // Never send exact coordinates or full registration fields to photo hosts.
 const urls=page.profiles.flatMap(p=>p.photos.slice(0,2).map(photo=>photo.url))
  .filter((url,i,all)=>ALLOWED.test(url)&&all.indexOf(url)===i)
  .slice(0,MAX_IMAGES);
 onStage?.("photos");
 const blobs=new Map<string,string>();
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
     if(bytes.size<1||bytes.size>MAX_IMAGE_BYTES)continue;
     blobs.set(url,URL.createObjectURL(bytes));
    }catch(e){
     if(signal.aborted)break;
     // A failed derivative prefetch must NOT block admission or replace
     // the server-backed photo URI with a broken cached resource.
    }
   }
  };
  await Promise.all([consume(),consume()]);
  if(signal.aborted)throw new DOMException("Aborted","AbortError");
  return{page:{
   ...page,profiles:page.profiles.map(p=>({
    ...p,photos:p.photos.map(photo=>({...photo,url:blobs.get(photo.url)??photo.url}))
   }))
  },release};
 }catch(e){release();throw e;}
}
