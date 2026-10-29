// REG01D opt-in only. The backend enforces Telegram identity, adult consent,
// approved publication and two-way blocks. Never cache responses in local storage.
import {geoCsrf} from "../auth/session-adapter";
import {remoteMediaPilot} from "./server-media";
export const realFeedPilot={
 enabled:remoteMediaPilot.enabled&&import.meta.env.VITE_LUEMI_REAL_DISCOVERY_UI==="1"
};
export const realMatchPilot={
 enabled:realFeedPilot.enabled&&import.meta.env.VITE_LUEMI_REAL_CHATS==="1"&&
  import.meta.env.VITE_LUEMI_REAL_MATCHES==="1"
};
/** Server verifies both adult published profiles, blocks and mutual likes. */
export async function likePublishedUser(id:string):Promise<{liked:true;matched:boolean;conversationId?:string}>{
 if(!realMatchPilot.enabled)throw new Error("matches_disabled");
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
  throw new Error("invalid_target");
 const data=await api("/api/v4/matches/like","POST",{targetId:id});
 if(!object(data)||data.liked!==true||typeof data.matched!=="boolean"||
    (data.matched&&(typeof data.conversationId!=="string"||!uuid.test(data.conversationId))))
  throw new Error("invalid_like_receipt");
 return data as {liked:true;matched:boolean;conversationId?:string};
}
/** Remove both participants' access immediately without erasing conversation history. */
export async function closeRealMatch(id:string):Promise<void>{
 if(!realMatchPilot.enabled)throw new Error("matches_disabled");
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
  throw new Error("invalid_match");
 const data=await api("/api/v4/matches/"+id+"/close","POST",{});
 if(!object(data)||data.closed!==true)throw new Error("invalid_unmatch_receipt");
}
export interface RealPublishedProfile{
 id:string;name:string;age:number;city:string;countryCode:string;
 about:string;gender:"man"|"woman"|"other";goal:string;
 interests:string[];languages:string[];
 photos:Array<{id:string;url:string}>;
}
export interface OwnerPublicationStatus{
 state:"draft"|"published"|"hidden";publishedRevision:number;
 approved:number;pending:number;other:number;
 profile?:{
  name:string;age:number;city:string;countryCode:string;about:string;
  goal:string;interests:string[];photos:string[];
 };
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const photoPath=/^\/api\/v3\/discovery\/photo\/[0-9a-f-]{36}$/i;
function requirePilot(){if(!realFeedPilot.enabled)throw new Error("real_feed_disabled");}
async function api(url:string,method:"GET"|"POST",body?:unknown):Promise<unknown>{
 requirePilot();
 const csrf=method==="POST"?geoCsrf():null;
 if(method==="POST"&&!csrf)throw new Error("session_required");
 const res=await fetch(url,{method,credentials:"same-origin",cache:"no-store",
  headers:method==="POST"?{"Content-Type":"application/json","X-Luemi-CSRF":csrf!}:undefined,
  ...(method==="POST"?{body:JSON.stringify(body??{})}:{})});
 if(!res.ok)throw new Error("api_"+res.status);
 return res.json() as Promise<unknown>;
}
const object=(x:unknown):x is Record<string,unknown>=>
  x!==null&&typeof x==="object"&&!Array.isArray(x);
export async function ownerPublicationStatus():Promise<OwnerPublicationStatus>{
 const data=await api("/api/v3/profile/status","GET");
 if(!object(data)||!["draft","published","hidden"].includes(String(data.state))||
  !Number.isSafeInteger(data.publishedRevision)||!Number.isSafeInteger(data.approved)||
  !Number.isSafeInteger(data.pending)||!Number.isSafeInteger(data.other))
  throw new Error("invalid_publication_status");
 if(data.profile!==undefined){
  const p=data.profile;
  if(data.state!=="published"||!object(p)||typeof p.name!=="string"||
   !Number.isInteger(p.age)||Number(p.age)<18||typeof p.city!=="string"||
   typeof p.countryCode!=="string"||typeof p.about!=="string"||
   typeof p.goal!=="string"||!Array.isArray(p.interests)||
   !p.interests.every((v:unknown)=>typeof v==="string")||
   !Array.isArray(p.photos)||p.photos.length<3||p.photos.length>6||
   !p.photos.every((url:unknown)=>typeof url==="string"&&photoPath.test(url)))
   throw new Error("invalid_owner_profile");
 }
 return data as unknown as OwnerPublicationStatus;
}
export async function publishMyProfile(revision:number):Promise<void>{
 if(!Number.isSafeInteger(revision)||revision<1)throw new Error("invalid_revision");
 const data=await api("/api/v3/profile/publish","POST",{revision});
 if(!object(data)||data.state!=="published"||data.revision!==revision)
  throw new Error("invalid_publication_receipt");
}
export async function unpublishMyProfile():Promise<void>{
 const data=await api("/api/v3/profile/unpublish","POST",{});
 if(!object(data)||data.state!=="hidden")throw new Error("invalid_unpublish_receipt");
}
/** Hides profile/media immediately, but does NOT erase user data or credentials. */
export async function withdrawRealConsent():Promise<void>{
 const result=await api("/api/v3/profile/withdraw-consent","POST",{});
 if(!object(result)||result.state!=="consent_withdrawn"||result.dataDeleted!==false)
  throw new Error("invalid_consent_withdrawal_receipt");
}
export const deletionReasons=[
 ["met_someone","Нашёл(ла) человека"],
 ["not_useful","Не подошло приложение"],
 ["privacy","Беспокоит конфиденциальность"],
 ["technical","Технические проблемы"],
 ["other","Другая причина"],
 ["prefer_not_to_say","Не хочу указывать"]
] as const;
export type DeletionReason=(typeof deletionReasons)[number][0];
/** Immediately hides the owner; final irreversible cleanup starts no earlier than 72h. */
export async function requestMyAccountDeletion(reason:DeletionReason,details:string):Promise<string>{
 if(!deletionReasons.some(item=>item[0]===reason)||details.length>500)
  throw new Error("invalid_deletion_reason");
 const result=await api("/api/v3/account/request-deletion","POST",
  {confirmation:"DELETE MY LUEMI ACCOUNT",reason,details});
 if(!object(result)||result.state!=="deletion_grace"||
   result.publicAccessRevoked!==true||result.sessionsRevoked!==true||
   result.storagePending!==true||result.dataDeleted!==false||
   result.canRestore!==true||typeof result.restoreUntil!=="string"||
   !Number.isFinite(Date.parse(result.restoreUntil)))
  throw new Error("invalid_deletion_grace_receipt");
 return result.restoreUntil;
}
export interface PublishedFeedPage{profiles:RealPublishedProfile[];nextCursor:string|null}
export async function getPublishedFeed(signal:AbortSignal,cursor:string|null=null):Promise<PublishedFeedPage>{
 requirePilot();
 if(cursor!==null&&!/^[A-Za-z0-9_-]{12,256}$/.test(cursor))throw new Error("invalid_feed_cursor");
 const res=await fetch("/api/v3/discovery/feed"+(cursor?"?after="+encodeURIComponent(cursor):""),{
  credentials:"same-origin",cache:"no-store",signal});
 if(!res.ok)throw new Error("feed_"+res.status);
 const data:unknown=await res.json();
 if(!object(data)||data.status!=="published_only"||!Array.isArray(data.profiles)||
   (data.nextCursor!==null&&(typeof data.nextCursor!=="string"||
     !/^[A-Za-z0-9_-]{12,256}$/.test(data.nextCursor))))
  throw new Error("invalid_feed");
 const profiles:RealPublishedProfile[]=data.profiles.flatMap((item:unknown)=>{
  if(!object(item)||typeof item.id!=="string"||!uuid.test(item.id)||
   typeof item.name!=="string"||!Number.isInteger(item.age)||Number(item.age)<18||
   typeof item.city!=="string"||typeof item.countryCode!=="string"||
   typeof item.about!=="string"||typeof item.goal!=="string"||
   !["woman","man","other"].includes(String(item.gender))||
   !Array.isArray(item.interests)||!Array.isArray(item.languages)||
   !Array.isArray(item.photos)||item.photos.length<3||item.photos.length>6)
    return [];
  const photos=item.photos.filter((p:unknown):p is {id:string;url:string}=>
   object(p)&&typeof p.id==="string"&&uuid.test(p.id)&&
   typeof p.url==="string"&&photoPath.test(p.url)&&p.url.endsWith(p.id));
  if(photos.length<3||photos.length>6||
   !item.interests.every((x:unknown)=>typeof x==="string")||
   !item.languages.every((x:unknown)=>typeof x==="string"))return [];
  return [{id:item.id,name:item.name,age:Number(item.age),city:item.city,
   countryCode:item.countryCode,gender:item.gender as "man"|"woman"|"other",
   goal:item.goal,about:item.about,interests:item.interests as string[],
   languages:item.languages as string[],photos}];
 });
 return{profiles,nextCursor:data.nextCursor as string|null};
}
export async function blockPublishedUser(id:string){
 if(!uuid.test(id))throw new Error("invalid_target");
 const data=await api("/api/v2/profile/blocks","POST",{targetId:id});
 if(!object(data)||data.ok!==true)throw new Error("block_failed");
}
export type PublishedReportReason="spam"|"harassment"|"impersonation"|"unsafe_media"|"minor_suspected"|"nonconsensual_photo";
export async function reportPublishedUser(
 id:string,reason:PublishedReportReason
){
 if(!uuid.test(id))throw new Error("invalid_target");
 const data=await api("/api/v2/profile/reports","POST",
  {targetId:id,reason,clientRef:crypto.randomUUID()});
 if(!object(data)||data.state!=="open")throw new Error("report_failed");
}

/** Request human review after successful private draft + 3–6 photo uploads.
 * The bot notification is server-side only; it never receives media bytes. */
export async function requestRegistrationReview():Promise<{notified:boolean;alreadySent:boolean}>{
 if(!realFeedPilot.enabled)throw new Error('registration_review_disabled');
 const result=await api('/api/v3/registration/submit-for-review','POST',{});
 if(!object(result)||result.state!=='review_requested'||
    typeof result.notified!=='boolean'||typeof result.alreadySent!=='boolean')
  throw new Error('invalid_review_request_receipt');
 return {notified:result.notified,alreadySent:result.alreadySent};
}
