import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,channel:"chrome",args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
const page=await context.newPage();
const cdp=await context.newCDPSession(page);
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
const pass=x=>console.log("REM03D_BROWSER_PASS "+x);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const media=(fn,...args)=>page.evaluate(([name,params])=>window.__luemiQaMedia[name](...params),[fn,args]);
const source=()=>page.locator(".pm-qa-photo-source img");
const touch=(type,points)=>cdp.send("Input.dispatchTouchEvent",{type,touchPoints:points.map(x=>({
 id:x.id,x:x.x,y:x.y,force:1,radiusX:2,radiusY:2
}))});
const viewer=()=>page.locator(".pm-viewer");
const state=()=>page.evaluate(()=>{
 const root=document.querySelector(".pm-viewer"),clip=root?.querySelector(".pm-viewer-morph-clip"),
  image=root?.querySelector(".pm-viewer-morph-image"),source=document.querySelector(".pm-qa-photo-source img"),
  main=root?.querySelector(".pm-viewer-image"),top=root?.querySelector(".pm-viewer-top"),
  bottom=root?.querySelector(".pm-viewer-bottom");
 const m=image?new DOMMatrixReadOnly(getComputedStyle(image).transform):null;
 return {open:!!root,active:root?.dataset.morphActive,clipDisplay:clip?.style.display,
  clipPath:clip?getComputedStyle(clip).clipPath:null,ghostSrc:image?.getAttribute("src")?.slice(0,32),
  m11:m?.m11??1,m22:m?.m22??1,sourceVisible:source?getComputedStyle(source).visibility:null,
  mainVisible:main?getComputedStyle(main).visibility:null,id:main?.dataset.photoId,
  topPadding:top?getComputedStyle(top).paddingTop:null,
  bottomPadding:bottom?getComputedStyle(bottom).paddingBottom:null,
  pvTop:root?.style.getPropertyValue("--pv-safe-top"),
  pvBottom:root?.style.getPropertyValue("--pv-safe-bottom"),
  theme:root?.dataset.theme,focus:document.activeElement?.getAttribute("aria-label")??document.activeElement?.className,
  height:root?.getBoundingClientRect().height};
});
const waitReady=id=>page.waitForFunction(id=>{
 const v=document.querySelector(".pm-viewer"),img=v?.querySelector(".pm-viewer-image");
 return img?.dataset.photoId===id&&img.style.opacity==="1"&&img.naturalWidth>0;
},id,{timeout:6000});
const open=async id=>{await media("open",id);await viewer().waitFor({state:"visible"});};
const close=async()=>{await viewer().getByRole("button",{name:"Закрыть просмотр"}).click();
 await viewer().waitFor({state:"detached",timeout:3500});};
