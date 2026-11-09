/** Feed Liquid Glass touch invariants under Android-sized Chromium.
 * This checks layout/gesture contracts, not real WebView GPU tile eviction.
 * Physical 60fps Samsung and Telegram acceptance remains a separate gate.
 */
import assert from "node:assert/strict";
import {chromium} from "playwright";

const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const ua="Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36";
const browser=await chromium.launch({headless:true});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function snapshot(page){
 return await page.evaluate(()=>{
  const sheet=document.querySelector(".discovery-deck-layer.deck-active .feed-v2-sheet");
  const card=sheet?.closest(".feed-v2-card");
  const details=sheet?.querySelector(".feed-v2-details");
  const text=sheet?.querySelector(".discovery-name-button span");
  const actions=card?.querySelector(".discovery-actions");
  if(!sheet||!card||!details||!text||!actions)return null;
  const rect=sheet.getBoundingClientRect(),label=text.getBoundingClientRect();
  const accent=card.querySelector(".discovery-action.discovery-special");
  return {
   contains:sheet.contains(details),height:rect.height,
   x:rect.left+rect.width*.66,y:rect.top+rect.height*.48,
   name:text.textContent?.trim()??"",
   opacity:getComputedStyle(text).opacity,
   display:getComputedStyle(details).display,
   glass:getComputedStyle(sheet).backgroundImage,
   blur:getComputedStyle(sheet).backdropFilter,
   rim:getComputedStyle(sheet,"::before").backgroundImage,
   sheetP:getComputedStyle(card).getPropertyValue("--sheet-p").trim(),
   special:accent?.classList.contains("lg--accent"),
   actionCount:actions.querySelectorAll(".discovery-action.lg").length,
   labelHeight:label.height,
   moving:sheet.dataset.moving
  };
 });
}
try{
 for(const [width,height] of [[360,780],[393,852]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,userAgent:ua});
  const page=await context.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(base+"/profile-qa.html",{waitUntil:"domcontentloaded"});
  await page.locator(".discovery-deck-layer.deck-active .feed-v2-sheet").first().waitFor({state:"visible"});
  await pause(400);
  const start=await snapshot(page);
  assert.ok(start&&start.contains&&start.height>100,width+": sheet must contain content");
  assert.ok(start.name&&start.labelHeight>0,width+": nonempty name label");
  assert.ok(start.glass.includes("gradient"),width+": transparent optical fill missing");
  assert.ok(start.rim.includes("gradient"),width+": chromatic rim missing");
  assert.equal(start.actionCount,3,width+": pass/special/like must share material");
  assert.equal(start.special,true,width+": star must be optical accent");
  assert.equal(start.blur,"none",width+": Android WebView must avoid moving backdrop blur");
  const cdp=await context.newCDPSession(page);
  // Tap on portrait only: a tap is not an info gesture.
  const portrait={x:Math.round(width*.55),y:Math.round(height*.34)};
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{id:1,...portrait}]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await pause(100);
  const tapped=await snapshot(page);
  assert.ok(tapped&&Math.abs(tapped.height-start.height)<2,width+": tap changed sheet height");
  // A deliberate vertical touch on the sheet must not unmount text or remount
  // another glass box while its height tracks the pointer.
  const point={x:Math.round(start.x),y:Math.round(start.y)};
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{id:2,...point}]});
  const frames=[];
  for(let i=1;i<=16;i++){
   await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{
    id:2,x:point.x,y:Math.round(point.y-i*7)}]});
   await pause(17);
   frames.push(await snapshot(page));
  }
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  assert.ok(frames.every(v=>v&&v.contains&&v.name===start.name&&v.opacity!=="0"),
    width+": information text must not disappear while sheet is touched");
  assert.ok(frames.every(v=>Number.isFinite(v.height)&&v.height>80),
    width+": sheet clipped or disappeared during drag");
  assert.ok(frames.some(v=>v.height>start.height+5),
    width+": intentional drag failed to expand sheet");
  await pause(450);
  const settled=await snapshot(page);
  assert.ok(settled&&settled.moving==="false",width+": moving state leaked past settle");
  assert.ok(!errors.length,width+": browser exceptions: "+errors.join(", "));
  console.log("LUEMI_FEED_LG_OK",JSON.stringify({
   viewport:width+"x"+height,resting:start.height,
   maxDrag:Math.max(...frames.map(v=>v.height)),settled:settled.height
  }));
  await context.close();
 }
}finally{await browser.close()}
