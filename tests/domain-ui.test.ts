import { test } from "node:test";
import { strict as assert } from "node:assert";
import { ageAt, blankProfile, validateStep, movePhoto, initialState, takeAction, undoAction } from "../packages/core/domain";

test("Registration is strictly 18+ and rejects invalid dates",()=>{
  assert.ok(Number.isNaN(ageAt("2000-02-31",new Date("2026-10-18"))));
  const profile={...blankProfile,name:"Анна-Мария",birthDate:"2008-10-18",gender:"Женщина",consent:true};
  assert.equal(validateStep(profile,1,new Date("2026-10-18")),null);
  assert.equal(validateStep(profile,2,new Date("2026-10-18")),null);
  assert.match(validateStep({...profile,birthDate:"2008-10-19"},2,new Date("2026-10-18"))??"",/18/);
});
test("Photo movement preserves all photo objects",()=>{
 const photos=[{id:"a",source:"demo"},{id:"b",source:"demo"},{id:"c",source:"demo"}];
 assert.deepEqual(movePhoto(photos,2,0).map(x=>x.id),["c","a","b"]);
 assert.deepEqual(photos.map(x=>x.id),["a","b","c"]);
});
test("Local like, mutual demo match and undo are reversible, not server-side",()=>{
 const state=initialState();
 const liked=takeAction(state,"alina","like");
 assert.deepEqual(liked.liked,["alina"]);
 assert.deepEqual(liked.matches,["alina"]);
 const restored=undoAction(liked);
 assert.deepEqual(restored.liked,[]);
 assert.deepEqual(restored.matches,[]);
 assert.equal(restored.undoUsed,1);
});
