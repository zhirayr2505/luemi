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
 });
 await p.route("**/api/health/live",route=>route.fulfill({status:200,contentType:"application/json",body:'{"status":"ok"}'}));
 await p.route("**/api/auth/telegram",route=>{
  authRequests++;
  return route.fulfill({status:200,contentType:"application/json",body:'{"user":{"firstName":"ACCEPTED QA","id":"fixture"}}'});
 });
 await p.clock.install();
 const t=Date.now();
 await p.goto((process.env.REM04A_BASE_URL||"http://127.0.0.1:5174")+"/",{waitUntil:"domcontentloaded"});
 await p.waitForFunction(()=>document.querySelector(".entry-state")!==null);
 await p.clock.fastForward(15900);
 await p.waitForTimeout(300);
 const result={acceptedSha:"94d8c10d0049b80861f837dd1c5327bc9d0347c8",
  fontPromise:"never-resolved",virtualMs:15900,authRequests,
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
