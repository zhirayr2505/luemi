import assert from "node:assert/strict";

/** Controlled-latency browser test of the actual DemoFeedSandbox, FeedCard,
 * PhotoCarousel and deck-v3 compositor, not a mocked animation.
 * All remote portraits are intercepted; no external network is required. */
export async function feedDeckBrowserQa(browser,baseUrl){
 const context=await browser.newContext({
  viewport:{width:393,height:852},isMobile:true,hasTouch:true,
  reducedMotion:"no-preference",
  userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"
 });
 const page=await context.newPage();
 const errors=[];
 page.on("pageerror",err=>errors.push(err.message));
 const image=(name,color)=>`<svg xmlns="http://www.w3.org/2000/svg" width="660" height="990" viewBox="0 0 660 990">
  <rect width="660" height="990" fill="${color}"/><circle cx="330" cy="380" r="165" fill="white" opacity=".28"/>
  <text x="330" y="760" font-size="52" fill="white" text-anchor="middle">${name}</text></svg>`;
 try{
  await page.route(/https:\/\/cdn\.pixabay\.com\/photo\//,async route=>{
   const url=route.request().url();
   // Profile 2 cover arrives much later than the first, matching the
   // screen recording's grey 40–54ms transition windows.
   if(url.includes("9541651"))await new Promise(r=>setTimeout(r,2500));
   const color=url.includes("9541651")?"#a37780":"#527485";
   await route.fulfill({status:200,contentType:"image/svg+xml",
    body:image(url.includes("9541651")?"PROFILE 2":"READY PHOTO",color)});
  });
  await page.route(/https:\/\/images\.unsplash\.com\//,async route=>
   route.fulfill({status:200,contentType:"image/svg+xml",body:image("SECONDARY","#526b64")}));
  await page.goto(baseUrl+"/feed-deck-qa.html",{waitUntil:"domcontentloaded"});
  const current=page.locator(".deck-active .carousel-track img:first-child");
  await current.waitFor({state:"attached",timeout:12000});
  await page.waitForFunction(()=>{
   const first=document.querySelector(".deck-active .carousel-track img:first-child");
   return first?.classList.contains("is-ready")&&first?.naturalWidth>0;
  },{timeout:12000});
  assert.equal(await page.locator(".deck-photo-pending").count()>0,true,
   "unready queued card must not show its grey frame at startup");
  // Arm RAF sampling *before* the tap and the delayed cover's decode.
  // Otherwise Playwright can observe .deck-entering late (or just before
  // promotion to .deck-active) and miss a valid 480ms compositor animation.
  // Collect exactly the same real DOM + decoded image invariant as before.
  await page.evaluate(()=>{
   const capture={frames:[],stop:false};
   window.__luemiFeedDeckFrames=capture;
   const since=performance.now();
   const sample=()=>{
    if(capture.stop||performance.now()-since>7000)return;
    const entering=document.querySelector(".deck-entering");
    if(entering){
     const image=entering.querySelector(".carousel-track img:first-child");
     capture.frames.push({
      at:Math.round(performance.now()-since),
      decoded:!!image?.complete&&image.naturalWidth>0&&image.classList.contains("is-ready"),
      incomingOpacity:Number(getComputedStyle(entering).opacity)
     });
    }
    requestAnimationFrame(sample);
   };
   requestAnimationFrame(sample);
  });
  await page.locator(".deck-active .moonstone-like-button").click();
  const before=await page.evaluate(()=>{
   const queued=document.querySelector(".deck-depth-one");
   const image=queued?.querySelector(".carousel-track img:first-child");
   return {leaving:document.querySelectorAll(".deck-leaving").length,
    painted:image?.classList.contains("is-ready")??false,
    opacity:queued?Number(getComputedStyle(queued).opacity):NaN};
  });
  assert.equal(before.leaving,0,"tap must not start an animation before actual DOM decode");
  assert.equal(before.painted,false,"the delayed image really is unready at click");
  assert.ok(before.opacity<.05,"queued card is invisible before its cover decode");

  await page.locator(".deck-entering").waitFor({state:"attached",timeout:6000});
  // Let the entering animation complete before reading the already running
  // frame recorder; it cannot miss its start while the test driver is busy.
  await page.waitForTimeout(540);
  const frames=await page.evaluate(()=>{
   const capture=window.__luemiFeedDeckFrames;
   capture.stop=true;
   return capture.frames;
  });
  assert.ok(frames.length>=8,"sample the real WebView compositor over consecutive animation frames");
  assert.ok(frames.every(frame=>frame.decoded),"every entering-frame cover must already be painted");
  await page.waitForFunction(()=>{
   const top=document.querySelector(".deck-active .discovery-name-button");
   return top?.textContent?.includes("София");
  },{timeout:5000});
  assert.deepEqual(errors,[],"no runtime errors in the real feed components");
  console.log("FEED_DECK_FRAME_QA_PASS "+JSON.stringify({
   samples:frames.length,first:frames[0],last:frames.at(-1),
   delayedCoverMs:2500,blankIncomingFrames:frames.filter(frame=>!frame.decoded).length
  }));
 }finally{await context.close();}
}
