import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {chromium} from "playwright";

/** Current Premium Photo Profile: 0–6 local QA photos, stable hero and viewer.
 * Synthetic Android Chromium only; not a physical Telegram WebView certification. */
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"});
const page=await context.newPage(),errors=[],records=[];
page.on("pageerror",e=>errors.push(e.message));
const dir="qa-artifacts/rem-04b/six";mkdirSync(dir,{recursive:true});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const root=()=>page.locator('.owner-premium-profile[data-mode="owner"]');
const dot=index=>root().locator(".owner-profile-photo-pager button").nth(index).click();
const setCount=async n=>{
 await page.evaluate(n=>{
  if(typeof window.__luemiQaV3?.setPhotoCount!=="function")throw Error("QA photo-count fixture absent");
  window.__luemiQaV3.setPhotoCount(n);
 },n);
 await page.waitForFunction(n=>document.querySelectorAll(".owner-premium-profile .owner-profile-photo-tile").length===n,n);
 await pause(80);
};
const read=()=>root().evaluate(host=>{
 const photos=[...host.querySelectorAll(".owner-profile-photo-tile img")];
 const dots=[...host.querySelectorAll(".owner-profile-photo-pager button")];
 const index=dots.findIndex(node=>node.getAttribute("aria-current")==="true");
 const active=host.querySelector(".owner-profile-photo-mask img[data-slot=current]");
 return {state:host.dataset.morphState,count:photos.length,
  ids:photos.map(node=>node.dataset.photoId),dots:dots.length,index,
  activeId:active?.dataset.photoId??null,
  avatarCount:host.querySelectorAll(".owner-profile-photo-mask img[data-slot=current]").length,
  logoCount:host.querySelectorAll(".owner-profile-brand img").length};
});
const capture=async label=>{
 const data=await read();records.push({label,...data});
 await page.screenshot({path:dir+"/"+label+".png"});
 assert.equal(data.logoCount,1,"the original white LUEMI logo remains mounted");
 assert.ok(data.avatarCount<=1,"morph surface uses only one foreground photo element");
 assert.equal(new Set(data.ids).size,data.ids.length,"gallery keeps unique stable photo IDs");
 console.log("PREMIUM_PROFILE_SIX "+JSON.stringify({label,count:data.count,index:data.index,id:data.activeId}));
 return data;
};
const active=async index=>{
 await page.waitForFunction(index=>{
  const root=document.querySelector('.owner-premium-profile[data-mode="owner"]');
  const nodes=[...(root?.querySelectorAll(".owner-profile-photo-pager button")??[])];
  return nodes[index]?.getAttribute("aria-current")==="true"&&
   root?.querySelector(".owner-profile-photo-mask img[data-slot=current]")?.dataset.photoId===
   root?.querySelectorAll(".owner-profile-photo-tile img")[index]?.dataset.photoId;
 },index,{timeout:3500});
};

try{
 await page.goto((process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173")+
  "/profile-qa.html?profileV3=1",{waitUntil:"domcontentloaded"});
 await page.locator(".discovery-bottom-nav button").filter({hasText:"Профиль"}).click();
 await root().waitFor({state:"visible",timeout:6000});
 await root().getByRole("tab",{name:"Фото",exact:true}).click();
 await setCount(6);
 const opening=await capture("six-expanded");
 assert.equal(opening.state,"expanded");
 assert.equal(opening.count,6);
 assert.equal(opening.dots,6);
 for(const [from,to] of [[0,5],[5,0],[0,3],[3,1],[1,4],[4,2],[2,5]]){
  await dot(from);await active(from);
  await dot(to);await active(to);
  const state=await capture("jump-"+from+"-"+to);
  assert.equal(state.index,to);assert.equal(state.activeId,state.ids[to]);
 }
 await dot(0);await dot(5);await dot(1);await dot(4);
 await active(4);
 assert.equal((await capture("fast-retarget")).index,4);
 await page.setViewportSize({width:375,height:768});
 await dot(0);await active(0);
 await dot(5);await active(5);
 await page.setViewportSize({width:393,height:852});
 await pause(180);
 assert.equal((await capture("resize-retarget")).index,5);

 // The viewer opens on the exact displayed hero photo, even after jumps.
 const before=await read();
 await root().locator(".owner-profile-photo-mask").click();
 await page.locator(".pm-viewer").waitFor({state:"visible",timeout:4500});
 assert.equal(await page.locator(".pm-viewer-image").getAttribute("data-photo-id"),
  before.activeId,"viewer uses the selected hero ID");
 await page.keyboard.press("Escape");
 await page.locator(".pm-viewer").waitFor({state:"detached",timeout:4500});
 assert.equal((await capture("viewer-return")).activeId,before.activeId);

 for(const n of [0,1,2,3,4,6]){
  await setCount(n);
  const state=await capture("cardinality-"+n);
  assert.equal(state.count,n);
  assert.equal(state.dots,n>1?n:0);
  if(n>1){
   await dot(n-1);await active(n-1);
   assert.equal((await read()).index,n-1);
   await dot(0);await active(0);
  }
 }
 assert.deepEqual(errors,[],"no uncaught browser errors");
 writeFileSync(dir+"/premium-records.json",JSON.stringify({records,errors},null,2));
 console.log("REM04B_SIX_PREMIUM_CARDINALITY_PASS synthetic Chromium; physical A55 unverified");
}finally{await context.close();await browser.close();}
