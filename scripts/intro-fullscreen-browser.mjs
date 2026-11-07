/** Synthetic Telegram fullscreen handshake regression.
 * Covers the first cinematic paint, not physical Android/WKWebView. */
import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({
 viewport:{width:412,height:740},isMobile:true,hasTouch:true,
 deviceScaleFactor:2.5,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/145.0 Mobile Safari/537.36"
});
const failures=[];
page.on("pageerror",error=>failures.push(error.message));
try{
 await page.route("https://telegram.org/js/telegram-web-app.js",route=>
  route.fulfill({status:200,contentType:"application/javascript",body:`
    window.__tgListeners={};
    window.Telegram={WebApp:{
     initData:"LUEMI_FULLSCREEN_QA",isFullscreen:false,colorScheme:"dark",
     ready(){},expand(){},disableVerticalSwipes(){},
     isVersionAtLeast(){return true;},
     requestFullscreen(){
      window.__earlyFullscreenProbe={rootExists:!!document.getElementById("root"),called:true};
     },
     onEvent(name,fn){(window.__tgListeners[name]??=[]).push(fn);},
     offEvent(name,fn){window.__tgListeners[name]=(window.__tgListeners[name]??[]).filter(x=>x!==fn);},
     setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){}
    }};
   `}));
 await page.route("**/api/**",route=>
  route.fulfill({status:404,contentType:"application/json",body:"{}"}));
 await page.route("**/api/health/live",route=>
  route.fulfill({status:200,contentType:"application/json",body:'{"status":"ok"}'}));
 await page.route("**/api/auth/telegram",route=>
  route.fulfill({status:200,contentType:"application/json",body:'{"user":{"firstName":"LUEMI","id":"qa"}}'}));
 await page.goto("http://127.0.0.1:5173/",{waitUntil:"domcontentloaded"});
 const intro=page.locator(".entry-state.cinematic-entry");
 await intro.waitFor();
 assert.deepEqual(await page.evaluate(()=>window.__earlyFullscreenProbe),{rootExists:false,called:true},
  "fullscreen is requested in the HTML head before the React app/root is mounted");
 assert.equal(await intro.evaluate(el=>el.classList.contains("hero-viewport-ready")),false,
  "the poster remains hidden while fullscreen geometry is still provisional");
 assert.equal(await intro.evaluate(el=>getComputedStyle(el,"::before").opacity),"0",
  "no cinematic photo must show in the temporary Telegram viewport");
 assert.equal(await intro.evaluate(el=>getComputedStyle(el,"::before").animationName),"none",
  "remove scale/zoom animation that makes the girl visibly jump");
 await page.setViewportSize({width:412,height:915});
 assert.equal(await intro.evaluate(el=>getComputedStyle(el,"::before").opacity),"0",
  "the resizing temporary viewport must not repaint the girl");
 await page.evaluate(()=>{
  window.Telegram.WebApp.isFullscreen=true;
  for(const handler of window.__tgListeners.fullscreenChanged??[])handler();
 });
 await page.waitForFunction(()=>{
  const el=document.querySelector(".entry-state.cinematic-entry");
  return el?.classList.contains("hero-viewport-ready")&&
   Number(getComputedStyle(el,"::before").opacity)>=.99;
 },null,{timeout:4000});
 const result=await intro.evaluate(el=>({
  height:el.getBoundingClientRect().height,
  imageAnimation:getComputedStyle(el,"::before").animationName,
  imageOpacity:Number(getComputedStyle(el,"::before").opacity)
 }));
 assert.ok(Math.abs(result.height-915)<=3,
  "first visible hero must match the final fullscreen viewport height");
 assert.equal(result.imageAnimation,"none");
 assert.equal(result.imageOpacity,1);
 assert.deepEqual(failures,[],"no uncaught errors during fullscreen handoff");
 console.log("LUEMI INTRO FULLSCREEN QA PASS "+JSON.stringify(result));
}finally{
 await page.close();await browser.close();
}
