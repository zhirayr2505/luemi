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
  const jpeg=await page.screenshot({type:"jpeg",quality:62,path:`stage03g6-${label}.jpg`});
  console.log("QA_SNAPSHOT_"+label.toUpperCase()+"="+jpeg.toString("base64"));
 };
 const state=()=>page.evaluate(()=>{
  const root=document.querySelector(".pm-dialog")||document.querySelector(".pm-inline");
  const sheet=root?.querySelector(".pm-profile-sheet"),hero=root?.querySelector(".pm-hero");
  const avatar=root?.querySelector(".pm-mini-avatar"),page=root?.querySelector(".pm-tab.active");
  return {mode:root?.getAttribute("data-sheet-state"),heroTop:hero?.getBoundingClientRect().top,
   heroBottom:hero?.getBoundingClientRect().bottom,sheetTop:sheet?.getBoundingClientRect().top,
   logoTop:document.querySelector(".lh-island")?.getBoundingClientRect().top,
   avatarOpacity:avatar?+getComputedStyle(avatar).opacity:0,activeTab:page?.textContent?.trim(),
   nameTop:root?.querySelector(".pm-identity h2")?.getBoundingClientRect().top,
   logoBottom:document.querySelector(".lh-island img:not(.lh-logo-contrast)")?.getBoundingClientRect().bottom,
   logoHeight:document.querySelector(".lh-island img:not(.lh-logo-contrast)")?.getBoundingClientRect().height,
   blur:parseFloat(getComputedStyle(root?.querySelector(".pm-photo-blur")).opacity),
   contrast:parseFloat(getComputedStyle(document.querySelector(".lh-logo-contrast")).opacity),
   avatarWidth:avatar?.getBoundingClientRect().width,
   sheetRadius:getComputedStyle(sheet).borderTopLeftRadius,
   activeTabDirection:getComputedStyle(page).flexDirection,
   activeTabBackground:getComputedStyle(page).backgroundColor,
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
 assert.ok(x.blur<.02&&x.contrast<.02,"expanded portrait has no blur or enhanced shadow");
 assert.ok(Math.abs(x.sheetTop-x.heroBottom+43)<11,"hero and sheet should overlap by 43px");
 assert.ok(x.logoTop<70,"logo stays near native top");
 assert.equal(await page.locator(".lh-profile-info,.lh-droplet").count(),0,"remove old duplicate identity and liquid crop");
 await snap("expanded");
 // Capture real intermediate frames while the finger is still on the glass.
 // The blur, logo contrast and sheet must all respond on the SAME frame.
 const cdp=await page.context().newCDPSession(page);
 await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:190,y:706}]});
 const captured=[];
 for(const [fraction,dy] of [[.25,-98],[.5,-194],[.75,-291]]){
  const segments=5;
  const from=captured.length?[-98,-194,-291][captured.length-1]:0;
  for(let k=1;k<=segments;k++){
   const next=from+(dy-from)*k/segments;
   await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:190,y:706+next}]});
   await page.waitForTimeout(8);
  }
  const mid=await state();
  captured.push(mid);
  assert.ok(mid.blur>.1&&mid.blur<.9,"intermediate blur is continuous");
  assert.ok(mid.contrast>.07&&mid.contrast<.85,"logo shadow develops with the sheet");
  assert.ok(Math.abs(mid.blur/.9-mid.contrast/.83)<.045,"photo blur and logo shadow share one progress");
  await snap("motion-"+Math.round(fraction*100));
 }
 await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
 await cdp.detach();
 await page.waitForTimeout(460);
 x=await state();assert.equal(x.mode,"collapsed");
 assert.ok(Math.abs(x.sheetTop-(x.logoBottom-x.logoHeight*.11))<8,"sheet overlaps bottom of W06 wordmark by 10-12%");
 assert.ok(x.nameTop>x.logoBottom+18,"profile name stays beneath the wordmark and system header");
 assert.ok(x.blur>.75&&x.contrast>.68,"portrait blur and logo contrast are visible at rest");
 assert.ok(x.sheetRadius!=="0px","upper sheet corners remain rounded");
 assert.equal(x.activeTabDirection,"row","tabs place icon beside title");
 assert.equal(x.activeTabBackground,"rgba(0, 0, 0, 0)","active tab has NO filled rectangular card");
 assert.equal(x.avatarWidth,64,"large avatar is 64 CSS pixels");
 assert.ok(x.avatarOpacity>.9,"round avatar fades in beside name");
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
 // On a purely VERTICAL native tab scroll the horizontal page rail and
 // underline must not receive any transform/style mutation: WebView square
 // flashes commonly come from resetting these compositor layers mid-scroll.
 await page.evaluate(()=>{
  const track=document.querySelector(".pm-pages-track");
  const ink=document.querySelector(".pm-tab-ink");
  window.__luemiFlickerAudit={track,ink,countTrack:0,countInk:0};
  const obs=new MutationObserver(entries=>{
   for(const e of entries){
    if(e.attributeName!=="style")continue;
    if(e.target===track)window.__luemiFlickerAudit.countTrack++;
    if(e.target===ink)window.__luemiFlickerAudit.countInk++;
   }
  });
  obs.observe(track,{attributes:true,attributeFilter:["style"]});
  obs.observe(ink,{attributes:true,attributeFilter:["style"]});
  window.__luemiFlickerAudit.observer=obs;
 });
 await swipe(195,580,-70);
 const mutations=await page.evaluate(()=>{
  const a=window.__luemiFlickerAudit;a.observer.disconnect();
  return {track:a.countTrack,underline:a.countInk};
 });
 assert.equal(mutations.track,0,"vertical scroll must never repaint horizontal track style");
 assert.equal(mutations.underline,0,"vertical scroll must never repaint horizontal tab underline");
 console.log("QA_SCROLL_LAYER_MUTATIONS "+JSON.stringify(mutations));
 await snap("tab-scroll");
 // A swipe started while tab content is scrolled must NOT expand the sheet,
 // even if that swipe returns the content to the top.
 await page.evaluate(()=>{document.querySelector(".pm-page:nth-child(4)").scrollTop=100});
 await swipe(195,610,150);
 x=await state();assert.equal(x.mode,"collapsed","first downward swipe scrolls content, not the sheet");
 const returned=await page.evaluate(()=>document.querySelector(".pm-page:nth-child(4)").scrollTop);
 assert.ok(returned<100,"native tab scroller moves towards top before the next gesture");
 // Only a separate new gesture may bring back the large profile photograph.
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
 const indicators=await page.evaluate(()=>{
  const holder=document.querySelector(".pm-dialog .pm-photo-progress");
  if(!holder)return {count:0,top:0};
  return {count:holder.querySelectorAll("button").length,
    top:holder.getBoundingClientRect().top,
    active:holder.querySelectorAll("button.active").length,
    style:getComputedStyle(holder.querySelector("button")).backgroundColor};
 });
 assert.ok(indicators.count>=2&&indicators.count<=6,"photo dots are available when there are multiple photos");
 assert.equal(indicators.active,1,"exactly one active capsule indicator");
 assert.ok(indicators.top>=x.logoBottom,"dots sit UNDER the unboxed LUEMI wordmark");
 await snap("visitor");
 assert.deepEqual(errors,[],"no JS runtime exceptions");
 console.log("PASS Stage03G6: synced blur/logo, safe sheet geometry, tabs, photo dots, and gesture regression");
}finally{await browser.close();}
