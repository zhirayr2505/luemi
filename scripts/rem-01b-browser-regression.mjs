import assert from "node:assert/strict";
import {chromium} from "playwright";
/** REM-01B: real isolated browser storage transactions + UI behavior, never user data. */
const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
const page=await context.newPage(),errors=[];
page.on("pageerror",error=>errors.push(error.message));
const run=async(name,fn)=>{await fn();console.log("REM01B_PASS "+name);};
try{
 await page.goto(base+"/rem-01b-qa.html",{waitUntil:"domcontentloaded"});
 await page.locator("#ready").filter({hasText:"ready"}).waitFor();
 await run("structural validator rejects malformed and accepts incomplete step 1",async()=>{
  const result=await page.evaluate(()=>{
   const q=window.__REM01B_QA__,base=q.makeDraft("");
   const wrong=[
    {...base,interests:"invalid"},{...base,radius:Infinity},
    {...base,ageMin:NaN},{...base,searchScope:"unknown"},
    {...base,about:{text:"nested"}},{...base,languages:["ru","ru"]},
    {...base,day:"NaN"},{...base,name:null}
   ];
   return {incomplete:q.validate(base).ok,wrong:wrong.map(x=>q.validate(x).ok),
    duplicate:q.photos([q.makePhoto("same"),q.makePhoto("same")].map(x=>({id:x.id,file:x.file}))).ok};
  });
  assert.equal(result.incomplete,true);
  assert.ok(result.wrong.every(x=>x===false));
  assert.equal(result.duplicate,false);
 });
 await run("new revision persists original File, preview and metadata across reopen",async()=>{
  const result=await page.evaluate(async()=>{
   const q=window.__REM01B_QA__,scope=q.scope(),photo=q.makePhoto("new-file"),
    draft=q.makeDraft("Анна");
   const saved=await q.save(scope,"draft-1",1,draft,4,[photo]);
   const read=await q.load();
   return {saved,source:read.source,revision:read.snapshot?.revision,
    name:read.snapshot?.draft.name,files:read.snapshot?.photos.length,
    fileBytes:read.snapshot?.photos[0]?.file.size,
    id:read.snapshot?.photos[0]?.id};
  });
  assert.equal(result.saved.ok,true);
  assert.deepEqual([result.source,result.revision,result.name,result.files,result.fileBytes,result.id],
   ["v2",1,"Анна",1,5,"new-file"]);
  await page.reload();
  await page.locator("#ready").filter({hasText:"ready"}).waitFor();
  const again=await page.evaluate(async()=>{const a=await window.__REM01B_QA__.load();return {source:a.source,revision:a.snapshot?.revision,photoCount:a.snapshot?.photos.length};});
  assert.deepEqual(again,{source:"v2",revision:1,photoCount:1});
 });
 await run("quota and transaction abort fail visibly; retry without photo changes succeeds",async()=>{
  const result=await page.evaluate(async()=>{
   const q=window.__REM01B_QA__,scope=q.scope(),draft=q.makeDraft("retry"),
    photos=[q.makePhoto("new-file")],prototype=IDBObjectStore.prototype,orig=prototype.put;
   let quota,abort;
   try{
    prototype.put=function(){throw new DOMException("Synthetic quota","QuotaExceededError");};
    quota=await q.save(scope,"draft-1",2,draft,4,photos);
   }finally{prototype.put=orig;}
   try{
    prototype.put=function(...args){const req=orig.apply(this,args);this.transaction.abort();return req;};
    abort=await q.save(scope,"draft-1",2,draft,4,photos);
   }finally{prototype.put=orig;}
   const previous=await q.load();
   const retry=await q.save(scope,"draft-1",2,draft,4,photos);
   const final=await q.load();
   return {quota,abort,previous:previous.snapshot?.revision,retry,after:final.snapshot?.revision,
    photo:final.snapshot?.photos[0]?.id};
  });
  assert.equal(result.quota.ok,false);assert.equal(result.quota.code,"quota");
  assert.equal(result.abort.ok,false);
  assert.equal(result.previous,1);
  assert.equal(result.retry.ok,true);assert.equal(result.after,2);assert.equal(result.photo,"new-file");
 });
 await run("legacy text+photos imported without altering legacy bytes",async()=>{
  const result=await page.evaluate(async()=>{
   const q=window.__REM01B_QA__;q.setAccount(91002);
   const scope=q.scope(),updated=Date.now()-3500,draft={...q.makeDraft("Legacy"),countryCode:" ru "};
   localStorage.setItem("luemi:registration-draft:v1:"+scope,
     JSON.stringify({version:1,step:6,draft,updated}));
   const db=await new Promise((resolve,reject)=>{
    const req=indexedDB.open("luemi-local-photo-preview-v1",1);
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
   });
   const photo=q.makePhoto("legacy-photo");
   await new Promise((resolve,reject)=>{
    const tx=db.transaction("drafts","readwrite");
    tx.objectStore("drafts").put({photos:[{id:photo.id,file:photo.file}],updated:updated-1000},scope);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
   });db.close();
   const first=await q.load();
   const saved=await q.save(scope,first.snapshot.draftId,2,first.snapshot.draft,6,
    first.snapshot.photos.map(p=>({...p,src:"",status:"ready"})));
   const second=await q.load();
   const db2=await new Promise((resolve,reject)=>{
    const req=indexedDB.open("luemi-local-photo-preview-v1",1);
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
   });
   const old=await new Promise((resolve,reject)=>{
    const tx=db2.transaction("drafts","readonly"),req=tx.objectStore("drafts").get(scope);
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
   });db2.close();
   return {source:first.source,photos:first.snapshot?.photos.length,
    country:first.snapshot?.draft.countryCode,saved,second:second.source,
    legacyStillPresent:!!localStorage.getItem("luemi:registration-draft:v1:"+scope),
    oldPhotoId:old.photos[0].id,oldFileSize:old.photos[0].file.size};
  });
  assert.deepEqual([result.source,result.photos,result.country,result.second,result.legacyStillPresent,result.oldPhotoId,result.oldFileSize],
   ["legacy",1,"RU","v2",true,"legacy-photo",5]);
  assert.equal(result.saved.ok,true);
 });
 await run("expired or malformed old photos never mix with new text",async()=>{
  const result=await page.evaluate(async()=>{
   const q=window.__REM01B_QA__;q.setAccount(91003);
   const scope=q.scope(),recent=Date.now()-2000;
   localStorage.setItem("luemi:registration-draft:v1:"+scope,
    JSON.stringify({version:1,step:1,updated:recent,draft:q.makeDraft("Fresh")}));
   const db=await new Promise((resolve,reject)=>{
    const req=indexedDB.open("luemi-local-photo-preview-v1",1);
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
   });
   await new Promise((resolve,reject)=>{
    const tx=db.transaction("drafts","readwrite");
    tx.objectStore("drafts").put({photos:[{id:"orphan",file:q.makePhoto("orphan").file}],
     updated:Date.now()-q.ttl-3000},scope);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
   });db.close();
   const read=await q.load();
   return {ok:read.ok,code:read.code,legacyStillPresent:!!localStorage.getItem("luemi:registration-draft:v1:"+scope)};
  });
  assert.deepEqual(result,{ok:false,code:"invalid",legacyStillPresent:true});
 });
 await run("invalid v2 record fails safely, never falls through to unrelated legacy",async()=>{
  const result=await page.evaluate(async()=>{
   const q=window.__REM01B_QA__;q.setAccount(91004);const scope=q.scope();
   const db=await new Promise((resolve,reject)=>{
    const req=indexedDB.open("luemi-local-photo-preview-v1",1);
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
   });
   const now=Date.now();
   await new Promise((resolve,reject)=>{
    const tx=db.transaction("drafts","readwrite");
    tx.objectStore("drafts").put({schemaVersion:2,scope,draftId:"x",revision:1,step:1,
     updatedAt:now,expiresAt:now+q.ttl,draft:{...q.makeDraft("Corrupt"),interests:"BAD"},photos:[]},
     "registration-v2:"+scope);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
   });db.close();
   const read=await q.load();return {ok:read.ok,code:read.code};
  });
  assert.deepEqual(result,{ok:false,code:"invalid"});
 });
 await run("expiry does not destroy original; fresh write archives it",async()=>{
  const result=await page.evaluate(async()=>{
   const q=window.__REM01B_QA__;q.setAccount(91005);const scope=q.scope(),past=Date.now()-q.ttl-7000;
   const db=await new Promise((resolve,reject)=>{
    const req=indexedDB.open("luemi-local-photo-preview-v1",1);
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
   });
   await new Promise((resolve,reject)=>{
    const tx=db.transaction("drafts","readwrite");
    tx.objectStore("drafts").put({schemaVersion:2,scope,draftId:"old",revision:1,step:1,
     updatedAt:past,expiresAt:past+q.ttl,draft:q.makeDraft("Expired"),
     photos:[{id:"old-photo",file:q.makePhoto("old-photo").file}]},"registration-v2:"+scope);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
   });db.close();
   const before=await q.load(),saved=await q.save(scope,"new",2,q.makeDraft("New"),1,[]);
   const db2=await new Promise((resolve,reject)=>{
    const req=indexedDB.open("luemi-local-photo-preview-v1",1);
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
   });
   const archive=await new Promise((resolve,reject)=>{
    const tx=db2.transaction("drafts","readonly"),req=tx.objectStore("drafts").get("registration-v2:"+scope+":expired:"+past);
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
   });db2.close();
   return {source:before.source,saved,archived:archive?.photos?.[0]?.id};
  });
  assert.equal(result.source,"expired");assert.equal(result.saved.ok,true);
  assert.equal(result.archived,"old-photo");
 });
 await run("account switch isolation; IndexedDB unavailable must not claim success",async()=>{
  const result=await page.evaluate(async()=>{
   const q=window.__REM01B_QA__;q.setAccount(91006);
   const missing=await q.load(),cross=await q.save("91002","wrong",3,q.makeDraft("Wrong"),1,[]);
   const descriptor=Object.getOwnPropertyDescriptor(window,"indexedDB");
   Object.defineProperty(window,"indexedDB",{configurable:true,value:undefined});
   let unavailable;try{unavailable=await q.load();}
   finally{if(descriptor)Object.defineProperty(window,"indexedDB",descriptor);else delete window.indexedDB;}
   q.setAccount(91002);const original=await q.load();
   return {missing:missing.source,cross:cross.code,unavailable:unavailable.code,original:original.snapshot?.draft.name};
  });
  assert.deepEqual(result,{missing:"empty",cross:"scope",unavailable:"unavailable",original:"Legacy"});
 });
 await run("queued write A -> write B -> confirmed clear leaves no resurrected photos",async()=>{
  const result=await page.evaluate(async()=>{
   const q=window.__REM01B_QA__;q.setAccount(91006);const scope=q.scope();
   const first=q.save(scope,"race",1,q.makeDraft("One"),7,[q.makePhoto("race1")]);
   const second=q.save(scope,"race",2,q.makeDraft("Two"),7,[q.makePhoto("race2")]);
   const clear=q.clear(scope);
   const completed=await Promise.all([first,second,clear]),after=await q.load();
   return {completed:completed.map(r=>r.ok),source:after.source,photos:after.snapshot?.photos.length??0};
  });
  assert.deepEqual(result,{completed:[true,true,true],source:"deleted",photos:0});
 });
 assert.deepEqual(errors,[],"no uncaught QA page exceptions");
 console.log("REM-01B browser transaction QA PASS; physical Android/iOS NOT VERIFIED");
}finally{await context.close();await browser.close();}
