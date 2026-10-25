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
  // Actual visible white panel coordinate; no scrollTop is used by 03G.
  const sheetPosition=shell.getBoundingClientRect().top-root.getBoundingClientRect().top;
  assert.equal(viewport.scrollTop,0,"outer native scroll offset must stay disabled");
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
   await page.getByRole("button",{name:"Раскрыть фото профиля"}).click();
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
  pass("absolute sheet resize "+Math.round(percent*100)+"% settles at endpoint within 1px");
 }
 await page.setViewportSize({width:393,height:852});await sleep(120);
 const collapsed=await geometry();
 assert.ok(Math.abs(collapsed.sheetPosition-collapsed.collapsed)<=1);
 await page.getByRole("button",{name:"Раскрыть фото профиля"}).click();
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
 // Actual pointer input: resize while the horizontal tab swipe is held.
 // Keep the actual pager onscreen: expanded sheet intentionally shows only its header.
 await page.getByRole("button",{name:"Развернуть анкету"}).click();
 await sleep(385);
 await page.getByRole("tab",{name:"О себе",exact:true}).click();await sleep(360);
 const area=await page.locator(".pm-inline .pm-pages").boundingBox();
 assert.ok(area&&area.height>10,"tab pager must be physically measurable");
 const px=area.x+area.width*.62,py=area.y+Math.min(80,area.height*.5);
 await page.mouse.move(px,py);await page.mouse.down();
 await page.mouse.move(px-105,py,{steps:7});await sleep(55);
 const beforePointer=await geometry();
 console.log("REM02B_POINTER_CONTEXT "+JSON.stringify({area,px,py,beforePointer,
  hit:await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.outerHTML.slice(0,180),[px,py])}));
 assert.ok(beforePointer.fraction>.04&&beforePointer.fraction<.9,
  "pointer actually drags fractional tab under finger");
 await page.setViewportSize({width:460,height:852});await sleep(65);
 const afterPointer=await geometry();
 assert.ok(Math.abs(afterPointer.fraction-beforePointer.fraction)*afterPointer.pageWidth<=1,
  "fraction must be continuous within one CSS pixel during width change "+JSON.stringify({beforePointer,afterPointer}));
 await page.mouse.move(px-140,py,{steps:4});await page.mouse.up();await sleep(370);
 const pointerFinal=await geometry();
 assert.equal(pointerFinal.selected,"Блики");
 assert.ok(Math.abs(pointerFinal.pagesLeft-pointerFinal.pageWidth)<=1);
 pass("pointer dragging preserves fractional location at width revision, commits new tab ≤1px");
 // Native touch: preserve sheet absolute position during height-only resize.
 await page.getByRole("button",{name:"Раскрыть фото профиля"}).click();
 await sleep(385);
 const identity=await page.locator(".pm-inline .pm-identity").boundingBox();
 assert.ok(identity&&identity.height>25);
 const tx=identity.x+identity.width*.45,ty=identity.y+identity.height*.45;
 const touch=await context.newCDPSession(page);
 try{
  const initial=await geometry();
  await touch.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:tx,y:ty}]});
  await touch.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:tx,y:ty-115}]});
  await sleep(65);
  const dragged=await geometry();
  assert.ok(dragged.sheetPosition<initial.sheetPosition-5,"native touch must actually drag sheet");
  await page.setViewportSize({width:460,height:790});await sleep(65);
  const rebased=await geometry();
  assert.ok(Math.abs(dragged.sheetPosition-rebased.sheetPosition)<=1,
   "sheet should remain under finger across resize (≤1px) "+JSON.stringify({dragged,rebased}));
  await touch.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:tx,y:ty-145}]});
  await sleep(40);
  const continued=await geometry();
  assert.ok(continued.sheetPosition<rebased.sheetPosition-12,
   "native touch must continue from new anchor without old-coordinate snap");
  await touch.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
 }finally{await touch.detach()}
 await sleep(435);
 const touchDone=await geometry();
 assert.equal(touchDone.remaining,"collapsed");
 assert.ok(Math.abs(touchDone.sheetPosition-touchDone.collapsed)<=1);
 await page.getByRole("button",{name:"Раскрыть фото профиля"}).click();
 await sleep(385);
 pass("real native touch drag+height change reanchors finger, ends at ≤1px endpoint");
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
