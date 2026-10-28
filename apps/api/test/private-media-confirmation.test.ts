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

test("same count but different server photos never confirms a new upload",()=>{
 const saved=manifest(["pending_review","approved","approved"]);
 assert.equal(confirmedPrivateMediaCount(saved,3,ids),3);
 const absent="00000000-0000-4000-8000-000000000099";
 assert.throws(()=>confirmedPrivateMediaCount(saved,3,[ids[0],ids[1],absent]),/uploaded_media_not_confirmed/);
 assert.throws(()=>confirmedPrivateMediaCount(saved,3,[ids[0],ids[0],ids[2]]),/uploaded_media_not_confirmed/);
 assert.throws(()=>confirmedPrivateMediaCount(saved,3,[ids[0],ids[1]]),/uploaded_media_not_confirmed/);
 assert.throws(()=>confirmedPrivateMediaCount(saved,3,["forged",ids[1],ids[2]]),/uploaded_media_not_confirmed/);
});
