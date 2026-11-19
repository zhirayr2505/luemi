import assert from "node:assert/strict";
import {chromium} from "playwright";

/** Current shared Premium Photo Profile lifecycle in Android Chromium emulation.
 * A physical Telegram Galaxy A55 or WKWebView is not certified by this test. */
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({
 viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"
});
const page=await context.newPage();
const errors=[];page.on("pageerror",error=>errors.push(error.message));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const route=()=>page.locator(".discovery-visitor-route");
const profile=()=>route().locator(".owner-premium-profile");
const photo=()=>profile().locator(".owner-profile-photo-mask");
const scroll=()=>profile().locator(".owner-profile-scroll");
const currentTab=()=>profile().locator('.owner-profile-tabs [role="tab"][aria-selected="true"]');
const getTranslation=()=>route().evaluate(node=>new DOMMatrixReadOnly(getComputedStyle(node).transform).m41);
const near=(actual,expected,tolerance=3)=>
 assert.ok(Math.abs(actual-expected)<=tolerance,
  "premium visitor profile moved unexpectedly: "+actual+" versus "+expected);
const portrait=()=>photo().evaluate(el=>{
 const rect=el.getBoundingClientRect();
 return {state:el.closest(".owner-premium-profile")?.dataset.morphState,
  x:rect.x,y:rect.y,width:rect.width,height:rect.height,
  radius:parseFloat(getComputedStyle(el).borderRadius)};
});
const setBackground=hidden=>page.evaluate(hidden=>{
 if(!("__premiumHidden" in window)){
  window.__premiumHidden=false;
  Object.defineProperty(document,"visibilityState",{
   configurable:true,get(){return window.__premiumHidden?"hidden":"visible";}
  });
 }
 window.__premiumHidden=hidden;
 document.dispatchEvent(new Event("visibilitychange"));
},hidden);
const open=async()=>{
 await page.getByRole("button",{name:/Открыть демо-профиль/}).first().click();
 await profile().waitFor({state:"visible",timeout:6000});
 await sleep(320);
 assert.equal(await profile().getAttribute("data-morph-state"),"expanded",
  "visitor opens with a large portrait, not the retired compact V3 sheet");
 near(await getTranslation(),0);
};
const edgeSwipe=async(dx)=>{
 const x=11,y=112;
 await page.mouse.move(x,y);await page.mouse.down();
 await page.mouse.move(x+dx,y,{steps:12});
 await page.mouse.up();await sleep(360);
};

try{
 await page.goto((process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173")+
  "/profile-qa.html",{waitUntil:"domcontentloaded"});
 const nav=page.locator(".discovery-bottom-nav button").filter({hasText:"Знакомства"});
 await nav.waitFor({state:"visible",timeout:6000});await nav.click();
 await page.getByRole("tab",{name:"Для тебя",exact:true}).click();

 await open();
 const expanded=await portrait();
 assert.ok(expanded.width>330&&expanded.height>350&&expanded.y>35);
 await scroll().evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event("scroll"));});
 await page.waitForFunction(()=>document.querySelector(".discovery-visitor-route .owner-premium-profile")?.dataset.morphState==="compact");
 const compact=await portrait();
 assert.ok(compact.width<135&&Math.abs(compact.width-compact.height)<1.5&&
  compact.radius>=compact.width/2-1,"compact photo becomes a circle in safe-area coordinates");
 near(compact.x+compact.width/2,393/2,1.5);
 await profile().getByRole("tab",{name:"Фото",exact:true}).click();
 assert.equal(await currentTab().innerText(),"Фото");

 // A suspended WebView can change its viewport height before resuming.
 await setBackground(true);await sleep(80);
 await page.setViewportSize({width:393,height:765});await sleep(120);
 await setBackground(false);await sleep(320);
 const after=await portrait();
 console.log("PREMIUM_PROFILE_RESUME_DIAGNOSTIC "+JSON.stringify({after,
  scroll:await scroll().evaluate(el=>({scrollTop:el.scrollTop,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight})),
  morphDistance:await profile().evaluate(el=>getComputedStyle(el).getPropertyValue("--owner-morph-distance")),
  rootState:await profile().getAttribute("data-morph-state")}));
 assert.ok(Number.isFinite(after.y)&&Number.isFinite(after.width)&&
  after.width>60&&after.width<135,"portrait geometry remains bounded after resume");
 near(after.x+after.width/2,393/2,1.5);
 assert.equal(await currentTab().innerText(),"Фото","tab selection survives Telegram background/resume");
 near(await getTranslation(),0);
 console.log("PREMIUM_PROFILE_LIFECYCLE_PASS suspended resize, compact geometry, tab retention");

 // A short edge pull returns to the same visitor instead of dismissing it.
 await edgeSwipe(19);
 assert.equal(await route().count(),1);
 near(await getTranslation(),0);
 assert.equal(await currentTab().innerText(),"Фото");
 console.log("PREMIUM_PROFILE_LIFECYCLE_PASS interrupted route rollback");

 await page.keyboard.press("Escape");
 await route().waitFor({state:"detached",timeout:5000});
 await open();
 await scroll().evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event("scroll"));});
 await page.waitForFunction(()=>document.querySelector(".discovery-visitor-route .owner-premium-profile")?.dataset.morphState==="compact");
 await edgeSwipe(212);
 await route().waitFor({state:"detached",timeout:5000});
 await open();
 await page.keyboard.press("Escape");
 await route().waitFor({state:"detached",timeout:5000});
 assert.deepEqual(errors,[],"no uncaught browser errors across route cleanup and reopen");
 console.log("REM-02D PREMIUM PROFILE LIFECYCLE QA PASS; physical Telegram WebView not tested");
}finally{
 await context.close();await browser.close();
}
