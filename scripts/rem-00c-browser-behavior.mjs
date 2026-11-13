import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdir,writeFile} from "node:fs/promises";
import {chromium} from "playwright";
import {feedDeckBrowserQa} from "./feed-deck-browser-qa.mjs";
/** Profile Morph V3 behavioral QA on synthetic Chromium, not physical Telegram A55. */
const BASE=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const OUT=process.env.LUEMI_QA_OUT||"qa-artifacts/rem-00c/profile-morph-v3";
const androidUA="Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36";
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const required=async(page,selector,scope="page")=>{
 const node=page.locator(selector).first();assert.ok(await node.count()>0,"REQUIRED SELECTOR MISSING "+scope+" "+selector);
 await node.waitFor({state:"attached"});return node;
};
const snapshot=async(page,name)=>{
 await mkdir(OUT,{recursive:true});
 const pixels=await page.screenshot({type:"png",animations:"disabled"});
 await writeFile(OUT+"/"+name+".png",pixels);
 console.log("QA_SNAPSHOT "+JSON.stringify({name,sha256:createHash("sha256").update(pixels).digest("hex"),bytes:pixels.length}));
};
const recordErrors=page=>{const errors=[];page.on("pageerror",e=>errors.push(e.message));return errors;};
const state=async(page,selector=".v3-profile-host")=>page.evaluate(sel=>{
 const host=document.querySelector(sel);if(!host)throw Error("V3 profile host absent");
 const root=host.querySelector(".v3-int-root");if(!root)throw Error("V3 render root absent");
 const pick=q=>{const el=root.querySelector(q);if(!el)throw Error("V3 missing "+q);return el;};
 const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
 const sheet=pick(".v3-int-sheet"),face=pick(".v3-int-mask");
 const pages=[...root.querySelectorAll(".v3-int-page")];
 const activePage=pages.find(x=>x.getAttribute("aria-hidden")==="false");
 return {mode:host.dataset.morphState,progress:Number(root.dataset.progress||"0"),
  host:rect(host),face:rect(face),sheet:rect(sheet),
  photoCount:root.querySelectorAll(".v3-int-photo-slide img").length,
  photoIds:[...root.querySelectorAll(".v3-int-photo-slide img")].map(x=>x.dataset.photoId),
  selectedCount:root.querySelectorAll('.v3-int-tab[aria-selected="true"]').length,
  tab:root.querySelector('.v3-int-tab[aria-selected="true"]')?.textContent?.trim(),
  backing:getComputedStyle(pick(".v3-int-opaque")).backgroundImage,
  sheetBg:getComputedStyle(sheet).backgroundColor,
  scrollTop:activePage?.scrollTop??0,
  timestamp:performance.now()};
},selector);
async function profileV3(browser,platform="android"){
 const android=platform==="android",context=await browser.newContext({viewport:{width:393,height:852},
  isMobile:true,hasTouch:true,reducedMotion:android?"no-preference":"reduce",
  userAgent:android?androidUA:"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1"});
 const page=await context.newPage(),errors=recordErrors(page);
 try{
  await page.goto(BASE+"/profile-qa.html?profileV3=1",{waitUntil:"domcontentloaded"});
  const ownProfileNav=page.locator(".discovery-bottom-nav button").filter({hasText:"Профиль"});
  await ownProfileNav.waitFor({state:"visible",timeout:6000});
  await ownProfileNav.click();
  const host=await required(page,".v3-profile-host.pm-inline","owner V3");
  const compact=await state(page);
  assert.equal(compact.mode,"compact","V3 owner starts compact");
  assert.ok(compact.face.width>=75&&compact.face.width<=145,"V3 compact avatar width");
  assert.ok(compact.face.height>=75&&compact.face.height<=145,"V3 compact avatar height");
  assert.ok(compact.sheet.y>compact.face.y+compact.face.height-26,"V3 sheet follows compact avatar");
  assert.equal(compact.tab,"О себе");assert.equal(compact.selectedCount,1);
  assert.equal(compact.photoCount,3,"QA fixture has three visible photos");
  assert.ok(compact.backing!=="none"&&compact.sheetBg!=="rgba(0, 0, 0, 0)","V3 opaque sheet and backing");
  assert.equal(await page.locator(".pm-inline.pm-a2-root").count(),0,"retired A2 must not appear");
  const logo=page.locator(".lh-header .lh-island img").first();
  assert.ok(await logo.count()>0,"original LUEMI brand image in global header");
  await snapshot(page,platform+"-01-v3-compact");

  await host.getByRole("button",{name:"Развернуть фото"}).click();
  await host.locator('.v3-int-root[data-sheet-state="expanded"]').waitFor({state:"attached",timeout:4000});
  const expanded=await state(page);
  assert.equal(expanded.mode,"expanded");
  assert.ok(expanded.face.width>compact.face.width*1.8,"V3 face expands visibly");
  assert.ok(expanded.sheet.y>compact.sheet.y+50,"V3 sheet moves down to reveal portrait");
  assert.equal(await page.locator(".pm-viewer").count(),0,"expansion must not open photo viewer");
  await snapshot(page,platform+"-02-v3-expanded");

  await host.getByRole("button",{name:"Открыть просмотр фото"}).click();
  await required(page,".pm-viewer","V3 expanded viewer");
  await snapshot(page,platform+"-03-v3-viewer");
  await page.keyboard.press("Escape");
  await page.locator(".pm-viewer").waitFor({state:"detached",timeout:4000});
  assert.equal((await state(page)).mode,"expanded","closing viewer keeps V3 expanded");
  assert.deepEqual((await state(page)).photoIds,compact.photoIds,"photo element order stable through viewer");

  const photoDots=host.locator(".v3-int-photo-dots button");
  assert.equal(await photoDots.count(),3,"three photo controls retained");
  await photoDots.nth(1).click();
  await page.waitForFunction(()=>document.querySelector('.v3-profile-host .v3-int-photo-dots button:nth-child(2)')?.getAttribute("aria-current")==="true");
  assert.equal(await host.locator(".v3-int-photo-slide img").count(),3,"photo gallery stays mounted");

  const handle=host.locator(".v3-int-handle");
  await handle.press("Enter");
  await host.locator('.v3-int-root[data-sheet-state="collapsed"]').waitFor({state:"attached",timeout:4000});
  await snapshot(page,platform+"-04-v3-after-collapse");
  assert.equal((await state(page)).mode,"compact");
  for(let i=0;i<10;i++){await handle.press("Enter");await sleep(20);}
  await sleep(350);
  // During a reversal, the next key targets the *current* interpolated
  // progress, not the previous endpoint. Even counts need not end compact.
  const afterReversals=await state(page);
  assert.ok(["compact","expanded"].includes(afterReversals.mode),"rapid reversals settle at a real endpoint");
  assert.ok(Number.isFinite(afterReversals.progress)&&afterReversals.progress>=0&&afterReversals.progress<=1,
   "V3 motion progress stays bounded after rapid reversals");
  if(afterReversals.mode==="expanded"){
   await handle.press("Enter");
   await host.locator('.v3-int-root[data-sheet-state="collapsed"]').waitFor({state:"attached",timeout:4000});
  }
  for(const label of ["Фото","Блики","Аккаунт","Подарки","О себе"]){
   await host.getByRole("tab",{name:label,exact:true}).click();
   await sleep(240);
   const st=await state(page);
   assert.equal(st.tab,label,"V3 selected tab: "+label);
   assert.equal(st.selectedCount,1,"only one V3 selected tab");
  }
  const pageEl=host.locator('.v3-int-page[data-tab-id="about"]');
  await pageEl.evaluate(el=>{el.scrollTop=50;});
  assert.ok(await pageEl.evaluate(el=>el.scrollTop)>=0,"native biography scroll functional");

  if(android){
   const discoveryNav=page.locator(".discovery-bottom-nav button").filter({hasText:"Знакомства"});
   await discoveryNav.waitFor({state:"visible",timeout:6000});
   await discoveryNav.click();
   await page.getByRole("tab",{name:"Для тебя",exact:true}).click();
   await page.getByRole("button",{name:/Открыть демо-профиль/}).first().click();
   const visitor=await required(page,".discovery-visitor-route .v3-profile-host","visitor V3");
   assert.equal((await state(page,".discovery-visitor-route .v3-profile-host")).mode,"compact");
   await snapshot(page,"android-05-v3-visitor-compact");
   await page.keyboard.press("Escape");
   await visitor.waitFor({state:"detached",timeout:4000});
   assert.equal(await page.locator(".discovery-visitor-route").count(),0,"visitor V3 closes without lingering route");
  }
  assert.deepEqual(errors,[],"no uncaught browser exceptions");
  console.log("PROFILE_MORPH_V3_BROWSER_PASS "+JSON.stringify({platform,photos:compact.photoCount,
   compactSheet:compact.sheet.y,expandedSheet:expanded.sheet.y,reversals:10}));
 }finally{await context.close();}
}
async function missingSelectorNegative(browser){
 const page=await browser.newPage();
 try{await page.goto(BASE+"/profile-qa.html");
  await assert.rejects(required(page,".__v3_deliberately_missing","negative fixture"),/REQUIRED SELECTOR MISSING/);
 }finally{await page.close()}
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
   isFullscreen:true,exitFullscreen:()=>mark("exitFullscreen"),
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
  await page.getByRole("button",{name:/^(Зарегистрироваться|Продолжить регистрацию)$/}).waitFor({state:"visible",timeout:9000}).catch(async error=>{
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
  assert.ok(["ready","expand","disableVerticalSwipes"].every(x=>bridge.includes(x)),"App must initialize Telegram bridge and disable vertical swipes");
  assert.equal(bridge.includes("exitFullscreen"),false,"V3 fullscreen app must never exit Telegram fullscreen");
  assert.ok(calls.includes("live")&&calls.includes("auth")&&calls.indexOf("live")<calls.indexOf("auth"),"mocked health precedes authorization, including React StrictMode effect reruns");
  await snapshot(page,"08-app-intro-mocked-telegram");
  await page.getByRole("button",{name:/^(Зарегистрироваться|Продолжить регистрацию)$/}).click();
  const progress=await required(page,'[role="progressbar"][aria-label="Прогресс регистрации"]',"real App onboarding");
  assert.equal(await progress.getAttribute("aria-valuenow"),"1","App moves from welcome to registration step 1");
  assert.equal(await page.locator(".luemi-shell").getAttribute("data-phase"),"form");
  await snapshot(page,"09-app-onboarding-mocked-telegram");
  assert.deepEqual(errors,[],"no errors in real App mock");
  console.log("REM00C_APP_BOOTSTRAP_MOCK_PASS");
 }finally{await context.close()}
}
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try{
 await profileV3(browser,"android");
 await feedDeckBrowserQa(browser,BASE);
 await profileV3(browser,"ios-emulation");
 await appBootstrap(browser);
 await missingSelectorNegative(browser);
 console.log("PROFILE_MORPH_V3_QA_COMPLETE: Chromium browser emulation; PHYSICAL A55/IOS NOT VERIFIED.");
}finally{await browser.close()}
