import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {chromium} from "playwright";
import {setPremiumProfileState} from "./premium-profile-browser-input.mjs";

/** Premium Photo Profile visual smoke with real Chromium screenshots.
 * Static compositor checks cannot certify physical Telegram A55 GPU behavior. */
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"});
const page=await context.newPage(),errors=[],records=[];
page.on("pageerror",e=>errors.push(e.message));
const dir="qa-artifacts/rem-04b/after";mkdirSync(dir,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const own=()=>page.locator('.owner-premium-profile[data-mode="owner"]');
const visitor=()=>page.locator('.discovery-visitor-route .owner-premium-profile[data-mode="visitor"]');
const read=host=>host.evaluate(node=>{
 const bounds=element=>{const r=element?.getBoundingClientRect();return r?{
  x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}:null;};
 const photo=node.querySelector(".owner-profile-photo-mask");
 const visiblePhoto=node.dataset.morphState==="compact"?node.querySelector(".owner-profile-avatar-circle"):photo;
 const tabs=node.querySelector(".owner-profile-tabs");
 const logo=node.querySelector(".owner-profile-brand img");
 const body=node.querySelector(".owner-profile-content");
 const actions=node.querySelector(".owner-profile-actions");
 const city=node.querySelector(".owner-profile-identity p");
 const avatar=visiblePhoto?getComputedStyle(visiblePhoto):null;
 return {state:node.dataset.morphState,mode:node.dataset.mode,
  isolated:getComputedStyle(node).isolation,
  bg:getComputedStyle(node).backgroundColor,
  cover:bounds(visiblePhoto),radius:parseFloat(avatar?.borderRadius||"0"),
  tabs:bounds(tabs),logo:bounds(logo),content:bounds(body),
  city:bounds(city),actions:bounds(actions),
  selected:node.querySelector('.owner-profile-tabs [aria-selected="true"]')?.textContent?.trim(),
  photoId:photo?.querySelector("img[data-slot=current]")?.dataset.photoId??null,
  photoCount:node.querySelectorAll(".owner-profile-photo-tile").length,
  dots:node.querySelectorAll(".owner-profile-photo-pager button").length};
});
const snap=async(host,label)=>{
 const data=await read(host);
 records.push({label,...data});
 await page.screenshot({path:dir+"/"+String(records.length).padStart(2,"0")+"-"+label+".png"});
 assert.equal(data.isolated,"isolate","profile compositing remains isolated");
 assert.ok(data.bg!=="rgba(0, 0, 0, 0)"&&data.cover&&data.logo,
  "real opaque profile backing, hero and original brand are mounted");
 console.log("PREMIUM_PROFILE_VISUAL "+JSON.stringify({label,state:data.state,
  cover:data.cover}));
 return data;
};

try{
 await page.goto((process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173")+
  "/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.locator(".discovery-bottom-nav button").filter({hasText:"Профиль"}).click();
 await own().waitFor({state:"visible",timeout:6500});
 const first=await snap(own(),"owner-expanded");
 assert.equal(first.state,"expanded");
 assert.ok(first.cover.y<1.5&&Math.abs(first.cover.width-first.cover.height)<1.5,
  "photo is a full-bleed square behind native Telegram chrome");
 assert.ok(first.city?.bottom<first.actions?.y-4,
  "expanded name and photo action row never overlap");
 assert.ok(first.logo?.y<first.actions.y,"white wordmark sits above controls");

 const firstImage=await own().locator(".owner-profile-photo-mask img[data-slot=current]").elementHandle();
 await setPremiumProfileState(page,own(),"compact");
 const compact=await snap(own(),"owner-compact");
 assert.ok(compact.cover.width>=94&&compact.cover.width<=112&&Math.abs(compact.cover.width-compact.cover.height)<1.5);
 assert.ok(compact.cover.y>=compact.logo.bottom+8,"the single compact photo clears the original logo");
 assert.ok(compact.tabs?.y>compact.cover.bottom+35,"tabs sit below avatar and name");
 assert.ok(compact.tabs?.y+compact.tabs.height<530,"tabs remain pinned in compact header");
 assert(await own().locator(".owner-profile-photo-mask img[data-slot=current]").evaluate((node,original)=>node===original,firstImage),
  "one persistent foreground image is preserved throughout the morph");

 assert(await own().locator(".owner-profile-scroll").evaluate(list=>list.scrollTop>0),
  "the long collapse swipe passes its remaining distance to the cards");
 await setPremiumProfileState(page,own(),"expanded");
 const reversed=await snap(own(),"owner-reversed");
 assert.ok(Math.abs(reversed.cover.width-first.cover.width)<2);
 await own().locator(".owner-profile-photo-pager button").nth(1).click();
 await page.waitForFunction(()=>document.querySelector('.owner-premium-profile[data-mode="owner"] .owner-profile-photo-pager button:nth-child(2)')?.getAttribute("aria-current")==="true");
 const photo2=await snap(own(),"owner-photo-two");
 assert.equal(photo2.photoId,await own().locator(".owner-profile-photo-tile img").nth(1).getAttribute("data-photo-id"));

 const nav=page.locator(".discovery-bottom-nav button").filter({hasText:"Знакомства"});
 await nav.click();
 await page.getByRole("tab",{name:"Для тебя",exact:true}).click();
 const feedScroll=page.locator(".fy-scroll");
 await feedScroll.evaluate(node=>{node.scrollTop=125;});
 const scrollPosition=await feedScroll.evaluate(node=>node.scrollTop);
 await page.locator(".fy-tile-photo").first().click();
 await visitor().waitFor({state:"visible",timeout:6500});await sleep(330);
 const guest=await snap(visitor(),"visitor-expanded");
 assert.equal(guest.state,"expanded");
 assert.equal(await visitor().locator(".owner-profile-actions button").count(),0,"visitor cannot edit profile");
 assert.equal(await page.locator(".discovery-app").getAttribute("data-profile-overlay"),"true");
 await visitor().locator(".owner-profile-photo-mask").click();
 await page.locator(".pm-viewer").waitFor({state:"visible",timeout:4000});
 await page.keyboard.press("Escape");
 await page.locator(".pm-viewer").waitFor({state:"detached",timeout:4000});
 await snap(visitor(),"visitor-viewer-return");
 await setPremiumProfileState(page,visitor(),"compact");
 await snap(visitor(),"visitor-compact");
 await page.keyboard.press("Escape");
 await page.locator(".discovery-visitor-route").waitFor({state:"detached",timeout:4500});
 assert.equal(await page.locator(".discovery-app").getAttribute("data-profile-overlay"),"false");
 assert.ok(Math.abs((await feedScroll.evaluate(node=>node.scrollTop))-scrollPosition)<2,
  "returning from visitor keeps the underlying feed scroll position");
 assert.deepEqual(errors,[],"no uncaught Chromium profile errors");
 writeFileSync(dir+"/premium-measurements.json",JSON.stringify({records,errors},null,2));
 console.log("REM-04B PREMIUM VISUAL QA PASS; physical A55 compositor not verified");
}finally{await context.close();await browser.close();}
