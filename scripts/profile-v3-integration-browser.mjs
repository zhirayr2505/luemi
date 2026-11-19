import assert from "node:assert/strict";
import {chromium} from "playwright";

/**
 * Integration of the active owner/visitor V4 profile into Discovery.
 * The V3 motion engine has its own isolated Chromium DOM test; owner and
 * visitor no longer render .v3-int-root. Browser emulation != physical A55.
 */
const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({
 viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"
});
const page=await context.newPage();
const errors=[];page.on("pageerror",e=>errors.push(e.message));
try{
 await page.goto(base+"/profile-qa.html?profileV3=1",{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Профиль",exact:true}).click();
 const owner=page.locator(".v3-profile-host.pm-inline .owner-premium-profile");
 await owner.waitFor({state:"visible",timeout:7000});
 const scroll=owner.locator(".owner-profile-scroll");
 const photo=owner.locator(".owner-profile-photo-mask");
 const initial=await photo.boundingBox();
 assert(initial&&initial.width>380&&Math.abs(initial.width-initial.height)<1.5&&initial.y<1.5,
  "owner opens with the approved full-width square");
 assert.equal(await owner.locator(".owner-profile-brand img").count(),1,"one original LUEMI wordmark");
 assert.deepEqual(await owner.locator(".owner-profile-tabs [role=tab]").allTextContents(),
  ["О себе","Фото","Блики","Подарки"],"one approved four-tab strip");
 assert.equal(await owner.locator(".owner-profile-actions button").count(),4,"owner tools remain available");

 const distance=await owner.evaluate(el=>Number.parseFloat(getComputedStyle(el).getPropertyValue("--owner-morph-distance")));
 assert(distance>40,"scroll-driven photo morph has a positive endpoint");
 await scroll.evaluate((el,d)=>{el.scrollTop=d;el.dispatchEvent(new Event("scroll"));},distance);
 await page.waitForFunction(()=>document.querySelector(".owner-premium-profile")?.dataset.morphState==="compact",
  null,{timeout:5000});
 const compact=await owner.locator(".owner-profile-avatar-circle").boundingBox();
 assert(compact&&compact.width>=94&&compact.width<=112&&Math.abs(compact.width-compact.height)<1.5,
  "square hands off directly to Telegram-sized perfectly circular avatar");
 assert(Math.abs(compact.x+compact.width/2-196.5)<2,"compact avatar remains centered");

 const tabs=["О себе","Фото","Блики","Подарки"];
 for(const label of tabs){
  const tab=owner.getByRole("tab",{name:label,exact:true});await tab.click();
  assert.equal(await tab.getAttribute("aria-selected"),"true");
  const tabMotion=await scroll.evaluate(el=>({
   position:el.scrollTop,max:el.scrollHeight-el.clientHeight,scrollHeight:el.scrollHeight,
   clientHeight:el.clientHeight,state:el.closest(".owner-premium-profile")?.dataset.morphState
  }));
  console.log("PROFILE_V4_TAB_DEBUG "+JSON.stringify({label,tabMotion,distance}));
  assert.equal(await owner.getAttribute("data-morph-state"),"compact",
   "tab changes may not expand the compact photo");
 }
 await owner.getByRole("tab",{name:"Фото",exact:true}).click();
 const gallery=owner.locator(".owner-profile-photo-tile");
 assert.equal(await gallery.count(),3,"three QA images in real owner gallery");
 await gallery.first().click();
 await page.locator(".pm-viewer").waitFor({state:"visible",timeout:4000});
 await page.keyboard.press("Escape");
 await page.locator(".pm-viewer").waitFor({state:"detached",timeout:4000});

 for(const count of [0,1,6,3]){
  await page.evaluate(count=>window.__luemiQaV3.setPhotoCount(count),count);
  await page.waitForFunction(count=>
   document.querySelectorAll(".v3-profile-host.pm-inline .owner-profile-photo-tile").length===count,
   count,{timeout:4000});
  assert.equal(await owner.locator(".owner-profile-photo-pager button").count(),count>1?count:0,
   "photo pager corresponds to permitted photos");
 }
 await scroll.evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new Event("scroll"));});
 await page.waitForFunction(()=>document.querySelector(".v3-profile-host.pm-inline .owner-premium-profile")?.dataset.morphState==="expanded",
  null,{timeout:5000});

 await page.getByRole("button",{name:"Знакомства",exact:true}).click();
 await page.getByRole("tab",{name:"Для тебя",exact:true}).click();
 await page.getByRole("button",{name:/Открыть демо-профиль/}).first().click();
 const visitor=page.locator(".discovery-visitor-route .owner-premium-profile");
 await visitor.waitFor({state:"visible",timeout:5000});
 assert.equal(await visitor.getAttribute("data-mode"),"visitor");
 assert.equal(await visitor.locator(".owner-profile-actions button").count(),0,
  "no owner actions on a visitor profile");
 assert.equal(await visitor.locator(".owner-profile-edit-top").count(),0,
  "no owner-only edit button in the visitor hero");
 assert.deepEqual(await visitor.locator(".owner-profile-tabs [role=tab]").allTextContents(),tabs);
 await page.keyboard.press("Escape");
 await visitor.waitFor({state:"detached",timeout:4000});
 assert.deepEqual(errors,[],"no unexpected browser errors across owner/visitor transitions");
 console.log("PROFILE_V4_INTEGRATION_CHROMIUM_PASS owner/visitor, square morph, four tabs, dynamic photos, PhotoViewer, permissions; physical Telegram not tested");
}finally{
 await context.close();await browser.close();
}
