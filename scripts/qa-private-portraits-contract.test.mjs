import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
const read=path=>readFileSync(path,"utf8");
const api=read("apps/api/src/rem05b-session.ts");
const data=read("apps/web/src/discovery/demo-people.ts");
const names=["karina","elina","milana","sara","arpi","diana"];
test("private real-photo QA album contains 24 distinct square WebP 512px frames",()=>{
 const digests=new Set();
 for(const name of names){
  for(let n=1;n<=4;n++){
   const path="apps/api/src/qa-fixtures/photos/"+name+"-"+n+".webp";
   assert.ok(existsSync(path),path);
   const bytes=readFileSync(path);
   assert.ok(bytes.length>4000&&bytes.length<180000,path);
   assert.equal(bytes.toString("ascii",0,4),"RIFF");
   assert.equal(bytes.toString("ascii",8,12),"WEBP");
   const index=bytes.indexOf(Buffer.from([0x9d,0x01,0x2a]));
   assert.ok(index>=0,"VP8 dimensions marker "+path);
   assert.equal(bytes.readUInt16LE(index+3)&0x3fff,512,path+" width");
   assert.equal(bytes.readUInt16LE(index+5)&0x3fff,512,path+" height");
   const digest=createHash("sha256").update(bytes).digest("hex");
   assert.ok(!digests.has(digest),"duplicate photo "+path);
   digests.add(digest);
  }
 }
 assert.equal(digests.size,24);
 assert.equal(existsSync("apps/web/public/assets/qa-fixtures"),false);
});
test("all portrait requests require an authenticated allowlisted actor, no public stock fallback",()=>{
 assert.match(api,/app\.get<\{Params:\{person:string;shot:string\}\}>/);
 assert.match(api,/\/api\/v2\/qa\/portraits\/:person\/:shot/);
 assert.match(api,/preHandler:authenticated/);
 assert.match(api,/if\(!qaAllowed\(req\)\|\|!safeRequest\)/);
 assert.match(api,/private, no-store/);
 assert.match(api,/qaNames\.has\(person\)/);
 assert.match(api,/readFile\(file\)/);
 assert.doesNotMatch(data,/https:\/\/(?:cdn\.pixabay\.com|images\.unsplash\.com)/);
 assert.match(data,/photos:Array\.from\(\{length:4\}/);
});
