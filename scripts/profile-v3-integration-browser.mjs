import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const url=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const out="qa-artifacts/profile-v3-integration";
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,
 isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0 Mobile Safari/537.36"});
const page=await context.newPage();
const errors=[];page.on("pageerror",e=>errors.push(e.message));
const frame=async()=>page.locator(".v3-profile-host.pm-inline");
const progress=async(scope)=>Number(await scope.locator(".v3-int-root").getAttribute("data-progress"));
const touch=async({x,y,dx=0,dy=0,steps=12,each})=>{
 const client=await context.newCDPSession(page);
 try{
  await client.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y,id:1}]});
  for(let i=1;i<=steps;i++){
   await client.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x+dx*i/steps,y:y+dy*i/steps,id:1}]});
   await page.waitForTimeout(18);
   if(each)await each(i);
  }
  await client.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
 }finally{await client.detach()}
};
try{
 await page.goto(url+"/profile-qa.html?profileV3=1");
 await page.getByRole("button",{name:"Профиль",exact:true}).click();
 const root=await frame();await root.waitFor();
 const shell=root.locator(".v3-int-root");
 assert.equal(await shell.getAttribute("data-sheet-state"),"collapsed","owner begins compact");
 const items=root.locator(".v3-int-photo-slide img");
 assert.equal(await items.count(),3,"three projected QA photos, not placeholder");
 await items.first().evaluate(img=>img.decode());
 const avatar=await root.locator(".v3-int-mask").boundingBox();
 const start=await root.locator(".v3-int-sheet").boundingBox();
 assert(avatar&&start&&avatar.width>=90&&avatar.width<=116&&avatar.x<160,
  "compact portrait has plausible geometry");
 assert(start.y>=avatar.y+avatar.height-6,"sheet below avatar");
 assert.equal(await root.locator('.v3-int-tab[aria-selected="true"]').count(),1);
 await page.screenshot({path:out+"/owner-compact.png"});
 await root.locator(".v3-int-mask").click({position:{x:avatar.width/2,y:avatar.height/2}});
 await page.waitForFunction(()=>document.querySelector(".v3-profile-host.pm-inline")?.dataset.morphState==="expanded");
 const expanded=await root.locator(".v3-int-mask").boundingBox(),sheet=await root.locator(".v3-int-sheet").boundingBox();
 assert(expanded&&sheet&&expanded.width>avatar.width*2&&sheet.y>start.y+45,"hero expands in bounded frame and sheet travels");
 assert(expanded.height<page.viewportSize().height*.62,"expanded photo may not consume most of the screen");
 assert.equal(await root.locator(".v3-int-photo-slide").first().evaluate(el=>getComputedStyle(el).overflow),"hidden",
  "each large photo must be clipped to its own slide; adjacent portraits cannot overlap");
 assert.equal(await root.locator(".v3-int-ambient img").evaluate(el=>getComputedStyle(el).filter),"none",
  "large blurred CSS photo cannot obscure the active portrait on A55");
 assert.equal(await page.locator(".pm-viewer").count(),0,"compact avatar must expand first, not open viewer");
 await page.screenshot({path:out+"/owner-expanded.png"});
 const photoId=await items.first().getAttribute("data-photo-id");
 assert.equal(photoId,"qa-photo-lilac");
 const image=await items.first().evaluate(img=>({w:img.naturalWidth,h:img.naturalHeight,
  paintedW:parseFloat(img.style.width),paintedH:parseFloat(img.style.height)}));
 assert(image.w>0&&Math.abs(image.w/image.h-image.paintedW/image.paintedH)<.0001,"image pixels never stretch");
 await root.locator(".v3-int-mask").click({position:{x:expanded.width/2,y:Math.max(30,expanded.height*.34)}});
 await page.locator(".pm-viewer").waitFor();
 await page.screenshot({path:out+"/owner-viewer.png"});
 await page.keyboard.press("Escape");
 await page.locator(".pm-viewer").waitFor({state:"detached",timeout:2600});
 assert.equal(await root.getAttribute("data-morph-state"),"expanded","viewer return retains expanded hero");
 // Gallery is a real, permission-filtered track with follow-finger horizontal
 // movement. The selected published/local self photo must persist in PhotoViewer.
 const swipable=await root.locator(".v3-int-mask").boundingBox();
 assert(swipable);
 const centerX=swipable.x+swipable.width*.62,centerY=swipable.y+swipable.height*.42;
 const track=root.locator(".v3-int-photo-rail");
 const initialTrack=await track.evaluate(el=>getComputedStyle(el).transform);
 await touch({x:centerX,y:centerY,dx:-235,steps:12,each:async i=>{
  if(i===6){
   const middle=await track.evaluate(el=>getComputedStyle(el).transform);
   assert.notEqual(middle,initialTrack,"gallery follows touch before release");
   await page.screenshot({path:out+"/owner-photo-mid-swipe.png"});
  }
 }});
 await page.waitForTimeout(300);
 assert.equal(await root.locator('.v3-int-photo-dots button.active').getAttribute("aria-label"),"Фото 2 из 3",
  "photo swipe commits next actual photo");
 await root.locator(".v3-int-mask").click({position:{x:expanded.width*.5,y:expanded.height*.36}});
 await page.locator(".pm-viewer").waitFor();
 await page.keyboard.press("Escape");
 await page.locator(".pm-viewer").waitFor({state:"detached"});
 assert.equal(await root.locator('.v3-int-photo-dots button.active').getAttribute("aria-label"),"Фото 2 из 3",
  "return from viewer preserves active photoId");
 const handle=await root.locator(".v3-int-handle").boundingBox();
 assert(handle&&handle.height>=30);
 const series=[];
 await touch({x:handle.x+handle.width/2,y:handle.y+handle.height/2,dy:-195,
  each:async i=>{if([2,5,8,12].includes(i))series.push(await progress(root));}});
 assert(series.some(x=>x<.65),"touch follows the finger");
 assert(series.every((v,i)=>i===0||v<=series[i-1]+.1),"no reverse snap during touch");
 await page.waitForFunction(()=>document.querySelector(".v3-profile-host.pm-inline")?.dataset.morphState==="compact",
  null,{timeout:2600});
 await page.screenshot({path:out+"/owner-after-touch.png"});
 const tabs=root.locator(".v3-int-tab");
 assert.equal(await tabs.count(),5);
 const contentSurface=await root.locator(".v3-int-pages").boundingBox();
 assert(contentSurface);
 const tabTrack=root.locator(".v3-int-pages-track");
 const startTabs=await tabTrack.evaluate(el=>getComputedStyle(el).transform);
 await touch({x:contentSurface.x+contentSurface.width*.75,y:contentSurface.y+Math.min(105,contentSurface.height*.35),
  dx:-210,steps:12,each:async i=>{
   if(i===6){
    assert.notEqual(await tabTrack.evaluate(el=>getComputedStyle(el).transform),startTabs,
     "tab rail must follow active touch, not snap after release");
    await page.screenshot({path:out+"/owner-tab-mid-swipe.png"});
   }
  }});
 await page.waitForTimeout(260);
 assert.equal(await tabs.nth(1).getAttribute("aria-selected"),"true","horizontal swipe selects Bliki");
 await tabs.first().click();
 // Swipe from an actual nested content card, not an empty gutter. Android
 // must bubble PointerEvents through the scrollable article to the tab owner.
 const nestedCard=root.locator(".v3-int-page").first().locator(".pm-card").first();
 const nestedBounds=await nestedCard.boundingBox();assert(nestedBounds);
 await touch({x:nestedBounds.x+nestedBounds.width*.75,
  y:nestedBounds.y+Math.min(45,nestedBounds.height*.5),dx:-225,steps:12});
 await page.waitForTimeout(280);
 assert.equal(await tabs.nth(1).getAttribute("aria-selected"),"true",
  "left swipe starting inside nested content switches to Bliki");
 await tabs.first().click();
 const firstPage=root.locator(".v3-int-page").first();
 await firstPage.evaluate(el=>el.scrollTop=75);
 assert(await firstPage.evaluate(el=>el.scrollTop)>0,"native tab content can scroll without sheet changing");
 for(let i=0;i<5;i++){
  await tabs.nth(i).click();
  assert.equal(await tabs.nth(i).getAttribute("aria-selected"),"true");
  assert.equal(await root.locator('.v3-int-page[aria-hidden="false"]').count(),1);
 }
 await tabs.nth(2).click();
 assert.equal(await root.locator(".pm-photo-tile").count(),3,"real authorized photo grid present");
 await root.locator(".pm-photo-tile").first().click();
 await page.locator(".pm-viewer").waitFor();
 await page.keyboard.press("Escape");
 await page.locator(".pm-viewer").waitFor({state:"detached"});
 // Owner media can be revised while profile remains mounted. No inaccessible
 // gallery slots, undefined dimensions or private media should leak.
 await page.evaluate(()=>window.__luemiQaV3.setPhotoCount(0));
 await page.waitForFunction(()=>document.querySelectorAll(".v3-profile-host.pm-inline .v3-int-photo-slide img").length===0);
 assert.equal(await root.locator(".v3-int-no-photo").count(),1,"0-photo placeholder remains safe");
 await page.evaluate(()=>window.__luemiQaV3.setPhotoCount(1));
 await page.waitForFunction(()=>document.querySelectorAll(".v3-profile-host.pm-inline .v3-int-photo-slide img").length===1);
 await page.evaluate(()=>window.__luemiQaV3.setPhotoCount(6));
 await page.waitForFunction(()=>document.querySelectorAll(".v3-profile-host.pm-inline .v3-int-photo-slide img").length===6);
 assert.equal(await root.locator(".pm-photo-tile").count(),6,"owner retains six authorized photo tiles");
 await page.evaluate(()=>window.__luemiQaV3.setPhotoCount(3));
 await page.waitForFunction(()=>document.querySelectorAll(".v3-profile-host.pm-inline .v3-int-photo-slide img").length===3);
 await page.getByRole("button",{name:"Знакомства",exact:true}).click();
 await page.getByRole("tab",{name:"Для тебя",exact:true}).click();
 await page.getByRole("button",{name:/Открыть демо-профиль/}).first().click();
 const visitor=page.locator(".discovery-visitor-route .v3-profile-host");
 await visitor.waitFor();
 assert.equal(await visitor.getAttribute("data-sheet-state"),"collapsed");
 assert.equal(await visitor.locator(".v3-int-owner-actions").count(),0,"visitor never gets owner actions");
 assert.equal(await visitor.locator(".v3-int-photo-slide img").count()>=1,true);
 await page.screenshot({path:out+"/visitor-compact.png"});
 // A right swipe starting on the expanded sheet handle belongs to ROUTE_BACK,
 // while the hero gallery and tab pager retain their own horizontal gestures.
 const visitorMask=visitor.locator(".v3-int-mask");
 await visitorMask.click();
 await page.waitForFunction(()=>document.querySelector(".discovery-visitor-route .v3-profile-host")?.dataset.morphState==="expanded");
 const visitorHandle=await visitor.locator(".v3-int-handle").boundingBox();
 assert(visitorHandle);
 await touch({x:visitorHandle.x+Math.min(100,visitorHandle.width*.35),
  y:visitorHandle.y+visitorHandle.height/2,dx:230,steps:12});
 await visitor.waitFor({state:"detached",timeout:3000});
 assert.deepEqual(errors,[],"no uncaught DOM runtime errors");
 console.log("PROFILE_V3_INTEGRATION_CHROMIUM_PASS owner/visitor real projection, 5 real tabs, fullscreen viewer, touch, photo aspect, route exit");
}finally{await context.close();await browser.close()}
