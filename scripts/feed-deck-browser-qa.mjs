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
  // Private QA portrait service is protected in production. Browser tests
  // intercept synthetic local URLs; no public CDN or real user photos.
  await page.route("**/api/v2/qa/portraits/**",async route=>{
   const url=route.request().url();
   if(url.includes("/elina/1.webp"))await new Promise(r=>setTimeout(r,2500));
   const color=url.includes("/elina/")?"#a37780":"#527485";
   await route.fulfill({status:200,contentType:"image/svg+xml",
    body:image(url.includes("/elina/")?"PROFILE 2":"READY PHOTO",color)});
  });
  await page.goto(baseUrl+"/feed-deck-qa.html",{waitUntil:"domcontentloaded"});
  const current=page.locator(".deck-active .carousel-slide:nth-child(2) img.feed-carousel-photo");
  await current.waitFor({state:"attached",timeout:12000});
  await page.waitForFunction(()=>{
   const first=document.querySelector(".deck-active .carousel-slide:nth-child(2) img.feed-carousel-photo");
   return first?.classList.contains("is-ready")&&first?.naturalWidth>0;
  },{timeout:12000});
  assert.equal(await page.locator(".deck-photo-pending").count()>0,true,
   "unready queued card must not show its grey frame at startup");
  // Queued cards remain invisible until their cover is ready (or the
  // bounded 2.4s network-recovery deadline expires). The retired
  // .deck-entering animation must not be required for the one-card design.
  assert.equal(await page.locator(".deck-active").count(),1,"one interactive card");
  assert.equal(await page.locator(".deck-queued").count(),1,"one prepared next card");
  await page.locator(".deck-active .moonstone-like-button").click();
  await page.waitForFunction(()=>{
   const leaving=document.querySelector(".deck-leaving");
   const active=document.querySelector(".deck-active .moonstone-name");
   return !!leaving||!!active?.textContent?.includes("Элина");
  },{timeout:9500});
  if(await page.locator(".deck-leaving").count()){
   assert.equal(await page.locator(".deck-queued").count(),1,
    "queued card remains beneath the departing one");
  }
  await page.waitForFunction(()=>{
   const active=document.querySelector(".deck-active .moonstone-name");
   return !!active?.textContent?.includes("Элина");
  },{timeout:10000});
  assert.equal(await page.locator(".deck-active").count(),1,
   "next profile is active after the exit");
  assert.equal(await page.locator(".deck-leaving").count(),0,
   "old card is unmounted after settling");
  assert.deepEqual(errors,[],"no runtime errors in the real feed components");
  console.log("FEED_DECK_FRAME_QA_PASS "+
   JSON.stringify({delayedCoverMs:2500,successor:"Элина",queued:true}));
 }finally{await context.close();}
}
