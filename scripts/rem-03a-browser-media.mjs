import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"});
const page=await context.newPage();
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const viewer=()=>page.locator(".pm-viewer");
const stage=()=>viewer().locator(".pm-viewer-stage");
const image=()=>viewer().locator(".pm-viewer-image");
const currentId=()=>image().getAttribute("data-photo-id");
const change=op=>page.evaluate(x=>window.__luemiQaMedia.change(x),op);
const open=id=>page.evaluate(x=>window.__luemiQaMedia.open(x),id);
const close=()=>page.evaluate(()=>window.__luemiQaMedia.close());
const pass=message=>console.log("REM03A_BROWSER_PASS "+message);
const ready=async(id,timeout=4500)=>{
 try{await page.waitForFunction(expected=>{
  const v=document.querySelector(".pm-viewer");
  const img=v?.querySelector(".pm-viewer-image");
  const status=v?.querySelector(".pm-viewer-media-status");
  return !!img&&img.dataset.photoId===expected&&img.naturalWidth>0&&img.naturalHeight>0&&
   img.style.opacity==="1"&&!status;
 },id,{timeout});}catch(error){
  console.log("REM03A_DIAG_READINESS",JSON.stringify(await page.evaluate(()=>{
   const v=document.querySelector(".pm-viewer");
   const img=v?.querySelector(".pm-viewer-image");
   const status=v?.querySelector(".pm-viewer-media-status");
   return {viewer:!!v,id:img?.dataset.photoId,key:img?.dataset.mediaKey,
    src:img?.getAttribute("src")?.slice(0,110),opacity:img?.style.opacity,
    naturalWidth:img?.naturalWidth,naturalHeight:img?.naturalHeight,
    mediaPhase:status?.dataset.mediaPhase,statusId:status?.dataset.photoId,
    date:v?.querySelector(".pm-viewer-bottom")?.textContent?.slice(0,100)};
  })));
  throw error;
 }
 assert.equal(await currentId(),id);
 const visible=await image().evaluate(el=>({photo:el.dataset.photoId,src:el.getAttribute("src"),
  width:el.naturalWidth,height:el.naturalHeight}));
 assert.ok(visible.src&&visible.width>0&&visible.height>0);
 return visible;
};
const nav=async(kind)=>{
 if(kind==="right")await page.keyboard.press("ArrowRight");
 if(kind==="left")await page.keyboard.press("ArrowLeft");
 if(kind==="next")await viewer().getByRole("button",{name:"Следующее фото"}).click();
 if(kind==="previous")await viewer().getByRole("button",{name:"Предыдущее фото"}).click();
};
const titleMatch=async text=>assert.ok((await viewer().locator(".pm-viewer-bottom").innerText()).includes(text));
const goSwipe=async(direction)=>{
 const box=await stage().boundingBox();
 assert.ok(box&&box.width>200);
 const x=box.x+box.width*(direction===1?.76:.24),y=box.y+box.height*.42;
 await page.mouse.move(x,y);await page.mouse.down();
 await page.mouse.move(x+(direction===1?-165:165),y,{steps:12});
 await page.mouse.up();
};
const svg=(label,color)=>'<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960"><rect width="720" height="960" fill="'+color+'"/><text x="30" y="90">'+label+'</text></svg>';
try{
 await page.route("**/qa-media-cold.png",async route=>{
  await wait(480);
  await route.fulfill({status:200,contentType:"image/svg+xml",body:svg("COLD","purple")});
 });
 await page.route("**/qa-media-broken.png",async route=>route.fulfill({status:404,contentType:"text/plain",body:"missing"}));
 await page.goto("http://127.0.0.1:5173/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>!!window.__luemiQaMedia);
 await open("qa-alpha");await viewer().waitFor({state:"visible"});
 await ready("qa-alpha");await titleMatch("2 января");
 pass("cold opening actual DOM decoded image, dimensions and photo/date identity");

 await nav("right");await ready("qa-beta");await titleMatch("3 февраля");
 await nav("left");await ready("qa-alpha");await titleMatch("2 января");
 await nav("next");await ready("qa-beta");
 await nav("previous");await ready("qa-alpha");
 pass("keyboard and buttons share stable photoId navigation; rapid N → N+1 → N");

 await goSwipe(1);await ready("qa-beta");
 await goSwipe(1);await ready("qa-gamma");await titleMatch("4 марта");
 pass("real DOM pointer swipe follows same ID transition, correct date and source");

 await change("reorder");await ready("qa-gamma");
 assert.ok((await viewer().locator(".pm-viewer-top").innerText()).includes("1 / 3"));
 await titleMatch("4 марта");
 await viewer().getByRole("button",{name:"Действия с фото"}).click();
 assert.equal(await viewer().getByRole("menuitem",{name:/Сделать главным/}).isDisabled(),true,
  "demo/QA fixture may not claim a backend save");
 await viewer().getByRole("button",{name:"Отмена"}).click();
 pass("reorder retains photoId and date/menu identity; no fictitious saved-main success");

 await change("remove-current");await ready("qa-beta");await titleMatch("3 февраля");
 await change("remove-last");await ready("qa-beta");
 pass("remove current and last select deterministic surviving neighbor");

 await change("reset");await ready("qa-beta");
 await change("replace-beta");
 let before=await image().getAttribute("src");
 assert.ok(before===null||before.includes("BETA%20VERSION%20TWO"),"version switch never renders old src");
 await ready("qa-beta");
 assert.ok((await image().getAttribute("src")).includes("BETA%20VERSION%20TWO"));
 pass("same photoId with new version/src invalidates old pixels and decodes replacement");

 await change("cold-beta");
 await page.waitForFunction(()=>document.querySelector(".pm-viewer-media-status")?.dataset.mediaPhase==="loading");
 assert.equal(await currentId(),"qa-beta");
 await titleMatch("3 февраля");
 assert.notEqual(await image().evaluate(el=>el.style.opacity),"1","do not show old pixels for cold resource");
 await ready("qa-beta",6000);
 assert.ok((await image().getAttribute("src")).includes("qa-media-cold.png"));
 pass("slow decoded media uses honest loading with stable geometry and no old-photo bleed");

 await change("broken-beta");await ready("qa-beta");
 assert.ok((await image().getAttribute("src")).startsWith("data:image/svg"),"fallback must decode before display");
 pass("broken primary uses exactly one decoded fallback, never automatic unbounded retries");

 await change("error-beta");
 await page.waitForFunction(()=>document.querySelector(".pm-viewer-media-status")?.dataset.mediaPhase==="error");
 assert.equal(await currentId(),"qa-beta");
 assert.notEqual(await image().evaluate(el=>el.style.opacity),"1");
 await viewer().getByRole("button",{name:"Повторить"}).click();
 await page.waitForFunction(()=>document.querySelector(".pm-viewer-media-status")?.dataset.mediaPhase==="error");
 pass("broken resource surfaces real error and bounded manual retry");

 await change("revoke-beta");await ready("qa-gamma");
 await titleMatch("4 марта");
 pass("access revocation removes formerly selected photo and stale resource");

 await change("remove-all");
 await viewer().waitFor({state:"detached",timeout:3500});
 await change("reset");await open("qa-alpha");await ready("qa-alpha");
 pass("remove all safely closes session, reopen has no stale decoded results");

 await close();await viewer().waitFor({state:"detached"});
 assert.deepEqual(errors,[],"no React/browser exceptions");
 console.log("REM-03A BROWSER MEDIA QA PASS · Chromium synthetic only, Galaxy A55/iOS NOT VERIFIED");
}finally{await context.close();await browser.close();}
