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
 await swipe(hero.x+hero.width*.72,hero.y+hero.height*.49,-hero.width*.46,0);
 await delay(140);
 assert.equal(await root.locator(".owner-profile-photo-pager button").nth(1).getAttribute("aria-current"),
  "true","left photo swipe moves to the second photo");
 await swipe(hero.x+hero.width*.28,hero.y+hero.height*.49,hero.width*.46,0);
 await delay(140);
 assert.equal(await root.locator(".owner-profile-photo-pager button").first().getAttribute("aria-current"),
  "true","right photo swipe returns to the main photo");
 console.log("PREMIUM_PROFILE_GESTURE_PASS photo left and right");

 // The hero is floating outside the native scrollbox. A vertical photo-origin
 // swipe must advance that scrollbox 1:1 instead of being lost to the WebView.
 await swipe(hero.x+hero.width*.5,hero.y+hero.height*.58,0,-180);
 await page.waitForFunction(()=>Number.parseFloat(
  getComputedStyle(document.querySelector(".owner-premium-profile")).getPropertyValue("--owner-morph-progress"))>.25);
 assert.equal(await page.locator(".pm-viewer").count(),0,"portrait swipe never opens fullscreen photo viewer");
 await root.locator(".owner-profile-scroll").evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event("scroll"));});
 await page.waitForFunction(()=>document.querySelector(".owner-premium-profile")?.dataset.morphState==="compact");
 const avatar=await face.boundingBox();
 assert.ok(avatar&&Math.abs(avatar.width-avatar.height)<1.2,"photo becomes a round avatar");
 console.log("PREMIUM_PROFILE_GESTURE_PASS vertical photo-origin morph");

 await root.getByRole("tab",{name:"О себе",exact:true}).click();
 const pages=root.locator(".owner-profile-pages"),rect=await pages.boundingBox();
 assert.ok(rect&&rect.height>90,"tab pages remain visible");
 await swipe(rect.x+rect.width*.75,rect.y+Math.min(90,rect.height*.35),-rect.width*.48,0);
 await delay(150);
 assert.equal(await selected().innerText(),"Фото","page swipe switches to next tab");
 await root.getByRole("tab",{name:"Подарки",exact:true}).click();
 await root.getByRole("tab",{name:"Блики",exact:true}).click();
 assert.equal(await selected().innerText(),"Блики","latest tab tap wins");
 assert.equal(await selected().count(),1);
 console.log("PREMIUM_PROFILE_GESTURE_PASS tab pager and interruptions");

 assert.deepEqual(errors,[],"no browser exceptions");
 console.log("REM-02C PREMIUM PROFILE GESTURE PASS; physical A55 NOT VERIFIED");
}finally{await context.close();await browser.close();}
