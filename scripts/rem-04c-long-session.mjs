/** REM-04C: same-browser before/after long-session evidence, never device/GPU proof. */
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {chromium} from "playwright";
const dir="qa-artifacts/rem-04c";
mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome",args:["--no-sandbox","--js-flags=--expose-gc"]});
const sites=[["accepted","http://127.0.0.1:5174"],["current","http://127.0.0.1:5173"]];
const results={date:new Date().toISOString(),sites:[],limitations:[
 "Chromium desktop with Android UA/touch simulation is not Telegram Android WebView or iOS WKWebView",
 "DOM image elements and JS heap do not represent GPU/decoded texture residency",
 "Instrumented global window/document listeners count add/removeEventListener only; detached DOM element listeners are deliberately not strongly referenced",
 "GC/idle samples are laboratory observations, not guarantees of OS memory return"]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const instrumentation=()=>{
 const counts={listeners:0,raf:0,timers:0,urls:0,decodes:0};
 const existing=[];
 const originalAdd=EventTarget.prototype.addEventListener;
 const originalRemove=EventTarget.prototype.removeEventListener;
 const capture=o=>typeof o==="boolean"?o:!!o?.capture;
 EventTarget.prototype.addEventListener=function(type,fn,options){
  if((this===window||this===document)&&fn&&!existing.some(x=>x.target===this&&x.type===type&&x.fn===fn&&x.capture===capture(options))){
   existing.push({target:this,type,fn,capture:capture(options)});counts.listeners++;
  }
  return originalAdd.call(this,type,fn,options);
 };
 EventTarget.prototype.removeEventListener=function(type,fn,options){
  const i=this===window||this===document?existing.findIndex(x=>x.target===this&&x.type===type&&x.fn===fn&&x.capture===capture(options)):-1;
  if(i>=0){existing.splice(i,1);counts.listeners--;}
  return originalRemove.call(this,type,fn,options);
 };
 const rafs=new Set(),timers=new Set(),urls=new Set();
 const oldRaf=window.requestAnimationFrame.bind(window);
 const oldCancel=window.cancelAnimationFrame.bind(window);
 window.requestAnimationFrame=callback=>{
  const id=oldRaf(t=>{rafs.delete(id);counts.raf=rafs.size;callback(t);});
  rafs.add(id);counts.raf=rafs.size;return id;
 };
 window.cancelAnimationFrame=id=>{rafs.delete(id);counts.raf=rafs.size;return oldCancel(id);};
 const oldTimeout=window.setTimeout.bind(window),oldClear=window.clearTimeout.bind(window);
 window.setTimeout=(callback,delay,...args)=>{
  const id=oldTimeout((...rest)=>{timers.delete(id);counts.timers=timers.size;
   if(typeof callback==="function")callback(...rest);else throw new Error("string timer unsupported in QA");
  },delay,...args);
  timers.add(id);counts.timers=timers.size;return id;
 };
 window.clearTimeout=id=>{timers.delete(id);counts.timers=timers.size;return oldClear(id);};
 const oldCreate=URL.createObjectURL.bind(URL),oldRevoke=URL.revokeObjectURL.bind(URL);
 URL.createObjectURL=(blob)=>{const url=oldCreate(blob);urls.add(url);counts.urls=urls.size;return url;};
 URL.revokeObjectURL=url=>{urls.delete(url);counts.urls=urls.size;return oldRevoke(url);};
 const oldDecode=HTMLImageElement.prototype.decode;
 if(oldDecode)HTMLImageElement.prototype.decode=function(...args){
  counts.decodes++;
  return Promise.resolve().then(()=>oldDecode.apply(this,args)).finally(()=>counts.decodes--);
 };
 window.__rem04cMetrics=()=>({...counts});
};
async function run(name,url){
 const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
  userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"});
 await context.addInitScript(instrumentation);
 const page=await context.newPage(),errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.route("**/*",route=>route.request().url().startsWith(url+"/")?route.continue():route.abort("blockedbyclient"));
 const cdp=await context.newCDPSession(page);
 await cdp.send("Performance.enable");
 await context.tracing.start({screenshots:true,snapshots:true,sources:false});
 const measure=async(tag)=>{
  await sleep(130);
  await cdp.send("HeapProfiler.collectGarbage");
  const perf=Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(v=>[v.name,v.value]));
  const dom=await page.evaluate(()=>{
   const r=document.querySelector(".fy-scroll"),library=r?.getBoundingClientRect();
   const windowImages=[...(r?.querySelectorAll(".fy-tile-photo > img")??[])].filter(n=>{
    if(!library)return false;const b=n.getBoundingClientRect();
    return b.bottom>=library.top&&b.top<=library.bottom;
   });
   const images=[...document.querySelectorAll("img")];
   return {imgNodes:images.length,decodedDomImages:images.filter(i=>i.complete&&i.naturalWidth>0).length,
    fyLibraryImages:r?.querySelectorAll(".fy-tile-photo > img").length??0,
    fyNearWindowImages:windowImages.length,
    fyExpandedImages:document.querySelectorAll(".fy-expanded .fy-tile-photo > img").length,
    fyExpandedTiles:document.querySelectorAll(".fy-expanded .fy-tile-photo").length,
    fyLibraryTiles:r?.querySelectorAll(".fy-tile-photo").length??0,
    libraryScroll:r?.scrollTop??0,
    imageBlurNodes:document.querySelectorAll(".pm-photo-blur-slide img").length,
    visitorRoutes:document.querySelectorAll(".discovery-visitor-route").length,
    domNodes:document.querySelectorAll("*").length,
    reactChildren:document.querySelector("#root")?.children.length??0,
    own:window.__rem04cMetrics?.()??null
   };
  });
  return {tag, ...dom,heap:Math.round(perf.JSHeapUsedSize??0),cdpNodes:perf.Nodes??null};
 };
 try{
  await page.goto(url+"/profile-qa.html",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>!!window.__luemiQaPerf && !!window.__rem04cMetrics);
  await page.getByRole("tab",{name:"Для тебя"}).click();
  await sleep(450);
  await page.locator(".fy-scroll").evaluate(node=>node.scrollTop=360);
  await sleep(125);
  const initial=await measure("library-warm");
  assert.ok(initial.fyLibraryImages>0&&initial.own!==null,"measuring owner must be installed");
  const originalScroll=initial.libraryScroll;
  // Open by DOM click: Playwright auto-scroll would change the library scroll
  // before the collection switch, incorrectly attributing test scrolling to LUEMI.
  await page.getByRole("button",{name:"Смотреть всех"}).first().evaluate(node=>node.click());
  await page.locator(".fy-expanded .fy-grid").waitFor();
  const expanded=await measure("expanded");
  assert.equal(expanded.fyExpandedImages,expanded.fyExpandedTiles);
  assert.ok(expanded.fyExpandedTiles>0);
  await page.screenshot({path:dir+"/"+name+"-expanded.png"});
  const count=await page.locator(".fy-expanded .fy-tile-photo").count();
  const checkpoints=[];
  for(let i=0;i<50;i++){
   await page.locator(".fy-expanded .fy-tile-photo").nth(i%count).click();
   await page.locator(".discovery-visitor-route").waitFor();
   await sleep(285);
   await page.evaluate(()=>window.__luemiQaBack?.());
   await page.locator(".discovery-visitor-route").waitFor({state:"detached",timeout:3500});
   if(i===0||i===9||i===29||i===49)checkpoints.push({cycle:i+1,...await measure("cycle-"+(i+1))});
  }
  const after50=await measure("after50");
  console.log("REM04C_PLATEAU "+JSON.stringify({name,expanded,checkpoints,after50}));
  assert.equal(after50.visitorRoutes,0,"visitor route must leave no mounted route");
  assert.ok(after50.own.urls<=expanded.own.urls,"app-owned object URLs must not grow");
  assert.ok(after50.own.listeners<=expanded.own.listeners+4,"app-owned global window/document listeners must plateau");
  // An expanded scroll is independent of the covered library scroll.
  await page.locator(".fy-expanded .fy-grid").evaluate(node=>node.scrollTop=245);
  await page.getByRole("button",{name:"Назад к подборкам"}).click();
  const restored=await measure("library-return");
  console.log("REM04C_SCROLL "+JSON.stringify({name,originalScroll,expandedScroll:expanded.libraryScroll,restoredScroll:restored.libraryScroll}));
  assert.ok(Math.abs(restored.libraryScroll-originalScroll)<=1,
   "REM-04C must keep original library scroll geometry, no scroll-to-zero");
  assert.equal(restored.fyLibraryImages,initial.fyLibraryImages,"all library media restored");
  // Adjacent browse tabs and cached Nearby preparation are part of a long session.
  await page.getByRole("tab",{name:"Рядом"}).click();
  await sleep(470);
  const nearby=await measure("nearby");
  await page.getByRole("tab",{name:"Лента"}).click();
  await sleep(470);
  const feed=await measure("feed");
  await page.getByRole("tab",{name:"Для тебя"}).click();
  await sleep(470);
  const forYouReturn=await measure("for-you-return");
  assert.ok(Math.abs(forYouReturn.libraryScroll-originalScroll)<=1);
  // PhotoViewer's pre-existing bounded three-slide resource contract (six IDs).
  await page.evaluate(()=>window.__luemiQaMedia.change("count-6"));
  await page.waitForFunction(()=>window.__luemiQaMedia?.stats().photoCount===6);
  await page.evaluate(()=>window.__luemiQaMedia.open("qa-alpha"));
  await page.locator(".pm-viewer").waitFor();
  const six=["qa-alpha","qa-beta","qa-gamma","qa-delta","qa-epsilon","qa-zeta"];
  for(const [direction,ids] of [["ArrowRight",six.slice(1)],["ArrowLeft",six.slice(0,-1).reverse()]]){
   for(const id of ids){
    await page.keyboard.press(direction);
    await page.waitForFunction(expected=>document.querySelector(".pm-viewer-image")?.dataset.photoId===expected,id,{timeout:3000});
   }
  }
  // Use explicit source fixture to check six-photo window and teardown reliably.
  const viewer=await measure("viewer-six");
  assert.ok(viewer.imageBlurNodes<=3);
  assert.equal(await page.locator(".pm-viewer-slide").count(),3,"bounded three slide viewer");
  await page.evaluate(()=>window.__luemiQaMedia.back());
  await page.locator(".pm-viewer").waitFor({state:"detached",timeout:4500});
  await page.evaluate(()=>window.__luemiQaPerf.theme());
  await page.setViewportSize({width:375,height:768});
  await sleep(190);
  const resized=await measure("theme-viewport");
  await page.getByRole("button",{name:"Профиль",exact:true}).click();
  await page.locator(".pm-inline .pm-photo-track").waitFor();
  for(let n=0;n<5;n++){
   await page.locator(".pm-inline .pm-sheet-grab").evaluate(button=>button.click());
   await page.waitForFunction(()=>document.querySelector(".pm-inline")?.dataset.sheetState==="collapsed");
   await sleep(370);
   await page.locator(".pm-inline .pm-sheet-grab").evaluate(button=>button.click());
   await page.waitForFunction(()=>document.querySelector(".pm-inline")?.dataset.sheetState==="expanded");
   await sleep(370);
  }
  const owner=await measure("owner-after-reentry");
  assert.ok(owner.imageBlurNodes<=3,"REM-04B blur cap preserved");
  let teardown=null;
  if(name==="current"){
   await page.evaluate(()=>window.__luemiQaUnmount());
   teardown=await measure("react-teardown");
   assert.equal(teardown.reactChildren,0,"all mounted React content removed");
  }
  assert.deepEqual(errors,[],"browser page errors");
  const result={name,initial,expanded,checkpoints,after50,restored,nearby,feed,forYouReturn,viewer,resized,owner,teardown,errors};
  console.log("REM04C_SESSION "+JSON.stringify(result));
  return result;
 }finally{
  await context.tracing.stop({path:dir+"/"+name+".trace.zip"}).catch(()=>{});
  await context.close();
 }
}
try{
 for(const [name,url] of sites)results.sites.push(await run(name,url));
 const [base,after]=results.sites;
 assert.ok(after.expanded.fyLibraryImages<base.expanded.fyLibraryImages,
  "measured covered-library image residency must be reduced");
 assert.equal(after.expanded.fyExpandedImages,base.expanded.fyExpandedImages,
  "the visible expanded collection must keep every approved image");
 assert.equal(after.initial.fyLibraryImages,base.initial.fyLibraryImages,
  "no change to ordinary ForYou library media");
 console.log("REM04C_COMPARE "+JSON.stringify({
  base:base.expanded.fyLibraryImages,after:after.expanded.fyLibraryImages,
  visibleGrid:after.expanded.fyExpandedImages,
  cycles:50,scrollDrift:after.restored.libraryScroll-after.initial.libraryScroll}));
 writeFileSync(dir+"/comparison.json",JSON.stringify(results,null,2));
}finally{await browser.close();}
