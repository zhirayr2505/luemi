import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {chromium} from "playwright";
import {setPremiumProfileState} from "./premium-profile-browser-input.mjs";

const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const systemChromium=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||"/usr/bin/chromium";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"],
 ...(existsSync(systemChromium)?{executablePath:systemChromium}:{})});
const context=await browser.newContext({
 viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36"
});
const page=await context.newPage();
const errors=[];page.on("pageerror",error=>errors.push(error.message));
try{
 await page.goto(base+"/profile-qa.html?profileV3=1",{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Профиль",exact:true}).click();
 const root=page.locator(".owner-premium-profile");
 await root.waitFor({state:"visible",timeout:5000});
 const photo=root.locator(".owner-profile-photo-mask");
 const image=photo.locator("img[data-slot=current]");
 const scroll=root.locator(".owner-profile-scroll");
 const initial=await root.evaluate(node=>{
  const mask=node.querySelector(".owner-profile-photo-mask");
  const image=mask?.querySelector("img[data-slot=current]");
  if(!mask||!image)throw Error("owner photo surface missing");
  window.__ownerProfileImage=image;
  const rect=mask.getBoundingClientRect();
  return {state:node.getAttribute("data-morph-state"),rect:rect.toJSON(),photoId:image.dataset.photoId};
 });
 assert.equal(initial.state,"expanded","owner profile opens with the large photo");
 assert(initial.rect.width>380&&Math.abs(initial.rect.width-initial.rect.height)<1.5&&initial.rect.y<1.5,
  "expanded photo is a full-bleed square behind the safe Telegram chrome");

 const box=await photo.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.wheel(0,44);
 await page.waitForFunction(()=>document.querySelector(".owner-premium-profile")?.dataset.morphState==="transition");
 await page.waitForFunction(()=>document.querySelector(".owner-premium-profile")?.dataset.morphState==="expanded");
 await setPremiumProfileState(page,root,"compact");
 assert.equal(await root.getAttribute("data-morph-state"),"compact",
  "releasing inside the morph range always settles to a semantic endpoint");

 await scroll.evaluate(element=>{element.scrollTop=element.scrollHeight;});
 await page.waitForFunction(()=>document.querySelector(".owner-premium-profile")?.getAttribute("data-morph-state")==="compact");
 const compact=await root.evaluate(node=>{
  const mask=node.querySelector(".owner-profile-avatar-circle");
  const image=mask?.querySelector("img[data-slot=current]");
  const original=node.querySelector(".owner-profile-photo-mask img[data-slot=current]");
  if(!mask||!image||!original)throw Error("compact circular photo surface missing");
  const rect=mask.getBoundingClientRect();
  return {rect:rect.toJSON(),radius:getComputedStyle(mask).borderRadius,
   same:original===window.__ownerProfileImage&&image===original,
   photoId:image.dataset.photoId};
 });
 assert.equal(compact.same,true,"the compact circle uses the exact same image element as the expanded square");
 assert.equal(compact.photoId,initial.photoId,"morph cannot switch to another photo");
 assert(Math.abs((compact.rect.x+compact.rect.width/2)-393/2)<1,"compact avatar is horizontally centered");
 assert(Math.abs(compact.rect.width-compact.rect.height)<1,"compact avatar is square");
 assert((compact.radius.includes("%")?compact.rect.width*parseFloat(compact.radius)/100:parseFloat(compact.radius))>=compact.rect.width/2-1,"compact avatar is circular");
 assert(compact.rect.width>=94&&compact.rect.width<=112,"Telegram-sized avatar leaves minimal header space");
 const logo=await root.locator(".owner-profile-brand").boundingBox();
 assert(compact.rect.y>=logo.y+logo.height+8,"the compact portrait clears the wordmark");

 for(const label of ["О себе","Фото","Блики","Подарки"]){
  await root.getByRole("tab",{name:label,exact:true}).click();
  assert.equal(await root.getByRole("tab",{name:label,exact:true}).getAttribute("aria-selected"),"true");
  assert.equal(await root.getByRole("tabpanel",{name:label,exact:true}).isVisible(),true);
  assert.equal(await root.getAttribute("data-morph-state"),"compact",
   "changing tab content cannot reopen the compact avatar");
 }
 await setPremiumProfileState(page,root,"expanded");
 assert.equal(await image.evaluate(element=>element===window.__ownerProfileImage),true,
  "reverse scroll expands the same photo element without remounting");
 for(const action of ["Редактировать профиль","Посмотреть анкету глазами других","Управлять фотографиями","Настройки профиля"])
  assert.equal(await root.getByRole("button",{name:action,exact:true}).count(),1,action);
 assert.equal(await root.getByRole("button",{name:"Назад",exact:true}).count(),0,
  "no redundant inner back button in V4");
 assert.deepEqual(errors,[],"owner profile has no uncaught browser errors");
 console.log("OWNER_PREMIUM_PROFILE_BROWSER_PASS 393x852 Chromium Android emulation; physical Telegram WebView not tested");
}finally{
 await context.close();await browser.close();
}
