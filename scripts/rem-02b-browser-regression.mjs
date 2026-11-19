import assert from "node:assert/strict";
import {chromium} from "playwright";

/** Responsive premium photo profile QA on synthetic Chromium (not a physical Telegram WebView). */
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({
 viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"
});
const page=await context.newPage(),errors=[];
page.on("pageerror",err=>errors.push(err.message));
const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const root=page.locator(".owner-premium-profile");
const scroll=page.locator(".owner-premium-profile .owner-profile-scroll");
const measure=()=>page.evaluate(()=>{
 const host=document.querySelector(".owner-premium-profile");
 if(!host)throw Error("Premium profile is missing");
 const mask=host.querySelector(".owner-profile-photo-mask");
 const tabs=host.querySelector(".owner-profile-tabs");
 const avatar=host.querySelector(".owner-profile-compact-identity");
 if(!mask||!tabs||!avatar)throw Error("Premium photo profile geometry incomplete");
 const face=mask.getBoundingClientRect(),strip=tabs.getBoundingClientRect();
 const panel=host.getBoundingClientRect();
 return {mode:host.dataset.morphState,photo:{
  x:face.x-panel.x,y:face.y-panel.y,width:face.width,height:face.height
 },tabTop:strip.top-panel.top,tabHeight:strip.height,avatarTop:avatar.getBoundingClientRect().top-panel.top,
  tabLabels:[...tabs.querySelectorAll('[role="tab"]')].map(node=>node.textContent?.trim()),
  progress:getComputedStyle(host).getPropertyValue("--owner-morph-progress")};
});
try{
 await page.goto(base+"/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.locator(".discovery-bottom-nav button").filter({hasText:"Профиль"}).click();
 await root.waitFor({state:"visible",timeout:7000});
 assert.deepEqual((await measure()).tabLabels,["О себе","Фото","Блики","Подарки"]);
 assert.equal(await root.locator(".owner-profile-brand img").count(),1,"original LUEMI wordmark");
 for(const height of [852,722,648,782]){
  await page.setViewportSize({width:393,height});
  await scroll.evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new Event("scroll"));});
  await page.waitForFunction(()=>document.querySelector(".owner-premium-profile")?.dataset.morphState==="expanded");
  const full=await measure();
  assert(full.photo.y<1.5&&Math.abs(full.photo.width-full.photo.height)<1.5,
   "expanded photo stays full-bleed and square at "+height);
  assert(full.photo.width>380,"expanded picture occupies width at "+height);
  assert(Math.abs(full.tabTop-(full.photo.y+full.photo.height-22))<1.5,
   "rounded sheet overlaps the expanded square photo by 22px at "+height);
  // Mid-morph the expanded city line must still clear the rising panel.
  const handoff=await scroll.evaluate(async el=>{
   const host=el.closest(".owner-premium-profile");
   const d=Number.parseFloat(getComputedStyle(host).getPropertyValue("--owner-morph-distance"));
   el.scrollTop=d*.42;el.dispatchEvent(new Event("scroll"));
   await new Promise(resolve=>requestAnimationFrame(resolve));
   const city=host.querySelector(".owner-profile-expanded-identity p");
   const tabs=host.querySelector(".owner-profile-tabs");
   return {cityBottom:city.getBoundingClientRect().bottom,tabTop:tabs.getBoundingClientRect().top};
  });
  assert(handoff.cityBottom<=handoff.tabTop+1.5,
   "city label cannot disappear behind the sheet at mid morph "+height);
  await scroll.evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event("scroll"));});
  await page.waitForFunction(()=>document.querySelector(".owner-premium-profile")?.dataset.morphState==="compact");
  const compact=await measure();
  assert(Math.abs(compact.photo.width-compact.photo.height)<1.5,
   "avatar is square at "+height);
  assert(Math.abs(compact.photo.x+compact.photo.width/2-393/2)<1.5,
   "avatar is centered at "+height);
  assert(compact.tabTop>compact.photo.y+compact.photo.height+35,
   "pinned tab strip clears circular avatar at "+height);
  assert(compact.tabHeight>40,"tabs stay tappable at "+height);
  console.log("PREMIUM_PROFILE_RESIZE_PASS "+height);
 }
 await page.setViewportSize({width:393,height:852});
 for(const label of ["О себе","Фото","Блики","Подарки"]){
  const tab=root.getByRole("tab",{name:label,exact:true});
  await tab.click();
  assert.equal(await tab.getAttribute("aria-selected"),"true","selected tab "+label);
 }
 assert.deepEqual(errors,[],"no runtime exceptions in owner geometry QA");
 console.log("REM-02B PREMIUM PROFILE GEOMETRY PASS; physical Samsung A55 not verified");
}finally{await context.close();await browser.close();}
