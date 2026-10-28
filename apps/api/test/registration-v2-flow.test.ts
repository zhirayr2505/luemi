import test from "node:test";
import assert from "node:assert/strict";
import {registrationV2Stages,nextRegistrationV2Stage,canPublishRegistrationV2,
 type RegistrationV2Gate} from "../../web/src/registration/v2/flow.js";

const full:RegistrationV2Gate={
 hasIdentity:true,hasLocation:true,hasIntent:true,
 selectedPhotos:3,biometricConsent:true,faceTrust:"eligible"
};

test("Registration V2 has exactly eight stable design phases with consent before camera",()=>{
 assert.deepEqual(registrationV2Stages.map(x=>x.id),[
  "identity","location","intent","personality","photos","face-consent","liveness","review"
 ]);
 assert.equal(new Set(registrationV2Stages.map(x=>x.id)).size,8);
 assert.equal(registrationV2Stages.filter(x=>!x.required).length,1);
});
test("v2 stage progression enforces identity, location, intentions and 3–6 photos",()=>{
 assert.deepEqual(nextRegistrationV2Stage("identity",{...full,hasIdentity:false}),
  {allowed:false,reason:"identity_required"});
 assert.deepEqual(nextRegistrationV2Stage("location",{...full,hasLocation:false}),
  {allowed:false,reason:"city_required"});
 assert.deepEqual(nextRegistrationV2Stage("intent",{...full,hasIntent:false}),
  {allowed:false,reason:"intent_required"});
 for(const count of [0,1,2,7,100])
  assert.deepEqual(nextRegistrationV2Stage("photos",{...full,selectedPhotos:count}),
   {allowed:false,reason:"three_to_six_photos_required"});
 assert.deepEqual(nextRegistrationV2Stage("personality",{...full}),
  {allowed:true,stage:"photos"});
 assert.deepEqual(nextRegistrationV2Stage("photos",{...full,selectedPhotos:6}),
  {allowed:true,stage:"face-consent"});
});
test("consent and trusted liveness evidence cannot be bypassed by the web client",()=>{
 const unknown:RegistrationV2Gate={...full,faceTrust:"awaiting_provider"};
 assert.deepEqual(nextRegistrationV2Stage("face-consent",{...full,biometricConsent:false}),
  {allowed:false,reason:"separate_biometric_consent_required"});
 for(const state of ["not_started","consent_required","awaiting_provider","processing","retry","needs_review","revoked"] as const){
  assert.equal(canPublishRegistrationV2({...full,faceTrust:state}),false);
  assert.deepEqual(nextRegistrationV2Stage("liveness",{...full,faceTrust:state}),
   {allowed:false,reason:"trusted_liveness_verdict_required"});
 }
 assert.equal(canPublishRegistrationV2(unknown),false);
 assert.equal(canPublishRegistrationV2(full),true);
 assert.equal(canPublishRegistrationV2({...full,selectedPhotos:2}),false);
 assert.equal(canPublishRegistrationV2({...full,biometricConsent:false}),false);
 assert.equal(canPublishRegistrationV2({...full,hasIdentity:false}),false);
 assert.deepEqual(nextRegistrationV2Stage("liveness",full),
  {allowed:true,stage:"review"});
 assert.deepEqual(nextRegistrationV2Stage("review",full),
  {allowed:false,reason:"complete"});
});
