import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {chromium} from "playwright";
/** V3 VISUAL P0: capture actual Chromium pixels and enforce opaque identity/underlay invariants.
 * Screenshot traces are artifacts; no assertion of physical Galaxy A55 GPU rendering. */
const browser=await chromium.launch({headless:true,channel:"chrome",args:["--no-sandbox"]});
const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"});
const page=await ctx.newPage(),errors=[],records=[];
page.on("pageerror",e=>errors.push(e.message));
const dir="qa-artifacts/rem-04b/after";mkdirSync(dir,{recursive:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const snap=async(label)=>{
 const reading=await page.evaluate(()=>{
  const profile=document.querySelector(".discovery-visitor-route .v3-int-root")||
   document.querySelector(".pm-inline .v3-int-root");
  const app=document.querySelector(".discovery-app"),route=app?.querySelector(".discovery-visitor-route");
  const bg=profile?.querySelector(".v3-int-opaque"),sheet=profile?.querySelector(".v3-int-sheet");
  const face=profile?.querySelector(".v3-int-mask"),layer=profile?.querySelector(".v3-int-ambient");
  const imgs=[...(profile?.querySelectorAll(".v3-int-photo-slide img")??[])];
  const rect=x=>{const r=x?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height}:null;};
  const prs=rect(profile),s=rect(sheet),f=rect(face);
  const tested=[];
  if(prs)for(const rx of [.12,.5,.88])for(const ry of [.17,.45,.8]){
   const x=prs.x+prs.w*rx,y=prs.y+prs.h*ry,top=document.elementFromPoint(x,y);
   tested.push({rx,ry,covered:!!top?.closest(".v3-int-root,.lh-header,.pm-viewer,.pm-preview-toolbar")});
  }
  return {mode:profile?.dataset.sheetState==="collapsed"?"compact":profile?.dataset.sheetState,route:!!route,profile:prs,sheet:s,face:f,
   backingBg:bg?getComputedStyle(bg).backgroundImage:null,
   backingOpacity:bg?getComputedStyle(bg).opacity:null,
   shellBg:profile?getComputedStyle(profile).backgroundColor:null,
   sheetBg:sheet?getComputedStyle(sheet).backgroundColor:null,
   isolated:profile?getComputedStyle(profile).isolation:null,
   backdropLayer:!!layer,blurCount:layer?.querySelectorAll("img").length??0,
   images:imgs.map(x=>({id:x.dataset.photoId,ready:x.complete&&x.naturalWidth>0})),
   activeDot:profile?.querySelector(".v3-int-photo-dots [aria-current=true]")?.getAttribute("aria-label")??null,
   underlay:app?.querySelector(".discovery-browse-panel")?
    getComputedStyle(app.querySelector(".discovery-browse-panel")).visibility:null,
   overlay:app?.getAttribute("data-profile-overlay"),tested};
 });
 records.push({label,...reading});
 const file=dir+"/"+String(records.length).padStart(2,"0")+"-"+label+".png";
 await page.screenshot({path:file});
 console.log("PROFILE_V3_VISUAL_FRAME "+JSON.stringify({label,mode:reading.mode,route:reading.route,
  sheet:reading.sheet?.y,faceW:reading.face?.w,blurCount:reading.blurCount,covered:reading.tested.every(x=>x.covered)}));
 assert.equal(reading.isolated,"isolate","profile compositing must be isolated");
 assert.ok(reading.backingBg?.includes("gradient"),"non-transparent continuous backing raster");
 assert.ok(reading.tested.every(x=>x.covered),"profile route must occlude all tested underlying deck coordinates");
 assert.ok(reading.images.length<=6,"bounded fixture image count");
 return reading;
};
try{
 await ctx.tracing.start({screenshots:true,snapshots:true,sources:false});
 await page.goto("http://127.0.0.1:5173/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Профиль",exact:true}).click();
 const root=page.locator(".pm-inline .v3-int-root");await root.waitFor({state:"visible"});
 const compact=await snap("owner-compact");
 assert.equal(compact.mode,"compact");assert.ok(compact.face?.w>=56&&compact.face.w<150);
 await root.locator(".v3-int-mask").evaluate(el=>el.click());
 await page.locator('.pm-inline [data-sheet-state="expanded"]').waitFor();
 const expanded=await snap("owner-expanded");
 assert.ok(expanded.face?.w>compact.face.w*2.4,"one persistent hero grows from compact avatar");
 // Overlay opacity and sheet compositor samples across repeated rapid reversals.
 const handle=root.locator(".v3-int-handle");
 await ctx.tracing.startChunk({title:"V3 24 reversals"}).catch(()=>{});
 for(let i=0;i<24;i++){
  await handle.press("Enter");await delay(22);
  if([3,8,13,18,23].includes(i))await snap("reversal-"+i);
 }
 await delay(340);
 const final=await snap("owner-reversed");
 assert.equal(final.mode,"expanded","24 reversals starting expanded end expanded");
 await root.locator(".v3-int-photo-dots button").nth(1).click();await delay(250);
 const photo=await snap("photo-2-selected");assert.equal(photo.activeDot,"Фото 2 из 3");
 await page.getByRole("button",{name:"Знакомства",exact:true}).click();
 await page.getByRole("tab",{name:"Для тебя",exact:true}).click();
 const scroll=page.locator(".fy-scroll");await scroll.evaluate(el=>el.scrollTop=125);
 const scrollTop=await scroll.evaluate(el=>el.scrollTop);
 await page.locator(".fy-tile-photo").first().evaluate(el=>el.click());
 await page.locator(".discovery-visitor-route").waitFor();
 await delay(310);const visitor=await snap("for-you-covered");
 assert.equal(visitor.route,true);assert.equal(visitor.mode,"compact");
 assert.equal(visitor.underlay,"visible","do not unmount Discovery while route is active");
 assert.equal(visitor.overlay,"true");
 await page.locator(".discovery-visitor-route .v3-int-mask").evaluate(el=>el.click());
 await delay(300);await snap("for-you-expanded");
 await page.locator(".discovery-visitor-route .v3-int-mask").evaluate(el=>el.click());
 await page.locator(".pm-viewer").waitFor({state:"attached"});
 await page.keyboard.press("Escape");await page.locator(".pm-viewer").waitFor({state:"detached",timeout:3500});
 const returnedFromViewer=await snap("viewer-return");
 assert.equal(returnedFromViewer.route,true);
 await page.evaluate(()=>document.querySelector(".discovery-browse-panel .discovery-deck-layer")?.classList.add("deck-entering"));
 await snap("deck-entering-under-covered-route");
 await page.keyboard.press("Escape");await page.locator(".discovery-visitor-route").waitFor({state:"detached",timeout:3500});
 await delay(80);const returned=await page.evaluate(()=>({
  overlay:document.querySelector(".discovery-app")?.dataset.profileOverlay,
  scroll:document.querySelector(".fy-scroll")?.scrollTop
 }));
 assert.equal(returned.overlay,"false");assert.ok(Math.abs((returned.scroll??0)-scrollTop)<2);
 await page.getByRole("tab",{name:"Рядом",exact:true}).click();await delay(190);
 await page.locator(".nb-photo").first().evaluate(el=>el.click());await page.locator(".discovery-visitor-route").waitFor();
 await delay(330);await snap("nearby-covered");
 await page.keyboard.press("Escape");await page.locator(".discovery-visitor-route").waitFor({state:"detached",timeout:3500});
 await page.getByRole("tab",{name:"Лента",exact:true}).click();
 await page.locator(".discovery-deck-layer.deck-active .discovery-name-button").first().evaluate(el=>el.click());
 await page.locator(".discovery-visitor-route").waitFor();await delay(340);await snap("feed-covered");
 await page.keyboard.press("Escape");await page.locator(".discovery-visitor-route").waitFor({state:"detached",timeout:3500});
 assert.deepEqual(errors,[],"no Chromium errors");
 writeFileSync(dir+"/measurements.json",JSON.stringify({records,errors},null,2));
 console.log("REM-04B V3 VISUAL QA PASS; sampled compositor/cover, physical A55 flash unverified");
}finally{await ctx.tracing.stop({path:dir+"/trace.zip"}).catch(()=>{});await ctx.close();await browser.close();}
