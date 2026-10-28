import test from "node:test";
import assert from "node:assert/strict";
import {confirmedPrivateMediaCount} from "../../web/src/registration/private-media-confirmation.js";
const ids=["00000000-0000-4000-8000-000000000001","00000000-0000-4000-8000-000000000002","00000000-0000-4000-8000-000000000003"];
const manifest=(states:string[])=>({status:"unpublished",photos:states.map((state,i)=>({id:ids[i],state,version:1}))});
test("registration requires three server-confirmed media assets",()=>{
 assert.equal(confirmedPrivateMediaCount(manifest(["pending_review","approved","approved"]),3),3);
 assert.throws(()=>confirmedPrivateMediaCount(manifest(["approved","approved"]),3),/incomplete/);
 assert.throws(()=>confirmedPrivateMediaCount(manifest(["approved","reserved","approved"]),3),/incomplete/);
});
test("forged, duplicate, rejected media never pass confirmation",()=>{
 for(const state of ["revoked","rejected","reserved","queued"])
  assert.throws(()=>confirmedPrivateMediaCount(manifest(["approved","approved",state]),3));
 assert.throws(()=>confirmedPrivateMediaCount({...manifest(["approved","approved","approved"]),status:"published"},3));
 assert.throws(()=>confirmedPrivateMediaCount({status:"unpublished",photos:Array(3).fill({id:ids[0],state:"approved"})},3));
 assert.throws(()=>confirmedPrivateMediaCount(manifest(["approved","approved","approved"]),7));
});
