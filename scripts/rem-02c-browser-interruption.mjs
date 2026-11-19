import assert from "node:assert/strict";
import {chromium} from "playwright";

/** Shared premium profile gesture smoke on synthetic Chromium Android; physical device not certified. */
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"});
const page=await context.newPage(),errors=[],base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
page.on("pageerror",e=>errors.push(e.message));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const swipe=async(x,y,dx,dy,steps=12)=>{
 const cdp=await context.newCDPSession(page);
 try{
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y,id:1}]});
  for(let n=1;n<=steps;n++){
   await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x+dx*n/steps,y:y+dy*n/steps,id:1}]});
   await delay(12);
  }
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
 }finally{await cdp.detach();}
};
const root=page.locator(".owner-premium-profile");
const selected=()=>root.locator('.owner-profile-tabs [role="tab"][aria-selected="true"]');
try{
 await page.goto(base+"/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.locator(".discovery-bottom-nav button").filter({hasText:"Профиль"}).click();
 await root.waitFor({state:"visible",timeout:7000});
 assert.equal(await root.getAttribute("data-morph-state"),"expanded");
 const face=root.locator(".owner-profile-photo-mask"),hero=await face.boundingBox();
 assert.ok(hero&&hero.width>300&&hero.height>350,"big photo begins expanded");
 assert.ok((await root.locator(".owner-profile-photo-pager button").count())>=2,"photo dots available");
 await face.evaluate(node=>{
  window.__v4PhotoGestureTrace=[];
  for(const type of ["pointerdown","pointermove","pointerup","pointercancel","lostpointercapture"]){
   node.addEventListener(type,e=>{
    if(window.__v4PhotoGestureTrace.length<50)
     window.__v4PhotoGestureTrace.push({type,x:e.clientX,y:e.clientY,pointerType:e.pointerType,isPrimary:e.isPrimary});
   },true);
  }
 });
 await swipe(hero.x+hero.width*.72,hero.y+hero.height*.49,-hero.width*.46,0);
 await delay(140);
 console.log("PROFILE_V4_PHOTO_SWIPE_DEBUG "+JSON.stringify(await root.evaluate(node=>({
  trace:window.__v4PhotoGestureTrace,
  selected:[...node.querySelectorAll(".owner-profile-photo-pager button")].map(x=>({current:x.getAttribute("aria-current"),cls:x.className})),
  photoId:node.querySelector(".owner-profile-photo-mask>img")?.getAttribute("data-photo-id"),
  morph:node.dataset.morphState
 }))));
 assert.equal(await root.locator(".owner-profile-photo-pager button").nth(1).getAttribute("aria-current"),
  "true","left photo swipe moves to the second photo");
 await swipe(hero.x+hero.width*.28,hero.y+hero.height*.49,hero.width*.46,0);
 await delay(140);
 assert.equal(await root.locator(".owner-profile-photo-pager button").first().getAttribute("aria-current"),
  "true","right photo swipe returns to the main photo");
 console.log("PREMIUM_PROFILE_GESTURE_PASS photo left and right");

 // Telegram V4.2: the spring must finish WHILE the finger is still held.
 // Deliberately do NOT dispatch touchEnd until after the state changes.
 const autoDistance=await root.evaluate(node=>Number.parseFloat(
  getComputedStyle(node).getPropertyValue("--owner-morph-distance")));
 const held=await context.newCDPSession(page);
 const finger=async(type,x,y)=>held.send("Input.dispatchTouchEvent",{
  type,touchPoints:type==="touchEnd"?[]:[{x,y,id:2}]});
 try{
  const hx=hero.x+hero.width*.5,hy=hero.y+hero.height*.58;
  await finger("touchStart",hx,hy);
  for(let n=1;n<=4;n++){await finger("touchMove",hx,hy-autoDistance*.75*n/4);await delay(18);}
  await page.waitForFunction(()=>document.querySelector(".owner-premium-profile")?.dataset.morphState==="compact",
   null,{timeout:3500});
  assert.equal(await root.getAttribute("data-morph-state"),"compact",
   "threshold auto-collapse completes before held finger is released");
  await finger("touchEnd",hx,hy-autoDistance*.75);
  await delay(80);
  const c=await root.locator(".owner-profile-avatar-circle").boundingBox();
  assert(c&&c.width>=94&&c.width<=112,"auto-compact shows the smaller true circular avatar");
  await finger("touchStart",c.x+c.width*.5,c.y+c.height*.5);
  for(let n=1;n<=4;n++){
   await finger("touchMove",c.x+c.width*.5,c.y+c.height*.5+autoDistance*.76*n/4);
   await delay(18);
  }
  await page.waitForFunction(()=>document.querySelector(".owner-premium-profile")?.dataset.morphState==="expanded",
   null,{timeout:3500});
  assert.equal(await root.getAttribute("data-morph-state"),"expanded",
   "threshold auto-expand completes while the finger remains pressed");
  await finger("touchEnd",c.x+c.width*.5,c.y+c.height*.5+autoDistance*.76);
 }finally{await held.detach();}
 console.log("PREMIUM_PROFILE_TELEGRAM_THRESHOLD_PASS auto-collapse/expand before touchEnd");


 // The hero is floating outside the native scrollbox. A vertical photo-origin
 // swipe must advance that scrollbox 1:1 instead of being lost to the WebView.
 await swipe(hero.x+hero.width*.5,hero.y+hero.height*.58,0,-180);
 await page.waitForFunction(()=>{
  const root=document.querySelector(".owner-premium-profile");
  const scroll=root?.querySelector(".owner-profile-scroll");
  if(!root||!scroll)return false;
  const distance=Number.parseFloat(getComputedStyle(root).getPropertyValue("--owner-morph-distance"));
  return distance>0&&scroll.scrollTop/distance>.25;
 });
 assert.equal(await page.locator(".pm-viewer").count(),0,"portrait swipe never opens fullscreen photo viewer");
 await root.locator(".owner-profile-scroll").evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event("scroll"));});
 await page.waitForFunction(()=>document.querySelector(".owner-premium-profile")?.dataset.morphState==="compact");
 const avatar=await root.locator(".owner-profile-avatar-circle").boundingBox();
 assert.ok(avatar&&Math.abs(avatar.width-avatar.height)<1.2,"photo becomes a round avatar");
 console.log("PREMIUM_PROFILE_GESTURE_PASS vertical photo-origin morph");

 await root.getByRole("tab",{name:"О себе",exact:true}).click();
 const pages=root.locator(".owner-profile-pages"),rect=await pages.boundingBox();
 const pinned=await root.locator(".owner-profile-tabs").boundingBox();
 assert.ok(rect&&pinned&&rect.height>90,"tab pages and pinned tabs remain visible");
 // The tab body can be scrolled underneath the opaque sticky bar; start the
 // gesture on the visible page, never at a hidden document coordinate.
 const touchY=Math.max(rect.y+Math.min(90,rect.height*.35),pinned.y+pinned.height+34);
 assert.ok(touchY<Math.min(rect.y+rect.height-24,760),
  "the page offers a usable swipe area below pinned tabs and above bottom navigation");
 const touchX=rect.x+rect.width*.75;
 assert(await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest(".owner-profile-pages"),
  {x:touchX,y:touchY}),"visible page receives horizontal gestures");
 await swipe(touchX,touchY,-rect.width*.48,0);
 await delay(150);
 assert.equal(await selected().innerText(),"Фото","page swipe switches to next tab");
 // Swipe the actual underline tab bar as well as the content panel. The
 // selected button must not steal a directional swipe as a delayed click.
 const rail=await root.locator(".owner-profile-tabs").boundingBox();
 assert.ok(rail&&rail.height>40,"tab rail stays reachable");
 await swipe(rail.x+rail.width*.62,rail.y+rail.height*.5,-rail.width*.46,0);
 await delay(150);
 assert.equal(await selected().innerText(),"Блики","tab rail swipe switches to next tab once");
 await root.getByRole("tab",{name:"Подарки",exact:true}).click();
 await root.getByRole("tab",{name:"Блики",exact:true}).click();
 assert.equal(await selected().innerText(),"Блики","latest tab tap wins");
 assert.equal(await selected().count(),1);
 console.log("PREMIUM_PROFILE_GESTURE_PASS tab pager and interruptions");

 assert.deepEqual(errors,[],"no browser exceptions");
 console.log("REM-02C PREMIUM PROFILE GESTURE PASS; physical A55 NOT VERIFIED");
}finally{await context.close();await browser.close();}
