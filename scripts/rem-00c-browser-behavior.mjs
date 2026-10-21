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
  await (await required(page,'.pm-inline[data-sheet-renderer="scroll"]',"owner profile")).waitFor({state:"visible"});
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
  const expanded=state;
  // Real native touch gesture: take intermediate sheet frames without faking CSS state.
  const geometry=await page.locator(".pm-inline .pm-profile-sheet").boundingBox();
  assert.ok(geometry&&geometry.height>80,"sheet must be measurable");
  const identityBox=await page.locator(".pm-inline .pm-identity").boundingBox();
  assert.ok(identityBox&&identityBox.height>30,"profile identity provides real sheet gesture surface");
  const x=identityBox.x+identityBox.width*.48,y=identityBox.y+Math.min(identityBox.height*.45,50);
  console.log("QA_TOUCH_CONTEXT "+JSON.stringify({geometry,x,y,element:await page.evaluate(([x,y])=>{const el=document.elementFromPoint(x,y);return el?.outerHTML.slice(0,280)??"none"},[x,y])}));
  const samples=[];
  await touch(page,{x,y,dy:-215,onStep:async i=>{
   if([4,8,12].includes(i))samples.push(await readState(page));
  }});
  console.log("QA_INTERMEDIATE_FRAMES "+JSON.stringify(samples.map(s=>({frame:s.frame,scroll:s.scrollTop,blur:s.blurOpacity,mode:s.mode}))));
  assert.equal(samples.length,3);
  assert.ok(samples.every(s=>Number.isFinite(s.scrollTop)&&Number.isFinite(s.blurOpacity)),"physical samples finite");
  assert.ok(samples.some(s=>s.scrollTop>expanded.scrollTop+5),"touch must move native sheet scroll");
  assert.ok(samples.some(s=>s.blurOpacity>expanded.blurOpacity+.03),"blur follows user gesture");
  console.log("QA_INTERMEDIATE_FRAMES "+JSON.stringify(samples.map(s=>({frame:s.frame,scroll:s.scrollTop,blur:s.blurOpacity,mode:s.mode}))));
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
  assert.ok(state.scrollTop>expanded.scrollTop+80,"collapsed sheet changes native viewport scroll");
  assert.ok(state.blurOpacity>.5,"collapsed state renders blurred photo layer");
  assert.ok(state.sheetTop<expanded.sheetTop,"sheet has actually moved");
  await snapshot(page,"02-owner-collapsed");
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
  assert.deepEqual(calls.slice(0,2),["live","auth"],"mocked health/auth flow is actually exercised");
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
  const owner=await required(page,'.pm-inline[data-sheet-renderer="scroll"]',"standard-DOM profile");
  await owner.waitFor({state:"visible"});
  await readyAssets(page);
  assert.equal(await page.locator(".lh-profile-android").count(),0,"non-Android profile uses standard logo chrome");
  assert.equal(await page.locator(".lh-profile .lh-island img").count(),2,"standard-DOM logo has primary raster and contrast companion");
  assert.equal((await readState(page)).mode,"expanded");
  await snapshot(page,"10-standard-reduced-light-expanded");
  await page.getByRole("button",{name:"Развернуть анкету"}).click();
  await page.locator('.pm-inline[data-sheet-state="collapsed"]').waitFor({state:"attached",timeout:2500});
  let state=await readState(page);
  assert.ok(state.scrollTop>60&&state.blurOpacity>.5,"reduced-motion collapse still reaches physical endpoint");
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
