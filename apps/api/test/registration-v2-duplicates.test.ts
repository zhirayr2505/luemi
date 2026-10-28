import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {findExactDuplicatePhotoIds} from "../../web/src/registration/v2/duplicate-photos.js";
test("free on-device duplicate filter finds identical image bytes but is not face verification",async()=>{
 const old=globalThis.crypto;
 Object.defineProperty(globalThis,"crypto",{configurable:true,value:webcrypto});
 try{
  const a=new Blob(["this is the same PNG payload"],{type:"image/png"});
  const b=new Blob(["different PNG payload"],{type:"image/png"});
  const items=[
   {id:"one",file:a},{id:"two",file:b},{id:"three",file:a},
   {id:"four",file:b}
  ] as Parameters<typeof findExactDuplicatePhotoIds>[0];
  assert.deepEqual(await findExactDuplicatePhotoIds(items),["three","four"]);
 }finally{
  Object.defineProperty(globalThis,"crypto",{configurable:true,value:old});
 }
});

test("missing WebCrypto never silently marks unchecked photos as distinct",async()=>{
 const old=globalThis.crypto;
 Object.defineProperty(globalThis,"crypto",{configurable:true,value:undefined});
 try{
  const a=new Blob(["unverified"]);
  await assert.rejects(
   findExactDuplicatePhotoIds([{id:"one",file:a}] as Parameters<typeof findExactDuplicatePhotoIds>[0]),
   /photo_digest_unavailable/
  );
 }finally{
  Object.defineProperty(globalThis,"crypto",{configurable:true,value:old});
 }
});
