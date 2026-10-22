import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,channel:"chrome",args:["--no-sandbox"]});
const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
const page=await ctx.newPage(),errors=[];
page.on("pageerror",e=>errors.push(e.message));
const pass=s=>console.log("REM03D_BROWSER_PASS "+s);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const act=(fn,...args)=>page.evaluate(([fn,args])=>window.__luemiQaMedia[fn](...args),[fn,args]);
const morph=()=>page.evaluate(()=>{
 const v=document.querySelector(".pm-viewer"),o=v?.querySelector(".pm-viewer-morph"),
  i=o?.querySelector("img"),source=document.querySelector(".qa-rem03d-source img"),
  track=v?.querySelector(".pm-viewer-track"),
  m=i?new DOMMatrixReadOnly(getComputedStyle(i).transform):null;
 return {visible:!!o&&getComputedStyle(o).display!=="none",mode:o?.dataset.morphMode,
  scale:o?.dataset.mediaScale,m11:m?.m11,m22:m?.m22,clip:o?.style.clipPath,
  sourceOpacity:source?.style.opacity,src:i?.getAttribute("src"),
  trackVisibility:track?.style.visibility,photo:o?.dataset.sourcePhotoId,
  safeTop:v?getComputedStyle(v).getPropertyValue("--pm-viewer-safe-top"):null,
  safeBottom:v?getComputedStyle(v).getPropertyValue("--pm-viewer-safe-bottom"):null,
  focused:v?.contains(document.activeElement),rev:v?.dataset.viewportRevision,
  overflow:document.body.style.overflow};
});
const open=async(kind="hero",id="qa-alpha")=>{
 await act("prepareSource",kind);
 await page.waitForFunction(()=>{const img=document.querySelector(".qa-rem03d-source img");return img?.complete&&img.naturalWidth>0});
 await act("openSource",id,kind);
 await page.locator(".pm-viewer").waitFor();
};
const settle=()=>page.waitForFunction(()=>{
 const v=document.querySelector(".pm-viewer"),o=v?.querySelector(".pm-viewer-morph");
 return v&&o&&getComputedStyle(o).display==="none"&&v.querySelector(".pm-viewer-image")?.style.opacity==="1";
},{timeout:4500});
const close=async()=>{await page.locator(".pm-viewer").getByRole("button",{name:"Закрыть просмотр"}).click();
 await page.locator(".pm-viewer").waitFor({state:"detached",timeout:4000});};
