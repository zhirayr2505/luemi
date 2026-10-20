import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try{
 const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 const swipe=async(x,y,dy)=>{
  const cdp=await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
  for(let n=1;n<=12;n++){
   await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x,y:y+dy*n/12}]});
   await new Promise(r=>setTimeout(r,10));
  }
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await cdp.detach();await page.waitForTimeout(460);
 };
 const snap=async(label)=>{
  const jpeg=await page.screenshot({type:"jpeg",quality:62,path:`stage03g4-${label}.jpg`});
  console.log("QA_SNAPSHOT_"+label.toUpperCase()+"="+jpeg.toString("base64"));
 };
 const state=()=>page.evaluate(()=>{
  const root=document.querySelector(".pm-shell:not(.pm-shell .pm-shell)");
  const sheet=root?.querySelector(".pm-profile-sheet"),hero=root?.querySelector(".pm-hero");
  const avatar=root?.querySelector(".pm-mini-avatar"),page=root?.querySelector(".pm-tab.active");
  return {mode:root?.getAttribute("data-sheet-state"),heroTop:hero?.getBoundingClientRect().top,
   heroBottom:hero?.getBoundingClientRect().bottom,sheetTop:sheet?.getBoundingClientRect().top,
   logoTop:document.querySelector(".lh-island")?.getBoundingClientRect().top,
   avatarOpacity:avatar?+getComputedStyle(avatar).opacity:0,activeTab:page?.textContent?.trim(),
   identityY:root?.querySelector(".pm-identity")?.getBoundingClientRect().top,
   tabsY:root?.querySelector(".pm-tabs")?.getBoundingClientRect().top};
 });
 await page.goto("http://127.0.0.1:5173/profile-qa.html",{waitUntil:"networkidle",timeout:30000});
 await page.getByRole("button",{name:"Профиль",exact:true}).click();
 await page.locator(".pm-hero img").first().waitFor();
 await page.waitForTimeout(470);
 let x=await state();
 console.log("QA_INITIAL "+JSON.stringify(x));
 assert.equal(x.mode,"expanded");assert.ok(x.heroTop<=2);
 assert.ok(Math.abs(x.sheetTop-x.heroBottom+43)<11,"hero and sheet should overlap by 43px");
 assert.ok(x.logoTop<70,"logo stays near native top");
 assert.equal(await page.locator(".lh-profile-info,.lh-droplet").count(),0,"remove old duplicate identity and liquid crop");
 await snap("expanded");
 await page.getByRole("button",{name:"Развернуть анкету"}).click();
 await page.waitForTimeout(470);
 x=await state();assert.equal(x.mode,"collapsed");
 assert.ok(x.sheetTop<2,"sheet fills screen");assert.ok(x.avatarOpacity>.9,"avatar fades in next to name");
 const pin={identity:x.identityY,tabs:x.tabsY};
 await snap("collapsed");
 await page.getByRole("tab",{name:"Подарки"}).click();
 await page.waitForTimeout(350);
 const moved=await page.evaluate(()=>{
  const pane=document.querySelector(".pm-page:nth-child(4)");
  pane.scrollTop=200;
  return {scroll:pane.scrollTop};
 });
 assert.ok(moved.scroll>20,"tab content must scroll on its own");
 x=await state();
 assert.ok(Math.abs(x.identityY-pin.identity)<2&&Math.abs(x.tabsY-pin.tabs)<2,
  "identity and tabs stay pinned during content scroll");
 await snap("tab-scroll");
 // Return tab content to its top. The NEXT separate swipe reveals the photo.
 await page.evaluate(()=>{document.querySelector(".pm-page:nth-child(4)").scrollTop=0});
 await swipe(195,630,145);
 x=await state();assert.equal(x.mode,"expanded","downward swipe at tab top reopens photo");
 await snap("reopened");
 await page.locator(".pm-photo-slide").first().click();
 await page.getByRole("dialog",{name:"Просмотр фото"}).waitFor();
 await page.getByRole("button",{name:"Закрыть просмотр"}).click();
 await page.getByRole("dialog",{name:"Просмотр фото"}).waitFor({state:"hidden",timeout:3000});
 await swipe(200,650,-170);
 x=await state();assert.equal(x.mode,"collapsed","upward swipe collapses sheet");
 await page.getByRole("button",{name:"Раскрыть фото профиля"}).click();
 await page.waitForTimeout(430);
 x=await state();assert.equal(x.mode,"expanded","avatar tap expands profile");
 await page.getByRole("button",{name:"Тёмная тема"}).click();
 assert.equal(await page.locator(".luemi-shell").getAttribute("data-theme"),"dark");
 await page.setViewportSize({width:360,height:780});
 await page.waitForTimeout(130);
 x=await state();assert.ok(x.heroTop<=2);
 await snap("narrow-dark");
 await page.getByRole("button",{name:"Знакомства",exact:true}).click();
 await page.getByRole("tab",{name:"Для тебя"}).click();
 await page.getByRole("button",{name:/Открыть демо-профиль/}).first().click();
 x=await state();assert.ok(x.heroTop<=2&&x.logoTop<70);
 await page.getByRole("button",{name:"Развернуть анкету"}).click();
 await page.waitForTimeout(460);
 x=await state();assert.equal(x.mode,"collapsed");
 await page.getByRole("button",{name:"Раскрыть фото профиля"}).click();
 await page.waitForTimeout(460);
 x=await state();assert.equal(x.mode,"expanded");
 await snap("visitor");
 assert.deepEqual(errors,[],"no JS runtime exceptions");
 console.log("PASS Stage03G4 real React Chromium two-layer swipe/scroll/avatar/viewer/visitor");
}finally{await browser.close();}
