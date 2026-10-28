import test from "node:test";
import assert from "node:assert/strict";
import {evaluateAutomaticPhotoReview,type AutoReviewInput} from "../src/automatic-photo-review.js";

const ids=[
 "00000000-0000-4000-8000-000000000001",
 "00000000-0000-4000-8000-000000000002",
 "00000000-0000-4000-8000-000000000003"
];
function baseline():AutoReviewInput{
 return{
  assetIds:[...ids],generation:2,
  photos:ids.map((assetId,i)=>({
   assetId,generation:2,contentDigest:String(i+1).repeat(64),
   faces:1,persons:1,faceQuality:"good",
   content:"safe",childPresence:"none_detected",faceAgeRisk:"adult_likely",
   syntheticMedia:"none_detected",similarityToLiveSelfie:99.9,
   complete:true
  })),
  selfie:{completed:true,sessionVerified:true,score:98},
  policy:{enabled:true,operationallyApproved:true,
   calibrationId:"calibrated-evaluation-v1",modelVersion:"provider-model-v1",
   minFaceSimilarity:97,minLiveness:95}
 };
}
const check=(input:AutoReviewInput,status:string,reason:string|null)=>{
 const v=evaluateAutomaticPhotoReview(input);
 assert.equal(v.status,status);
 assert.equal(v.reason,reason);
 assert.equal(v.eligibleForAutomaticPublication,status==="auto_publish_eligible");
};
test("only genuinely completed, calibrated, owner-bound, 3-photo evidence may be eligible",()=>{
 check(baseline(),"auto_publish_eligible",null);
 const good=baseline();good.photos.push({
  ...good.photos[0],assetId:"00000000-0000-4000-8000-000000000004",
  contentDigest:"4".repeat(64)
 });good.assetIds.push("00000000-0000-4000-8000-000000000004");
 check(good,"auto_publish_eligible",null);
});
test("never allow automatic publication without configured and calibrated models",()=>{
 const b=baseline();b.policy.enabled=false;check(b,"not_verified","not_configured");
 b.policy.enabled=true;b.policy.operationallyApproved=false;check(b,"not_verified","not_configured");
 b.policy.operationallyApproved=true;b.policy.calibrationId="";check(b,"not_verified","not_configured");
 b.policy.calibrationId="calibrated-evaluation-v1";
 b.policy.minFaceSimilarity=80;check(b,"not_verified","similarity_not_calibrated");
 b.policy.minFaceSimilarity=97;b.policy.minLiveness=50;
 check(b,"not_verified","similarity_not_calibrated");
});
test("manifest cannot be padded, swapped, outdated, duplicated or rely on unsigned evidence",()=>{
 const b=baseline();b.assetIds.pop();check(b,"not_verified","invalid_manifest");
 const c=baseline();c.assetIds[1]=c.assetIds[0];check(c,"not_verified","invalid_manifest");
 const d=baseline();d.photos[0].generation=1;check(d,"not_verified","stale_evidence");
 const e=baseline();e.photos[0].assetId="00000000-0000-4000-8000-000000000005";
 check(e,"not_verified","stale_evidence");
 const f=baseline();f.photos[0].contentDigest="not-sha";check(f,"not_verified","stale_evidence");
});
test("requires vendor-verified selfie and handles failed/incomplete liveness",()=>{
 const b=baseline();b.selfie=null;check(b,"not_verified","liveness_missing");
 const c=baseline();c.selfie!.sessionVerified=false;check(c,"not_verified","liveness_missing");
 const d=baseline();d.selfie!.score=50;check(d,"retry_selfie","liveness_failed");
});
test("refuses explicit sexual content and avoids auto-approving suspected children",()=>{
 const b=baseline();b.photos[0].content="unsafe";check(b,"rejected","unsafe_content");
 const c=baseline();c.photos[1].childPresence="detected";check(c,"needs_review","minor_suspected");
 const d=baseline();d.photos[0].faceAgeRisk="minor_possible";check(d,"needs_review","minor_suspected");
});
test("one unique person must be present in each image, with same face as live selfie",()=>{
 const b=baseline();b.photos[0].faces=2;check(b,"replace_photo","more_than_one_person");
 const c=baseline();c.photos[1].persons=2;check(c,"replace_photo","more_than_one_person");
 const d=baseline();d.photos[1].faces=0;check(d,"replace_photo","face_missing");
 const e=baseline();e.photos[0].similarityToLiveSelfie=50;check(e,"replace_photo","face_mismatch");
 const f=baseline();f.photos[2].contentDigest=f.photos[0].contentDigest;
 check(f,"replace_photo","duplicate_photo");
});
test("unknown vendor outputs, synthetic-risk or quality issues never auto-approve",()=>{
 const b=baseline();b.photos[0].complete=false;check(b,"not_verified","provider_incomplete");
 const c=baseline();c.photos[2].faceQuality="poor";check(c,"replace_photo","image_low_quality");
 const d=baseline();d.photos[0].childPresence="unknown";check(d,"needs_review","uncertain_content");
 const e=baseline();e.photos[0].syntheticMedia="suspected";check(e,"needs_review","synthetic_media_risk");
 const f=baseline();f.photos[0].similarityToLiveSelfie=null;check(f,"not_verified","provider_incomplete");
 const g=baseline();g.photos[1].content="uncertain";check(g,"needs_review","uncertain_content");
});
