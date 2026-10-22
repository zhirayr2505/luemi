import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"});
const page=await context.newPage(),errors=[];
page.on("pageerror",e=>errors.push(e.message));
const BASE=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const near=(a,b,delta=1)=>assert.ok(Math.abs(a-b)<=delta,`continuity | ${a} - ${b} | > ${delta}px`);
const scan=async(selector)=>page.locator(selector).evaluate(el=>({
 x:new DOMMatrixReadOnly(getComputedStyle(el).transform).m41,
 frozen:Number(el.dataset.motionFrozenX),
 transition:getComputedStyle(el).transitionDuration,
 width:el.clientWidth
}));
const heroTrack=".pm-inline .pm-photo-track";
const heroDots=page.locator(".pm-inline .pm-photo-progress button");
const browseTrack=".discovery-page-track";
const browseInk=".discovery-tab-underline";
const pass=m=>console.log("REM02C_BROWSER_PASS "+m);
try{
 await page.goto(BASE+"/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Профиль",exact:true}).click();
 await page.locator(".pm-inline").waitFor({state:"visible"});
 const hb=await page.locator(".pm-inline .pm-hero").boundingBox();
 assert.ok(hb&&hb.width>=320);
 const px=hb.x+hb.width*.52,py=hb.y+Math.min(220,hb.height*.56);
 await page.locator(heroTrack).waitFor({state:"attached"});
 for(const delay of [50,150,250]){
  await heroDots.first().click();await sleep(360);
  await heroDots.last().click();await sleep(delay);
  await page.mouse.move(px,py);await page.mouse.down();
  await page.mouse.move(px-16,py,{steps:2});
  await sleep(45);
  const frozen=await scan(heroTrack);
  assert.ok(Number.isFinite(frozen.frozen),"hero capture must expose actual matrix");
  // At 250ms the photo may already be at the LAST edge: the approved .18
  // elastic coefficient must remain intact, not be mistaken for a discontinuity.
  const last=-frozen.frozen/frozen.width>=2-.001;
  near(frozen.x,frozen.frozen-(last?16*.18:16),1);
  await page.mouse.move(px-36,py,{steps:4});await page.mouse.up();
  const state=await heroDots.evaluateAll(nodes=>nodes.filter(n=>n.getAttribute("aria-current")==="true").length);
  assert.equal(state,1,"one semantic photo index after interrupted settle");
  await sleep(335);
  pass("hero second pointer at "+delay+"ms: freeze-to-first-frame error ≤1px");
 }
 await heroDots.last().click();await sleep(80);
 await heroDots.first().click();await sleep(360);
 const lastClick=await scan(heroTrack);
 near(lastClick.x,0,1);
 assert.equal(await heroDots.first().getAttribute("aria-current"),"true");
 pass("photo dot click interrupts CSS settling without stale animation commit");
 // First/last hero edges must not wrap or click-open the fullscreen viewer.
 for(const edge of [{i:0,dx:55},{i:2,dx:-55}]){
  await heroDots.nth(edge.i).click();await sleep(340);
  await page.mouse.move(px,py);await page.mouse.down();
  await page.mouse.move(px+edge.dx,py,{steps:7});await sleep(35);await page.mouse.up();
  await sleep(340);
  assert.equal(await heroDots.nth(edge.i).getAttribute("aria-current"),"true");
  assert.equal(await page.locator(".pm-viewer").count(),0);
 }
 pass("first/last hero edges elastic without wrap or spurious viewer click");
 // Re-render a mounted owner profile while its CSS transform is settling.
 await heroDots.first().click();await sleep(350);await heroDots.last().click();await sleep(90);
 await page.getByRole("button",{name:"Тёмная тема"}).click();await sleep(350);
 assert.equal(await heroDots.last().getAttribute("aria-current"),"true");
 assert.equal((await scan(heroTrack)).width>=320,true);
 pass("theme/React rerender retains photo identity and terminal hero pixels");
 // Main browse pager: retain BOTH the track and the differently eased ink
 // matrices while a new drag interrupts CSS settling.
 await page.getByRole("button",{name:"Знакомства",exact:true}).click();
 const top=page.locator('.discovery-top-tabs [role=tab]');
 await top.first().click();await sleep(365);
 const box=await page.locator(".discovery-top-tabs").boundingBox();
 assert.ok(box&&box.width>300);
 const bx=box.x+box.width*.55,by=box.y+box.height*.55;
 for(const delay of [50,150,250]){
  await top.first().click();await sleep(350);
  await top.last().click();await sleep(delay);
  await page.mouse.move(bx,by);await page.mouse.down();
  await page.mouse.move(bx-16,by,{steps:2});await sleep(45);
  const [track,ink]=await Promise.all([scan(browseTrack),scan(browseInk)]);
  assert.ok(Number.isFinite(track.frozen)&&Number.isFinite(ink.frozen));
  near(track.x,track.frozen-16,1);
  near(ink.x,ink.frozen+16/3,1);
  await page.mouse.move(bx-45,by,{steps:3});await page.mouse.up();
  await sleep(350);
  const selected=await top.evaluateAll(nodes=>nodes.filter(n=>n.getAttribute("aria-selected")==="true").length);
  assert.equal(selected,1);
  pass("browse+ink second down "+delay+"ms: each first painted pixel ≤1px; one selected tab");
 }
 await top.first().click();await sleep(80);
 await top.last().click();await sleep(350);
 assert.equal(await top.last().getAttribute("aria-selected"),"true");
 near((await scan(browseTrack)).x,-2*box.width,1);
 pass("top tab tap during settling retargets real matrix, commits once");
 // Diagonal and vertical input must not let horizontal custom owner paint.
 await top.first().click();await sleep(350);
 const before=await scan(browseTrack);
 await page.mouse.move(bx,by);await page.mouse.down();
 await page.mouse.move(bx-20,by+45,{steps:4});await page.mouse.up();await sleep(90);
 const diagonal=await scan(browseTrack);
 near(diagonal.x,before.x,1);
 pass("vertical-dominant diagonal preserves native owner, browse pixels unchanged");
 assert.deepEqual(errors,[],"no browser exceptions");
 console.log("REM-02C BROWSER INTERRUPTION QA PASS · Chromium Android UA only; physical A55/iOS NOT VERIFIED");
}finally{await context.close();await browser.close();}
