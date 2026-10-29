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
const MAX_IMAGES=6;
const MAX_IMAGE_BYTES=1_500_000;
const ALLOWED=/^\/api\/v3\/discovery\/photo\/[0-9a-f-]{36}$/i;
type Preferences=Pick<RegistrationDraft,"city"|"countryCode"|"interests"|"ageMin"|"ageMax">;
/** Rank only already-authorized server rows. Eligibility, blocks and 18+
 * restrictions remain enforced on the server; approximate city is optional.
 * Stable ties retain the server publication order.
 */
export function rankPublishedRecommendations(page:PublishedFeedPage,p:Preferences):PublishedFeedPage{
 const city=p.city.trim().toLocaleLowerCase("ru");
 const interests=new Set(p.interests);
 const score=(profile:PublishedFeedPage["profiles"][number])=>{
  const sameCity=!!city&&profile.city.trim().toLocaleLowerCase("ru")===city&&
   profile.countryCode===p.countryCode;
  const shared=profile.interests.reduce((sum,id)=>sum+(interests.has(id)?1:0),0);
  const ageMatch=profile.age>=p.ageMin&&profile.age<=p.ageMax;
  return (sameCity?6:0)+Math.min(shared,5)*3+(ageMatch?1:0);
 };
 return {...page,profiles:page.profiles.map((profile,i)=>({profile,i,score:score(profile)}))
  .sort((a,b)=>b.score-a.score||a.i-b.i).map(x=>x.profile)};
}


export async function warmPublishedRecommendations(
 signal:AbortSignal,
 onStage?:(stage:"recommendations"|"nearby"|"photos")=>void,
 preferences?:Preferences
):Promise<WarmRecommendationSet>{
 onStage?.("recommendations");
 const source=await getPublishedFeed(signal);
 if(signal.aborted)throw new DOMException("Aborted","AbortError");
 onStage?.("nearby");
 // The server already filters eligibility, adulthood and blocks; the client
 // now ranks its signed result by shared interests and approximate city.
 // Never send exact coordinates or raw registration details to photo hosts.
 const page=preferences?rankPublishedRecommendations(source,preferences):source;
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
    }catch{
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
