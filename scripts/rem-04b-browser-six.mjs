/** Current Profile Morph V3 photo cardinality and track continuity.
 * Chromium Android emulation; this is NOT a physical Galaxy A55 approval. */
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"});
const page=await context.newPage(),errors=[],records=[];
page.on("pageerror",e=>errors.push(e.message));
const dir="qa-artifacts/rem-04b/six";
mkdirSync(dir,{recursive:true});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const root=()=>page.locator(".pm-inline .v3-int-root");
const dot=i=>root().locator(".v3-int-photo-dots button").nth(i).evaluate(el=>el.click());
const count=async n=>{
 await page.evaluate(n=>{
  if(!window.__luemiQaV3||typeof window.__luemiQaV3.setPhotoCount!=="function")
   throw new Error("V3 photo fixture controller missing");
  window.__luemiQaV3.setPhotoCount(n);
 },n);
 await page.waitForFunction(n=>document.querySelectorAll(".pm-inline .v3-int-photo-slide img").length===n,n);
 await pause(100);
};
const read=()=>page.evaluate(()=>{
 const profile=document.querySelector(".pm-inline .v3-int-root");
 const track=profile?.querySelector(".v3-int-photo-rail");
 const images=[...(track?.querySelectorAll(".v3-int-photo-slide img")??[])];
 const ambient=[...(profile?.querySelectorAll(".v3-int-ambient img")??[])];
 const dots=[...(profile?.querySelectorAll(".v3-int-photo-dots button")??[])];
 const active=dots.findIndex(el=>el.getAttribute("aria-current")==="true");
 const tx=track?new DOMMatrixReadOnly(getComputedStyle(track).transform).m41:0;
 return {sheet:profile?.dataset.sheetState,images:images.map(x=>({id:x.dataset.photoId,
   ready:x.complete&&x.naturalWidth>0})),ambientCount:ambient.length,dots:dots.length,
   active,activeId:images[active]?.dataset.photoId??null,tx,width:profile?.clientWidth??0};
});
const capture=async label=>{
 const state=await read();records.push({label,...state});
 await page.screenshot({path:dir+"/"+label+".png"});
 assert.ok(state.ambientCount<=2,"at most two V3 ambient images");
 assert.ok(state.images.every(x=>!!x.id));
 console.log("PROFILE_V3_SIX "+JSON.stringify({label,images:state.images.length,
  dots:state.dots,active:state.active,ready:state.images.filter(x=>x.ready).length}));
 return state;
};
const awaitActive=async id=>{
 await page.waitForFunction(id=>{
  const root=document.querySelector(".pm-inline .v3-int-root");
  const active=root?.querySelector('.v3-int-photo-dots button[aria-current="true"]');
  return active?.getAttribute("aria-label")==="Фото "+(id+1)+" из "+root?.querySelectorAll(".v3-int-photo-slide img").length;
 },id,{timeout:2500});
};
try{
 await page.goto("http://127.0.0.1:5173/profile-qa.html?profileV3=1",{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Профиль",exact:true}).click();
 await root().waitFor({state:"visible"});
 await count(6);
 let opening=await capture("six-compact");
 assert.equal(opening.sheet,"collapsed");
 await root().locator(".v3-int-mask").evaluate(el=>el.click());
 await page.waitForFunction(()=>document.querySelector(".pm-inline .v3-int-root")?.dataset.sheetState==="expanded");
 await pause(260);
 assert.equal((await capture("six-expanded")).images.length,6);
 for(const [from,to] of [[0,5],[5,0],[0,3],[3,1],[1,4],[4,2],[2,5]]){
  await dot(from);await awaitActive(from);
  await dot(to);await awaitActive(to);
  await pause(250);
  const state=await capture("jump-"+from+"-"+to);
  assert.equal(state.active,to,"exact requested photo must remain selected");
  assert.equal(state.activeId,state.images[to].id,"photo id and selected index agree");
 }
 await dot(0);await dot(5);await dot(1);await dot(4);
 await awaitActive(4);await pause(300);
 assert.equal((await capture("fast-retarget")).active,4);
 await page.setViewportSize({width:375,height:768});
 await dot(0);await awaitActive(0);
 await dot(5);await awaitActive(5);
 await page.setViewportSize({width:393,height:852});
 await pause(350);
 assert.equal((await capture("resize-during-transition")).active,5);
 await root().locator(".v3-int-mask").evaluate(el=>el.click());
 await page.locator(".pm-viewer").waitFor({state:"visible",timeout:4000});
 const viewerId=await page.locator(".pm-viewer-image").getAttribute("data-photo-id");
 assert.equal(viewerId,(await read()).activeId);
 await page.keyboard.press("Escape");
 await page.locator(".pm-viewer").waitFor({state:"detached",timeout:4000});
 assert.equal((await capture("viewer-return")).active,5);
 for(const n of [0,1,2,3,4,6]){
  await count(n);
  const state=await capture("cardinality-"+n);
  assert.equal(state.images.length,n);
  assert.equal(state.dots,n>1?n:0);
  if(n>1){
   await dot(n-1);await awaitActive(n-1);
   assert.equal((await read()).active,n-1);
   await dot(0);await awaitActive(0);
  }
 }
 assert.deepEqual(errors,[],"no uncaught browser exceptions");
 writeFileSync(dir+"/v3-records.json",JSON.stringify({records,errors},null,2));
 console.log("REM04B_SIX_V3_CARDINALITY_AND_PERF_PASS; synthetic Chromium only, hardware A55 unverified");
}finally{await context.close();await browser.close();}
