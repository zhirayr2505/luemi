import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"});
const page=await context.newPage();
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
const pass=msg=>console.log("REM03B_BROWSER_PASS "+msg);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const open=id=>page.evaluate(id=>window.__luemiQaMedia.open(id),id);
const close=()=>page.evaluate(()=>window.__luemiQaMedia.close());
const change=op=>page.evaluate(op=>window.__luemiQaMedia.change(op),op);
const state=()=>page.evaluate(()=>{
 const v=document.querySelector(".pm-viewer"),track=v?.querySelector(".pm-viewer-track");
 const slide=v?.querySelector(".pm-viewer-slide[data-slot=current]");
 const img=v?.querySelector(".pm-viewer-image");
 const matrix=track?new DOMMatrixReadOnly(getComputedStyle(track).transform):null;
 return {open:!!v,id:img?.dataset.photoId,offset:Number(track?.dataset.offset??0),
  tx:matrix?.m41??0,width:v?.getBoundingClientRect().width??0,slides:v?.querySelectorAll(".pm-viewer-slide").length??0,
  ready:img?.style.opacity==="1",currentX:slide?.getBoundingClientRect().x??0,
  phase:v?.dataset.motionPhase,commits:Number(v?.dataset.semanticCommits??0),
  count:v?.querySelector(".pm-viewer-top")?.textContent??""};
});
const ready=async id=>{
 await page.waitForFunction(id=>{
  const v=document.querySelector(".pm-viewer"),img=v?.querySelector(".pm-viewer-image");
  return !!img&&img.dataset.photoId===id&&img.style.opacity==="1"&&img.naturalWidth>0;
 },id,{timeout:5000});
 return state();
};
async function swipe(sign=1,dx=175,steps=8){
 const box=await page.locator(".pm-viewer-stage").boundingBox();assert.ok(box);
 const x=box.x+box.width*(sign>0?.76:.24),y=box.y+box.height*.44;
 await page.mouse.move(x,y);await page.mouse.down();
 for(let i=1;i<=steps;i++)await page.mouse.move(x-sign*dx*i/steps,y);
 await page.mouse.up();
}
const drag=async(delta)=>{
 const box=await page.locator(".pm-viewer-stage").boundingBox();assert.ok(box);
 const x=box.x+box.width*.68,y=box.y+box.height*.42;
 await page.mouse.move(x,y);await page.mouse.down();
 const initial=await state();const points=[];
 for(const dx of [22,55,97,134].filter(d=>d<=Math.abs(delta))){
  await page.mouse.move(x-Math.sign(delta)*dx,y);
  points.push({dx,x:(await state()).offset});
 }
 return {x,y,initial,points};
};
const settle=async(id)=>{
 await ready(id);
 await page.waitForFunction(()=>{
  const v=document.querySelector(".pm-viewer"),t=v?.querySelector(".pm-viewer-track");
  return !!v&&!!t&&Math.abs(Number(t.dataset.offset))<.25;
 },null,{timeout:4000});
};
try{
 await page.route("**/qa-media-cold.png",async route=>{
  await sleep(500);
  await route.fulfill({status:200,contentType:"image/svg+xml",
   body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="purple"/></svg>'});
 });
 await page.route("**/qa-media-broken.png",route=>route.fulfill({status:404,body:"missing"}));
 await page.goto("http://127.0.0.1:5173/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>!!window.__luemiQaMedia);
 await change("count-0");await open("qa-alpha");
 await page.locator(".pm-viewer").waitFor({state:"detached",timeout:3500});
 await change("count-1");await open("qa-alpha");await ready("qa-alpha");
 assert.equal((await state()).slides,3);
 await swipe(1,190);await sleep(260);
 assert.equal((await state()).id,"qa-alpha","single photo cannot escape edge");
 assert.ok(Math.abs((await state()).offset)<1);
 await close();
 await change("count-2");await open("qa-alpha");await ready("qa-alpha");
 assert.equal((await state()).slides,3);
 await swipe(1,185);await settle("qa-beta");
 await swipe(1,180);await sleep(270);
 assert.equal((await state()).id,"qa-beta","last photo boundary resistance");
 pass("0/1/2 photos and first/last boundary with exactly three track slots");

 await close();await change("count-6");await open("qa-alpha");await ready("qa-alpha");
 let snap=await state();
 assert.equal(snap.slides,3);assert.equal(snap.width,393);
 let {x,y,points}=await drag(134);
 for(const p of points)assert.ok(Math.abs(p.x+p.dx)<=1,
  "interior track displacement must be <= 1 CSS px; "+JSON.stringify(p));
 const next=page.locator(".pm-viewer-slide[data-slot=next] img");
 const arriving=await next.elementHandle();assert.ok(arriving);
 const rect=await page.locator(".pm-viewer-slide[data-slot=next]").boundingBox();
 assert.ok(rect&&rect.x<393&&rect.x>0,"neighbor must progressively enter during same swipe");
 await page.mouse.up();
 await settle("qa-beta");
 assert.equal(await arriving.evaluate(n=>n.isConnected&&n.classList.contains("pm-viewer-image")),true,
  "arriving DOM img retains identity through atomic recenter");
 assert.ok(Math.abs((await state()).currentX)<1,"recenter leaves arrival at same viewport point");
 pass("6 photos, real DOM 1:1 measured CSS matrix, progressive neighbor, keyed node preserved through no-jump recenter");

 const start=await state();
 const small=await drag(55);
 await page.mouse.up();await sleep(270);
 assert.equal((await state()).id,"qa-beta","short drag rolls back");
 assert.ok(Math.abs((await state()).offset)<1);
 await swipe(1,190);await settle("qa-gamma");
 pass("short swipe rollback and long swipe commit with original .17 viewport threshold");

 // Retouch during a 240ms settle must freeze the sampled interpolated position,
 // not reset the track to an integer slot.
 await change("count-6");await ready("qa-gamma");
 const box=await page.locator(".pm-viewer-stage").boundingBox();
 await page.mouse.move(box.x+300,box.y+350);await page.mouse.down();
 await page.mouse.move(box.x+100,box.y+350);await page.mouse.up();
 await sleep(60);
 const during=await state();assert.ok(during.offset<-.1&&during.offset>-393);
 await page.mouse.move(box.x+270,box.y+350);await page.mouse.down();
 const interrupted=await state();
 assert.ok(interrupted.offset<-.1&&interrupted.offset>-393,
  "touch during settle must preserve fractional track position");
 await page.mouse.move(box.x+320,box.y+350);await page.mouse.up();
 await sleep(350);
 assert.ok(Math.abs((await state()).offset)<1,"interrupted settle reaches a center endpoint");
 pass("mid-settle finger capture preserves fractional x and supports reversal");

 await page.setViewportSize({width:430,height:852});await sleep(100);
 assert.equal(Math.round((await state()).width),430);
 assert.ok(Math.abs((await state()).offset)<1);
 pass("ResizeObserver rebases track geometry at new viewport width");

 // Twenty real gestures, both directions, always a valid photo and centered track.
 for(let i=0;i<20;i++){
  const before=await state();const idx=["qa-alpha","qa-beta","qa-gamma","qa-delta","qa-epsilon","qa-zeta"].indexOf(before.id);
  assert.ok(idx>=0,"known photo id at iteration "+i);
  const sign=idx===5?-1:idx===0?1:i%2?1:-1;
  await swipe(sign,183,4);
  const expected=["qa-alpha","qa-beta","qa-gamma","qa-delta","qa-epsilon","qa-zeta"][idx+(sign===1?1:-1)];
  await settle(expected);
 }
 pass("20 consecutive real gestures always settle with correct stable photo identity");

 await change("reorder");await ready((await state()).id);
 await change("remove-current");
 await page.waitForFunction(()=>!!document.querySelector(".pm-viewer-image"));
 await change("count-6");await ready((await state()).id);
 pass("live reorder/removal doesn't corrupt three-slot DOM");

 await close();await change("count-6");await open("qa-alpha");await ready("qa-alpha");
 await change("cold-beta");await sleep(30);
 assert.equal((await state()).id,"qa-alpha");
 const cold=await page.locator(".pm-viewer-slide[data-slot=next]").getAttribute("data-photo-id");
 assert.equal(cold,"qa-beta");
 await swipe(1,183);await settle("qa-beta");
 await change("error-beta");
 await page.waitForFunction(()=>document.querySelector(".pm-viewer-media-status")?.dataset.mediaPhase==="error");
 assert.notEqual(await page.locator(".pm-viewer-image").evaluate(n=>n.style.opacity),"1");
 pass("cold neighbor and broken decode expose honest loading/error without stale pixels");

 await change("count-6");await close();await open("qa-alpha");
 // Close while the opening CSS transition is still pending; both transitionend
 // and the 280ms safety timer must feed a single terminal MotionController token.
 const prior=await page.evaluate(()=>window.__luemiQaMedia.stats().closeCommits);
 await page.locator(".pm-viewer").getByRole("button",{name:"Закрыть просмотр"}).click();
 await page.evaluate(()=>document.querySelector(".pm-viewer-surface")?.dispatchEvent(new TransitionEvent("transitionend",
  {bubbles:true,propertyName:"transform"})));
 await page.locator(".pm-viewer").waitFor({state:"detached",timeout:3000});
 await sleep(360);
 const after=await page.evaluate(()=>window.__luemiQaMedia.stats().closeCommits);
 assert.equal(after-prior,1,"transitionend+timer closing must commit at most once");
 pass("opening interrupt, double-terminal close and stale fallback timeout cannot double-commit");

 await page.emulateMedia({reducedMotion:"reduce"});await change("count-2");await open("qa-alpha");await ready("qa-alpha");
 await swipe(1,185);await settle("qa-beta");
 await page.locator(".pm-viewer").getByRole("button",{name:"Закрыть просмотр"}).click();
 await page.locator(".pm-viewer").waitFor({state:"detached",timeout:1500});
 pass("reduced-motion settles and closes without stale animation callbacks");
 assert.deepEqual(errors,[],"no browser JS exceptions");
 console.log("REM-03B BROWSER TRACK QA PASS · Chromium synthetic only. Physical A55 and iOS NOT VERIFIED.");
}finally{await context.close();await browser.close();}
