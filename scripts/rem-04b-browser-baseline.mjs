/** REM-04B read-only baseline: this runs on the accepted REM-04A code before
 * any application changes. Real Chromium DOM, screenshots and Playwright trace.
 */
import {chromium} from "playwright";
import {mkdirSync,writeFileSync} from "node:fs";
const browser=await chromium.launch({headless:true,channel:"chrome",args:["--no-sandbox"]});
const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"});
const page=await ctx.newPage(),samples=[],errors=[];
page.on("pageerror",e=>errors.push(e.message));
const out="qa-artifacts/rem-04b/baseline";mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sample=async label=>{
 const m=await page.evaluate(()=>{
  const p=document.querySelector(".pm-dialog")??document.querySelector(".pm-inline");
  const hero=p?.querySelector(".pm-hero"),track=p?.querySelector(".pm-photo-track");
  const motion=p?.querySelector(".pm-photo-motion"),blur=p?.querySelector(".pm-photo-blur");
  const clear=track?.querySelectorAll(".pm-photo-slide img")??[];
  const b=blur?.querySelector("img");const s=hero?.getBoundingClientRect();
  const t=track?new DOMMatrixReadOnly(getComputedStyle(track).transform):null;
  const scene=document.querySelector(".discovery-app"),browse=scene?.querySelector(".discovery-browse-panel");
  const descendant=browse?.querySelector(".deck-entering .photo-progress");
  const layers=Array.from(clear).map(img=>{const r=img.getBoundingClientRect();
   return {photoId:img.closest(".pm-photo-slide")?.querySelector("img")?.getAttribute("src")?.slice(0,80),
    x:Math.round(r.x*100)/100,width:Math.round(r.width*100)/100,
    src:img.getAttribute("src")?.slice(0,80)};});
  const br=b?.getBoundingClientRect(),cr=clear[0]?.getBoundingClientRect();
  const anchor=(el)=>el?{x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,
   w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height,
   visible:getComputedStyle(el).visibility,opacity:getComputedStyle(el).opacity}:null;
  return {viewport:[innerWidth,innerHeight],theme:document.querySelector(".luemi-shell")?.getAttribute("data-theme"),
   hero:anchor(hero),motion:motion?getComputedStyle(motion).transform:null,
   trackOffset:t?.m41??null,trackTransition:track?getComputedStyle(track).transitionDuration:null,
   blur:{src:b?.getAttribute("src")?.slice(0,80),opacity:blur?getComputedStyle(blur).opacity:null,
    transform:b?getComputedStyle(b).transform:null,
    filter:b?getComputedStyle(b).filter:null,rect:anchor(b)},
   clear:layers,clearRect:anchor(clear[0]),browse:{visible:browse?getComputedStyle(browse).visibility:null,
     display:browse?getComputedStyle(browse).display:null,descendant:anchor(descendant),
     mounted:!!browse,scrollTop:scene?.querySelector(".fy-page-scroll")?.scrollTop??null},
   route:{exists:!!scene?.querySelector(".discovery-visitor-route"),
     reveal:scene?.hasAttribute("data-route-revealing"),
     offset:scene?.querySelector(".discovery-visitor-route")?
      new DOMMatrixReadOnly(getComputedStyle(scene.querySelector(".discovery-visitor-route")).transform).m41:null},
   overlap:br&&cr?{blurW:br.width,clearW:cr.width}:null};
 });
 samples.push({label,atMs:Math.round(performance.now()),...m});
 console.log("REM04B_BASELINE_SAMPLE "+JSON.stringify(samples.at(-1)));
 if(label!=="initial")await page.screenshot({path:out+"/"+String(samples.length).padStart(2,"0")+"-"+label+".png"});
 return m;
};
const stopTrace=async()=>{try{await ctx.tracing.stop({path:out+"/trace.zip"});}catch{}};
try{
 await ctx.tracing.start({screenshots:true,snapshots:true,sources:false});
 await page.goto("http://127.0.0.1:5173/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>!!window.__luemiQaPerf);
 await sample("initial");
 await page.getByRole("button",{name:"Профиль",exact:true}).click();
 await page.locator(".pm-inline .pm-photo-track").waitFor();
 await sleep(350);await sample("owner-expanded");
 const openGrab=page.getByRole("button",{name:"Развернуть анкету"});
 if(await openGrab.count()){
  await openGrab.click();await sleep(125);await sample("owner-sheet-midpoint");
  await sleep(420);await sample("owner-collapsed");
 }
 const hero=page.locator(".pm-inline .pm-hero");
 if(await hero.count()){
  const r=await hero.boundingBox();
  if(r){
   await page.mouse.move(r.x+r.width*.76,r.y+r.height*.36);
   await page.mouse.down();
   await page.mouse.move(r.x+r.width*.26,r.y+r.height*.36,{steps:7});
   await sample("owner-hero-drag");
   await page.mouse.up();await sleep(65);await sample("owner-hero-settle");
   await sleep(350);await sample("owner-hero-endpoint");
  }
 }
 await page.getByRole("button",{name:"Знакомства",exact:true}).click();
 await page.getByRole("tab",{name:"Для тебя",exact:true}).click();
 await page.locator(".fy-tile-photo").first().click();
 await page.locator(".discovery-visitor-route").waitFor();
 await sleep(375);await sample("visitor-for-you-covered");
 await page.evaluate(()=>{
  const browse=document.querySelector(".discovery-browse-panel");
  browse?.querySelector(".discovery-deck-layer")?.classList.add("deck-entering");
 });
 await sample("visitor-hidden-deck-explicit-visible");
 await page.evaluate(()=>window.__luemiQaBack?.());
 await sleep(70);await sample("visitor-route-revealing");
 await sleep(390);await sample("visitor-returned");
 await page.getByRole("tab",{name:"Рядом",exact:true}).click();await sleep(90);
 await sample("nearby-tab");
 const browse=await page.locator(".discovery-browse-panel").count();
 if(browse){
  await page.evaluate(()=>{
   document.querySelector(".discovery-app")?.setAttribute("data-profile-overlay","true");
   document.querySelector(".discovery-app")?.removeAttribute("data-route-revealing");
  });
  await sleep(140);await page.setViewportSize({width:375,height:700});
  await sample("hidden-resize");
  await page.evaluate(()=>{
   document.querySelector(".discovery-app")?.removeAttribute("data-profile-overlay");
   document.dispatchEvent(new Event("visibilitychange"));
  });
  await sample("after-hidden-resize");
 }
 await stopTrace();
 console.log("REM04B_BASELINE_SUMMARY "+JSON.stringify({samples:samples.length,errors,viewport:[393,852],
  blurExamples:samples.filter(x=>x.blur?.opacity&&Number(x.blur.opacity)>.2).length,
  hiddenDescendant:samples.find(x=>x.label==="visitor-hidden-deck-explicit-visible")?.browse}));
 writeFileSync(out+"/measurements.json",JSON.stringify({samples,errors},null,2));
 if(errors.length)process.exitCode=1;
}finally{await stopTrace();await ctx.close();await browser.close();}
