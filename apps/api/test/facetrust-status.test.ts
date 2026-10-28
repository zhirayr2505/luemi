import Fastify from "fastify";
import test from "node:test";
import assert from "node:assert/strict";
import {registerFaceTrustCapabilities} from "../src/facetrust-status.js";
test("FaceTrust API is absent without signed-session guards",async()=>{
 const app=Fastify();registerFaceTrustCapabilities(app,undefined);
 try{
  const r=await app.inject({method:"GET",url:"/api/v2/facetrust/status"});
  assert.equal(r.statusCode,404);
 }finally{await app.close();}
});
test("FaceTrust API never claims verified or ready without an actual provider",async()=>{
 const app=Fastify();
 registerFaceTrustCapabilities(app,{read:async()=>{}});
 try{
  const r=await app.inject({method:"GET",url:"/api/v2/facetrust/status"});
  assert.equal(r.statusCode,200);
  assert.equal(r.headers["cache-control"],"private, no-store");
  const s=r.json();
  assert.deepEqual(s,{
   state:"provider_not_connected",faceLivenessAvailable:false,
   photoComparisonAvailable:false,photoAutoReviewAvailable:false,
   verified:false,publicProfileEligible:false,cameraPreviewAvailable:true,
   supportsPrivateDraft:true
  });
 }finally{await app.close();}
});
