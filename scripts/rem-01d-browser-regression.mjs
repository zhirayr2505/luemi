import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852},
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36",
 isMobile:true,hasTouch:true});
const page=await context.newPage(),errors=[];
page.on("pageerror",err=>errors.push(err.message));
const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const settle=()=>page.waitForTimeout(110);
const info=()=>page.evaluate(()=>{
 const shell=document.querySelector(".luemi-shell"),body=document.querySelector(".onboard-body"),
  footer=document.querySelector(".onboard-footer"),field=document.querySelector("#keyboard-field");
 const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};};
 return {snapshot:window.__REM01D_QA__.snapshot(),shell:rect(shell),
  footer:rect(footer),body:rect(body),field:rect(field),
  footerDisplay:getComputedStyle(footer).display,
  footerBottom:getComputedStyle(footer).paddingBottom,
  safeTop:getComputedStyle(shell).getPropertyValue("--top-safe"),
  topSafe:parseFloat(getComputedStyle(shell).paddingTop)||0,
  scrollTop:body.scrollTop,
  revision:Number(shell.getAttribute("data-viewport-revision"))};
});
const log=s=>console.log("REM01D_BROWSER_PASS "+s);
try{
 await page.goto(base+"/rem-01d-viewport-qa.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>!!window.__REM01D_QA__?.snapshot());
 // The controller coalesces Telegram/VisualViewport updates into one browser RAF.
 // A fixed wall-clock sleep cannot prove the commit happened on a busy CI runner.
 const initialRevision=await page.evaluate(()=>window.__REM01D_QA__.snapshot().revision);
 await page.evaluate(()=>{const q=window.__REM01D_QA__;q.telegram.viewportHeight=852;q.telegram.viewportStableHeight=852;q.emit("viewportChanged",{isStateStable:true});});
 try{
  await page.waitForFunction(rev=>window.__REM01D_QA__?.snapshot()?.revision>rev,
   initialRevision,{polling:"raf",timeout:3000});
 }catch(error){
  const diagnostic=await page.evaluate(()=>({snapshot:window.__REM01D_QA__?.snapshot(),
   innerHeight:innerHeight,visualHeight:visualViewport?.height}));
  console.error("REM01D_INITIAL_VIEWPORT_TIMEOUT",JSON.stringify(diagnostic));
  throw error;
 }
 await settle();
 let data=await info();
 console.log("REM01D_INITIAL_VIEWPORT_PROOF",JSON.stringify({
  revisionBefore:initialRevision,revisionAfter:data.revision,
  shellHeight:data.snapshot.shellHeight,layoutHeight:data.snapshot.layoutHeight,
  visualHeight:data.snapshot.visualHeight,acceptedStableHeight:data.snapshot.acceptedStableHeight
 }));
 assert.equal(data.snapshot.shellHeight,852);
 assert.equal(data.snapshot.keyboardState,"closed");
 assert.equal(data.footerDisplay,"block");
 assert.ok(data.footer.bottom<=data.shell.bottom+1);
 log("initial shell/footer geometry: CTA visible");

 // Multiple source events within one frame produce just one revision.
 const baseRev=data.revision;
 await page.evaluate(()=>{
  const q=window.__REM01D_QA__;
  q.visual(810);
  q.visual(805);
  q.visual(800);
 });
 await settle();data=await info();
 assert.equal(data.snapshot.shellHeight,800);
 assert.equal(data.revision,baseRev+1,"coalesced updates should commit only one revision");
 log("VisualViewport rapid resize events coalesced within one RAF");

 // Actual Telegram stability event must shrink at an unchanged layout width.
 await page.evaluate(()=>{
  const q=window.__REM01D_QA__;
  q.telegram.viewportStableHeight=640;q.telegram.viewportHeight=640;
  q.visual(640);q.emit("viewportChanged",{isStateStable:true});
 });
 await settle();data=await info();
 assert.equal(data.snapshot.shellHeight,640);
 assert.equal(data.snapshot.stableHeight,640);
 assert.equal(data.snapshot.keyboardState,"closed");
 assert.ok(data.footer.bottom<=data.shell.bottom+1);
 log("Telegram fullscreen exit at same width shrinks shell; footer stays visible");

 await page.evaluate(()=>{
  const q=window.__REM01D_QA__;
  q.telegram.viewportStableHeight=760;q.telegram.viewportHeight=760;
  q.visual(760);q.emit("fullscreenChanged");
 });
 await settle();data=await info();
 assert.equal(data.snapshot.shellHeight,760);
 assert.equal(data.snapshot.stableHeight,760);
 assert.ok(data.footer.bottom<=data.shell.bottom+1);
 log("Telegram fullscreenChanged expands accepted height without waiting for viewportChanged");
 await page.evaluate(()=>{
  const q=window.__REM01D_QA__;
  q.telegram.viewportStableHeight=640;q.telegram.viewportHeight=640;
  q.visual(640);q.emit("viewportChanged",{isStateStable:true});
 });
 await settle();

 await page.locator("#keyboard-field").focus();
 await page.evaluate(()=>{
  const q=window.__REM01D_QA__;
  q.telegram.viewportHeight=390;q.visual(390);
 });
 await settle();data=await info();
 assert.equal(data.snapshot.keyboardState,"open");
 assert.equal(data.snapshot.shellHeight,390);
 assert.ok(data.body.height>35,"form scroll body must stay usable");
 assert.ok(data.footer.bottom<=data.shell.bottom+1,"footer must be ABOVE keyboard");
 assert.equal(data.footerDisplay,"block");
 assert.ok(data.field.bottom<=data.body.bottom+16,"focused textarea should scroll into available area");
 log("focus + native keyboard resize keeps CTA visible and reveals editable inside form scroll");

 await page.locator("#keyboard-field").evaluate(e=>e.blur());
 await settle();data=await info();
 assert.equal(data.snapshot.keyboardState,"uncertain");
 assert.equal(data.snapshot.shellHeight,390);
 assert.ok(data.footer.bottom<=data.shell.bottom+1);
 log("blur before IME closes classified uncertain, no false keyboard claim");

 await page.evaluate(()=>{
  const q=window.__REM01D_QA__;
  q.telegram.viewportHeight=640;q.visual(640);
 });
 await settle();data=await info();
 assert.equal(data.snapshot.keyboardState,"closed");
 assert.equal(data.snapshot.shellHeight,640);
 assert.ok(data.footer.bottom<=data.shell.bottom+1);
 log("keyboard dismissal restores stable shell without lost footer");

 // Native browser window resize at the SAME WIDTH, with stale Telegram stable reading.
 await page.evaluate(()=>{const q=window.__REM01D_QA__;q.visual(null);q.telegram.viewportStableHeight=852;});
 await page.setViewportSize({width:393,height:680});
 await settle();data=await info();
 assert.equal(data.snapshot.shellHeight,680);
 assert.equal(data.snapshot.stableHeight,680);
 assert.equal(data.snapshot.keyboardState,"closed");
 assert.ok(data.footer.bottom<=data.shell.bottom+1);
 log("window height shrink with fixed width overrides stale stableHeight");

 await page.setViewportSize({width:852,height:393});
 await settle();data=await info();
 assert.equal(data.snapshot.orientation,"landscape");
 assert.equal(data.snapshot.shellHeight,393);
 assert.equal(data.snapshot.acceptedStableHeight,null);
 assert.ok(data.footer.bottom<=data.shell.bottom+1,"portrait safe geometry must not leak into landscape");
 log("real browser orientation dimensions rebase old portrait geometry");

 await page.setViewportSize({width:393,height:852});
 await page.evaluate(()=>{
  const q=window.__REM01D_QA__;
  q.telegram.viewportStableHeight=800;q.telegram.viewportHeight=800;
  q.emit("viewportChanged",{isStateStable:true});
  q.visual(540,35);
 });
 await page.locator("#keyboard-field").focus();
 await settle();data=await info();
 assert.equal(data.snapshot.shellTop,35);
 assert.equal(data.snapshot.shellHeight,540);
 assert.equal(data.shell.top,35);
 assert.equal(data.snapshot.keyboardState,"open");
 assert.ok(data.footer.bottom<=575+1);
 log("iOS-like visual viewport offsetTop is used once, no extra keyboard displacement");

 await page.evaluate(()=>{
  const q=window.__REM01D_QA__;
  q.telegram.safeAreaInset={top:26,right:0,bottom:36,left:0};
  q.telegram.contentSafeAreaInset={top:18,right:0,bottom:19,left:0};
  q.emit("safeAreaChanged");
 });
 await settle();data=await info();
 const safe=await page.locator(".luemi-shell").evaluate(el=>{
  const probe=document.createElement("div");probe.style.height="var(--bottom-safe)";el.append(probe);
  const value=probe.getBoundingClientRect().height;probe.remove();
  return value;
 });
 assert.equal(safe,36,"safe area and content insets are MAX, not added together");
 assert.ok(data.footer.bottom<=data.shell.bottom+1);
 log("Telegram safe/content insets not double-counted, footer above bottom edge");

 const rev=data.revision;
 await page.evaluate(()=>window.__REM01D_QA__.dispose());
 const listeners=await page.evaluate(()=>window.__REM01D_QA__.listeners());
 assert.equal(listeners,0,"controller must unregister all Telegram callbacks");
 await page.evaluate(()=>{
  window.__REM01D_QA__.visual(210);
  window.dispatchEvent(new Event("resize"));
 });
 await settle();data=await info();
 assert.equal(data.revision,rev);
 log("unmount fully cancels event owners, no post-dispose mutations");

 assert.deepEqual(errors,[],"no browser exceptions");
 console.log("REM-01D BROWSER QA PASS; synthetic Chromium Telegram + VisualViewport, physical A55/iOS NOT VERIFIED");
}finally{
 await context.close();await browser.close();
}
