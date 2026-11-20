import assert from "node:assert/strict";
import {chromium} from "playwright";
import {setPremiumProfileState} from "./premium-profile-browser-input.mjs";

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
async function checkAbout(profile){
 const about=profile.getByRole("tabpanel",{name:"О себе",exact:true});
 await about.locator(".owner-profile-moonrise").evaluate(image=>image.decode());
 const design=await about.evaluate(node=>{
  const quote=node.querySelector("blockquote");
  const chips=[...node.querySelectorAll(".owner-profile-interests .interest-chip")];
  return {
   quote:quote?.textContent.trim(),
   heart:quote&&getComputedStyle(quote).backgroundImage,
   goal:node.querySelector(".owner-profile-goal")?.textContent.trim(),
   count:Number(node.querySelector(".owner-profile-interest-count")?.textContent),
   chipColors:chips.map(chip=>[chip.style.getPropertyValue("--chip-from"),chip.style.getPropertyValue("--chip-to")].join("/")),
   cards:node.querySelectorAll("article").length,
   fits:node.scrollWidth<=node.clientWidth+1
  };
 });
 assert(design.quote&&design.heart?.includes("about-heart.svg"),"the bio is an open quote with warm heart art");
 assert(design.goal,"the fixture's dating goal is displayed as an inline badge");
 assert.equal(design.count,design.chipColors.length,"the badge counts rendered interest chips");
 assert(design.count>1&&new Set(design.chipColors).size>1,"interests keep their catalog colors");
 assert.equal(design.cards,0,"the About surface contains no boxed cards");
 assert(design.fits,"the moon and About content fit the screen width");
}
async function checkPager(profile){
 const viewport=profile.locator(".owner-profile-viewport");
 const pages=profile.locator(".owner-profile-pages");
 const panels=profile.locator('[role="tabpanel"]');
 const input=await context.newCDPSession(page);
 const finger=(type,x,y)=>input.send("Input.dispatchTouchEvent",{
  type,touchPoints:type==="touchEnd"?[]:[{x,y,id:1}]
 });
 try{
  for(const state of ["expanded","compact"]){
   await setPremiumProfileState(page,profile,state);
   for(const [from,to] of [[0,1],[1,2],[2,3],[3,2],[2,1],[1,0]]){
    const box=await viewport.boundingBox(),width=box.width,dir=Math.sign(to-from);
    const outgoing=panels.nth(from),incoming=panels.nth(to);
    const y=box.y+65,x=box.x+width*(dir>0?.73:.27);
    const start=await outgoing.boundingBox(),next=await incoming.boundingBox();
    assert(Math.abs(start.x-box.x)<1&&Math.abs(next.x-start.x-dir*width)<1,
     "resting neighbour is entirely beyond the screen edge");
    const scrollTop=await outgoing.evaluate(el=>el.scrollTop);
    await finger("touchStart",x,y);
    for(const fraction of [.18,.10,.52]){
     await finger("touchMove",x-dir*width*fraction,y);
     await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
     const current=await outgoing.boundingBox(),neighbour=await incoming.boundingBox();
     assert(Math.abs(current.x-start.x+dir*width*fraction)<2,`track follows input: ${state} ${from}->${to} fraction=${fraction} actual=${current.x-start.x} expected=${-dir*width*fraction}`);
     assert(Math.abs(neighbour.x-current.x-dir*width)<1&&Math.abs(neighbour.y-next.y)<1,
      "incoming page stays adjacent at the same height");
     assert.equal(await outgoing.evaluate(el=>el.scrollTop),scrollTop);
    }
    await finger("touchEnd");
    await profile.getByRole("tab").nth(to).locator("xpath=self::*[@aria-selected='true']").waitFor();
    await pages.locator("xpath=self::*[not(@data-paging)]").waitFor();
    assert(Math.abs((await incoming.boundingBox()).x-box.x)<1);
    assert(Math.abs((await incoming.boundingBox()).y-next.y)<1);
    assert.equal(await profile.getAttribute("data-morph-state"),state);
   }
  }
 }finally{await input.detach();}
}
try{
 await page.goto(base+"/profile-qa.html?profileV3=1",{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Профиль",exact:true}).click();
 const owner=page.locator(".v3-profile-host.pm-inline .owner-premium-profile");
 await owner.waitFor({state:"visible",timeout:7000});
 const scroll=owner.getByRole("tabpanel");
 const photo=owner.locator(".owner-profile-photo-mask");
 const initial=await photo.boundingBox();
 assert(initial&&initial.width>380&&Math.abs(initial.width-initial.height)<1.5&&initial.y<1.5,
  "owner opens with the approved full-width square");
 assert.equal(await owner.locator(".owner-profile-brand img").count(),1,"one original LUEMI wordmark");
 assert.deepEqual(await owner.locator(".owner-profile-tabs [role=tab]").allTextContents(),
  ["О себе","Фото","Блики","Подарки"],"one approved four-tab strip");
 assert.equal(await owner.getByRole("tabpanel").locator(".owner-profile-actions button").count(),4,"owner tools remain available");

 await checkAbout(owner);
 await checkPager(owner);
 await setPremiumProfileState(page,owner,"compact");
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
  console.log("PROFILE_V4_TAB_DEBUG "+JSON.stringify({label,tabMotion}));
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
 await setPremiumProfileState(page,owner,"expanded");

 await page.getByRole("button",{name:"Знакомства",exact:true}).click();
 await page.getByRole("tab",{name:"Для тебя",exact:true}).click();
 await page.getByRole("button",{name:/Открыть демо-профиль/}).first().click();
 const visitor=page.locator(".discovery-visitor-route .owner-premium-profile");
 await visitor.waitFor({state:"visible",timeout:5000});
 await page.waitForFunction(()=>{
  const route=document.querySelector(".discovery-visitor-route");
  return route&&Math.abs(route.getBoundingClientRect().left)<.05;
 });
 await checkAbout(visitor);
 await checkPager(visitor);
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
