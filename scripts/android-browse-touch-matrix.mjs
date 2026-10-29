/** LUEMI browsing-gesture regression: real Chromium Android touch events.
 * Checks the two field failures: scrolled ForYou must still allow horizontal
 * tab change, and Nearby photo cards must not suppress the browsing gesture.
 * Native vertical scroll must remain native, without unintended tab changes.
 * This is synthetic Chromium, NOT a physical Samsung/Telegram GPU test.
 */
import assert from "node:assert/strict";
import {chromium} from "playwright";

const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const ua="Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36";
const browser=await chromium.launch({headless:true});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const samples=[];
async function swipe(cdp,x,y,dx,dy,steps=14){
 await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{id:1,x,y}]});
 for(let i=1;i<=steps;i++){
  await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{
   id:1,x:Math.round(x+dx*i/steps),y:Math.round(y+dy*i/steps)}]});
  await delay(19);
 }
 await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
}
async function active(page,n){
 await delay(390);
 assert.equal(await page.locator(".discovery-top-tabs [role=tab]").nth(n).getAttribute("aria-selected"),
  "true","expected tab "+n+" to be active after touch");
}
async function scrollerPoint(page,selector){
 return await page.evaluate(selector=>{
  const el=document.querySelector(selector);
  if(!(el instanceof HTMLElement))return null;
  const box=el.getBoundingClientRect();
  const x=box.left+Math.min(12,box.width*.06);
  const y=box.top+box.height*.69;
  return {x:Math.round(x),y:Math.round(y),height:box.height};
 },selector);
}
async function nonRailPoint(page){
 return await page.evaluate(()=>{
  const sc=document.querySelector(".fy-scroll");
  if(!(sc instanceof HTMLElement))return null;
  const r=sc.getBoundingClientRect();
  // The browse pager intentionally ignores buttons/links. Pick an actual
  // noninteractive scroller pixel so the test measures a supported swipe.
  const excluded=".fy-rail,.fy-expanded,.fy-manage,.discovery-action,[role=dialog],button,a,input,textarea,select,[contenteditable],[role=button]";
  for(const yf of [.20,.35,.50,.65,.80]){
   for(const xf of [.78,.55,.35,.15]){
    const x=Math.round(r.left+r.width*xf),y=Math.round(r.top+r.height*yf);
    const el=document.elementFromPoint(x,y);
    if(el&&sc.contains(el)&&!el.closest(excluded))return {x,y,tag:el.tagName};
   }
  }
  return null;
 });
}
try {
 for(const [width,height] of [[360,780],[393,852],[412,915]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,userAgent:ua});
  const page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto(base+"/profile-qa.html",{waitUntil:"domcontentloaded"});
  await page.locator(".discovery-app").waitFor();
  await page.evaluate(()=>{
   window.__luemiTouchTrace=[];
   const surface=document.querySelector(".discovery-pages");
   for(const type of ["touchstart","touchmove","touchend","touchcancel","pointercancel"]){
    surface?.addEventListener(type,event=>{
     const touch=event.touches?.[0]??event.changedTouches?.[0];
     const log=window.__luemiTouchTrace;
     if(Array.isArray(log)&&log.length<90)log.push({
      type,cancelable:event.cancelable,tag:event.target?.tagName,
      className:typeof event.target?.className==="string"?event.target.className.slice(0,110):"",
      x:Math.round(touch?.clientX??-1),y:Math.round(touch?.clientY??-1)
     });
    },{capture:true,passive:true});
   }
  });
  const tabs=page.locator(".discovery-top-tabs [role=tab]");
  for(let repeat=0;repeat<2;repeat++){
   // The ForYou scroller is NOT at rest at top; this used to cause all
   // horizontal gestures to be rejected by gestureCapabilities.canScrollY.
   await tabs.nth(1).click();await active(page,1);
   const initial=await page.locator(".fy-scroll").evaluate(el=>{
    el.scrollTop=132;
    return {top:el.scrollTop,max:el.scrollHeight-el.clientHeight};
   });
   assert.ok(initial.top>1,"ForYou fixture must actually be scrolled for this regression");
   const start=await nonRailPoint(page);
   assert.ok(start,"no gesture-safe visible point inside scrolled ForYou");
   const t1=performance.now();
   await swipe(cdp,start.x,start.y,-width*.46,0);
   try{await active(page,2);}catch(error){
    const diagnosis=await page.evaluate(()=>({
     events:window.__luemiTouchTrace,
     selected:[...document.querySelectorAll(".discovery-top-tabs [role=tab]")].map(x=>x.getAttribute("aria-selected")),
     current:document.querySelector(".discovery-app")?.dataset,
     scrollTop:document.querySelector(".fy-scroll")?.scrollTop
    }));
    console.error("LUEMI_BROWSE_TOUCH_DIAGNOSTIC "+JSON.stringify({start,diagnosis}));
    throw error;
   }
   await page.evaluate(()=>{window.__luemiTouchTrace=[];});
   samples.push({screen:width,repeat,scenario:"for-you-scrolled-left",elapsedMs:Math.round(performance.now()-t1)});
   // Vertical touch scroll on Nearby must remain native (tab stays Nearby).
   const nb=await scrollerPoint(page,".nb-scroll");
   assert.ok(nb,"Nearby scroll fixture missing");
   await swipe(cdp,nb.x,nb.y,0,-Math.min(168,nb.height*.38));
   await delay(140);
   const nearbyTop=await page.locator(".nb-scroll").evaluate(el=>el.scrollTop);
   assert.ok(nearbyTop>1,"Nearby vertical touch did not scroll");
   assert.equal(await tabs.nth(2).getAttribute("aria-selected"),"true",
    "vertical Nearby scroll switched tabs");
   samples.push({screen:width,repeat,scenario:"nearby-vertical-native",scrollTop:Math.round(nearbyTop)});
   // Swiping right on a Nearby *photo card* must switch back to ForYou.
   // Earlier code excluded every .nb-card at pointerdown.
   const photo=page.locator(".nb-photo").first();
   await photo.scrollIntoViewIfNeeded();
   const rect=await photo.boundingBox();
   assert.ok(rect&&rect.width>30&&rect.height>30,"Nearby photo card absent");
   const startX=Math.round(rect.x+Math.min(23,rect.width*.14));
   const startY=Math.round(rect.y+rect.height*.48);
   await swipe(cdp,startX,startY,width*.47,0);
   await active(page,1);
   samples.push({screen:width,repeat,scenario:"nearby-photo-right"});
   // Native vertical scrolling in ForYou must still work, without navigating.
   await page.locator(".fy-scroll").evaluate(el=>{el.scrollTop=0;});
   const fy=await scrollerPoint(page,".fy-scroll");
   assert.ok(fy,"ForYou scroll fixture missing");
   await swipe(cdp,fy.x,fy.y,0,-Math.min(155,fy.height*.3));
   await delay(140);
   const fyTop=await page.locator(".fy-scroll").evaluate(el=>el.scrollTop);
   assert.ok(fyTop>1,"ForYou native vertical scroll did not advance");
   assert.equal(await tabs.nth(1).getAttribute("aria-selected"),"true",
    "vertical ForYou scroll switched tabs");
   samples.push({screen:width,repeat,scenario:"for-you-vertical-native",scrollTop:Math.round(fyTop)});
   // Taps on top tabs must keep responding after each touch gesture.
   await tabs.nth(2).click();await active(page,2);
   await tabs.nth(1).click();await active(page,1);
  }
  assert.deepEqual(errors,[],"browser exceptions on "+width);
  await context.close();
 }
 console.log("LUEMI_BROWSE_TOUCH_MATRIX_PASS "+JSON.stringify({scenarios:samples.length,samples}));
} catch(err){
 console.error("LUEMI_BROWSE_TOUCH_MATRIX_FAIL "+(err?.stack||String(err)));
 process.exitCode=1;
} finally { await browser.close(); }
