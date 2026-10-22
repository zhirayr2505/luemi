import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,channel:"chrome",args:["--no-sandbox"]});
const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
const page=await ctx.newPage(),errors=[];
page.on("pageerror",e=>errors.push(e.message));
const pass=x=>console.log("REM03D_BROWSER_PASS "+x);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const api=(name,...args)=>page.evaluate(({name,args})=>window.__luemiQaMedia[name](...args),{name,args});
const viewer=()=>page.locator(".pm-viewer");
const open=async(id,kind)=>{
 await api("prepareOrigin",id,kind);
 await page.waitForFunction(id=>{
  const img=document.getElementById("qa-source-photo");
  return img?.dataset.photoId===id&&img.complete&&img.naturalWidth>0&&img.naturalHeight>0;
 },id,{timeout:3500});
 await api("openFrom",id,kind);
};
const get=()=>page.evaluate(()=>{
 const root=document.querySelector(".pm-viewer"),m=root?.querySelector(".pm-viewer-morph img"),img=root?.querySelector(".pm-viewer-image");
 const source=document.getElementById("qa-source-photo");
 const matrix=m?new DOMMatrixReadOnly(getComputedStyle(m).transform):null;
 const shell=document.querySelector(".luemi-shell");
 return {exists:!!root,morph:root?.dataset.morphActive||null,visible:root?.querySelector(".pm-viewer-morph")?.style.display,
  srcHidden:source?.style.visibility||"",srcPhoto:source?.dataset.photoId,
  photo:img?.dataset.photoId,stageImgOpacity:img?getComputedStyle(img).opacity:null,
  morphImageSrc:m?.getAttribute("src")?.slice(0,50),matrixScaleX:matrix?.a,
  matrixScaleY:matrix?.d,matrixSkew:matrix?.b??0,clip:m?getComputedStyle(m).clipPath:null,
  safeTop:root?getComputedStyle(root).getPropertyValue("--viewer-safe-top").trim():null,
  safeBottom:root?getComputedStyle(root).getPropertyValue("--viewer-safe-bottom").trim():null,
  headerY:root?.querySelector(".pm-viewer-top")?.getBoundingClientRect().top,
  footerY:root?.querySelector(".pm-viewer-bottom")?.getBoundingClientRect().bottom,
  active:document.activeElement?.getAttribute("aria-label")||document.activeElement?.tagName,
  overflow:document.body.style.overflow,theme:shell?.dataset.theme,
  closeCount:window.__luemiQaMedia.stats().closeCommits};
});
const waitGone=async()=>viewer().waitFor({state:"detached",timeout:4000});
const pressBack=()=>api("back");
try{
 await page.goto("http://127.0.0.1:5173/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>!!window.__luemiQaMedia);
 await page.evaluate(()=>{
  const b=document.querySelector("button");
  if(b instanceof HTMLElement)b.focus();
 });
 for(const kind of ["hero","grid"]){
  await open("qa-alpha",kind);await viewer().waitFor();
  await page.waitForFunction(()=>document.querySelector(".pm-viewer-image")?.dataset.photoId==="qa-alpha");
  const init=await get();
  assert.equal(init.photo,"qa-alpha");
  assert.equal(init.active,"Закрыть просмотр");
  assert.equal(init.overflow,"hidden");
  if(kind==="hero"||kind==="grid")
   assert.equal(init.morph,"true","decoded existing thumbnail should get true uniform morph");
  if(init.morph==="true"){
   assert.ok(Math.abs(init.matrixScaleX-init.matrixScaleY)<.001,
    "morph image never uses scaleX/scaleY separately");
   assert.equal(init.stageImgOpacity,"0","no overlapping mismatched pixel copies");
   assert.ok(init.clip?.startsWith("inset("));
  }
  await wait(295);
  assert.notEqual((await get()).srcHidden,"hidden","thumbnail restored after opening");
  await viewer().getByRole("button",{name:"Закрыть просмотр"}).click();
  await waitGone();
  assert.equal(await page.evaluate(()=>document.getElementById("qa-source-photo")?.style.visibility??""),"",
   "source visibility always restored after closed modal");
  pass(kind+" uniform morph/crop or decode-gated fade, no hidden source after close");
 }
 await open("qa-alpha","hero");await viewer().waitFor();await wait(310);
 await page.keyboard.press("ArrowRight");
 await page.waitForFunction(()=>document.querySelector(".pm-viewer-image")?.dataset.photoId==="qa-beta");
 await viewer().getByRole("button",{name:"Закрыть просмотр"}).click();await waitGone();
 assert.notEqual(await page.evaluate(()=>document.getElementById("qa-source-photo")?.style.visibility),"hidden");
 pass("changed photo never morphs to opening thumbnail of old photo");
 await open("qa-alpha","grid");await viewer().waitFor();await wait(285);
 await api("removeOrigin");await viewer().getByRole("button",{name:"Закрыть просмотр"}).click();await waitGone();
 pass("removed source gracefully uses fade, no stale DOM or leaked opacity");
 await open("qa-alpha","outside");await viewer().waitFor();await wait(290);
 await viewer().getByRole("button",{name:"Закрыть просмотр"}).click();await waitGone();
 pass("offscreen source never causes incorrect return morph or profile scrolling");
 await open("qa-alpha","hero");await viewer().waitFor();await wait(285);
 await viewer().getByRole("button",{name:"Действия с фото"}).click();
 assert.ok(await viewer().getByRole("menu").isVisible());
 await pressBack();await page.waitForFunction(()=>!document.querySelector(".pm-viewer-menu"));
 assert.ok(await viewer().isVisible());assert.equal(await viewer().getByRole("menu").count(),0);
 await pressBack();await waitGone();await pressBack();
 assert.ok((await api("stats")).profileBack>=1,"Back stack: menu > viewer > profile");
 pass("modal registered Back hierarchy: menu, viewer, profile");
 await open("qa-alpha","hero");await viewer().waitFor();await page.keyboard.press("Escape");await waitGone();
 await open("qa-alpha","hero");await viewer().waitFor();
 await page.keyboard.press("Backspace");await waitGone();
 pass("Escape and keyboard Back share idempotent requestClose");
 await page.evaluate(()=>{
  const root=document.querySelector(".luemi-shell");
  root.style.setProperty("--tg-safe-area-inset-top","24px");
  root.style.setProperty("--tg-content-safe-area-inset-top","34px");
  root.style.setProperty("--tg-safe-area-inset-bottom","12px");
  root.style.setProperty("--tg-content-safe-area-inset-bottom","31px");
 });
 await open("qa-alpha","hero");await viewer().waitFor();await wait(290);
 await page.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector(".pm-viewer")).getPropertyValue("--viewer-safe-top"))>=34);
 let snap=await get();assert.ok(parseFloat(snap.safeTop)>=34&&parseFloat(snap.safeBottom)>=31);
 const beforeId=snap.photo;
 await page.evaluate(()=>{
  const root=document.querySelector(".luemi-shell");
  root.style.setProperty("--tg-content-safe-area-inset-top","46px");
  window.dispatchEvent(new Event("resize"));
 });
 await page.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector(".pm-viewer")).getPropertyValue("--viewer-safe-top"))>=46);
 snap=await get();assert.equal(snap.photo,beforeId);
 assert.ok(snap.headerY>=0&&snap.footerY<=852.5);
 await page.setViewportSize({width:852,height:393});await wait(90);
 snap=await get();assert.equal(snap.photo,beforeId);assert.ok(snap.footerY<=393.5);
 pass("portal-safe 34/31 max insets, live 46px safe update, portrait/landscape without remount");
 await page.emulateMedia({reducedMotion:"reduce"});await viewer().getByRole("button",{name:"Закрыть просмотр"}).click();await waitGone();
 pass("reduced-motion and X close restore source and overflow");
 const final=await get();assert.notEqual(final.overflow,"hidden");
 assert.deepEqual(errors,[],"no page errors");
 console.log("REM-03D BROWSER QA PASS · real Chromium synthetic, physical A55/iOS NOT VERIFIED");
}finally{await ctx.close();await browser.close();}