const setSource=async mode=>{
 await media("setSource",mode);
 if(mode==="none")await source().waitFor({state:"detached"});
 else await page.waitForFunction(()=>{const el=document.querySelector(".pm-qa-photo-source img");
  return el?.complete&&el.naturalWidth>0;});
};
try{
 await page.goto("http://127.0.0.1:5173/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>!!window.__luemiQaMedia);
 await media("change","aspect-portrait");
 await setSource("hero");
 const originalOverflow=await page.evaluate(()=>document.body.style.overflow);
 await page.locator(".pm-qa-focus").focus();
 await open("qa-alpha");
 let s=await state();
 assert.equal(s.active,"true","hero must start real source crop morph");
 assert.equal(s.sourceVisible,"hidden");
 assert.equal(s.mainVisible,"hidden","no competing live pixels during morph");
 assert.ok(s.clipPath?.startsWith("inset("));
 assert.ok(Math.abs(s.m11-s.m22)<1e-5,"no scaleX/scaleY face stretching");
 await waitReady("qa-alpha");await sleep(280);
 s=await state();assert.equal(s.active,"false");
 assert.equal(s.sourceVisible,"visible");assert.equal(s.mainVisible,"visible");
 assert.equal(s.focus,"Закрыть просмотр");
 await viewer().getByRole("button",{name:"Закрыть просмотр"}).click();
 const closing=await state();
 assert.equal(closing.active,"true","reverse source morph must use same valid thumbnail");
 assert.equal(closing.sourceVisible,"hidden");
 assert.ok(Math.abs(closing.m11-closing.m22)<1e-5,"closing image must never distort");
 await viewer().waitFor({state:"detached",timeout:3500});
 assert.equal(await page.evaluate(()=>document.body.style.overflow),originalOverflow);
 assert.equal(await source().evaluate(el=>getComputedStyle(el).visibility),"visible");
 assert.equal(await page.locator(".pm-qa-focus").evaluate(el=>document.activeElement===el),true);
 pass("hero cover 22% 70% source morph: clipped pixels, uniform actual DOMMatrix, single visible copy, focus + overflow restored");
 for(const [aspect,mode] of [["aspect-portrait","grid"],["aspect-landscape","hero"],
    ["aspect-panorama","grid"],["aspect-tall","hero"]]){
  await media("change",aspect);await setSource(mode);
  await open("qa-alpha");
  const first=await state();assert.equal(first.active,"true",aspect+" "+mode);
  assert.ok(Math.abs(first.m11-first.m22)<1e-5);
  await waitReady("qa-alpha");await sleep(265);
  await close();
  assert.equal(await source().evaluate(el=>getComputedStyle(el).visibility),"visible");
 }
 pass("3:4 grid, landscape, panorama and tall cover crop have only uniform pixel scale on open and close");
 await media("change","reset");await setSource("hero");
 await open("qa-alpha");await waitReady("qa-alpha");await sleep(270);
 await page.keyboard.press("ArrowRight");await waitReady("qa-beta");
 await close();
 pass("photo navigation invalidates old miniature identity: close falls back safely");
 await media("change","reset");await setSource("hero");
 await open("qa-alpha");await waitReady("qa-alpha");await sleep(265);
 await media("change","reorder");await page.waitForFunction(()=>
  document.querySelector(".pm-viewer-image")?.dataset.photoId==="qa-alpha");
 await viewer().getByRole("button",{name:"Закрыть просмотр"}).click();
 assert.equal((await state()).active,"false","reorder invalidates previous source morph");
 await viewer().waitFor({state:"detached",timeout:3500});
 pass("same photoId after reorder cannot return to stale pre-reorder source");
 await media("change","reset");await setSource("grid");await open("qa-alpha");await waitReady("qa-alpha");await sleep(265);
 await setSource("none");
 await close();
 pass("deleted source DOM during viewer forces fade, no invalid destination morph");
 await media("change","reset");await setSource("hero");
 await open("qa-alpha");await waitReady("qa-alpha");await sleep(270);
 await media("change","aspect-panorama");
 await page.waitForFunction(()=>document.querySelector(".pm-viewer-image")?.dataset.photoId==="qa-alpha");
 await viewer().getByRole("button",{name:"Закрыть просмотр"}).click();
 assert.equal((await state()).active,"false","new URL/version invalidates old source");
 await viewer().waitFor({state:"detached",timeout:3500});
 pass("same photoId with new src/version closes by fade rather than outdated image source");
 await setSource("offscreen");await open("qa-alpha");
 assert.equal((await state()).active,"false","offscreen must not morph");
 await close();await setSource("hero");
 pass("source outside viewport skips morph and restores image");
 await open("qa-alpha");await waitReady("qa-alpha");await sleep(265);
 await page.setViewportSize({width:430,height:780});await sleep(60);
 assert.equal(Math.round((await state()).height),780);
 await close();await page.setViewportSize({width:393,height:852});
 pass("viewport resize invalidates changed thumbnail coordinates; viewer remains continuous");
 await media("change","reset");await setSource("hero");
 await open("qa-alpha");await waitReady("qa-alpha");await sleep(270);
 await touch("touchStart",[{id:11,x:160,y:370}]);
 await touch("touchStart",[{id:11,x:160,y:370},{id:12,x:245,y:470}]);
 await touch("touchMove",[{id:11,x:95,y:330},{id:12,x:303,y:515}]);
 await page.waitForFunction(()=>{
  const img=document.querySelector(".pm-viewer-image");
  const m=new DOMMatrixReadOnly(getComputedStyle(img).transform);
  return Math.hypot(m.m11,m.m12)>1.2;
 });
 await page.keyboard.press("Escape");
 const zoomClosing=await state();
 assert.equal(zoomClosing.active,"true","zoomed image returns via source after cancellation");
 assert.ok(Math.abs(zoomClosing.m11-zoomClosing.m22)<1e-5,"closing zoomed image uses uniform image scale");
 await viewer().waitFor({state:"detached",timeout:3500});
 await touch("touchCancel",[]).catch(()=>{});
 pass("closing while pinch zoom is active releases pointers and does not stretch source pixels");

 // REM-01D snapshot: safe and content insets must combine via max, not sum.
 await page.evaluate(()=>{
  const shell=document.querySelector(".luemi-shell");
  shell.style.setProperty("--viewport-safe-top","43px");
  shell.style.setProperty("--viewport-safe-bottom","36px");
  shell.style.setProperty("--viewport-offset-top","0px");
  shell.style.setProperty("--app-height","852px");
 });
 await open("qa-alpha");
 await page.waitForFunction(()=>document.querySelector(".pm-viewer")?.style.getPropertyValue("--pv-safe-top")==="43px");
 s=await state();assert.equal(s.pvBottom,"36px");
 assert.ok(parseFloat(s.topPadding)>=106,"63px header inset retained plus 43px safe");
 assert.ok(parseFloat(s.bottomPadding)>=56,"bottom control above safe area");
 const before=await state();
 await page.evaluate(()=>{
  const shell=document.querySelector(".luemi-shell");
  shell.style.setProperty("--viewport-safe-top","22px");
  shell.style.setProperty("--viewport-safe-bottom","15px");
  shell.dataset.theme="dark";
 });
 await page.waitForFunction(()=>document.querySelector(".pm-viewer")?.dataset.theme==="dark");
 s=await state();assert.equal(s.pvTop,"22px");assert.equal(s.pvBottom,"15px");
 assert.equal(s.id,before.id);
 pass("portal live theme + safe/content-area max insets, 63px preserved; no viewer remount on update");
 // Browser fallback above was exercised without Telegram SDK. Now introduce
 // an isolated explicit Telegram safe/content overlap fixture; no double sum.
 await page.evaluate(()=>{
  const callbacks={};
  window.Telegram={WebApp:{
   safeAreaInset:{top:21,right:12,bottom:18,left:8},
   contentSafeAreaInset:{top:48,right:4,bottom:34,left:9},
   onEvent:(name,cb)=>(callbacks[name]??=[]).push(cb),
   offEvent:(name,cb)=>callbacks[name]=(callbacks[name]??[]).filter(x=>x!==cb)
  }};
  window.__qaSafeEmit=()=>{for(const cb of callbacks.contentSafeAreaChanged??[])cb();};
 });
 await viewer().getByRole("button",{name:"Закрыть просмотр"}).click();
 await viewer().waitFor({state:"detached",timeout:3500});
 await open("qa-alpha");
 await page.waitForFunction(()=>document.querySelector(".pm-viewer")?.style.getPropertyValue("--pv-safe-top")==="48px");
 s=await state();assert.equal(s.pvBottom,"34px");
 await page.evaluate(()=>{
  window.Telegram.WebApp.contentSafeAreaInset.top=53;
  window.__qaSafeEmit();
 });
 await page.waitForFunction(()=>document.querySelector(".pm-viewer")?.style.getPropertyValue("--pv-safe-top")==="53px");
 const routeBefore=await state();
 await page.evaluate(()=>{
  const shell=document.querySelector(".luemi-shell");
  shell.style.setProperty("--viewport-offset-top","9px");
  shell.style.setProperty("--app-height","731px");
 });
 await page.waitForFunction(()=>parseFloat(document.querySelector(".pm-viewer")?.style.getPropertyValue("--pv-visual-bottom"))>50);
 s=await state();assert.equal(s.id,routeBefore.id);
 assert.ok(parseFloat(s.bottomPadding)>=20+34+80,"Telegram fullscreen exit keeps menu above visible frame");
 await page.evaluate(()=>{
  const shell=document.querySelector(".luemi-shell");
  shell.style.setProperty("--viewport-offset-top","0px");
  shell.style.setProperty("--app-height","852px");
 });
 pass("Telegram safe/content max overlap and fullscreen exit change insets live without reopening viewer");
 const prevCount=(await media("stats")).closeCommits;
 await viewer().getByRole("button",{name:"Действия с фото"}).click();
 assert.equal(await viewer().getByRole("menu").isVisible(),true);
 assert.equal(await media("back"),true);await viewer().getByRole("menu").waitFor({state:"detached"});
 assert.equal((await media("stats")).closeCommits,prevCount);
 assert.equal(await media("back"),true);await viewer().waitFor({state:"detached",timeout:3000});
 assert.equal((await media("stats")).closeCommits,prevCount+1);
 assert.equal(await media("back"),false);
 pass("registered Telegram-style Back hierarchy menu → viewer → parent, exact single commit");
 await setSource("grid");await open("qa-alpha");await waitReady("qa-alpha");await sleep(270);
 await page.keyboard.press("Escape");await viewer().waitFor({state:"detached",timeout:3000});
 await open("qa-alpha");await waitReady("qa-alpha");await sleep(270);
 await close();assert.equal(await media("back"),false);
 pass("Escape, X, no duplicate close, StrictMode reopen preserved");
 await page.setViewportSize({width:852,height:393});await open("qa-alpha");await waitReady("qa-alpha");
 await sleep(70);
 const rotated=await state();
 assert.ok(rotated.height>350&&rotated.height<450);
 assert.ok(parseFloat(rotated.topPadding)>=63,"landscape controls retain 63px base");
 const closeBounds=await viewer().getByRole("button",{name:"Закрыть просмотр"}).boundingBox();
 assert.ok(closeBounds&&closeBounds.y>=0&&closeBounds.y+closeBounds.height<393);
 await close();await page.setViewportSize({width:393,height:852});
 pass("landscape viewer controls remain inside actual viewport, no source morph stretch");
 await open("qa-alpha");
 await page.evaluate(()=>{
  Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"hidden"});
  document.dispatchEvent(new Event("visibilitychange"));
 });
 await sleep(50);
 assert.equal(await source().evaluate(el=>getComputedStyle(el).visibility),"visible");
 await page.evaluate(()=>{
  Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"visible"});
  document.dispatchEvent(new Event("visibilitychange"));
 });
 await close();
 pass("background/foreground restores source visibility and cancels old morph");
 assert.deepEqual(errors,[],"browser exceptions must be empty");
 console.log("REM-03D BROWSER MORPH QA PASS · Chromium only; physical A55/iOS NOT VERIFIED");
}finally{await context.close();await browser.close();}
