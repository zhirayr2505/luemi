import assert from "node:assert/strict";
import {chromium} from "playwright";

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36"});
const page=await context.newPage();
const errors=[];
page.on("pageerror",error=>errors.push(error.message));
const selected=()=>page.locator('.discovery-top-tabs [role=tab][aria-selected=true]').textContent();
const center=async selector=>{
 const box=await page.locator(selector).first().boundingBox();
 assert.ok(box?.width>0&&box.height>0,`Visible gesture target: ${selector}`);
 return {x:box.x+box.width/2,y:box.y+box.height/2};
};
const swipe=async(selector,dx,dy)=>{
 const {x,y}=await center(selector);
 const session=await context.newCDPSession(page);
 try{
  await session.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y,id:1}]});
  for(let i=1;i<=12;i++){
   await session.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[
    {x:x+dx*i/12,y:y+dy*i/12,id:1}]});
   await sleep(17);
  }
  await session.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
 }finally{await session.detach();}
};
try{
 await page.goto((process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173")+"/profile-qa.html",
  {waitUntil:"domcontentloaded"});
 await page.locator(".feed-v2-card[data-expanded=false]").first().waitFor();
 const image=page.locator(".deck-active .feed-v2-photo .carousel-track img").first();
 const info=page.locator(".deck-active .feed-v2-details");
 const text=page.locator(".deck-active .feed-v2-content");
 const height=await info.evaluate(node=>node.clientHeight);
 const offset=()=>text.evaluate(node=>new DOMMatrixReadOnly(getComputedStyle(node).transform).m42);
 const compactOffset=await offset();
 const before=await image.evaluate(node=>{window.__feedPhoto=node;return node.src;});
 await swipe(".deck-active .feed-v2-details .discovery-place",0,-180);
 await page.locator(".deck-active .feed-v2-card[data-expanded=true]").waitFor({timeout:1800});
 assert.ok(await image.evaluate((node,src)=>node===window.__feedPhoto&&node.src===src,before),
  "Reveal keeps the decoded photo node mounted");
 assert.ok(Math.abs(await offset())<1,"Expanded text reaches the visible endpoint");
 assert.equal(await info.evaluate(node=>node.clientHeight),height,"Reveal does not resize the information surface");
 await swipe(".deck-active .feed-v2-details .discovery-place",0,190);
 await page.locator(".deck-active .feed-v2-card[data-expanded=false]").waitFor({timeout:1800});
 assert.ok(await image.evaluate(node=>node===window.__feedPhoto),"Close preserves the same photo");
 assert.ok(Math.abs(await offset()-compactOffset)<1,"Close restores compact text position");

 await swipe(".deck-active .feed-v2-details .discovery-place",-205,0);
 await page.waitForTimeout(430);
 assert.equal((await selected())?.trim(),"Для тебя","Feed text swipes to For You");
 await swipe(".fy-hero h2",-205,0);
 await page.waitForTimeout(430);
 assert.equal((await selected())?.trim(),"Рядом","For You text swipes to Nearby");
 await swipe(".nb-head h2",205,0);
 await page.waitForTimeout(430);
 assert.equal((await selected())?.trim(),"Для тебя","Nearby text swipes back to For You");
 const rail=page.locator(".fy-rail").first();
 const railStart=await rail.evaluate(node=>node.scrollLeft);
 await swipe(".fy-rail .fy-tile-photo",-210,0);
 const railRelease=await rail.evaluate(node=>node.scrollLeft);
 await page.waitForTimeout(120);
 const railAfter=await rail.evaluate(node=>node.scrollLeft);
 assert.ok(railRelease>railStart+20&&railAfter>=railRelease,
  "For You portraits scroll natively with continued horizontal motion");
 assert.equal((await selected())?.trim(),"Для тебя","Portrait rail never changes the top tab");
 await swipe(".fy-hero h2",0,-220);
 const scrollTop=await page.locator(".fy-scroll").evaluate(node=>node.scrollTop);
 assert.ok(scrollTop>10,"Vertical For You swipe remains native scrolling");
 assert.equal((await selected())?.trim(),"Для тебя","Vertical scroll never changes tabs");
 assert.deepEqual(errors,[],"No browser exceptions during gestures");
 console.log("DISCOVERY_GESTURE_BROWSER_PASS touch tabs, fixed-layout reveal, photo identity and native rails");
}finally{await browser.close();}
