import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdir,writeFile} from "node:fs/promises";
import {chromium} from "playwright";
/** Profile Morph A2 behavioral QA on synthetic Chromium, not physical Telegram A55. */
const BASE=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const OUT=process.env.LUEMI_QA_OUT||"qa-artifacts/profile-morph-a2";
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
const state=async(page,selector=".pm-inline")=>page.evaluate(sel=>{
 const root=document.querySelector(sel);if(!root)throw Error("A2 profile root absent");
 const pick=q=>{const el=root.querySelector(q);if(!el)throw Error("A2 missing "+q);return el;};
 const sheet=pick(".pm-a2-sheet"),face=pick(".pm-a2-face"),tabs=pick(".pm-a2-tabs"),page=pick(".pm-a2-page:not([aria-hidden=true])");
 const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
 return {mode:root.dataset.morphState,photoCount:root.querySelectorAll(".pm-a2-photo-slide img").length,
  sheet:rect(sheet),face:rect(face),tabs:rect(tabs),page:rect(page),
  tab:root.querySelector('.pm-a2-tab[aria-selected=true]')?.textContent?.trim(),
  selectedCount:root.querySelectorAll('.pm-a2-tab[aria-selected=true]').length,
  imageIds:[...root.querySelectorAll(".pm-a2-photo-slide img")].map(x=>x.dataset.photoId),
  background:getComputedStyle(pick(".pm-a2-backing")).backgroundImage,
  sheetBg:getComputedStyle(sheet).backgroundColor,scrollTop:page.scrollTop,
  timestamp:performance.now()};
},selector);
const touch=async(page,{x,y,dx=0,dy=0,steps=12,onStep})=>{
 const cdp=await page.context().newCDPSession(page);
 try{
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y,id:1}]});
  for(let i=1;i<=steps;i++){
   await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x+dx*i/steps,y:y+dy*i/steps,id:1}]});
   await sleep(19);
   if(onStep)await onStep(i);
  }
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
 }finally{await cdp.detach()}
};
async function profileA2(browser,platform="android"){
 const android=platform==="android",context=await browser.newContext({viewport:{width:393,height:852},
  isMobile:true,hasTouch:true,reducedMotion:android?"no-preference":"reduce",
  userAgent:android?androidUA:"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1"});
 const page=await context.newPage(),errors=recordErrors(page);
 try{
  await page.goto(BASE+"/profile-qa.html",{waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"Профиль",exact:true}).click();
  const root=await required(page,".pm-inline.pm-a2-root","owner A2");
  const compact=await state(page);
  assert.equal(compact.mode,"compact","A2 must begin compact, no expanded initial state");
  assert.ok(compact.face.width>=85&&compact.face.width<=125,"compact left avatar width");
  assert.ok(compact.face.height>=85&&compact.face.height<=125,"compact avatar height");
  assert.ok(compact.face.x<compact.sheet.width*.40,"compact avatar physically left");
  assert.ok(compact.sheet.y>compact.face.y+compact.face.height-6,"compact sheet below avatar");
  assert.equal(compact.selectedCount,1);assert.equal(compact.tab,"О себе");
  assert.ok(compact.background!=="none"&&compact.sheetBg!=="rgba(0, 0, 0, 0)","opaque profile backing/sheet");
  const logo=page.locator(".lh-header .lh-island img").last();assert.ok(await logo.count()>0,"real LUEMI header logo");
  if(android)assert.equal(await page.locator(".lh-profile-android .lh-island img").count(),1);
  await snapshot(page,platform+"-01-compact");
  // Portrait tap expands but must NOT open PhotoViewer.
  await root.locator(".pm-a2-face").click({position:{x:compact.face.width/2,y:compact.face.height/2}});
  await root.locator('[data-morph-state="expanded"]').waitFor({state:"attached",timeout:2300}).catch(async()=>{throw Error("portrait click did not expand")});
  await sleep(35);
  let expanded=await state(page);
  assert.equal(expanded.mode,"expanded");
  assert.ok(expanded.face.width>compact.face.width*2.2,"same photo grows into hero width");
  assert.ok(expanded.sheet.y>compact.sheet.y+70,"sheet moved DOWN to reveal photo");
  assert.equal(await page.locator(".pm-viewer").count(),0,"compact portrait click must not open viewer");
  await snapshot(page,platform+"-02-expanded");
  // Same photo element must remain DOM-backed through morph.
  const photoNodes=await root.locator(".pm-a2-photo-slide img").evaluateAll(xs=>xs.map(x=>x.dataset.photoId));
  assert.deepEqual(photoNodes,expanded.imageIds);
  assert.ok(expanded.photoCount>=1,"fixture contains media");
  // Viewer opens only from expanded photo and closes without reinitializing sheet.
  await root.locator(".pm-a2-face").click({position:{x:expanded.face.width*.52,y:expanded.face.height*.45}});
  await required(page,".pm-viewer","viewer from expanded");
  await snapshot(page,platform+"-03-viewer");
  await page.keyboard.press("Escape");
  await page.locator(".pm-viewer").waitFor({state:"detached",timeout:2200});
  assert.equal((await state(page)).mode,"expanded","viewer close preserves morph state");
  // A2 handle drag: movement 1:1 for 12 real CDP touch samples.
  const handle=await root.locator(".pm-a2-handle").boundingBox();
  assert.ok(handle?.height>=25);
  const before=await state(page),frames=[];
  await touch(page,{x:handle.x+handle.width*.5,y:handle.y+handle.height*.5,dy:-115,
   onStep:async i=>{if([2,5,8,12].includes(i))frames.push((await state(page)).sheet.y)}});
  assert.ok(frames.length===4&&frames.at(-1)<before.sheet.y-60,"up swipe follows finger immediately");
  assert.ok(frames.every((y,i)=>i===0||y<=frames[i-1]+9),"no reverse snap while moving up");
  await sleep(340);
  const now=await state(page);
  assert.equal(now.mode,"compact","up drag settles compact");
  await snapshot(page,platform+"-04-after-drag");
  // Repeat transitions, interrupt in-flight animations, and reject underlay bleed via
  // elementFromPoint + structural invariant, NOT a claim of GPU frame-level proof.
  for(let i=0;i<22;i++){
   await root.locator(".pm-a2-handle").press("Enter");
   await sleep(15);
  }
  await sleep(340);
  const afterTaps=await state(page);
  assert.equal(afterTaps.mode,"compact","22 reversals end at deterministic compact endpoint");
  const paint=await page.evaluate(()=>{
   const root=document.querySelector(".pm-a2-root");
   const backing=root?.querySelector(".pm-a2-backing");
   const route=document.querySelector(".discovery-visitor-route");
   const a=getComputedStyle(backing),r=root.getBoundingClientRect();
   return {backing:a.backgroundImage,opaque:a.opacity,cover:r.width>200&&r.height>400,
    isolation:getComputedStyle(root).isolation,routeBg:route?getComputedStyle(route).backgroundColor:null};
  });
  assert.ok(paint.cover&&paint.isolation==="isolate"&&paint.backing!=="none","continuous profile-scoped backing layer");
  const tabs=root.locator(".pm-a2-tab");
  for(const id of [1,2,3,4,0]){await tabs.nth(id).click();await sleep(225);
   assert.equal(await root.locator('.pm-a2-tab[aria-selected=true]').count(),1);
  }
  const selected=await state(page);assert.equal(selected.tab,"О себе");
  const pageEl=root.locator(".pm-a2-page").first();
  await pageEl.evaluate(el=>el.scrollTop=50);
  const scrolled=await pageEl.evaluate(el=>el.scrollTop);
  assert.ok(scrolled>=0,"native scroll remains functional");
  if(android){
   await page.getByRole("tab",{name:"Для тебя",exact:true}).click();
   await page.getByRole("button",{name:/Открыть демо-профиль/}).first().click();
   const visitor=await required(page,".discovery-visitor-route .pm-a2-root","visitor A2");
   assert.equal((await state(page,".discovery-visitor-route .pm-a2-root")).mode,"compact");
   await snapshot(page,"android-05-visitor-compact");
   await page.keyboard.press("Escape");
   await visitor.waitFor({state:"detached",timeout:2200});
   assert.equal(await page.locator(".discovery-visitor-route").count(),0,"visitor route closes without leaked profile overlay");
  }
  assert.deepEqual(errors,[],"no uncaught browser exceptions");
  console.log("PROFILE_MORPH_A2_BROWSER_PASS "+JSON.stringify({platform,photos:compact.photoCount,compactSheet:compact.sheet.y,
   expandedSheet:expanded.sheet.y,reversalCount:22,dragSamples:frames}));
 }finally{await context.close()}
}
async function missingSelectorNegative(browser){
 const page=await browser.newPage();
 try{await page.goto(BASE+"/profile-qa.html");
  await assert.rejects(required(page,".__a2_deliberately_missing","negative fixture"),/REQUIRED SELECTOR MISSING/);
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
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try{
 await profileA2(browser,"android");
 await profileA2(browser,"ios-emulation");
 await appBootstrap(browser);
 await missingSelectorNegative(browser);
 console.log("PROFILE_MORPH_A2_QA_COMPLETE: Chromium browser emulation; PHYSICAL A55/IOS NOT VERIFIED.");
}finally{await browser.close()}
