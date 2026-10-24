/**
 * REM-05F — SYNTHETIC CONTRACT HARNESS ONLY.
 * Never import into apps/api/src or expose as an HTTP handler. These checks
 * model a possible future server; they do NOT grant real permissions.
 */
export type BlikAudience="public"|"matches";
export type BlikOperation="list"|"detail"|"media"|"viewer"|"prefetch"|"view"|"fire"|"comment"|"world"|"author_viewers";
export type Decision="ALLOW_SYNTHETIC_ONLY"|"DENY";
export type BlikFailure="closed"|"identity"|"publication"|"moderation"|"expiry"|"revoked"|"blocked"|"audience"|"world_consent"|"eligibility"|"premium"|"author_only";

export interface SyntheticBlik {
 id:string;authorId:string;mediaId:string;mediaVersion:number;permissionRevision:number;
 audience:BlikAudience;publication:"published"|"draft"|"pending"|"hidden"|"rejected";
 moderation:"approved"|"pending"|"removed"|"rejected";
 publishedAtMs:number;expiresAtMs:number;revokedAtMs:null|number;
 worldOptIn:boolean;commentsEnabled:boolean;
}
export interface SyntheticServerFacts {
 viewerId:string|null; serverNowMs:number; permissionRevision:number;
 currentMatchIds:ReadonlySet<string>;blockedIds:ReadonlySet<string>;
 viewerWorldOpened:boolean;eligible:boolean;
 premiumEntitlement:{serverVerified:boolean;active:boolean}|null;
 playback:{userInitiated:boolean;decodedAndVisible:boolean}|null;
}
export interface SyntheticDecision {
 decision:Decision;reason:BlikFailure|"none";permissionRevision:number|null;
 /** No URI, object path, Storage key or signed download link is ever returned. */
 mediaUrl:null;publicViewerIdentity:null;
}

/** Strict allowlisted structural validation; extra client-supplied flags ignored. */
export function parseSyntheticBlik(value:unknown):SyntheticBlik|null {
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const p=value as Record<string,unknown>;
 const id=(s:unknown)=>typeof s==="string"&&/^[A-Za-z0-9_-]{1,64}$/.test(s);
 const ms=(n:unknown)=>typeof n==="number"&&Number.isSafeInteger(n)&&n>=0;
 if(!id(p.id)||!id(p.authorId)||!id(p.mediaId)||
   typeof p.mediaVersion!=="number"||!Number.isSafeInteger(p.mediaVersion)||p.mediaVersion<1||
   typeof p.permissionRevision!=="number"||!Number.isSafeInteger(p.permissionRevision)||p.permissionRevision<1||
   (p.audience!=="public"&&p.audience!=="matches")||
   !["published","draft","pending","hidden","rejected"].includes(String(p.publication))||
   !["approved","pending","removed","rejected"].includes(String(p.moderation))||
   !ms(p.publishedAtMs)||!ms(p.expiresAtMs)||
   !(p.revokedAtMs===null||ms(p.revokedAtMs))||
   typeof p.worldOptIn!=="boolean"||typeof p.commentsEnabled!=="boolean")return null;
 return {id:p.id as string,authorId:p.authorId as string,mediaId:p.mediaId as string,
   mediaVersion:p.mediaVersion as number,permissionRevision:p.permissionRevision as number,
   audience:p.audience as BlikAudience,
   publication:p.publication as SyntheticBlik["publication"],
   moderation:p.moderation as SyntheticBlik["moderation"],
   publishedAtMs:p.publishedAtMs as number,expiresAtMs:p.expiresAtMs as number,
   revokedAtMs:p.revokedAtMs as number|null,worldOptIn:p.worldOptIn as boolean,
   commentsEnabled:p.commentsEnabled as boolean};
}
export function evaluateSyntheticBlik(
 input:unknown, facts:SyntheticServerFacts,operation:BlikOperation
):SyntheticDecision {
 const deny=(reason:BlikFailure):SyntheticDecision=>({decision:"DENY",reason,
   permissionRevision:null,mediaUrl:null,publicViewerIdentity:null});
 const p=parseSyntheticBlik(input);
 if(!p||!Number.isSafeInteger(facts.serverNowMs)||!Number.isSafeInteger(facts.permissionRevision)||
   facts.permissionRevision<1)return deny("closed");
 if(!facts.viewerId||typeof facts.viewerId!=="string")return deny("identity");
 if(facts.permissionRevision!==p.permissionRevision)return deny("closed");
 if(p.publication!=="published")return deny("publication");
 if(p.moderation!=="approved")return deny("moderation");
 if(p.revokedAtMs!==null)return deny("revoked");
 if(p.publishedAtMs>facts.serverNowMs||p.expiresAtMs<=facts.serverNowMs||
   p.expiresAtMs>p.publishedAtMs+86400000)return deny("expiry");
 if(facts.blockedIds.has(p.authorId))return deny("blocked");
 if(!facts.eligible)return deny("eligibility");
 if(p.audience==="matches"&&p.authorId!==facts.viewerId&&
   !facts.currentMatchIds.has(p.authorId))return deny("audience");
 if(operation==="world" && (p.audience!=="public"||!p.worldOptIn||
   !facts.viewerWorldOpened))return deny("world_consent");
 if(operation==="author_viewers"&&facts.viewerId!==p.authorId)return deny("author_only");
 if(operation==="view"&&(!facts.playback?.userInitiated||
   !facts.playback.decodedAndVisible||facts.viewerId===p.authorId))return deny("eligibility");
 if(operation==="fire"&&facts.viewerId===p.authorId)return deny("eligibility");
 if(operation==="comment"&&(!p.commentsEnabled||
   !facts.premiumEntitlement?.serverVerified||!facts.premiumEntitlement.active))return deny("premium");
 // Eligibility is not capability. This result cannot be used for production access.
 return {decision:"ALLOW_SYNTHETIC_ONLY",reason:"none",
   permissionRevision:facts.permissionRevision,mediaUrl:null,publicViewerIdentity:null};
}
/** Deterministic mock-only fire idempotency key; never creates a match or chat. */
export function syntheticFireKey(viewerId:string,blikId:string):string|null {
 return /^[A-Za-z0-9_-]{1,64}$/.test(viewerId)&&/^[A-Za-z0-9_-]{1,64}$/.test(blikId)?
   viewerId+":"+blikId:null;
}
