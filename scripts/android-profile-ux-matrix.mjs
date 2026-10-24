/** LUEMI Android-size Chromium interaction matrix. Synthetic, not physical Telegram/A55 GPU evidence. */
import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true});
const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const ua="Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36";
const screenSizes=[[360,780],[393,852],[412,915]],themes=["light","dark"],sources=["feed","for-you","nearby"];
const variants=[...screenSizes.flatMap(([width,height])=>themes.map(theme=>({width,height,theme,rate:1}))),
 {width:393,height:852,theme:"light",rate:4}];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),measure=[];
const quantile=(arr,q)=>{const a=[...arr].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.ceil(a.length*q)-1)]??0};
try{
 for(const {width,height,theme,rate} of variants){
  const ctx=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,userAgent:ua});
  const page=await ctx.newPage(),errors=[];
  if(rate>1){const cdp=await ctx.newCDPSession(page);await cdp.send("Emulation.setCPUThrottlingRate",{rate});}
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(base+"/profile-qa.html",{waitUntil:"domcontentloaded"});
  await page.locator(".discovery-app").waitFor();
  // profile-qa.html mounts DiscoveryApp directly (without App.tsx's ambient
  // layer). Mount that same static CSS element in the synthetic fixture before
  // testing the mobile reduced-paint rule.
  await page.evaluate(()=>{
   const mist=document.createElement("div");
   mist.className="milky-mist";
   document.querySelector(".luemi-shell")?.prepend(mist);
  });
  if(theme==="dark")await page.evaluate(()=>window.__luemiQaPerf.theme());
  for(const source of sources)for(let round=0;round<2;round++){
   const key=width+"x"+height+"/"+theme+"/cpu"+rate+"/"+source+"/"+round;
   const tab=page.locator(".discovery-top-tabs [role=tab]");
   await tab.nth(sources.indexOf(source)).click();
   // Do not count the accepted 300ms tab-settling animation as a tap delay.
   await pause(340);
   const selector=source==="feed"?".discovery-deck-layer.deck-active .discovery-name-button":
    source==="for-you"?".fy-tile-photo":".nb-photo";
   const target=page.locator(selector).first();
   await target.waitFor({state:"visible",timeout:6000});
   const started=await page.evaluate(()=>performance.now());
   await target.click();
   const route=page.locator(".discovery-visitor-route");
   await route.waitFor({state:"attached",timeout:2600});
   const openMs=await page.evaluate(()=>performance.now())-started;
   assert.ok(openMs<(rate===1?1200:3200),key+": synthetic tap-to-route too slow: "+openMs);
   await pause(320);
   const chrome=await page.evaluate(()=>{
    const scene=document.querySelector(".discovery-app"),route=scene?.querySelector(".discovery-visitor-route");
    const front=route?.querySelector(".lh-header"),back=scene?.querySelector(":scope > .lh-header");
    return {front:front?.querySelectorAll(".lh-island img").length,
      back:back?.querySelectorAll(".lh-island img").length,
      browse:getComputedStyle(scene.querySelector(".discovery-browse-panel")).visibility,
      nav:getComputedStyle(scene.querySelector(".discovery-bottom-nav")).visibility,
      bg:getComputedStyle(route).backgroundColor,
      frontZ:Number(getComputedStyle(route).zIndex),backZ:Number(getComputedStyle(back).zIndex),
      routeWillChange:getComputedStyle(route).willChange,
      logoFilter:getComputedStyle(front.querySelector(".lh-island img")).filter,
      mistAnimation:getComputedStyle(document.querySelector(".milky-mist"),"::before").animationName};
   });
   assert.equal(chrome.front,1,key+": multiple moving logos");
   assert.equal(chrome.back,1,key+": duplicate browse logos");
   assert.equal(chrome.browse,"visible",key+": browse raster invalidated");
   assert.equal(chrome.nav,"visible",key+": navigation raster invalidated");
   assert.ok(chrome.frontZ>chrome.backZ,key+": logo occlusion lost");
   assert.ok(/^rgb\(/.test(chrome.bg),key+": visitor route must be opaque");
   assert.ok(chrome.routeWillChange.includes("transform"),key+": route compositor hint missing");
   assert.equal(chrome.logoFilter,"none",key+": animated logo filter still creates raster churn");
   assert.equal(chrome.mistAnimation,"none",key+": background GPU animation active on mobile");
   const box=await page.locator(".discovery-visitor-route .pm-identity").first().boundingBox();
   assert.ok(box&&box.width>80&&box.height>10,key+": missing identity sheet");
   const x=Math.max(26,box.x+Math.min(30,box.width*.09)),y=box.y+box.height*.5;
   const frames=[];
   await page.mouse.move(x,y);await page.mouse.down();
   for(let n=1;n<=12;n++){
    await page.mouse.move(x+Math.round(width*.23*n/12),y);
    frames.push(await page.evaluate(()=>{
     const scene=document.querySelector(".discovery-app"),route=scene.querySelector(".discovery-visitor-route");
     return {x:new DOMMatrixReadOnly(getComputedStyle(route).transform).m41,
       underlay:getComputedStyle(scene.querySelector(".discovery-browse-panel")).visibility,
       front:route.querySelectorAll(".lh-island img").length};
    }));
    await pause(30);
   }
   await page.mouse.up();
   assert.ok(frames.some(p=>p.x>width*.06),key+": route did not follow pointer");
   assert.ok(frames.every(p=>p.underlay==="visible"&&p.front===1),key+": flicker-prone paint/logo state");
   assert.ok(frames.every((p,i)=>i===0||p.x>=frames[i-1].x-8),key+": backward jump mid-drag");
   await pause(345);
   const rollback=await page.evaluate(()=>{
    const route=document.querySelector(".discovery-visitor-route");
    return route?new DOMMatrixReadOnly(getComputedStyle(route).transform).m41:null;
   });
   assert.ok(rollback!==null&&Math.abs(rollback)<9,key+": rollback incomplete");
   await page.evaluate(()=>window.dispatchEvent(new Event("resize")));
   assert.equal(await route.count(),1,key+": resize unmounted or duplicated route");
   await page.keyboard.press("Escape");
   await route.waitFor({state:"detached",timeout:2200});
   measure.push({key,openMs:Math.round(openMs)});
  }
  assert.deepEqual(errors,[],"browser page errors "+width+"/"+theme);
  await ctx.close();
 }
 const open=measure.map(row=>row.openMs);
 console.log("LUEMI_ANDROID_UX_MATRIX_PASS "+JSON.stringify({
  runs:measure.length,tapP50Ms:quantile(open,.50),tapP95Ms:quantile(open,.95),tapMaxMs:Math.max(...open)}));
 console.log("LUEMI_ANDROID_UX_SAMPLES "+JSON.stringify(measure));
}catch(error){
 console.error("LUEMI_ANDROID_UX_MATRIX_FAIL "+(error?.stack??String(error)));
 process.exitCode=1;
}finally{await browser.close();}
