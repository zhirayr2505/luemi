import assert from "node:assert/strict";
import {chromium} from "playwright";
const baseline=process.env.REM04A_BASELINE==="1";
const browser=await chromium.launch({headless:true,channel:"chrome",args:["--no-sandbox"]});
const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
const result={mode:baseline?"baseline":"optimized",viewport:[393,852],profile:null,startup:null};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try{
 const page=await ctx.newPage();
 await page.addInitScript(()=>{
  window.__luemiRem04aTrace=[];window.__rem04aImages=[];
  const OriginalImage=window.Image;
  function CountedImage(...args){
   const image=new OriginalImage(...args);
   const descriptor=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,"src");
   Object.defineProperty(image,"src",{configurable:true,get:()=>descriptor.get.call(image),
    set:src=>{window.__rem04aImages.push(String(src));descriptor.set.call(image,src);}});
   return image;
  }
  CountedImage.prototype=OriginalImage.prototype;
  window.Image=CountedImage;
 });
 await page.goto("http://127.0.0.1:5173/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>!!window.__luemiQaPerf);
 await page.getByRole("tab",{name:"Для тебя"}).click();
 await page.locator(".fy-tile-photo").first().click();
 await page.locator(".pm-photo-slide").first().click();
 await page.locator(".pm-viewer").waitFor();
 await page.waitForFunction(()=>document.querySelector(".pm-viewer-image")?.style.opacity==="1");
 await delay(350);
 const sample=async(action)=>{
  await page.evaluate(()=>{window.__luemiQaPerf.clear();window.__rem04aImages.length=0;});
  await page.evaluate(action);await delay(110);
  return page.evaluate(()=>{
   const records=window.__luemiQaPerf.summary(),imgs=window.__rem04aImages;
   return {commits:Object.fromEntries(["DiscoveryApp","VisitorProfileRoute","ProfileMaster","PhotoViewer"].map(id=>
    [id,records.filter(e=>e.id===id).length])),
    renderEvents:records.length,actualDurationMs:Math.round(records.reduce((v,e)=>v+e.actualDuration,0)*100)/100,
    mediaPreloadAttempts:imgs.length,photoId:document.querySelector(".pm-viewer-image")?.dataset.photoId};
  });
 };
 const unrelated=await sample(()=>window.__luemiQaPerf.bump());
 const theme=await sample(()=>window.__luemiQaPerf.theme());
 const repeated=await sample(()=>window.__luemiQaPerf.bump());
 result.profile={unrelated,theme,repeated};
 console.log("REM04A_PROFILE_MEASURE "+JSON.stringify(result.profile));
 if(!baseline){
  assert.equal(unrelated.renderEvents,2,"memo route Profiler boundary may commit with parent but its ProfileMaster and PhotoViewer subtree must bail out");
  assert.equal(unrelated.commits.ProfileMaster,0,"unrelated parent rerender must not rerender memoized profile");
  assert.equal(unrelated.commits.PhotoViewer,0,"unrelated parent rerender must not rerender existing viewer");
  assert.equal(repeated.renderEvents,2,"repeated unchanged parent update must not commit expensive profile subtree");
  assert.equal(theme.commits.VisitorProfileRoute,1,"real theme change must still reach route");
  assert.equal(unrelated.mediaPreloadAttempts,0,"no unnecessary preload due to parent change");
 }
 assert.equal(unrelated.photoId,theme.photoId);
 assert.equal(theme.photoId,repeated.photoId);
 await page.close();
 const p=await ctx.newPage();
 await p.addInitScript(()=>{
  window.Telegram={WebApp:{initData:"rem04a-valid-fixture",colorScheme:"light",ready(){},expand(){},
   requestFullscreen(){},disableVerticalSwipes(){},isVersionAtLeast(){return false;}}};
  Object.defineProperty(document.fonts,"ready",{configurable:true,get:()=>new Promise(()=>{})});
 });
 await p.route("**/api/health/live",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({status:"ok"})}));
 await p.route("**/api/auth/telegram",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({user:{firstName:"QA",id:"qa"}})}));
 const start=Date.now();
 await p.goto("http://127.0.0.1:5173/",{waitUntil:"domcontentloaded"});
 await delay(2800);
 result.startup={case:"fonts-never-resolve",elapsedMs:Date.now()-start,
  entryText:await p.locator(".entry-state").innerText(),cta:await p.locator(".intro-cta").count(),
  error:await p.getByText("Не удалось подтвердить вход.").count()};
 console.log("REM04A_STARTUP_MEASURE "+JSON.stringify(result.startup));
 if(!baseline)assert.equal(result.startup.cta,1,"optional fonts must not block authorized entry");
 console.log("REM04A_MEASUREMENT_PASS "+JSON.stringify(result));
 await p.close();
}finally{await ctx.close();await browser.close();}
