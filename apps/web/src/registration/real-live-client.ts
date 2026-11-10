// REG01D opt-in only. The backend enforces Telegram identity, adult consent,
// approved publication and two-way blocks. Never cache responses in local storage.
import {geoCsrf} from "../auth/session-adapter";
import type {SearchScope} from "./model";
import {remoteMediaPilot} from "./server-media";
export const realFeedPilot={
 enabled:remoteMediaPilot.enabled&&import.meta.env.VITE_LUEMI_REAL_DISCOVERY_UI==="1"
};
export const realMatchPilot={
 enabled:realFeedPilot.enabled&&import.meta.env.VITE_LUEMI_REAL_CHATS==="1"&&
  import.meta.env.VITE_LUEMI_REAL_MATCHES==="1"
};
/** Server verifies both adult published profiles, blocks and mutual likes. */
export type RealLikeKind="ordinary"|"super";
export interface SuperlikeBalance{weekly:number;purchased:number;total:number;renewsAt:string}
export interface LikeReceipt{liked:true;kind:RealLikeKind;matched:boolean;matchId?:string;superlikes:SuperlikeBalance}
export async function likePublishedUser(id:string,kind:RealLikeKind="ordinary"):Promise<LikeReceipt>{
 if(!realMatchPilot.enabled)throw new Error("matches_disabled");
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
  throw new Error("invalid_target");
 const controller=new AbortController();
 const timeout=window.setTimeout(()=>controller.abort(),10000);
 let data:unknown;
 try{data=await api("/api/v4/matches/like","POST",{targetId:id,kind},controller.signal);}
 catch(error){if(controller.signal.aborted)throw new Error("like_timeout");throw error;}
 finally{window.clearTimeout(timeout);}
 if(!object(data)||data.liked!==true||data.kind!==kind||typeof data.matched!=="boolean"||
    (data.matched&&(typeof data.matchId!=="string"||!uuid.test(data.matchId)))||
    !validBalance(data.superlikes))
  throw new Error("invalid_like_receipt");
 return data as unknown as LikeReceipt;
}
const validBalance=(value:unknown):value is SuperlikeBalance=>object(value)&&
 Number.isInteger(value.weekly)&&Number(value.weekly)>=0&&Number.isInteger(value.purchased)&&
 Number(value.purchased)>=0&&Number.isInteger(value.total)&&
 Number(value.total)===Number(value.weekly)+Number(value.purchased)&&
 typeof value.renewsAt==="string"&&Number.isFinite(Date.parse(value.renewsAt));
export async function getSuperlikeBalance(signal?:AbortSignal):Promise<SuperlikeBalance>{
 const res=await fetch("/api/v4/matches/superlikes",{credentials:"same-origin",cache:"no-store",signal});
 if(!res.ok)throw new Error("superlikes_"+res.status);
 const data:unknown=await res.json();if(!validBalance(data))throw new Error("invalid_superlikes");return data;
}
export interface IncomingLike{ id:string;name:string;createdAt:string;kind:RealLikeKind;photoUrl:string|null; }
export interface IncomingLikesPage{likes:IncomingLike[];premium:boolean;hiddenCount:number}
export async function getIncomingLikes(signal?:AbortSignal):Promise<IncomingLikesPage>{
 if(!realMatchPilot.enabled)throw new Error("matches_disabled");
 const res=await fetch("/api/v4/matches/incoming",{credentials:"same-origin",cache:"no-store",signal});
 if(!res.ok)throw new Error("incoming_likes_"+res.status);
 const data:unknown=await res.json();
 if(!object(data)||!Array.isArray(data.likes))throw new Error("invalid_incoming_likes");
 const likes=data.likes.flatMap((item:unknown)=>{
  if(!object(item)||typeof item.id!=="string"||!uuid.test(item.id)||
     typeof item.name!=="string"||item.name.length<1||item.name.length>80||
     typeof item.createdAt!=="string"||!Number.isFinite(Date.parse(item.createdAt))||
     (item.kind!=="ordinary"&&item.kind!=="super")||
     (item.photoUrl!==null&&(typeof item.photoUrl!=="string"||!photoPath.test(item.photoUrl))))return [];
  return [{id:item.id,name:item.name,createdAt:item.createdAt,kind:item.kind,photoUrl:item.photoUrl}];
 });
 if(typeof data.premium!=="boolean"||!Number.isInteger(data.hiddenCount)||Number(data.hiddenCount)<0)
  throw new Error("invalid_incoming_likes");
 return {likes:likes as IncomingLike[],premium:data.premium,hiddenCount:Number(data.hiddenCount)};
}
export async function rejectIncomingLike(id:string):Promise<void>{
 if(!uuid.test(id))throw new Error("invalid_target");
 const data=await api("/api/v4/matches/incoming/"+id+"/reject","POST",{});
 if(!object(data)||data.rejected!==true)throw new Error("invalid_reject_receipt");
}
export interface NewMatch{id:string;peerId:string;peerProfileId:string;peerName:string;
 peerPhotoUrl:string|null;createdAt:string;interests:string[];seen:boolean;conversationId:string|null}
