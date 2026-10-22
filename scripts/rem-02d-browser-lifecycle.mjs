import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"});
const page=await context.newPage(),errors=[];
page.on("pageerror",e=>errors.push(e.message));
const BASE=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const near=(x,y,tol=1)=>assert.ok(Math.abs(x-y)<=tol,`REM02D unexpected physical pixel ${x} vs ${y}`);
const pass=text=>console.log("REM02D_BROWSER_PASS "+text);
const visitor=()=>page.locator(".discovery-visitor-route");
const photo=()=>visitor().locator(".pm-inline");
const translation=()=>visitor().evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
const open=async()=>{
 await page.getByRole("button",{name:/Открыть демо-профиль/}).first().click();
 await visitor().waitFor({state:"visible"});
};
const point=async()=>{
 const b=await visitor().locator(".pm-identity").boundingBox();
 assert.ok(b&&b.width>150&&b.height>25);
 return {x:b.x+Math.min(48,b.width*.2),y:b.y+Math.min(45,b.height*.46)};
};
const routeDrag=async(dx,{hold=200,cancel=false,lost=false}={})=>{
 const p=await point();
 await page.mouse.move(p.x,p.y);await page.mouse.down();
 await page.mouse.move(p.x+dx,p.y,{steps:7});
 await sleep(hold);
 if(lost)await visitor().evaluate(el=>el.dispatchEvent(
  new PointerEvent("lostpointercapture",{bubbles:true,pointerId:1,pointerType:"mouse",isPrimary:true})
 ));
 else if(cancel)await visitor().evaluate(el=>el.dispatchEvent(
  new PointerEvent("pointercancel",{bubbles:true,pointerId:1,pointerType:"mouse",isPrimary:true})
 ));
 await page.mouse.up();
};
const sheetEndpoint=async()=>photo().evaluate(root=>{
 const view=root.querySelector(".pm-sheet-viewport"),panel=root.querySelector(".pm-profile-sheet");
 const top=parseFloat(panel.style.getPropertyValue("--pm-collapsed-top"));
 const bottom=parseFloat(root.style.getPropertyValue("--pm-expanded-y"));
 return {y:bottom-view.scrollTop,top,bottom,state:root.dataset.sheetState};
});
const settleSheet=async()=>{
 await sleep(430);
 const snap=await sheetEndpoint();
 assert.ok(snap.state==="collapsed"||snap.state==="expanded");
 near(snap.y,snap.state==="collapsed"?snap.top:snap.bottom,1);
};
const tabEndpoint=async(name)=>{
 await sleep(370);
 const tabs=visitor().getByRole("tab");
 const selected=visitor().getByRole("tab",{name,exact:true});
 assert.equal(await selected.getAttribute("aria-selected"),"true");
 const index=await tabs.evaluateAll((all,label)=>all.findIndex(el=>el.textContent?.trim()===label),name);
 assert.ok(index>=0);
 const state=await visitor().locator(".pm-pages").evaluate(el=>({left:el.scrollLeft,width:el.clientWidth}));
 near(state.left,index*state.width,1);
};
const setBackground=async(value)=>{
 await page.evaluate(hidden=>{
  if(!("__rem02dVisibility" in window)){
   window.__rem02dVisibility=false;
   Object.defineProperty(document,"visibilityState",{
    configurable:true,get(){return window.__rem02dVisibility?"hidden":"visible";}
   });
  }
  window.__rem02dVisibility=hidden;
  document.dispatchEvent(new Event("visibilitychange"));
 },value);
};
try{
 await page.goto(BASE+"/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Знакомства",exact:true}).click();
 await page.getByRole("tab",{name:"Для тебя",exact:true}).click();
 await open();await sleep(390);
 near(await translation(),0,1);
 // Child sheet is settling when route claims; abort the back swipe and
 // verify the previously requested child destination still reaches its endpoint.
 await visitor().getByRole("button",{name:"Развернуть анкету"}).click();
 await sleep(95);
 await routeDrag(47,{hold:225});
 const early=await visitor().evaluate(el=>({
  x:new DOMMatrixReadOnly(getComputedStyle(el).transform).m41,
  width:el.clientWidth,transform:getComputedStyle(el).transform
 }));
 console.log("REM02D_DIAG_FIRST_ROLLBACK",JSON.stringify(early));
 await sleep(410);
 assert.equal(await visitor().count(),1,"route must not close for below-threshold release");
 near(await translation(),0,1);
 await sleep(380);
 assert.equal(await visitor().count(),1,"no delayed stale route exit after rollback");
 await settleSheet();
 pass("sheet settling -> route claim -> rollback restores exact child endpoint");
 // After collapse, the tab page can be settling independently: restore its
 // original semantic selection and physical scroll coordinate.
 await visitor().getByRole("tab",{name:"Фото",exact:true}).click();
 await sleep(90);
 await routeDrag(47,{hold:220});
 await sleep(390);
 near(await translation(),0,1);
 await tabEndpoint("Фото");
 pass("tabs settling -> route claim -> rollback retains selected tab and ≤1 CSS px");
 // No double semantic commit when two cancellation events arrive.
 await routeDrag(62,{hold:35,cancel:true});
 await sleep(310);near(await translation(),0,1);
 await routeDrag(63,{hold:35,lost:true});
 await sleep(310);near(await translation(),0,1);
 pass("pointercancel and lostpointercapture are idempotent and restore route");
 // Browser/Telegram simulated background while route drag is in progress.
 const p=await point();
 await page.mouse.move(p.x,p.y);await page.mouse.down();
 await page.mouse.move(p.x+73,p.y,{steps:6});
 await setBackground(true);
 await page.setViewportSize({width:393,height:725});
 await sleep(100);
 await setBackground(false);
 await page.mouse.up();await sleep(450);
 near(await translation(),0,1);
 await settleSheet();await tabEndpoint("Фото");
 pass("background while dragging, viewport height change, resume and child geometry converge");
 // Background a child sheet settle without route claim.
 await visitor().getByRole("button",{name:"Потянуть панель вниз"}).click();
 await sleep(75);
 await setBackground(true);await sleep(120);await setBackground(false);
 await settleSheet();
 pass("background while sheet settling preserves target and resumes one child animation");
 // Route back successful close, then immediate reopen proves no stale cleanup callback.
 await routeDrag(180,{hold:20});
 await sleep(420);assert.equal(await visitor().count(),0);
 await open();await sleep(390);
 near(await translation(),0,1);
 pass("successful route close, single terminal commit, immediate reopen");
 // System back during a normal open must travel RIGHT from current CSS matrix.
 await page.keyboard.press("Escape");await sleep(440);
 assert.equal(await visitor().count(),0);
 await open();
 await page.keyboard.press("Escape");
 await sleep(40);
 if(await visitor().count())assert.ok((await translation())>=0);
 await sleep(450);assert.equal(await visitor().count(),0);
 pass("Telegram/keyboard Back and back during route entrance close to right without replay");
 // Closing while suspended: old timers cannot call exit a second time.
 await open();await sleep(360);
 await page.keyboard.press("Escape");await sleep(65);
 await setBackground(true);await page.setViewportSize({width:393,height:812});
 await sleep(110);await setBackground(false);
 await sleep(440);assert.equal(await visitor().count(),0);
 pass("background while route closing, viewport revision, no stale timer resurrection");
 // Entrance interrupted by background: finish opening once, no extra exit.
 await open();await setBackground(true);
 await sleep(80);await setBackground(false);await sleep(360);
 near(await translation(),0,1);
 assert.equal(await visitor().count(),1);
 pass("background while opening, foreground reaches stable visible endpoint");
 // Trigger React rerender with theme; route and child states must remain stable.
 await page.getByRole("button",{name:"Тёмная тема"}).click();await sleep(90);
 near(await translation(),0,1);
 await page.keyboard.press("Escape");await sleep(410);
 assert.equal(await visitor().count(),0);
 pass("React rerender, teardown with pending callbacks and complete remount");
 assert.deepEqual(errors,[],"no browser exceptions");
 console.log("REM-02D BROWSER ROUTE/LIFECYCLE QA PASS · Chromium only, A55/iOS NOT VERIFIED");
}finally{await context.close();await browser.close();}
