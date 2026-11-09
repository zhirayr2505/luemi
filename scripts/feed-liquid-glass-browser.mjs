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
  // Liquid Glass V2: a fallback is optically layered, not flat/opaque. The
  // supported WebView must never run SVG displacement on a moving photo tile.
  const material=await page.evaluate(()=>{
   const sheet=document.querySelector(".deck-active .feed-v2-sheet");
   const pill=document.querySelector(".deck-active .discovery-action.discovery-like");
   if(!sheet||!pill)return null;
   const rim=getComputedStyle(sheet,"::before");
   const light=getComputedStyle(sheet,"::after");
   const surface=getComputedStyle(sheet);
   const action=getComputedStyle(pill);
   const accent=getComputedStyle(document.querySelector(".deck-active .discovery-action.discovery-special"));
   return {
    mode:document.documentElement.dataset.lgOptics,
    rimBackground:rim.backgroundImage,
    rimFilter:rim.filter,
    rimOpacity:Number(rim.opacity),
    rimDepth:parseFloat(rim.paddingTop),
    rimBorder:parseFloat(surface.borderTopWidth),
    actionBorder:parseFloat(action.borderTopWidth),
    shine:light.backgroundImage,
    relief:surface.boxShadow,
    tint:surface.backgroundImage,
    actionTint:action.backgroundImage,
    accentGradient:accent.backgroundImage,
    accentFrom:accent.getPropertyValue("--lg-accent-from").trim()
   };
  });
  assert.equal(material?.mode,"safe",width+": Android must use safe lens mode");
  assert.equal(material?.rimFilter,"none",width+": no SVG frame recompositing on Android");
  assert.ok(material?.rimBackground.includes("conic-gradient")&&
   material.rimOpacity>=.25&&material.rimOpacity<=.55,
   width+": rim must be iridescent but subtle, without the thick white halo");
  assert.ok(material?.rimDepth<=3&&material.rimBorder<=1.25&&material.actionBorder<=1.25,
   width+": overbuilt chrome-like border diverges from the approved first reference");
  assert.ok(material?.accentGradient.includes("gradient")&&
   material?.accentFrom.includes(".94"),
   width+": the middle action must be a unified rose-plum pill");
  assert.ok(material?.shine.includes("radial-gradient"),
   width+": specular light is missing");
  assert.ok(material?.relief.includes("inset")&&material.actionTint.includes("gradient"),
   width+": glass relief or pill transparency is missing");
  // Video regression: the old blur occupied 58% of the picture, with a sharp
  // horizontal edge at the model's nose and a different portrait crop.
  await page.waitForFunction(()=>{
   const layer=document.querySelector(".deck-active .feed-v2-photo-ambient");
   const image=layer?.querySelector('img[data-source-photo]');
   return !!image?.naturalWidth&&Number(getComputedStyle(layer).opacity)>.95;
  },null,{timeout:6000});
  const ambient=await page.evaluate(()=>{
   const hero=document.querySelector(".deck-active .feed-v2-photo");
   const layer=hero?.querySelector(".feed-v2-photo-ambient");
   const image=layer?.querySelector('img[data-source-photo]');
   const h=hero?.getBoundingClientRect(),l=layer?.getBoundingClientRect();
   if(!hero||!layer||!image||!h||!l)return null;
   const canvas=document.createElement("canvas");
   canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
   const context=canvas.getContext("2d");
   context.drawImage(image,0,0);
   const alpha=y=>context.getImageData(Math.round(canvas.width*.5),
    Math.round(canvas.height*y),1,1).data[3];
   return {
    top:l.top-h.top,heightDelta:Math.abs(l.height-h.height),
    alphaTop:alpha(.25),alphaBottom:alpha(.92),
    source:image.dataset.sourcePhoto,
    original:hero.querySelector(".carousel-track img:first-child")?.src
   };
  });
  assert.ok(ambient&&Math.abs(ambient.top)<2&&ambient.heightDelta<2,
   width+": the feathered blur must exactly align with the whole photograph");
  assert.ok(ambient.alphaTop<12&&ambient.alphaBottom>210,
   width+": blur alpha must be feathered inside bitmap, never a rectangular JPG seam");
  assert.equal(ambient.source,ambient.original,
   width+": initial blurred photo source must match the sharp carousel");
  const cdp=await context.newCDPSession(page);
  // Tap on portrait only: a tap is not an info gesture.
  const portrait={x:Math.round(width*.55),y:Math.round(height*.34)};
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{id:1,...portrait}]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await pause(100);
  const tapped=await snapshot(page);
  assert.ok(tapped&&Math.abs(tapped.height-start.height)<2,width+": tap changed sheet height");
  // Swipe the photo track while the ambient copy is visible. It must be hidden
  // during the finger drag and decode the new photo before resurfacing.
  const swipe={x:Math.round(width*.79),y:Math.round(height*.36)};
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{id:3,...swipe}]});
  for(let i=1;i<=13;i++){
   await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{
    id:3,x:swipe.x-i*14,y:swipe.y}]});
   await pause(17);
  }
  await pause(140);
  const hidden=await page.evaluate(()=>{
   const layer=document.querySelector(".deck-active .feed-v2-photo-ambient");
   return layer?Number(getComputedStyle(layer).opacity):NaN;
  });
  assert.ok(hidden<.08,width+": old blurred portrait must disappear during photo swipe");
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await page.waitForFunction(()=>{
   const hero=document.querySelector(".deck-active .feed-v2-photo");
   const current=Array.from(hero?.querySelectorAll(".photo-progress button")??[])
    .findIndex(el=>el.classList.contains("current"));
   const ambient=hero?.querySelector(".feed-v2-photo-ambient");
   const displayed=ambient?.querySelector('img[data-source-photo][style*="opacity: 1"]');
   const original=hero?.querySelectorAll(".carousel-track img")[current];
   return current===1&&displayed?.dataset.sourcePhoto===original?.src&&
    Number(getComputedStyle(ambient).opacity)>.95;
  },null,{timeout:6000});
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
 // Full optical path: verify iPhone-type user agent gets the SVG
 // displacement only when its CSS feature probes genuinely support it.
 const ios=await browser.newContext({
  viewport:{width:393,height:852},isMobile:true,hasTouch:true,
  userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1"
 });
 try{
  const page=await ios.newPage();
  await page.goto(base+"/profile-qa.html",{waitUntil:"domcontentloaded"});
  await page.locator(".deck-active .feed-v2-sheet").first().waitFor({state:"visible"});
  const state=await page.evaluate(()=>{
   const svg="/assets/glass/liquid-refraction-v2.svg#luemi-refraction-v2";
   const supported=(CSS.supports("backdrop-filter","blur(2px)")||
    CSS.supports("-webkit-backdrop-filter","blur(2px)"))&&
    CSS.supports("filter","url('"+svg+"')");
   const sheet=document.querySelector(".deck-active .feed-v2-sheet");
   return {
    supported,mode:document.documentElement.dataset.lgOptics,
    nativeRefraction:document.documentElement.dataset.lgNativeRefraction,
    rimFilter:getComputedStyle(sheet,"::before").filter
   };
  });
  assert.equal(state.mode,state.supported?"full":"safe",
   "progressive optical filtering must respect browser capabilities");
  assert.equal(state.nativeRefraction,"off",
   "WebKit-style user agents must never receive crash-prone SVG backdrop URL");
  if(state.mode==="full"){
   assert.ok(state.rimFilter.includes("liquid-refraction-v2.svg"),
    "capable browser must receive actual SVG displacement on the lens bevel");
  }
  console.log("LUEMI_LG_V2_CAPABILITY_OK",state);
 }finally{await ios.close()}
}finally{await browser.close()}