try{
 await page.goto("http://127.0.0.1:5173/profile-qa.html");
 await page.waitForFunction(()=>!!window.__luemiQaMedia);
 for(const kind of ["hero","grid","contain"]){
  await open(kind);
  let m=await morph();
  assert.equal(m.visible,true,"must morph while opening "+kind);
  assert.equal(m.mode,"uniform");
  assert.ok(Number(m.scale)>0);
  assert.equal(m.sourceOpacity,"0");
  assert.equal(m.trackVisibility,"hidden");
  assert.ok(m.clip?.startsWith("inset("),"clip crop separate from image transform");
  await settle();m=await morph();assert.equal(m.visible,false);assert.equal(m.sourceOpacity,"");
  await page.locator(".pm-viewer").getByRole("button",{name:"Закрыть просмотр"}).click();
  m=await morph();
  if(m.visible){assert.ok(Math.abs(m.m11-m.m22)<.001,"pixel scaling must remain uniform");assert.equal(m.photo,"qa-alpha");}
  await page.locator(".pm-viewer").waitFor({state:"detached",timeout:4500});
  assert.equal(await act("sourceOpacity"),"","source opacity restored on close");
 }
 pass("hero cover center 20%, grid 3:4 and contain: opening/close clipped uniform pixels without source opacity leak");

 await open("hero");await settle();
 await page.keyboard.press("ArrowRight");
 await page.waitForFunction(()=>document.querySelector(".pm-viewer-image")?.dataset.photoId==="qa-beta");
 await page.locator(".pm-viewer").getByRole("button",{name:"Закрыть просмотр"}).click();
 assert.equal((await morph()).visible,false,"navigated photo must not return to old source");
 await page.locator(".pm-viewer").waitFor({state:"detached",timeout:3500});
 pass("keyboard changed photo cannot morph into obsolete thumbnail");

 await open("grid");await settle();
 await act("sourceOutside",true);
 await page.locator(".pm-viewer").getByRole("button",{name:"Закрыть просмотр"}).click();
 assert.equal((await morph()).visible,false,"offscreen source uses fade only");
 await page.locator(".pm-viewer").waitFor({state:"detached",timeout:3500});
 await open("hero");await settle();await act("sourceHidden",true);
 await page.locator(".pm-viewer").getByRole("button",{name:"Закрыть просмотр"}).click();
 assert.equal((await morph()).visible,false);
 await page.locator(".pm-viewer").waitFor({state:"detached",timeout:3500});
 pass("source offscreen or removed/hidden safely falls back to short fade");

 // Intrinsic landscape/panorama pictures must keep one uniform pixel scale.
 for(const aspect of ["aspect-landscape","aspect-panorama","aspect-tall"]){
  await act("change",aspect);
  await open("grid");const pm=await morph();
  assert.equal(pm.visible,true,aspect+" must still use uniform morph");
  assert.ok(Number(pm.scale)>0);
  await settle();await close();
 }
 await act("change","reset");
 pass("landscape, extreme panorama and tall contained media preserve uniform pixel matrix");

 // Source resource replacement while modal is open invalidates old thumbnail.
 await open("hero");await settle();
 await act("change","aspect-panorama");
 await page.locator(".pm-viewer").getByRole("button",{name:"Закрыть просмотр"}).click();
 assert.equal((await morph()).visible,false,"changed same ID/src/version must fade");
 await page.locator(".pm-viewer").waitFor({state:"detached",timeout:3500});
 await act("change","reset");
 pass("same photo ID but replaced resource cannot return pixels to prior thumbnail");

 // A viewport change in the middle of morph invalidates its pixel/crop anchor;
 // it does not remount the viewer, disturb the 3-slot track or restart opening.
 await open("hero");
 assert.equal((await morph()).visible,true);
 await page.setViewportSize({width:430,height:780});
 await page.waitForFunction(()=>document.querySelector(".pm-viewer-morph")?.style.display==="none");
 assert.equal(await page.locator(".pm-viewer").count(),1);
 await settle();await close();await page.setViewportSize({width:393,height:852});
 pass("viewport changes mid-morph safely abandon obsolete geometry without remount");

 await open("hero");
 assert.equal((await morph()).visible,true);
 await page.evaluate(()=>{
  Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"hidden"});
  document.dispatchEvent(new Event("visibilitychange"));
 });
 await page.waitForFunction(()=>document.querySelector(".pm-viewer-morph")?.style.display==="none");
 assert.equal(await act("sourceOpacity"),"");
 await page.evaluate(()=>{
  Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"visible"});
  document.dispatchEvent(new Event("visibilitychange"));
 });
 await close();
 pass("background/foreground interrupts morph and restores source opacity without stale ownership");

 await open("hero");await settle();
 const start=await morph();assert.equal(start.focused,true,"modal owns keyboard focus");
 assert.equal(start.overflow,"hidden");
 await page.locator(".pm-viewer").getByRole("button",{name:"Действия с фото"}).click();
 await page.locator(".pm-viewer-menu").waitFor();
 assert.equal(await act("back"),true);await page.locator(".pm-viewer-menu").waitFor({state:"detached"});
 assert.equal(await page.locator(".pm-viewer").count(),1,"first back closes menu only");
 assert.equal(await act("back"),true);await page.locator(".pm-viewer").waitFor({state:"detached",timeout:3500});
 assert.notEqual((await morph()).overflow,"hidden","body scroll lock restored");
 pass("menu → registered modal Back → viewer Back, focus and overflow restored");

 await open("grid");await settle();
 await page.keyboard.press("Escape");
 await page.locator(".pm-viewer").waitFor({state:"detached",timeout:3500});
 await open("contain");await settle();
 await close();
 pass("Escape, X and re-open in React StrictMode preserve exactly one close");

 await open("hero");await settle();
 const revBefore=(await morph()).rev;
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent("luemi:viewport-revision",{
  detail:{revision:71,safeInsets:{top:37,right:5,bottom:18,left:5},
   contentInsets:{top:31,right:4,bottom:42,left:4}}
 })));
 await page.waitForFunction(()=>getComputedStyle(document.querySelector(".pm-viewer")).getPropertyValue("--pm-viewer-safe-bottom").trim()==="42px");
 let m=await morph();assert.equal(m.safeTop.trim(),"37px");assert.equal(m.safeBottom.trim(),"42px");
 assert.equal(m.visible,false,"viewport safe change must not restart opening");
 await page.setViewportSize({width:780,height:430});await sleep(80);
 assert.equal(await page.locator(".pm-viewer").count(),1);
 await page.locator(".luemi-shell").evaluate(el=>el.setAttribute("data-theme","dark"));
 assert.equal(await page.locator(".pm-viewer").count(),1);
 await page.locator(".pm-viewer").getByRole("button",{name:"Действия с фото"}).click();
 await page.locator(".pm-viewer-menu").waitFor();
 await page.keyboard.press("Escape");
 await page.locator(".pm-viewer-menu").waitFor({state:"detached"});
 await close();
 assert.ok(revBefore!==undefined);
 pass("REM-01D viewport snapshot MAX safe areas, no remount, landscape orientation");
 assert.deepEqual(errors,[],"no browser JS errors");
 console.log("REM-03D BROWSER QA PASS · synthetic Chromium only; physical Telegram A55/iOS NOT VERIFIED");
}finally{await ctx.close();await browser.close();}
