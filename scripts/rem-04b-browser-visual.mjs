import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,channel:"chrome",args:["--no-sandbox"]});
const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"});
const page=await ctx.newPage(),errors=[],records=[];
page.on("pageerror",e=>errors.push(e.message));
const dir="qa-artifacts/rem-04b/after";mkdirSync(dir,{recursive:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const near=(a,b,tol=.85)=>assert.ok(Math.abs(a-b)<=tol,"expected "+a+" ~ "+b+" within "+tol);
const snapshot=async(tag,requireHero=false)=>{
 const r=await page.evaluate(()=>{
  const profile=document.querySelector(".pm-dialog")||document.querySelector(".pm-inline");
  const track=profile?.querySelector(".pm-photo-track");
  const blurTrack=profile?.querySelector(".pm-photo-blur-track");
  const layer=profile?.querySelector(".pm-photo-blur");
  const motion=profile?.querySelector(".pm-photo-motion");
  const a=Array.from(track?.querySelectorAll(".pm-photo-slide img")??[]);
  const b=Array.from(blurTrack?.querySelectorAll(".pm-photo-blur-slide")??[]);
  const matrix=el=>el?new DOMMatrixReadOnly(getComputedStyle(el).transform):null;
  const root=document.querySelector(".discovery-app"),browse=root?.querySelector(".discovery-browse-panel");
  const entering=browse?.querySelector(".deck-entering .photo-progress");
  const rect=el=>{const r=el?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height}:null;};
  return {photoCount:a.length,blurCount:b.filter(el=>el.querySelector("img")).length,
   matching:b.every((el,i)=>!el.querySelector("img")||el.querySelector("img").currentSrc===a[i]?.currentSrc),
   trackX:matrix(track)?.m41??null,blurX:matrix(blurTrack)?.m41??null,
   parallax:matrix(motion)?.toString()??null,
   opacity:layer?Number(getComputedStyle(layer).opacity):null,
   filter:layer?.querySelector("img")?getComputedStyle(layer.querySelector("img")).filter:null,
   blurKeys:b.filter(el=>el.querySelector("img")).map(el=>el.dataset.blurPhotoId),
   blurRect:rect(b.find(el=>el.querySelector("img"))?.querySelector("img")),clearRect:rect(a[0]),
   route:!!root?.querySelector(".discovery-visitor-route"),browseMounted:!!browse,
   browseVisibility:browse?getComputedStyle(browse).visibility:null,
   browseDisplay:browse?getComputedStyle(browse).display:null,
   enteringVisibility:entering?getComputedStyle(entering).visibility:null,
   overlay:root?.getAttribute("data-profile-overlay"),revealing:root?.getAttribute("data-route-revealing")};
 });
 records.push({tag,...r});console.log("REM04B_AFTER "+JSON.stringify({tag,...r}));
 await page.screenshot({path:dir+"/"+String(records.length).padStart(2,"0")+"-"+tag+".png"});
 if(requireHero){
  assert.ok(r.photoCount>0&&r.blurCount<=3);
  assert.equal(r.matching,true,"photoId/media identity must match in aligned clear/blur slides");
  assert.notEqual(r.trackX,null);near(r.trackX,r.blurX);
  assert.equal(r.filter,"blur(11px)","unchanged optical design");
  assert.ok(r.opacity>=0&&r.opacity<=.9001);
 }
 return r;
};
try{
 await ctx.tracing.start({screenshots:true,snapshots:true,sources:false});
 await page.goto("http://127.0.0.1:5173/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>!!window.__luemiQaPerf);
 await page.getByRole("button",{name:"Профиль",exact:true}).click();
 await page.locator(".pm-inline .pm-photo-blur-track").waitFor();
 await delay(320);await snapshot("owner-expanded",true);
 await page.getByRole("button",{name:"Развернуть анкету"}).click();
 await delay(125);const mid=await snapshot("owner-midpoint",true);
 assert.ok(mid.opacity>.1&&mid.opacity<.9);
 await delay(400);const collapsed=await snapshot("owner-collapsed",true);
 near(collapsed.opacity,.9,.03);
 await page.locator(".pm-inline .pm-photo-progress button").nth(1).evaluate(el=>el.click());
 await delay(70);const move=await snapshot("hero-fractional-settle",true);
 assert.ok(move.trackX<-.2&&move.trackX>-393,"interpolated track not integer");
 await delay(320);await snapshot("hero-endpoint",true);
 await page.locator(".pm-inline .pm-photo-progress button").nth(0).evaluate(el=>el.click());
 await delay(60);await page.evaluate(()=>window.__luemiQaPerf.theme());
 await delay(55);await snapshot("theme-during-hero-settle",true);
 await page.getByRole("button",{name:"Знакомства",exact:true}).click();
 await page.getByRole("tab",{name:"Для тебя",exact:true}).click();
 // Set a real inner-scroll offset before overlay; a programmatic DOM click
 // avoids Playwright's scroll-into-view altering that measured offset.
 await page.locator(".fy-scroll").evaluate(el=>{el.scrollTop=132;});
 await delay(45);
 const savedScroll=await page.locator(".fy-scroll").evaluate(el=>el.scrollTop);
 assert.ok(savedScroll>1,"ForYou fixture actually scrolls");
 await page.locator(".fy-tile-photo").first().evaluate(el=>el.click());
 await page.locator(".discovery-visitor-route").waitFor();
 await delay(390);const covered=await snapshot("for-you-covered");
 assert.equal(covered.browseVisibility,"hidden");
 // REM-03B/03D nested Viewer should leave the same hero/blur gallery and
 // underlay untouched when its own modal returns to profile.
 await page.locator(".discovery-visitor-route .pm-photo-slide").first().evaluate(el=>el.click());
 await page.locator(".pm-viewer").waitFor();
 await page.keyboard.press("Escape");
 await page.locator(".pm-viewer").waitFor({state:"detached",timeout:3500});
 const viewerReturn=await snapshot("viewer-return-to-profile",true);
 assert.ok(viewerReturn.route,"Viewer Back must not close the containing profile");
 assert.equal(covered.browseDisplay,"flex","mounted underlay remains layout alive");
 await page.evaluate(()=>document.querySelector(".discovery-browse-panel .discovery-deck-layer")?.classList.add("deck-entering"));
 const leak=await snapshot("deck-entering-under-covered-route");
 assert.equal(leak.enteringVisibility,"hidden","explicitly visible deck descendant may not escape hidden underlay");
 await page.evaluate(()=>{window.__rem04bBrowse=document.querySelector(".discovery-browse-panel");});
 await page.evaluate(()=>window.__luemiQaBack?.());
 await delay(80);const reveal=await snapshot("route-revealing");
 assert.equal(reveal.browseVisibility,"visible");
 await delay(390);const returned=await snapshot("route-returned");
 assert.equal(returned.route,false);
 assert.equal(await page.evaluate(()=>window.__rem04bBrowse===document.querySelector(".discovery-browse-panel")),true,
   "underlay DOM is not remounted");
 near(await page.locator(".fy-scroll").evaluate(el=>el.scrollTop),savedScroll,1);
 await page.getByRole("tab",{name:"Рядом",exact:true}).click();await delay(80);
 await snapshot("nearby-mounted");
 await page.locator(".nb-photo").first().evaluate(el=>el.click());
 await page.locator(".discovery-visitor-route").waitFor();await delay(370);
 const nearbyCovered=await snapshot("nearby-covered");
 assert.equal(nearbyCovered.browseVisibility,"hidden");
 await page.evaluate(()=>window.__luemiQaBack?.());
 await page.locator(".discovery-visitor-route").waitFor({state:"detached",timeout:3200});
 await page.getByRole("tab",{name:"Лента",exact:true}).click();
 await page.locator(".discovery-deck-layer.deck-active .discovery-name-button").first().evaluate(el=>el.click());
 await page.locator(".discovery-visitor-route").waitFor();await delay(350);
 const feedCovered=await snapshot("feed-covered");
 assert.equal(feedCovered.browseVisibility,"hidden");
 await page.evaluate(()=>window.__luemiQaBack?.());
 await page.locator(".discovery-visitor-route").waitFor({state:"detached",timeout:3200});
 await page.evaluate(()=>{
  const app=document.querySelector(".discovery-app");app?.setAttribute("data-profile-overlay","true");
  app?.removeAttribute("data-route-revealing");
  Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"hidden"});
  document.dispatchEvent(new Event("visibilitychange"));
 });
 await page.setViewportSize({width:852,height:393});await delay(75);
 const landscape=await snapshot("covered-landscape");
 assert.equal(landscape.browseVisibility,"hidden");
 await page.evaluate(()=>{
  const app=document.querySelector(".discovery-app");app?.removeAttribute("data-profile-overlay");
  Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"visible"});
  document.dispatchEvent(new Event("visibilitychange"));
 });
 await snapshot("landscape-restore");
 assert.deepEqual(errors,[],"no browser exceptions");
 console.log("REM-04B BROWSER VISUAL QA PASS · bounded synchronized clear/blur, cover leak blocked, mounted background and reveal");
 writeFileSync(dir+"/measurements.json",JSON.stringify({records,errors},null,2));
}finally{
 await ctx.tracing.stop({path:dir+"/trace.zip"}).catch(()=>{});
 await ctx.close();await browser.close();
}