export interface NewMatchesPage{matches:NewMatch[];viewerGender:"man"|"woman"|"other"}
export async function getNewMatches(signal?:AbortSignal):Promise<NewMatchesPage>{
 const res=await fetch("/api/v4/matches/new",{credentials:"same-origin",cache:"no-store",signal});
 if(!res.ok)throw new Error("new_matches_"+res.status);const data:unknown=await res.json();
 if(!object(data)||!Array.isArray(data.matches)||!["man","woman","other"].includes(String(data.viewerGender)))
  throw new Error("invalid_new_matches");
 const matches=data.matches.filter((item:unknown):item is NewMatch=>object(item)&&typeof item.id==="string"&&uuid.test(item.id)&&
  typeof item.peerId==="string"&&uuid.test(item.peerId)&&item.peerProfileId===item.peerId&&
  typeof item.peerName==="string"&&(item.peerPhotoUrl===null||typeof item.peerPhotoUrl==="string"&&photoPath.test(item.peerPhotoUrl))&&
  typeof item.createdAt==="string"&&Number.isFinite(Date.parse(item.createdAt))&&Array.isArray(item.interests)&&
  item.interests.every((x:unknown)=>typeof x==="string")&&typeof item.seen==="boolean"&&
  (item.conversationId===null||typeof item.conversationId==="string"&&uuid.test(item.conversationId)));
 return {matches,viewerGender:data.viewerGender as NewMatchesPage["viewerGender"]};
}
export async function openNewMatch(id:string):Promise<string>{
 if(!uuid.test(id))throw new Error("invalid_match");
 const data=await api("/api/v4/matches/"+id+"/open","POST",{});
 if(!object(data)||typeof data.conversationId!=="string"||!uuid.test(data.conversationId))
  throw new Error("invalid_match_open");
 return data.conversationId;
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
 likedYouKind:RealLikeKind|null;
 distanceKm:number|null;publishedAt:string|null;
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
async function api(url:string,method:"GET"|"POST",body?:unknown,signal?:AbortSignal):Promise<unknown>{
 requirePilot();
 const csrf=method==="POST"?geoCsrf():null;
 if(method==="POST"&&!csrf)throw new Error("session_required");
 const res=await fetch(url,{method,credentials:"same-origin",cache:"no-store",
  signal,
  headers:method==="POST"?{"Content-Type":"application/json","X-Luemi-CSRF":csrf!}:undefined,
  ...(method==="POST"?{body:JSON.stringify(body??{})}:{})});
 if(!res.ok){
  let reason="api_"+res.status;
  try{const failure:unknown=await res.json();if(object(failure)&&typeof failure.error==="string")reason=failure.error;}
  catch{/* retain status-based error */}
  throw new Error(reason);
 }
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
export interface PublishedFeedPage{profiles:RealPublishedProfile[];nextCursor:string|null;searchScope?:SearchScope}
function parsePublishedProfile(item:unknown):RealPublishedProfile|null{
 if(!object(item)||typeof item.id!=="string"||!uuid.test(item.id)||typeof item.name!=="string"||
  !Number.isInteger(item.age)||Number(item.age)<18||typeof item.city!=="string"||
  typeof item.countryCode!=="string"||typeof item.about!=="string"||typeof item.goal!=="string"||
  !["woman","man","other"].includes(String(item.gender))||!Array.isArray(item.interests)||
  !Array.isArray(item.languages)||!Array.isArray(item.photos)||item.photos.length<3||item.photos.length>6)return null;
 const photos=item.photos.filter((p:unknown):p is {id:string;url:string}=>object(p)&&
  typeof p.id==="string"&&uuid.test(p.id)&&typeof p.url==="string"&&photoPath.test(p.url)&&p.url.endsWith(p.id));
 if(photos.length!==item.photos.length||!item.interests.every((x:unknown)=>typeof x==="string")||
  !item.languages.every((x:unknown)=>typeof x==="string"))return null;
 const distanceKm=item.distanceKm===null?null:typeof item.distanceKm==="number"&&Number.isFinite(item.distanceKm)&&item.distanceKm>=0?item.distanceKm:null;
 const publishedAt=typeof item.publishedAt==="string"&&Number.isFinite(Date.parse(item.publishedAt))?item.publishedAt:null;
 return {id:item.id,name:item.name,age:Number(item.age),city:item.city,countryCode:item.countryCode,
  gender:item.gender as "man"|"woman"|"other",goal:item.goal,about:item.about,
  interests:item.interests as string[],languages:item.languages as string[],photos,
  likedYouKind:item.likedYouKind==="ordinary"||item.likedYouKind==="super"?item.likedYouKind:null,
  distanceKm,publishedAt};
}
export async function getPublishedProfile(id:string,signal?:AbortSignal):Promise<RealPublishedProfile>{
 if(!uuid.test(id))throw new Error("invalid_target");
 const res=await fetch("/api/v3/discovery/profile/"+id,{credentials:"same-origin",cache:"no-store",signal});
 if(!res.ok)throw new Error("profile_"+res.status);const data:unknown=await res.json();
 const profile=object(data)?parsePublishedProfile(data.profile):null;
 if(!profile)throw new Error("invalid_profile");return profile;
}
/** Changes only the signed owner's discovery geography preference. */
export async function updateDiscoverySearchScope(scope:"radius"|"city"|"world"):Promise<void>{
 const data=await api("/api/v3/discovery/scope","POST",{scope});
 if(!object(data)||data.scope!==scope)throw new Error("invalid_scope_response");
}
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
  const parsed=parsePublishedProfile(item);return parsed?[parsed]:[];
 });
 const scope=data.searchScope;
 if(scope!==undefined&&scope!=="radius"&&scope!=="city"&&scope!=="country"&&scope!=="world")
  throw new Error("invalid_feed_scope");
 return{profiles,nextCursor:data.nextCursor as string|null,
  ...(scope===undefined?{}:{searchScope:scope as SearchScope})};
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
