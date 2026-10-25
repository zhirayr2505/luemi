import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdir,writeFile} from "node:fs/promises";
import {chromium} from "playwright";

/** REM-00C: behavioral, deterministic local QA. This is Chromium emulation, NOT physical A55/iOS evidence. */
const BASE=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const OUT=process.env.LUEMI_QA_OUT||"qa-artifacts/rem-00c";
const androidUA="Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fail=(what,e)=>{throw new Error("REM-00C "+what+": "+(e?.message??e),{cause:e});};
const required=async(page,selector,scope="page")=>{
 const node=page.locator(selector).first();
 const n=await node.count();
 assert.ok(n>0,"REQUIRED SELECTOR MISSING "+scope+" "+selector);
 await node.waitFor({state:"attached"});
 return node;
};
const snapshot=async(page,name)=>{
 await mkdir(OUT,{recursive:true});
 const buffer=await page.screenshot({type:"png",animations:"disabled"});
 const hash=createHash("sha256").update(buffer).digest("hex");
 const [w,h]=await page.evaluate(()=>[window.innerWidth,window.innerHeight]);
 await writeFile(OUT+"/"+name+".png",buffer);
 console.log("QA_SNAPSHOT "+JSON.stringify({name,sha256:hash,viewport:{width:w,height:h},timestamp:Date.now()}));
};
const readState=async(page,selector=".pm-inline")=>page.evaluate(selector=>{
 const root=document.querySelector(selector);
 if(!(root instanceof HTMLElement))throw new Error("REQUIRED PROFILE DOM MISSING "+selector);
 const grab=root.querySelector(".pm-profile-sheet");
 const viewport=root.querySelector(".pm-sheet-viewport");
 const pages=root.querySelector(".pm-pages");
 const ink=root.querySelector(".pm-tab-ink");
 const blur=root.querySelector(".pm-photo-blur");
 const hero=root.querySelector(".pm-hero");
 for(const [name,element] of Object.entries({grab,viewport,pages,ink,blur,hero}))
  if(!(element instanceof HTMLElement))throw new Error("REQUIRED PROFILE ELEMENT MISSING "+name);
 const active=root.querySelector('.pm-tab[aria-selected="true"]');
 if(!(active instanceof HTMLElement))throw new Error("REQUIRED SELECTED TAB MISSING");
 const photo=root.querySelector(".pm-photo-track");
 return {
  mode:root.dataset.sheetState,renderer:root.dataset.sheetRenderer,
  sheetTransform:getComputedStyle(grab).transform,
  sheetTop:grab.getBoundingClientRect().top,heroBottom:hero.getBoundingClientRect().bottom,
  scrollTop:viewport.scrollTop,pagesLeft:pages.scrollLeft,pagesWidth:pages.clientWidth,
  inkTransform:getComputedStyle(ink).transform,selectedTab:active.textContent?.trim(),
  selectedCount:root.querySelectorAll('.pm-tab[aria-selected="true"]').length,
  blurOpacity:Number(getComputedStyle(blur).opacity),
  photoTransform:photo?getComputedStyle(photo).transform:null,
  identityTop:root.querySelector(".pm-identity")?.getBoundingClientRect().top,
  tabsTop:root.querySelector(".pm-tabs")?.getBoundingClientRect().top,
  frame:performance.now()
 };
},selector);
// A moving sheet may change its top, but never the layout height of its
// descendants. Reflowing the tab strip each Android WebView frame can cause
// tab raster flicker even when the sheet top has correct motion endpoints.
const readSheetFlexLayout=async page=>page.evaluate(()=>{
 const root=document.querySelector(".pm-inline");
 const sheet=root?.querySelector(".pm-profile-sheet");
 const tabs=root?.querySelector(".pm-tabs");
 const pages=root?.querySelector(".pm-pages");
 if(!(sheet instanceof HTMLElement)||!(tabs instanceof HTMLElement)||
    !(pages instanceof HTMLElement))throw new Error("sheet flex QA nodes missing");
 const box=sheet.getBoundingClientRect(),tabBox=tabs.getBoundingClientRect();
 return {sheetHeight:box.height,pagesHeight:pages.clientHeight,
  tabLocalTop:tabBox.top-box.top,tabsHeight:tabBox.height,top:box.top};
});
// Android WebView paint regression: the moving SHEET must no longer
// re-rasterize all five tab labels or independently transition the underline.
const readTabPaint=async page=>page.evaluate(()=>{
 const root=document.querySelector(".pm-inline");
 const bar=root?.querySelector(".pm-tabs");
 const ink=bar?.querySelector(".pm-tab-ink");
 if(!(bar instanceof HTMLElement)||!(ink instanceof HTMLElement))throw new Error("profile tabs missing");
 const strip=getComputedStyle(bar),under=getComputedStyle(ink);
 const bounds=bar.getBoundingClientRect();
 const items=[...bar.querySelectorAll(".pm-tab")].map(el=>{
  const style=getComputedStyle(el),rect=el.getBoundingClientRect();
  return {text:el.textContent?.trim(),selected:el.getAttribute("aria-selected"),
   opacity:style.opacity,visibility:style.visibility,display:style.display,
   x:Math.round((rect.left-bounds.left)*100)/100,
   y:Math.round((rect.top-bounds.top)*100)/100,
   width:Math.round(rect.width*100)/100};
 });
 return {layer:strip.transform,contain:strip.contain,isolation:strip.isolation,
  backface:strip.backfaceVisibility,
  inkTransition:under.transitionDuration,inkHint:under.willChange,
  items,selectedCount:items.filter(x=>x.selected==="true").length};
});
const touch=async(page,{x,y,dx=0,dy=0,steps=12,onStep})=>{
 const cdp=await page.context().newCDPSession(page);
 try{
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
  for(let i=1;i<=steps;i++){
   await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x+dx*i/steps,y:y+dy*i/steps}]});
   if(onStep)await onStep(i);
   await sleep(14);
  }
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
 }finally{await cdp.detach()}
};
const recordErrors=page=>{
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 return errors;
};
async function readyAssets(page){
 await page.evaluate(async()=>{
  await document.fonts.ready;
  const imgs=[...document.querySelectorAll('img')].filter(i=>i.closest('.pm-shell,.lh-header'));
  await Promise.all(imgs.map(async img=>{
   if(!img.complete)await new Promise((resolve,reject)=>{
    img.addEventListener("load",resolve,{once:true});img.addEventListener("error",reject,{once:true});
   });
   if(!img.naturalWidth)throw new Error("QA fixture image failed: "+img.src.slice(0,80));
   if(img.decode)await img.decode();
  }));
 });
}
async function qaProfile(browser){
 const context=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:1,isMobile:true,hasTouch:true,userAgent:androidUA});
 const page=await context.newPage();const errors=recordErrors(page);
 try{
  await page.goto(BASE+"/profile-qa.html",{waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"Профиль",exact:true}).click();
  await (await required(page,'.pm-inline[data-sheet-renderer="absolute"]',"owner profile")).waitFor({state:"visible"});
  await readyAssets(page);
  let state=await readState(page);
  assert.equal(state.mode,"expanded","owner must start expanded");
  assert.equal(state.selectedCount,1,"one selected tab");
  const logo=await required(page,".lh-profile-android .lh-island img","Android unboxed logo");
  assert.equal(await page.locator(".lh-profile-android .lh-island img").count(),1,"Android renders one logo raster");
  assert.ok((await logo.evaluate(el=>el.getBoundingClientRect().height))>0);
  const photos=await page.locator(".pm-inline .pm-photo-track img").evaluateAll(nodes=>nodes.map(n=>n.src));
  assert.equal(photos.length,3,"fixture provides three independently identifiable photos");
  assert.equal(new Set(photos).size,3,"adjacent photos must not share same src");
  await snapshot(page,"01-owner-expanded");
  const dots=page.locator(".pm-inline .pm-photo-progress button");
  assert.equal(await dots.count(),3,"all three real fixture photo indicators render");
  await dots.nth(1).click();
  assert.equal(await dots.nth(1).getAttribute("aria-current"),"true","photo 2 click changes current photo, not just CSS");
  await dots.first().click();
  assert.equal(await dots.first().getAttribute("aria-current"),"true","photo index can return to first");
  const expanded=state;
  const expandedFlexLayout=await readSheetFlexLayout(page);
  const pristineTabs=await readTabPaint(page);
  assert.ok(pristineTabs.layer!=="none"&&pristineTabs.contain.includes("paint")&&
   pristineTabs.isolation==="isolate"&&pristineTabs.backface==="hidden",
   "PROFILE TAB FLICKER: tab labels need one persistent isolated composited paint surface");
  assert.equal(pristineTabs.inkTransition,"0s","underline must not have competing CSS transitions");
  assert.ok(pristineTabs.inkHint.includes("transform"),"underline movement stays in its own transform layer");
  assert.equal(pristineTabs.selectedCount,1);

  // Real mobile touch: sample the independent absolute sheet top each frame.
  const geometry=await page.locator(".pm-inline .pm-profile-sheet").boundingBox();
  assert.ok(geometry&&geometry.height>80,"sheet must be measurable");
  const identityBox=await page.locator(".pm-inline .pm-identity").boundingBox();
  assert.ok(identityBox&&identityBox.height>30,"profile identity provides real sheet gesture surface");
  const x=identityBox.x+identityBox.width*.48,y=identityBox.y+Math.min(identityBox.height*.45,50);
  console.log("QA_TOUCH_CONTEXT "+JSON.stringify({geometry,x,y,element:await page.evaluate(([x,y])=>{const el=document.elementFromPoint(x,y);return el?.outerHTML.slice(0,280)??"none"},[x,y])}));
  await page.evaluate(()=>{
   const el=document.querySelector(".pm-inline .pm-profile-sheet");
   window.__SHEET_QA_TOUCH__=[];
   for(const type of ["touchstart","touchmove","touchend","touchcancel"])
    el?.addEventListener(type,e=>{
     window.__SHEET_QA_TOUCH__.push({
      type,top:el.getBoundingClientRect().top,
      target:e.target?.className||e.target?.nodeName,
      cancelable:e.cancelable,touches:e.touches?.length
     });
    },{capture:true,passive:true});
  });
  const samples=[],flexSamples=[],tabPaintSamples=[];
  await touch(page,{x,y,dy:-215,onStep:async i=>{
   if([4,8,12].includes(i)){
    samples.push(await readState(page));
    flexSamples.push(await readSheetFlexLayout(page));
    tabPaintSamples.push(await readTabPaint(page));
   }
  }});
  assert.equal(tabPaintSamples.length,3);
  const samePaintedTabs=(a,b)=>a.items.length===b.items.length&&a.items.every((v,i)=>{
   const prior=b.items[i];
   return v.text===prior.text&&v.selected===prior.selected&&
    v.opacity===prior.opacity&&v.visibility===prior.visibility&&v.display===prior.display&&
    Math.abs(v.x-prior.x)<.75&&Math.abs(v.y-prior.y)<.75&&
    Math.abs(v.width-prior.width)<.75;
  });
  assert.ok(tabPaintSamples.every(x=>x.selectedCount===1&&
   samePaintedTabs(x,pristineTabs)&&x.layer!=="none"),
   "PROFILE TAB FLICKER: all labels stay visible with stable local geometry during sheet movement");
  assert.equal(flexSamples.length,3,"captured layout at three finger positions");
  assert.ok(flexSamples.every(s=>Math.abs(s.sheetHeight-expandedFlexLayout.sheetHeight)<1&&
   Math.abs(s.pagesHeight-expandedFlexLayout.pagesHeight)<1&&
   Math.abs(s.tabLocalTop-expandedFlexLayout.tabLocalTop)<1),
   "TAB FLICKER: drag may change sheet top but not tab/page layout");
  console.log("QA_INTERMEDIATE_FRAMES "+JSON.stringify(samples.map(s=>({frame:s.frame,top:s.sheetTop,outerScroll:s.scrollTop,blur:s.blurOpacity,mode:s.mode}))));
  console.log("QA_SHEET_TOUCH_DIAGNOSTICS "+JSON.stringify(
   await page.evaluate(()=>window.__SHEET_QA_TOUCH__?.slice(0,40))));
  assert.equal(samples.length,3);
  assert.ok(samples.every(s=>Number.isFinite(s.sheetTop)&&Number.isFinite(s.blurOpacity)),"physical samples finite");
  assert.ok(samples.some(s=>s.sheetTop<expanded.sheetTop-5),"touch must move the real white surface");
  assert.ok(samples.some(s=>s.blurOpacity>expanded.blurOpacity+.03),"blur follows user gesture");
  console.log("QA_INTERMEDIATE_FRAMES "+JSON.stringify(samples.map(s=>({frame:s.frame,top:s.sheetTop,outerScroll:s.scrollTop,blur:s.blurOpacity,mode:s.mode}))));
  await sleep(480);
  state=await readState(page);
  if(state.mode!=="collapsed"){
   // An incomplete threshold interaction must be observable, not fake success.
   console.log("QA_TOUCH_SETTLE "+JSON.stringify(state));
   await page.getByRole("button",{name:"Развернуть анкету"}).click();
   await page.locator('.pm-inline[data-sheet-state="collapsed"]').waitFor({state:"attached",timeout:2500});
   state=await readState(page);
  }
  assert.equal(state.mode,"collapsed");
  assert.ok(state.sheetTop<expanded.sheetTop-80,"collapsed white surface must move upward");
   assert.equal(state.scrollTop,0,"no outer native scroller may compete");
   assert.equal(state.sheetTransform,"none","new white sheet must not move by transform");
  assert.ok(state.blurOpacity>.5,"collapsed state renders blurred photo layer");
  assert.ok(state.sheetTop<expanded.sheetTop,"sheet has actually moved");
  const collapsedFlexLayout=await readSheetFlexLayout(page);
  const collapsedTabs=await readTabPaint(page);
  assert.ok(samePaintedTabs(collapsedTabs,pristineTabs),
   "PROFILE TAB FLICKER: collapsed sheet cannot hide, reposition or reorder tab labels");

  assert.ok(Math.abs(collapsedFlexLayout.sheetHeight-expandedFlexLayout.sheetHeight)<1,
   "TAB FLICKER: sheet flex surface must retain the same height at both snap points");
  assert.ok(Math.abs(collapsedFlexLayout.pagesHeight-expandedFlexLayout.pagesHeight)<1,
   "TAB FLICKER: pages viewport must not resize during profile collapse");
  assert.ok(Math.abs(collapsedFlexLayout.tabLocalTop-expandedFlexLayout.tabLocalTop)<1,
   "TAB FLICKER: tabs offset relative to sheet must stay constant");
  assert.ok(Math.abs(collapsedFlexLayout.tabsHeight-expandedFlexLayout.tabsHeight)<1,
   "TAB FLICKER: tab strip height must stay constant");
  console.log("QA_STABLE_PROFILE_SHEET_LAYOUT "+JSON.stringify({expandedFlexLayout,collapsedFlexLayout}));
  await snapshot(page,"02-owner-collapsed");
  // Regression: a COMPLETE settle followed by a new finger drag must NOT
  // jump backward on touchend to the previous motion-runner endpoint.
  const collapsedBeforeReopen=await readState(page);
  const reopenBox=await page.locator(".pm-inline .pm-identity").boundingBox();
  assert.ok(reopenBox&&reopenBox.height>30,"collapsed grab target must remain measurable");
  let lastFingerFrame=null;
  await touch(page,{x:reopenBox.x+reopenBox.width*.48,
   y:reopenBox.y+Math.min(reopenBox.height*.44,45),dy:177,steps:14,
   onStep:async index=>{
    if(index===14){await sleep(22);lastFingerFrame=await readState(page);}
   }});
  const releaseFrame=await readState(page);
  assert.ok(lastFingerFrame&&lastFingerFrame.sheetTop>collapsedBeforeReopen.sheetTop+55,
   "finger must physically pull the white panel downward before release");
  assert.ok(releaseFrame.sheetTop>=lastFingerFrame.sheetTop-16,
   "WHITE SHEET BOUNCE: touchend snapped panel UP before its expand settle");
  await page.locator('.pm-inline[data-sheet-state="expanded"]').waitFor({state:"attached",timeout:2500});
  await sleep(35);
  const reopened=await readState(page);
  assert.ok(Math.abs(reopened.sheetTop-expanded.sheetTop)<5,
   "reopened panel should return to the actual expanded endpoint");
  const reopenedFlexLayout=await readSheetFlexLayout(page);
  assert.ok(Math.abs(reopenedFlexLayout.pagesHeight-expandedFlexLayout.pagesHeight)<1,
   "TAB FLICKER: expanding the sheet must not resize its tab pager");
  // Symmetric regression: collapsing from a completely settled expansion
  // must also start at the LAST finger-painted position, not the stale old
  // expanded endpoint. Test both directions through actual touch events.
  const recollapseBox=await page.locator(".pm-inline .pm-identity").boundingBox();
  assert.ok(recollapseBox&&recollapseBox.height>30,"expanded panel gesture target measurable");
  let lastCollapseFingerFrame=null;
  await touch(page,{x:recollapseBox.x+recollapseBox.width*.48,
   y:recollapseBox.y+Math.min(recollapseBox.height*.44,45),dy:-215,steps:14,
   onStep:async index=>{
    if(index===14){await sleep(22);lastCollapseFingerFrame=await readState(page);}
   }});
  const collapseReleaseFrame=await readState(page);
  assert.ok(lastCollapseFingerFrame&&lastCollapseFingerFrame.sheetTop<reopened.sheetTop-55,
   "finger must physically pull the white panel UP before collapse release");
  assert.ok(collapseReleaseFrame.sheetTop<=lastCollapseFingerFrame.sheetTop+16,
   "WHITE SHEET BOUNCE: collapse touchend snapped panel DOWN before settling upward");
  await page.locator('.pm-inline[data-sheet-state="collapsed"]').waitFor({state:"attached",timeout:2500});
  const recollapsed=await readState(page);
  assert.ok(Math.abs(recollapsed.sheetTop-collapsedBeforeReopen.sheetTop)<5,
   "collapsed panel must return to its prior physical pixel endpoint");
  console.log("QA_NO_SHEET_BOUNCE "+JSON.stringify({
   collapsedTop:collapsedBeforeReopen.sheetTop,
   draggedDownTop:lastFingerFrame.sheetTop,releaseExpandTop:releaseFrame.sheetTop,
   expandedTop:reopened.sheetTop,
   draggedUpTop:lastCollapseFingerFrame.sheetTop,releaseCollapseTop:collapseReleaseFrame.sheetTop,
   recollapsedTop:recollapsed.sheetTop}));

  // The owner's actual UI sequence, repeated: collapse -> mini-avatar tap
  // -> expand -> white grab tap -> collapse. Never reuse a stale end pixel.
  for(let repeat=0;repeat<3;repeat++){
   await page.locator(".pm-inline").getByRole("button",{name:"Раскрыть фото профиля"}).click();
   await page.locator('.pm-inline[data-sheet-state="expanded"]').waitFor({state:"attached",timeout:2500});
   const openAgain=await readState(page);
   assert.ok(Math.abs(openAgain.sheetTop-expanded.sheetTop)<5,
    "repeated open must not reposition the white column");
   await page.locator(".pm-inline").getByRole("button",{name:"Развернуть анкету"}).click();
   await page.locator('.pm-inline[data-sheet-state="collapsed"]').waitFor({state:"attached",timeout:2500});
   const closeAgain=await readState(page);
   assert.ok(Math.abs(closeAgain.sheetTop-collapsedBeforeReopen.sheetTop)<5,
    "repeated close must not jump to a stale sheet position");
  }
  console.log("QA_PROFILE_REPEATED_TAPS_PASS");
  // Critical reentrant transition case on Android:
  // while a mini-avatar click is EXPANDING the sheet, a neutral touch on
  // the white identity must not issue a competing touchend.noAxis settle
  // to the previously committed collapsed state.
  await page.locator(".pm-inline").getByRole("button",{name:"Раскрыть фото профиля"}).click();
  await sleep(38);
  const identityDuringSettle=await page.locator(".pm-inline .pm-identity").boundingBox();
  assert.ok(identityDuringSettle&&identityDuringSettle.height>40);
  const neutralX=identityDuringSettle.x+identityDuringSettle.width*.3;
  const neutralY=identityDuringSettle.y+Math.min(35,identityDuringSettle.height*.32);
  await touch(page,{x:neutralX,y:neutralY,steps:1});
  await sleep(350);
  const unaffected=await readState(page);
  assert.equal(unaffected.mode,"expanded",
   "SHEET REENTRANCY: neutral touchend must not reverse in-flight avatar expansion");
  assert.ok(Math.abs(unaffected.sheetTop-expanded.sheetTop)<5,
   "SHEET REENTRANCY: original expand endpoint must remain physically stable");
  await page.locator(".pm-inline").getByRole("button",{name:"Развернуть анкету"}).click();
  await page.locator('.pm-inline[data-sheet-state="collapsed"]').waitFor({state:"attached",timeout:2500});
  console.log("QA_NO_TOUCHEND_RESTART_DURING_SHEET_EXPAND_PASS");
  // A collapsed/scrolled about page must still accept horizontal paging.
  await page.getByRole("tab",{name:"О себе"}).click();
  await sleep(320);
  const beforeSwipe=await readState(page);
  const scrollAtStart=await page.evaluate(()=>{
   const panel=document.querySelector(".pm-inline .pm-page");
   if(!(panel instanceof HTMLElement))throw new Error("about page missing");
   const available=panel.scrollHeight-panel.clientHeight;
   panel.scrollTop=Math.min(85,available);
   return {available,top:panel.scrollTop};
  });
  assert.ok(scrollAtStart.top>20,"about page must be scrolled before horizontal swipe");
  const pagesBox=await page.locator(".pm-inline .pm-pages").boundingBox();
  assert.ok(pagesBox&&pagesBox.width>250&&pagesBox.height>140);
  const swipeX=pagesBox.x+pagesBox.width*.65;
  const swipeY=pagesBox.y+Math.min(115,pagesBox.height*.3);
  await touch(page,{x:swipeX,y:swipeY,dx:-205,dy:2,steps:12});
  await sleep(360);
  const afterScrolledSwipe=await readState(page);
  assert.equal(afterScrolledSwipe.selectedTab,"Блики",
   "TAB SWIPE REGRESSION: horizontal swipe on scrolled page must switch tabs");
  assert.ok(Math.abs(afterScrolledSwipe.pagesLeft-afterScrolledSwipe.pagesWidth)<5,
   "TAB SWIPE REGRESSION: pager position and selected tab agree");
  assert.ok(Math.abs(afterScrolledSwipe.sheetTop-beforeSwipe.sheetTop)<2,
   "TAB SWIPE REGRESSION: accepted white sheet must not move");
  // Touchend can arrive before the first queued RAF on a one-move flick.
  await touch(page,{x:swipeX-pagesBox.width*.25,y:swipeY,dx:190,steps:1});
  await sleep(360);
  const afterFastFlick=await readState(page);
  assert.equal(afterFastFlick.selectedTab,"О себе",
   "TAB SWIPE REGRESSION: one-event reverse flick must work");
  assert.ok(Math.abs(afterFastFlick.pagesLeft)<5,
   "TAB SWIPE REGRESSION: fast flick must settle correct visible page");
  const nativeBefore=await page.evaluate(()=>{
   const el=document.querySelector(".pm-inline .pm-page");
   if(!(el instanceof HTMLElement))throw new Error("about page missing");
   el.scrollTop=25;return el.scrollTop;
  });
  await touch(page,{x:swipeX,y:swipeY,dy:-125,steps:9});
  await sleep(80);
  const nativeAfter=await page.evaluate(()=>{
   const el=document.querySelector(".pm-inline .pm-page");
   return el instanceof HTMLElement?el.scrollTop:-1;
  });
  assert.ok(nativeAfter>nativeBefore+10,
   "TAB SWIPE REGRESSION: native vertical scrolling remains available");
  assert.equal((await readState(page)).selectedTab,"О себе",
   "TAB SWIPE REGRESSION: vertical scroll cannot change tabs");
  console.log("QA_PROFILE_SCROLLED_SIDEWAYS_FAST_FLICK_NATIVE_VERTICAL_PASS");
  await page.getByRole("tab",{name:"Подарки"}).click();
  await sleep(380);
  state=await readState(page);
  assert.equal(state.selectedTab,"Подарки");
  assert.equal(state.selectedCount,1);
  assert.ok(Math.abs(state.pagesLeft-3*state.pagesWidth)<5,"native horizontal scrollLeft matches gifts tab index");
  assert.notEqual(state.inkTransform,"none","underline follows selected tab");
  await snapshot(page,"03-owner-gifts");
  const pin={identity:state.identityTop,tabs:state.tabsTop};
  await page.getByRole("tab",{name:"О себе"}).click();await sleep(370);
  const scroll=await page.evaluate(()=>{
   const pane=document.querySelector(".pm-inline .pm-page");
   if(!(pane instanceof HTMLElement))throw new Error("REQUIRED ABOUT PAGE MISSING");
   const available=pane.scrollHeight-pane.clientHeight;
   pane.scrollTop=Math.min(100,available);
   return {available,top:pane.scrollTop};
  });
  console.log("QA_NATIVE_PAGE_SCROLL "+JSON.stringify(scroll));
  assert.ok(scroll.available>20&&scroll.top>20,"local long-content fixture must demonstrate native vertical page scroll");
  state=await readState(page);
  assert.ok(Math.abs(state.identityTop-pin.identity)<3&&Math.abs(state.tabsTop-pin.tabs)<3,"identity and tabs remain pinned during independent content scroll");
  await snapshot(page,"04-owner-native-scroll");
  await page.getByRole("tab",{name:"Фото",exact:true}).click();await sleep(360);
  await page.getByRole("button",{name:"Открыть фото 2"}).click();
  const viewer=await required(page,'.pm-viewer[role="dialog"][aria-label="Просмотр фото"]',"photo viewer");
  await viewer.waitFor({state:"visible"});
  assert.equal(await page.locator(".pm-viewer-top").innerText().then(s=>s.match(/2\s*\/\s*3/)?.[0]??""),"2 / 3","viewer uses selected photo index");
  await page.getByRole("button",{name:"Следующее фото"}).click();
  assert.match(await page.locator(".pm-viewer-top").innerText(),/3\s*\/\s*3/);
  await page.getByRole("button",{name:"Закрыть просмотр"}).click();
  await viewer.waitFor({state:"hidden",timeout:3000});
  assert.equal((await readState(page)).selectedTab,"Фото","closing viewer retains current profile tab");
  await page.getByRole("button",{name:"Тёмная тема"}).click();
  assert.equal(await page.locator(".luemi-shell").getAttribute("data-theme"),"dark");
  await page.setViewportSize({width:360,height:780});
  await sleep(200);await readyAssets(page);
  state=await readState(page);
  assert.ok(Number.isFinite(state.sheetTop)&&state.pagesWidth>0,"resize does not corrupt layout");
  await snapshot(page,"05-owner-dark-narrow");
  // Discovery: parent swiper owns background but child Nearby controls keep ownership.
  await page.getByRole("button",{name:"Знакомства",exact:true}).click();
  await page.getByRole("tab",{name:"Рядом",exact:true}).click();
  await (await required(page,".nb-root .nb-scroll","Nearby background")).waitFor({state:"visible"});
  assert.equal(await page.getByRole("tab",{name:"Рядом",exact:true}).getAttribute("aria-selected"),"true");
  const location=await required(page,".nb-location","Nearby location control");
  await location.click();
  await page.getByRole("dialog",{name:/Фильтры|Настройки/}).waitFor({state:"visible",timeout:2000}).catch(e=>fail("geography control did not open filter dialog",e));
  await page.getByRole("button",{name:"Закрыть фильтры"}).click();
  await page.getByRole("dialog",{name:"Фильтры знакомств"}).waitFor({state:"hidden",timeout:2500});
  assert.equal(await page.getByRole("tab",{name:"Рядом",exact:true}).getAttribute("aria-selected"),"true","closing geography controls leaves nearby selected");
  const bg=await page.locator(".nb-head").boundingBox();assert.ok(bg,"Nearby non-card background present");
  await touch(page,{x:bg.x+bg.width*.7,y:bg.y+Math.min(35,bg.height*.5),dx:-235});
  await sleep(420);
  const selected=await page.getByRole("tab",{name:"Рядом",exact:true}).getAttribute("aria-selected");
  console.log("QA_NEARBY_BACKGROUND_SWIPE "+JSON.stringify({selected,tabText:await page.locator(".discovery-top-tabs").innerText()}));
  assert.equal(selected,"true","edge swipe on last tab stays bounded; no overshoot or crash");
  // Real positive gesture: a swipe across the Nearby heading must switch the
  // parent discovery tab; empty/no-op touch handlers would fail this assertion.
  await touch(page,{x:bg.x+Math.min(70,bg.width*.22),y:bg.y+Math.min(35,bg.height*.5),dx:210});
  await sleep(430);
  assert.equal(await page.getByRole("tab",{name:"Для тебя",exact:true}).getAttribute("aria-selected"),"true",
    "Nearby empty heading grants horizontal swipe to parent discovery pager");
  await page.getByRole("tab",{name:"Рядом",exact:true}).click();
  // A card retains its tap/swipe surface and must not unexpectedly page.
  await page.locator(".nb-location").click();
  const filters=page.getByRole("dialog",{name:"Фильтры знакомств"});
  await filters.getByRole("button",{name:"Весь мир"}).click();
  await filters.getByRole("button",{name:"Показать анкеты"}).click();
  await filters.waitFor({state:"hidden",timeout:2500});
  await (await required(page,".nb-card","deterministic world fixture")).waitFor({state:"visible"});
  const card=await page.locator(".nb-card").first().boundingBox();
  assert.ok(card&&card.width>90);
  await touch(page,{x:card.x+card.width*.76,y:card.y+Math.min(90,card.height*.3),dx:-Math.min(110,card.width*.48)});
  await sleep(400);
  assert.equal(await page.getByRole("tab",{name:"Рядом",exact:true}).getAttribute("aria-selected"),"true",
   "child Nearby person-card gesture never changes discovery tab");
  await page.getByRole("tab",{name:"Для тебя",exact:true}).click();
  assert.equal(await page.getByRole("tab",{name:"Для тебя",exact:true}).getAttribute("aria-selected"),"true");
  await page.getByRole("tab",{name:"Рядом",exact:true}).click();
  assert.ok(await page.locator(".nb-root").count(),"Nearby remains mounted after navigation");
  await snapshot(page,"06-nearby-restored");
  // Visitor profile route actually animates on arrival and on Escape/back.
  await page.getByRole("tab",{name:"Для тебя",exact:true}).click();
  await page.getByRole("button",{name:/Открыть демо-профиль/}).first().click();
  await (await required(page,'.discovery-visitor-route .pm-dialog[role="dialog"]',"visitor profile")).waitFor({state:"attached"});
  await sleep(350);
  assert.equal(await page.locator(".discovery-app").getAttribute("data-profile-overlay"),"true");
  // A slow interactive back-swipe must never toggle the paint visibility
  // of the browse subtree and force Android Blink to recreate its tiles.
  const underlay=await page.evaluate(async()=>{
   const scene=document.querySelector(".discovery-app");
   const browse=scene?.querySelector(".discovery-browse-panel");
   const chrome=scene?.querySelector(":scope > .lh-header");
   const nav=scene?.querySelector(".discovery-bottom-nav");
   const route=scene?.querySelector(".discovery-visitor-route");
   if(!scene||!browse||!chrome||!nav||!route)return null;
   const visibility=()=>[browse,chrome,nav].map(el=>getComputedStyle(el).visibility);
   const atRest=visibility();
   // No synthetic data-route-revealing flag: the CSS never consumed it.
   // Observe consecutive paints; actual drag/rollback is in Android QA.
   await new Promise(requestAnimationFrame);
   const whileDragging=visibility();
   await new Promise(requestAnimationFrame);
   const afterRollback=visibility();
   return {atRest,whileDragging,afterRollback,focusInsideRoute:route.contains(document.activeElement)};
  });
  assert.ok(underlay?.focusInsideRoute,"visitor route owns focus at rest");
  assert.deepEqual(underlay?.atRest,["visible","visible","visible"],"browse paints under opaque route");
  assert.deepEqual(underlay?.whileDragging,underlay.atRest,"no underlay raster visibility toggle on drag");
  assert.deepEqual(underlay?.afterRollback,underlay.atRest,"no underlay raster visibility toggle on rollback");
  const beforeBack=await page.locator(".discovery-visitor-route").evaluate(el=>getComputedStyle(el).transform);
  console.log("QA_VISITOR_OPEN "+beforeBack);
  await page.keyboard.press("Escape");
  await sleep(350);
  assert.equal(await page.locator(".discovery-visitor-route").count(),0,"Escape closes route after exit animation");
  assert.equal(await page.locator(".discovery-app").getAttribute("data-profile-overlay"),"false","underlying discovery restored");
  assert.equal(await page.getByRole("tab",{name:"Для тебя",exact:true}).getAttribute("aria-selected"),"true","source tab restored after back");
  await snapshot(page,"07-visitor-back-restored");
  assert.deepEqual(errors,[],"no uncaught runtime errors");
  console.log("REM00C_PROFILE_BEHAVIOR_PASS");
 }finally{await context.close()}
}
async function appBootstrap(browser){
 const context=await browser.newContext({viewport:{width:393,height:852},userAgent:androidUA,isMobile:true,hasTouch:true,reducedMotion:"reduce"});
 const page=await context.newPage(); const errors=recordErrors(page);
 const calls=[];
 await page.addInitScript(()=>{
  const listeners=new Map();
  window.__QA_TELEGRAM_MOCK__={calls:[],listeners};
  const mark=(name,...args)=>window.__QA_TELEGRAM_MOCK__.calls.push({name,args});
  window.Telegram={WebApp:{
   initData:"qa_mock_signed_placeholder_NOT_REAL",colorScheme:"light",viewportStableHeight:852,
   version:"8.0",isVersionAtLeast:()=>true,
   ready:()=>mark("ready"),expand:()=>mark("expand"),
   requestFullscreen:()=>mark("requestFullscreen"),
   disableVerticalSwipes:()=>mark("disableVerticalSwipes"),
   setHeaderColor:c=>mark("setHeaderColor",c),
   setBackgroundColor:c=>mark("setBackgroundColor",c),
   onEvent:(n,handler)=>{mark("onEvent",n);listeners.set(n,handler)},
   offEvent:(n,handler)=>{if(listeners.get(n)===handler)listeners.delete(n)},
   BackButton:{show:()=>mark("back.show"),hide:()=>mark("back.hide"),
    onClick:f=>listeners.set("back",f),offClick:f=>{if(listeners.get("back")===f)listeners.delete("back")}}
  }};
 });
 await page.route("https://telegram.org/js/telegram-web-app.js",async route=>{
  await route.fulfill({status:200,contentType:"application/javascript",body:"/* REM-00C test-only Telegram SDK stub; bridge is supplied by addInitScript */"});
 });
 await page.route("**/api/health/live",async route=>{calls.push("live");await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({status:"ok"})})});
 await page.route("**/api/auth/telegram",async route=>{
  const body=JSON.parse(route.request().postData()||"{}");
  assert.equal(body.initData,"qa_mock_signed_placeholder_NOT_REAL");
  calls.push("auth");
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({user:{firstName:"QA User"}})});
 });
 try{
  await page.goto(BASE+"/",{waitUntil:"domcontentloaded"});
  console.log("QA_BOOTSTRAP_INIT "+JSON.stringify(await page.evaluate(()=>({
   mockPresent:!!window.__QA_TELEGRAM_MOCK__,telegramPresent:!!window.Telegram,
   initData:window.Telegram?.WebApp?.initData,webappKeys:Object.keys(window.Telegram?.WebApp||{}).slice(0,20),
   scripts:[...document.scripts].map(x=>x.getAttribute("src")).filter(Boolean)
  }))));
  await page.getByRole("button",{name:"Начать",exact:true}).waitFor({state:"visible",timeout:9000}).catch(async error=>{
   const diagnostics=await page.evaluate(()=>({
    text:document.querySelector(".entry-state")?.textContent?.slice(0,450),
    authScene:document.querySelector(".luemi-shell")?.getAttribute("data-scene"),
    phase:document.querySelector(".luemi-shell")?.getAttribute("data-phase"),
    bridgeCalls:window.__QA_TELEGRAM_MOCK__?.calls.map(x=>x.name)||[],
    telegramPresent:!!window.Telegram,initData:window.Telegram?.WebApp?.initData,
    webappKeys:Object.keys(window.Telegram?.WebApp||{}).slice(0,20)
   }));
   throw new Error("REM-00C mocked App did not become authorized: "+JSON.stringify({calls,diagnostics,errors}),{cause:error});
  });
  const bridge=await page.evaluate(()=>window.__QA_TELEGRAM_MOCK__.calls.map(x=>x.name));
  assert.ok(["ready","expand","requestFullscreen","disableVerticalSwipes"].every(x=>bridge.includes(x)),"real App must invoke mocked Telegram bridge lifecycle");
  assert.ok(calls.includes("live")&&calls.includes("auth")&&calls.indexOf("live")<calls.indexOf("auth"),"mocked health precedes authorization, including React StrictMode effect reruns");
  await snapshot(page,"08-app-intro-mocked-telegram");
  await page.getByRole("button",{name:"Начать",exact:true}).click();
  const progress=await required(page,'[role="progressbar"][aria-label="Прогресс регистрации"]',"real App onboarding");
  assert.equal(await progress.getAttribute("aria-valuenow"),"1","App moves from welcome to registration step 1");
  assert.equal(await page.locator(".luemi-shell").getAttribute("data-phase"),"form");
  await snapshot(page,"09-app-onboarding-mocked-telegram");
  assert.deepEqual(errors,[],"no errors in real App mock");
  console.log("REM00C_APP_BOOTSTRAP_MOCK_PASS");
 }finally{await context.close()}
}
async function standardProfile(browser){
 // Chromium iPhone-like standard-DOM emulation; NOT a claim of testing Safari on physical iOS.
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,
  userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  reducedMotion:"reduce"});
 const page=await context.newPage(),errors=recordErrors(page);
 try{
  await page.goto(BASE+"/profile-qa.html",{waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"Профиль",exact:true}).click();
  const owner=await required(page,'.pm-inline[data-sheet-renderer="absolute"]',"standard-DOM profile");
  await owner.waitFor({state:"visible"});
  await readyAssets(page);
  assert.equal(await page.locator(".lh-profile-android").count(),0,"non-Android profile uses standard logo chrome");
  assert.equal(await page.locator(".lh-profile .lh-island img").count(),2,"standard-DOM logo has primary raster and contrast companion");
  assert.equal((await readState(page)).mode,"expanded");
  await snapshot(page,"10-standard-reduced-light-expanded");
  await page.getByRole("button",{name:"Развернуть анкету"}).click();
  await page.locator('.pm-inline[data-sheet-state="collapsed"]').waitFor({state:"attached",timeout:2500});
  let state=await readState(page);
  assert.ok(state.scrollTop===0&&state.sheetTop<185&&state.blurOpacity>.5,
    "reduced-motion collapse reaches the real absolute top without outer scroll");
  await page.getByRole("tab",{name:"Блики",exact:true}).click();await sleep(390);
  state=await readState(page);
  assert.equal(state.selectedTab,"Блики");
  assert.ok(Math.abs(state.pagesLeft-state.pagesWidth)<5,"standard DOM tabs follow native scrollLeft");
  await page.getByRole("button",{name:"Тёмная тема"}).click();
  assert.equal(await page.locator(".luemi-shell").getAttribute("data-theme"),"dark");
  await snapshot(page,"11-standard-reduced-dark-bliki");
  await page.getByRole("button",{name:"Знакомства",exact:true}).click();
  await page.getByRole("button",{name:"Профиль",exact:true}).click();
  await owner.waitFor({state:"visible"});
  state=await readState(page);
  assert.equal(state.selectedTab,"Блики","returning to hidden owner profile preserves tab");
  assert.equal(state.mode,"collapsed","returning to owner profile preserves sheet mode");
  assert.deepEqual(errors,[],"standard DOM has no uncaught browser errors");
  console.log("REM00C_STANDARD_DOM_REDUCED_MOTION_PASS");
 }finally{await context.close()}
}
async function missingSelectorNegative(browser){
 const page=await browser.newPage();
 try{
  await page.goto(BASE+"/profile-qa.html");
  await assert.rejects(required(page,".__rem00c_definitely_absent","negative selector fixture"),/REQUIRED SELECTOR MISSING/);
  console.log("REM00C_NEGATIVE_SELECTOR_FAIL_CLOSED_PASS");
 }finally{await page.close()}
}
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try{
 await qaProfile(browser);
 await standardProfile(browser);
 await appBootstrap(browser);
 await missingSelectorNegative(browser);
 console.log("REM-00C COMPLETE: Chromium Android-UA fixture, App mock, selector-negative test; PHYSICAL DEVICES NOT VERIFIED.");
}finally{await browser.close()}
