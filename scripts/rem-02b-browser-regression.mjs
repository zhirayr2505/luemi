import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135.0 Mobile Safari/537.36"});
const page=await context.newPage(),errors=[];
page.on("pageerror",e=>errors.push(e.message));
const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function geometry(){
 return page.evaluate(()=>{
  const root=document.querySelector(".pm-inline");
  if(!(root instanceof HTMLElement))throw Error("profile root missing");
  const shell=root.querySelector(".pm-profile-sheet");
  const viewport=root.querySelector(".pm-sheet-viewport");
  const pages=root.querySelector(".pm-pages");
  const c=window.getComputedStyle(root);
  const top=Number(c.getPropertyValue("--pm-collapsed-top"))||Number(shell.style.getPropertyValue("--pm-collapsed-top"));
  const collapsed=Number(shell.style.getPropertyValue("--pm-collapsed-top").replace("px",""));
  const expanded=Number(root.style.getPropertyValue("--pm-expanded-y").replace("px",""));
  const sheetPosition=expanded-viewport.scrollTop;
  return {height:root.clientHeight,width:root.clientWidth,top,collapsed,expanded,
   sheetPosition,remaining:root.dataset.sheetState,pagesLeft:pages.scrollLeft,
   pageWidth:pages.clientWidth,fraction:pages.scrollLeft/Math.max(1,pages.clientWidth),
   selected:root.querySelector('.pm-tab[aria-selected=true]')?.textContent?.trim()};
 });
}
const pass=s=>console.log("REM02B_BROWSER_PASS "+s);
try{
 await page.goto(base+"/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Профиль",exact:true}).click();
 await page.locator(".pm-inline").waitFor({state:"visible"});
 await sleep(180);
 const original=await geometry();
 assert.ok(original.expanded>original.collapsed);
 for(const percent of [.25,.5,.9]){
  await page.setViewportSize({width:393,height:852});
  await sleep(90);
  if((await geometry()).remaining==="collapsed"){
   await page.getByRole("button",{name:"Развернуть анкету"}).click();
   await sleep(385);
  }
  await page.getByRole("button",{name:"Развернуть анкету"}).click();
  await sleep(Math.round(335*percent));
  const before=await geometry();
  assert.equal(before.remaining,"expanded","CSS/React state must stay expanded until actual settle completion");
  await page.setViewportSize({width:393,height:percent===.25?722:percent===.5?648:782});
  await sleep(390);
  const after=await geometry();
  assert.equal(after.remaining,"collapsed");
  assert.ok(Math.abs(after.sheetPosition-after.collapsed)<=1,
   "sheet endpoint deviation >1 CSS px at "+percent+": "+JSON.stringify(after));
  pass("native sheet resize "+Math.round(percent*100)+"% settles at endpoint within 1px");
 }
 await page.setViewportSize({width:393,height:852});await sleep(120);
 const collapsed=await geometry();
 assert.ok(Math.abs(collapsed.sheetPosition-collapsed.collapsed)<=1);
 await page.getByRole("button",{name:"Потянуть панель вниз"}).click();
 await sleep(85);
 await page.setViewportSize({width:393,height:715});
 await sleep(420);
 const opened=await geometry();
 assert.equal(opened.remaining,"expanded");
 assert.ok(Math.abs(opened.sheetPosition-opened.expanded)<=1,
  "height-only shrink during expand must finish "+JSON.stringify(opened));
 pass("height-only shrink at fixed width + expanding settle endpoint ≤1px");
 await page.getByRole("tab",{name:"Подарки",exact:true}).click();
 await sleep(92);
 const tabDuring=await geometry();
 assert.ok(tabDuring.fraction>0&&tabDuring.fraction<3,"must capture fractional tab while settling");
 await page.setViewportSize({width:428,height:852});
 await sleep(90);
 const tabAfterResize=await geometry();
 assert.ok(tabAfterResize.fraction>0.01&&tabAfterResize.fraction<=3.01,
  "tab resize must preserve fractional position rather than reset to 3");
 await sleep(250);
 const tabDone=await geometry();
 assert.equal(tabDone.selected,"Подарки");
 assert.ok(Math.abs(tabDone.pagesLeft-3*tabDone.pageWidth)<=1,
  "tab final offset must be within 1 CSS px "+JSON.stringify(tabDone));
 pass("fractional tabs width changes mid-settle and arrive at selected index ≤1px");
 await page.getByRole("tab",{name:"О себе",exact:true}).click();
 await sleep(350);
 const tabBack=await geometry();
 assert.ok(Math.abs(tabBack.fraction)<=1/Math.max(1,tabBack.pageWidth));
 await page.getByRole("tab",{name:"Подарки",exact:true}).click();
 await sleep(74);
 await page.getByRole("tab",{name:"Фото",exact:true}).click();
 await sleep(350);
 const reversed=await geometry();
 assert.equal(reversed.selected,"Фото");
 assert.ok(Math.abs(reversed.pagesLeft-2*reversed.pageWidth)<=1);
 pass("rapid settle reversal does not restart stale tab target");
 // Zero-size hidden owner must keep unspent animation time and resume on show.
 await page.getByRole("button",{name:"Развернуть анкету"}).click();
 await sleep(82);
 await page.evaluate(()=>{document.querySelector(".pm-inline").style.display="none";});
 await sleep(120);
 await page.evaluate(()=>{document.querySelector(".pm-inline").style.display="";});
 await sleep(430);
 const shown=await geometry();
 assert.equal(shown.remaining,"collapsed");
 assert.ok(Math.abs(shown.sheetPosition-shown.collapsed)<=1);
 pass("hidden → visible sheet completes and never remains intermediate");
 // Orientation and safe-area changes: logo/sheet are recomputed without stale endpoints.
 await page.setViewportSize({width:852,height:393});
 await sleep(190);
 const landscape=await geometry();
 assert.ok(landscape.width>landscape.height);
 assert.equal(landscape.remaining,"collapsed");
 assert.ok(Math.abs(landscape.sheetPosition-landscape.collapsed)<=1,
  "rotation endpoint error >1px "+JSON.stringify(landscape));
 await page.evaluate(()=>{
  document.querySelector(".luemi-shell")?.style.setProperty("--top-safe","42px");
  window.dispatchEvent(new Event("resize"));
 });
 await sleep(175);
 const safe=await geometry();
 assert.ok(Math.abs(safe.sheetPosition-safe.collapsed)<=1,
  "safe inset change endpoint error >1px "+JSON.stringify(safe));
 pass("rotation and safe-area geometry changes preserve endpoint within 1px");
 if(errors.length)throw Error("Chromium page errors: "+errors.join(" | "));
 console.log("REM-02B BROWSER GEOMETRY QA PASS · Chromium Android UA, physical A55/iOS NOT VERIFIED");
}finally{await context.close();await browser.close();}
