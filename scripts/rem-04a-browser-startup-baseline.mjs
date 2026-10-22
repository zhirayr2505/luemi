/** Evidence from the real accepted REM-03D App, served read-only on port 5174.
 * Auth really succeeds, Telegram SDK mocked, document.fonts.ready never resolves.
 * The original Promise.all leaves entry unresolved even after 15s deadline.
 */
import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,channel:"chrome",args:["--no-sandbox"]});
const ctx=await browser.newContext({viewport:{width:393,height:852}});
const p=await ctx.newPage();
try{
 let authRequests=0;
 await p.route("https://telegram.org/js/telegram-web-app.js",route=>route.fulfill({status:200,contentType:"application/javascript",body:""}));
 await p.addInitScript(()=>{
  window.Telegram={WebApp:{initData:"REM04A_ACCEPTED_REM03D",colorScheme:"light",ready(){},expand(){},
   isVersionAtLeast(){return false;},disableVerticalSwipes(){},setHeaderColor(){},setBackgroundColor(){}}};
  Object.defineProperty(document.fonts,"ready",{configurable:true,get:()=>new Promise(()=>{})});
  // Read-only fixture instrumentation: preserve real native Image.decode()
  // and record when the accepted REM-03D brand preload truly decodes.
  // Virtual watchdog time must not advance while that unrelated resource
  // is still pending, or its abort rejection races the font-only scenario.
  window.__rem04aAcceptedBrand={started:0,decoded:0,failed:0};
  const originalDecode=HTMLImageElement.prototype.decode;
  HTMLImageElement.prototype.decode=function(...args){
   if(!(this.currentSrc||this.src||"").includes("wordmark_original_raster_alpha_W06.webp"))
    return originalDecode.apply(this,args);
   window.__rem04aAcceptedBrand.started++;
   return originalDecode.apply(this,args).then(value=>{
    window.__rem04aAcceptedBrand.decoded++;return value;
   },error=>{
    window.__rem04aAcceptedBrand.failed++;throw error;
   });
  };
 });
 await p.route("**/api/health/live",route=>route.fulfill({status:200,contentType:"application/json",body:'{"status":"ok"}'}));
 await p.route("**/api/auth/telegram",route=>{
  authRequests++;
  return route.fulfill({status:200,contentType:"application/json",body:'{"user":{"firstName":"ACCEPTED QA","id":"fixture"}}'});
 });
 await p.clock.install();
 const t=Date.now();
 // Explicitly confirm successful HTTP 200 auth, not merely a request counter.
 const authResponse=p.waitForResponse(response=>
  response.url().includes("/api/auth/telegram")&&response.status()===200);
 await p.goto((process.env.REM04A_BASE_URL||"http://127.0.0.1:5174")+"/",{waitUntil:"domcontentloaded"});
 await p.waitForFunction(()=>document.querySelector(".entry-state")!==null);
 await authResponse;
 // Wait for real native decode of the unchanged accepted logo and a loaded
 // DOM copy. This separates the unresolved font Promise from unrelated asset
 // loading. Neither the accepted App nor its brand bytes are modified.
 await p.waitForFunction(()=>window.__rem04aAcceptedBrand?.decoded>=1 &&
  document.querySelector(".intro-logo")?.complete===true &&
  document.querySelector(".intro-logo")?.naturalWidth>0,null,{timeout:12000});
 await p.evaluate(()=>Promise.resolve()); // finish the accepted preload's microtasks
 const brand=await p.evaluate(()=>({...window.__rem04aAcceptedBrand,
  domNaturalWidth:document.querySelector(".intro-logo")?.naturalWidth??0}));
 assert.ok(brand.started>=1&&brand.decoded>=1,"accepted native logo preload must actually decode");
 assert.ok(brand.domNaturalWidth>0,"unchanged original LUEMI logo must be loaded before the deadline");
 assert.equal(authRequests,1,"accepted real Telegram auth HTTP 200 must finish before virtual deadline");
 await p.clock.fastForward(14900);
 await p.waitForTimeout(50);
 assert.equal(await p.locator(".intro-cta").count(),0,"font-only pending state must block CTA before deadline");
 assert.equal(await p.getByText("Не удалось подтвердить вход.").count(),0,
  "successful authorized startup must not error before its 15s deadline");
 await p.clock.fastForward(1000);
 await p.waitForTimeout(300);
 const result={acceptedSha:"94d8c10d0049b80861f837dd1c5327bc9d0347c8",
  fontPromise:"never-resolved",virtualMs:15900,authRequests,brand,
  cta:await p.locator(".intro-cta").count(),
  error:await p.getByText("Не удалось подтвердить вход.").count(),
  outsideTelegram:await p.getByText("Открой LUEMI через").count(),
  scene:await p.locator(".luemi-shell").getAttribute("data-scene"),
  wallElapsedMs:Date.now()-t};
 console.log("REM04A_BASELINE_STARTUP_MEASURE "+JSON.stringify(result));
 assert.equal(authRequests,1,"real accepted baseline must complete successful auth request");
 assert.equal(result.outsideTelegram,0,"Telegram SDK fixture must not fall back to outside-telegram");
 assert.equal(result.cta,0,"old fonts.ready Promise.all retains indefinite loading past 15s");
 assert.equal(result.error,0,"old controller abort cannot settle the fonts promise");
 console.log("REM04A_BASELINE_STARTUP_CONFIRMED accepted REM-03D real App hangs beyond original 15s despite successful auth");
}finally{await ctx.close();await browser.close();}
