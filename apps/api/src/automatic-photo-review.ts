/**
 * LUEMI automated photo assessment V0. An isolated, side-effect-free decision
 * contract: it does NOT request AI, mutate PostgreSQL, approve assets or publish
 * a profile. All evidence MUST come from a privileged server-side worker,
 * never from Telegram WebView/HTTP request JSON.
 *
 * Neither age estimates, liveness scores nor face similarities certify age,
 * authenticity, consent, or legal biometric processing. False positives and
 * false negatives must be measured against consenting evaluation data.
 */
export type PhotoDisposition="auto_publish_eligible"|"replace_photo"|"retry_selfie"|
  "needs_review"|"rejected"|"not_verified";

export type AutoReviewReason=
  |"not_configured"|"invalid_manifest"|"stale_evidence"|"provider_incomplete"
  |"unsafe_content"|"minor_suspected"|"more_than_one_person"
  |"face_missing"|"image_low_quality"|"face_mismatch"|"duplicate_photo"
  |"uncertain_content"|"uncertain_age"|"synthetic_media_risk"
  |"liveness_missing"|"liveness_failed"|"similarity_not_calibrated";

export interface PhotoEvidence {
  assetId:string;
  generation:number;
  /** Distinct image bytes; SHA-256 of the already-sanitized PNG, server-generated. */
  contentDigest:string;
  faces:number|null;
  persons:number|null;
  faceQuality:"good"|"poor"|"unknown";
  content:"safe"|"unsafe"|"uncertain";
  /** Possible/minor detected => reject. None detected is NOT proof of adulthood. */
  childPresence:"none_detected"|"possible"|"detected"|"unknown";
  faceAgeRisk:"adult_likely"|"minor_possible"|"unknown";
  syntheticMedia:"none_detected"|"suspected"|"unknown";
  /** The face similarity against the same live-selfie reference image. */
  similarityToLiveSelfie:number|null;
  /** All required independent provider checks finished server-side. */
  complete:boolean;
}
export interface SelfieEvidence {
  completed:boolean;
  score:number|null;
  /** True only for an actual vendor-verified, bound live session. */
  sessionVerified:boolean;
}
export interface AutoReviewInput {
  /** Owner-bound, RLS-protected asset list and immutable review generation. */
  assetIds:string[];
  generation:number;
  photos:PhotoEvidence[];
  selfie:SelfieEvidence|null;
  /** Thresholds MUST be calibrated on production-relevant evaluation data. */
  policy:{
    enabled:boolean;
    calibrationId:string;
    modelVersion:string;
    minFaceSimilarity:number;
    minLiveness:number;
    /** Separately consented biometric processing, lawful provider settings and
     * explicit server-side configuration are required at integration time. */
    operationallyApproved:boolean;
  };
}
export interface PhotoVerdict {
  status:PhotoDisposition;
  reason:AutoReviewReason|null;
  /** Important: this boolean does NOT perform publication. A privileged worker
   * must atomically check persisted evidence and asset generations again. */
  eligibleForAutomaticPublication:boolean;
}
const verdict=(status:PhotoDisposition,reason:AutoReviewReason):PhotoVerdict=>
  ({status,reason,eligibleForAutomaticPublication:false});

const finiteScore=(x:number|null):x is number=>
  typeof x==="number"&&Number.isFinite(x)&&x>=0&&x<=100;
const validId=(v:string):boolean=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const sha256=(v:string):boolean=>/^[0-9a-f]{64}$/i.test(v);

/**
 * Conservative gate: any unavailable/suspicious signal remains private.
 * Caller must re-check the manifest against the database before writing an
 * 'approved' moderation decision in a separate trusted operator transaction.
 */
export function evaluateAutomaticPhotoReview(input:AutoReviewInput):PhotoVerdict{
 const {policy,photos,assetIds,generation,selfie}=input;
 if(!policy.enabled||!policy.operationallyApproved||
    !/^[a-z0-9][a-z0-9._:-]{5,127}$/i.test(policy.calibrationId)||
    !/^[a-z0-9][a-z0-9._:-]{2,127}$/i.test(policy.modelVersion))
   return verdict("not_verified","not_configured");
 if(!finiteScore(policy.minFaceSimilarity)||!finiteScore(policy.minLiveness)||
    policy.minFaceSimilarity<90||policy.minLiveness<80)
   return verdict("not_verified","similarity_not_calibrated");
 if(!Number.isSafeInteger(generation)||generation<1||
    !Array.isArray(assetIds)||assetIds.length<3||assetIds.length>6||
    !assetIds.every(validId)||new Set(assetIds).size!==assetIds.length||
    !Array.isArray(photos)||photos.length!==assetIds.length)
   return verdict("not_verified","invalid_manifest");
 const ids=new Set(assetIds);
 if(photos.some(p=>!ids.has(p.assetId)||p.generation!==generation||
    !sha256(p.contentDigest))||
    new Set(photos.map(p=>p.assetId)).size!==photos.length)
   return verdict("not_verified","stale_evidence");

 if(!selfie||!selfie.completed||!selfie.sessionVerified||
    !finiteScore(selfie.score))
   return verdict("not_verified","liveness_missing");
 if(selfie.score<policy.minLiveness)
   return verdict("retry_selfie","liveness_failed");

 // Explicit unsafe/child signals outrank retry/uncertain in the final result.
 if(photos.some(p=>p.content==="unsafe"))
   return verdict("rejected","unsafe_content");
 if(photos.some(p=>p.childPresence==="detected"||
                       p.childPresence==="possible"||
                       p.faceAgeRisk==="minor_possible"))
   return verdict("needs_review","minor_suspected");

 if(photos.some(p=>!p.complete||p.faces===null||p.persons===null||
    !Number.isSafeInteger(p.faces)||!Number.isSafeInteger(p.persons)||
    !finiteScore(p.similarityToLiveSelfie)))
   return verdict("not_verified","provider_incomplete");
 if(photos.some(p=>p.faces>1||p.persons>1))
   return verdict("replace_photo","more_than_one_person");
 if(photos.some(p=>p.faces!==1||p.persons!==1))
   return verdict("replace_photo","face_missing");
 if(photos.some(p=>p.faceQuality==="poor"))
   return verdict("replace_photo","image_low_quality");
 if(photos.some(p=>p.faceQuality==="unknown"||
     p.content==="uncertain"||p.childPresence==="unknown"||
     p.faceAgeRisk==="unknown"||p.syntheticMedia==="unknown"))
   return verdict("needs_review","uncertain_content");
 if(photos.some(p=>p.syntheticMedia==="suspected"))
   return verdict("needs_review","synthetic_media_risk");
 if(new Set(photos.map(p=>p.contentDigest.toLowerCase())).size!==photos.length)
   return verdict("replace_photo","duplicate_photo");
 if(photos.some(p=>(p.similarityToLiveSelfie??0)<policy.minFaceSimilarity))
   return verdict("replace_photo","face_mismatch");
 if(photos.some(p=>p.faceQuality!=="good"||p.content!=="safe"||
    p.childPresence!=="none_detected"||p.faceAgeRisk!=="adult_likely"||
    p.syntheticMedia!=="none_detected"))
   return verdict("needs_review","uncertain_content");
 return {status:"auto_publish_eligible",reason:null,eligibleForAutomaticPublication:true};
}
