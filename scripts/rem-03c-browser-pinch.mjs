import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,channel:"chrome",args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"});
const page=await context.newPage();
const cdp=await context.newCDPSession(page);
const failures=[],pass=m=>console.log("REM03C_BROWSER_PASS "+m);
page.on("pageerror",e=>failures.push(e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const send=async(type,points)=>{
 const eventName=type==="touchStart"?"touchstart":type==="touchMove"?"touchmove":
  type==="touchEnd"?"touchend":null;
 const before=eventName?await page.evaluate(()=>window.__rem03cSeq??-1):-1;
 await cdp.send("Input.dispatchTouchEvent",{type,touchPoints:points.map(p=>({
  id:p.id,x:p.x,y:p.y,force:1,radiusX:2,radiusY:2}))});
 if(eventName&&before>=0)await page.waitForFunction(({eventName,before})=>
  window.__rem03cEvents?.some(e=>e.seq>before&&e.event===eventName),
  {eventName,before},{timeout:3000});
};
const p=(id,x,y)=>({id,x,y});
const open=id=>page.evaluate(id=>window.__luemiQaMedia.open(id),id);
const change=op=>page.evaluate(op=>window.__luemiQaMedia.change(op),op);
const ready=async id=>{
 await page.waitForFunction(id=>{
  const img=document.querySelector(".pm-viewer-image");
  return img?.dataset.photoId===id&&img.style.opacity==="1"&&img.naturalWidth>0;
 },id,{timeout:6000});
};
const state=()=>page.evaluate(()=>{
 const viewer=document.querySelector(".pm-viewer"),img=viewer?.querySelector(".pm-viewer-image");
 const surface=viewer?.querySelector(".pm-viewer-surface"),stage=viewer?.querySelector(".pm-viewer-stage");
 const track=viewer?.querySelector(".pm-viewer-track");
 const m=img?new DOMMatrixReadOnly(getComputedStyle(img).transform):null;
 const stageM=surface?new DOMMatrixReadOnly(getComputedStyle(surface).transform):null;
 const w=surface?.clientWidth??0,h=surface?.clientHeight??0;
 const iw=img?.naturalWidth??0,ih=img?.naturalHeight??0;
 const k=iw&&ih?Math.min(w/iw,h/ih):0;
 const cw=iw*k,ch=ih*k,s=m?Math.hypot(m.m11,m.m12):1;
 return {open:!!viewer,id:img?.dataset.photoId,scale:s,tx:m?.m41??0,ty:m?.m42??0,
  matrix:m?.toString(),natural:[iw,ih],viewport:[w,h],content:[cw,ch],
  fit:[(w-cw)/2,(h-ch)/2,cw,ch],stageOpacity:Number(stage?getComputedStyle(stage).opacity:1),
  surfaceY:stageM?.m42??0,offset:Number(track?.dataset.offset??0),
  commits:Number(viewer?.dataset.semanticCommits??0),phase:viewer?.dataset.motionPhase};
});
const near=(a,b,eps=1)=>assert.ok(Math.abs(a-b)<=eps,
 "Expected "+a+" near "+b+" (±"+eps+")");
const bounds=t=>{
 const [w,h]=t.viewport,[cw,ch]=t.content;
 assert.ok(w>0&&h>0&&cw>0&&ch>0);
 const mx=Math.max(0,(cw*t.scale-w)/2),my=Math.max(0,(ch*t.scale-h)/2);
 assert.ok(Math.abs(t.tx)<=mx+.7,"x exceeds true contained-image bound: "+JSON.stringify(t));
 assert.ok(Math.abs(t.ty)<=my+.7,"y exceeds true contained-image bound: "+JSON.stringify(t));
 if(cw*t.scale<=w+.0001)near(t.tx,0,.7);
 if(ch*t.scale<=h+.0001)near(t.ty,0,.7);
};
const q=(f,t)=>({x:(f.x-t.viewport[0]/2-t.tx)/t.scale,
 y:(f.y-t.viewport[1]/2-t.ty)/t.scale});
const stats=()=>page.evaluate(()=>window.__luemiQaMedia.stats());
const close=()=>page.evaluate(()=>window.__luemiQaMedia.close());
try{
 await page.goto("http://127.0.0.1:5173/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>!!window.__luemiQaMedia);
 await page.evaluate(()=>{
  window.__rem03cEvents=[];window.__rem03cSeq=0;
  for(const name of ["pointerdown","pointermove","pointerup","pointercancel","lostpointercapture","touchstart","touchmove","touchend","touchcancel"]){
   document.addEventListener(name,e=>{
    if(!(e.target instanceof Element)||!e.target.closest(".pm-viewer"))return;
    const touch=e.changedTouches?.[0];
    window.__rem03cEvents.push({seq:++window.__rem03cSeq,event:name,
     id:e.pointerId??touch?.identifier,
     x:e.clientX??touch?.clientX,y:e.clientY??touch?.clientY,
     buttons:e.buttons,time:Math.round(e.timeStamp)});
    if(window.__rem03cEvents.length>120)window.__rem03cEvents.shift();
   },true);
  }
 });
 await change("aspect-portrait");await open("qa-alpha");await ready("qa-alpha");
 await sleep(280);
 let s=await state();near(s.scale,1,.01);bounds(s);
 let first=p(11,155,373),second=p(12,235,453);
 await send("touchStart",[first]);await send("touchStart",[first,second]);
 let initial=await state(),f={x:195,y:413},before=q(f,initial);
 first=p(11,106,338);second=p(12,310,515);
 await send("touchMove",[first,second]);
 s=await state();assert.ok(s.scale>2&&s.scale<=3.2);
 const newF={x:(first.x+second.x)/2,y:(first.y+second.y)/2},after=q(newF,s);
 near(before.x,after.x,.9);near(before.y,after.y,.9);bounds(s);
 assert.equal(s.id,"qa-alpha");
 pass("portrait off-center pinch preserves actual DOMMatrix focal point under moving midpoint");
 const zoomed=s,commits=s.commits;
 // Remaining finger pans rather than starting horizontal navigation or dismiss.
 await send("touchEnd",[second]);
 const oneLeft=await state();
 first=p(11,first.x+30,first.y+29);await send("touchMove",[first]);
 s=await state();
 if(Math.abs(s.tx-zoomed.tx)+Math.abs(s.ty-zoomed.ty)<=3)
  console.log("REM03C_DIAG_ONE_FINGER",JSON.stringify({zoomed,oneLeft,after:s,
   events:await page.evaluate(()=>window.__rem03cEvents.slice(-30))}));
 assert.ok(Math.abs(s.tx-zoomed.tx)+Math.abs(s.ty-zoomed.ty)>3);
 bounds(s);assert.equal(s.commits,commits);
 pass("2→1 keeps zoom and remaining finger pans actual contained photo");

 second=p(13,300,516);const beforeRepeat=await state();
 await send("touchStart",[first,second]);
 s=await state();near(s.scale,beforeRepeat.scale,.02);
 // Third finger may move without replacing original active pair.
 let third=p(14,80,165);await send("touchStart",[first,second,third]);
 const beforeThird=await state();third=p(14,320,710);
 await send("touchMove",[first,second,third]);s=await state();
 near(s.scale,beforeThird.scale,.02);near(s.tx,beforeThird.tx,.8);near(s.ty,beforeThird.ty,.8);
 // Third finger remains, active first is released; remaining pair safely rebases.
 await send("touchEnd",[first]);const afterPromote=await state();
 near(afterPromote.scale,beforeThird.scale,.02);
 second=p(13,330,530);await send("touchMove",[second,third]);s=await state();
 assert.ok(s.scale>=1&&s.scale<=3.2);bounds(s);
 await send("touchEnd",[second]);third=p(14,300,700);
 await send("touchMove",[third]);bounds(await state());
 await send("touchEnd",[third]);await sleep(280);
 s=await state();near(s.scale,1,.015);near(s.tx,0,.7);near(s.ty,0,.7);
 assert.equal(s.id,"qa-alpha");assert.equal(s.commits,commits);
 pass("1→2→1→2, third ignored while first pair intact, first-finger release, pan, final reset");

 // Reverse order: second member releases first; first remains pan-eligible.
 first=p(21,160,389);second=p(22,230,464);
 await send("touchStart",[first]);await send("touchStart",[first,second]);
 first=p(21,100,340);second=p(22,290,520);await send("touchMove",[first,second]);
 await send("touchEnd",[second]);const poseBefore=await state();
 first=p(21,116,375);await send("touchMove",[first]);const poseAfter=await state();
 assert.ok(Math.abs(poseAfter.tx-poseBefore.tx)+Math.abs(poseAfter.ty-poseBefore.ty)>2);
 await send("touchEnd",[first]);await sleep(280);
 near((await state()).scale,1,.02);
 pass("second finger released first: primary pointer continues pan, no geometry jump");

 // Intrinsic object-fit content sizes differ from viewport; clamp each axis.
 for(const kind of ["aspect-landscape","aspect-panorama","aspect-tall","aspect-portrait"]){
  await change(kind);await ready("qa-alpha");await sleep(25);
  first=p(31,164,400);second=p(32,224,450);
  await send("touchStart",[first]);await send("touchStart",[first,second]);
  for(const [a,b] of [
   [p(31,75,335),p(32,315,515)],
   [p(31,24,310),p(32,370,595)],
   [p(31,45,160),p(32,365,730)]
  ]){
   first=a;second=b;
   await send("touchMove",[first,second]);const t=await state();
   bounds(t);
   assert.ok(t.scale<=3.201&&t.scale>=1);
  }
  // Strong pan towards all borders cannot expose forbidden empty content.
  await send("touchEnd",[second]);
  for(const d of [[-220,-270],[250,290],[-190,360],[300,-380]]){
   first=p(31,first.x+d[0],first.y+d[1]);
   // Browser pointer positions can leave viewport; alternate small in-bounds moves.
   if(first.x<1||first.x>391||first.y<1||first.y>850)continue;
   await send("touchMove",[first]);bounds(await state());
  }
  await send("touchEnd",[first]);await sleep(250);
 }
 pass("portrait/landscape/panorama/tall: actual natural sizes and zoomed content rect bound pan on both axes");

 // No navigation/dismiss while pinch or remaining-pointer pan is active.
 await change("aspect-portrait");await ready("qa-alpha");
 first=p(41,157,390);second=p(42,240,470);
 await send("touchStart",[first]);await send("touchStart",[first,second]);
 first=p(41,100,342);second=p(42,305,545);await send("touchMove",[first,second]);
 const pre=await state();
 await send("touchEnd",[second]);
 first=p(41,60,600);await send("touchMove",[first]);
 s=await state();assert.equal(s.id,"qa-alpha");assert.equal(s.commits,pre.commits);
 assert.equal(s.open,true);
 await send("touchEnd",[first]);await sleep(270);
 pass("zoomed pan cannot switch neighbor or initiate vertical dismiss");

 // Viewport change while pointer session is active maintains safe fit bounds.
 first=p(51,150,390);second=p(52,240,480);
 await send("touchStart",[first]);await send("touchStart",[first,second]);
 first=p(51,100,350);second=p(52,290,520);await send("touchMove",[first,second]);
 await page.setViewportSize({width:430,height:780});await sleep(80);
 s=await state();bounds(s);near(s.viewport[0],430,.5);
 first=p(51,104,355);second=p(52,292,525);await send("touchMove",[first,second]);
 bounds(await state());await send("touchEnd",[first,second]);await sleep(260);
 pass("viewport resizing midpinch rebases actual content fit and pointer focal anchor");
 await page.setViewportSize({width:393,height:852});await sleep(65);

 // Native pointer cancellation must terminally reset the media and leave track stable.
 first=p(61,153,395);second=p(62,243,483);
 await send("touchStart",[first]);await send("touchStart",[first,second]);
 first=p(61,103,351);second=p(62,296,526);await send("touchMove",[first,second]);
 await send("touchCancel",[]);await sleep(40);
 s=await state();near(s.scale,1,.02);assert.equal(s.open,true);assert.equal(s.id,"qa-alpha");
 pass("native touchcancel / pointercancel ends pinch without photo or dismiss commit");

 // React delegated touchcancel and lostpointercapture idempotence.
 await page.locator(".pm-viewer-stage").evaluate(el=>{
  el.dispatchEvent(new Event("touchcancel",{bubbles:true,cancelable:true}));
  el.dispatchEvent(new PointerEvent("lostpointercapture",{pointerId:61,bubbles:true}));
 });
 s=await state();near(s.scale,1,.02);
 pass("touchcancel + stale lostpointercapture do not resurrect prior gesture");
 // A touchcancel during normal REM-03B one-finger x dragging must likewise
 // return the fractional track to center without committing a neighbor.
 const beforeCancel=await state();
 await page.mouse.move(290,410);await page.mouse.down();
 await page.mouse.move(170,410,{steps:8});
 const duringCancel=await state();assert.ok(duringCancel.offset< -20);
 await page.locator(".pm-viewer-stage").evaluate(el=>
  el.dispatchEvent(new Event("touchcancel",{bubbles:true,cancelable:true})));
 await page.mouse.up();await sleep(290);
 s=await state();near(s.offset,0,.7);
 assert.equal(s.id,beforeCancel.id);assert.equal(s.commits,beforeCancel.commits);
 pass("touchcancel during horizontal drag restores fractional track without a photo commit");

 // Background / Telegram deactivation midpinch terminates pointers.
 first=p(71,165,380);second=p(72,230,460);
 await send("touchStart",[first]);await send("touchStart",[first,second]);
 first=p(71,103,340);second=p(72,294,530);await send("touchMove",[first,second]);
 await page.evaluate(()=>{
  Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"hidden"});
  document.dispatchEvent(new Event("visibilitychange"));
 });
 await sleep(30);s=await state();near(s.scale,1,.02);
 await send("touchCancel",[]).catch(()=>{});
 await page.evaluate(()=>{
  Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"visible"});
  document.dispatchEvent(new Event("visibilitychange"));
 });
 pass("background/foreground midpinch releases media writer and old pointers");
 first=p(75,158,386);second=p(76,236,460);
 await send("touchStart",[first]);await send("touchStart",[first,second]);
 first=p(75,108,344);second=p(76,300,520);await send("touchMove",[first,second]);
 await page.evaluate(()=>window.dispatchEvent(new Event("blur")));
 await sleep(25);
 s=await state();near(s.scale,1,.02);assert.equal(s.id,"qa-alpha");
 await send("touchCancel",[]).catch(()=>{});
 pass("focus loss midpinch invalidates old pointer session with no semantic photo commit");

 // Vertical dismiss at identity: short slow drag resets y and opacity in lockstep.
 const base=(await stats()).closeCommits;
 first=p(81,200,410);await send("touchStart",[first]);
 first=p(81,200,470);await send("touchMove",[first]);
 s=await state();assert.ok(s.surfaceY>10&&s.stageOpacity<1);
 await sleep(190);await send("touchEnd",[first]);await sleep(260);
 s=await state();assert.equal(s.open,true);near(s.surfaceY,0,.9);near(s.stageOpacity,1,.03);
 assert.equal((await stats()).closeCommits,base);
 pass("cancelled vertical dismiss restores surface Y and opacity synchronously at 1x");
 // Preserve previously accepted either-direction vertical dismiss (upward).
 first=p(82,200,510);await send("touchStart",[first]);
 first=p(82,200,350);await send("touchMove",[first]);
 const upwardDuring=await state();
 await send("touchEnd",[first]);
 try{await page.locator(".pm-viewer").waitFor({state:"detached",timeout:3500});}
 catch(error){
  console.log("REM03C_DIAG_VERTICAL_CLOSE",JSON.stringify({
   upwardDuring,after:await state(),stats:await stats(),
   events:await page.evaluate(()=>window.__rem03cEvents.slice(-27))
  }));
  throw error;
 }
 assert.equal((await stats()).closeCommits,base+1);
 await sleep(320);assert.equal((await stats()).closeCommits,base+1);
 pass("upward vertical dismiss at 1x commits close once (not down-only)");
 await open("qa-alpha");await ready("qa-alpha");await sleep(280);
 // StrictMode QA fixture and reopening can still navigate original 3-slide track.
 await page.keyboard.press("ArrowRight");await ready("qa-beta");
 await page.keyboard.press("ArrowLeft");await ready("qa-alpha");
 s=await state();assert.equal(s.commits,2);
 await close();assert.deepEqual(failures,[],"no browser page errors");
 console.log("REM-03C BROWSER PINCH QA PASS · real Chromium CDP multi-touch, physical A55/iOS NOT VERIFIED");
}finally{await context.close();await browser.close();}
