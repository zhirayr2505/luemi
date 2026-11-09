/** LUEMI reference Feed visual geometry and interaction QA.
 * Dev-only fixture renders the exact DiscoveryApp and card code, not a flat mock.
 * Run with the same Chromium installation as the existing profile V3 browser job.
 */
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const root="qa-artifacts/feed-reference";
const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
await mkdir(root,{recursive:true});
const browser=await chromium.launch({headless:true});
const variants=[
 {name:"android-393x852",width:393,height:852,ua:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36"},
 {name:"compact-360x740",width:360,height:740,ua:"Mozilla/5.0 (Linux; Android 15; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36"},
 {name:"short-320x568",width:320,height:568,ua:"Mozilla/5.0 (Linux; Android 15; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36"},
 {name:"ios-390x844",width:390,height:844,ua:"Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1"}
];
const near=(a,b,tolerance=2)=>Math.abs(a-b)<=tolerance;
const rect=async(locator)=>locator.evaluate(el=>{
 const r=el.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height,b:r.bottom,r:r.right};
});
const screenshot=async(page,name)=>page.screenshot({path:`${root}/${name}.png`,animations:"disabled"});
try{
 for(const device of variants){
  const ctx=await browser.newContext({viewport:{width:device.width,height:device.height},isMobile:true,hasTouch:true,
   userAgent:device.ua,deviceScaleFactor:1});
  const page=await ctx.newPage();
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto(base+"/profile-qa.html",{waitUntil:"domcontentloaded"});
  await page.locator(".deck-active .feed-v2-card").waitFor({timeout:15000});
  // Profile QA switches from its light-theme toggle to production dark.
  await page.evaluate(()=>window.__luemiQaPerf?.theme?.());
  await page.locator('.luemi-shell[data-theme="dark"]').waitFor();
  // Emulate the safe-area variables provided by Telegram, including iPhone/Android.
  await page.locator(".luemi-shell").evaluate(node=>{
   node.style.setProperty("--tg-content-safe-area-inset-top","26px");
   node.style.setProperty("--tg-safe-area-inset-bottom","9px");
  });
  await page.locator(".deck-active .feed-v2-photo .carousel-track img.is-ready").first().waitFor({timeout:15000});
  await page.waitForTimeout(350);
  const feed=page.locator(".deck-active .feed-v2-card");
  const panel=page.locator(".deck-active .feed-v2-glass");
  const details=page.locator(".deck-active .feed-v2-details");
  const nav=page.locator(".discovery-bottom-nav");
  const logo=page.locator(".lh-browse .lh-center");
  const tabs=page.locator(".discovery-top-tabs");
  const img=page.locator(".deck-active .feed-v2-photo .carousel-track img.is-ready").first();
  const action=page.locator(".deck-active .discovery-actions");
  const [f,g,d,n,l,t,i,a]=await Promise.all([
   rect(feed),rect(panel),rect(details),rect(nav),rect(logo),rect(tabs),rect(img),rect(action)
  ]);
  assert(near(f.x,0,1)&&near(f.y,0,1)&&near(f.w,device.width,1),
   `Full-bleed card must start at viewport origin on ${device.name}: ${JSON.stringify(f)}`);
  assert(near(f.h,device.height,2),`Photo extends behind bottom nav: ${JSON.stringify(f)}`);
  assert(near(l.x+l.w/2,device.width/2,2),`Original LUEMI wordmark centered: ${JSON.stringify(l)}`);
  assert(t.y>=l.y+l.h-2,`Tabs must follow logo: ${JSON.stringify({l,t})}`);
  assert(g.y>t.y+t.h+40,`Glass should sit below face/top navigation: ${JSON.stringify(g)}`);
  assert(g.y>0&&g.b<a.y+10,`Glass is above the existing actions: ${JSON.stringify({g,a})}`);
  assert(a.b<=n.y+5,`Action row cannot be obscured by nav: ${JSON.stringify({a,n})}`);
  assert(d.y>=g.y-5&&d.b<=g.b+5,`Information stays within glass: ${JSON.stringify({g,d})}`);
  assert(near(i.x,0,2)&&near(i.w,device.width,2),`Photo image must cover width`);
  assert.equal(await action.locator("button").count(),3);
  assert.equal((await page.locator('.discovery-top-tabs [role=tab]').allTextContents()).join("/"),"Лента/Для тебя/Мир");
  const optics=await panel.evaluate(node=>({
   blur:getComputedStyle(node).backdropFilter||getComputedStyle(node).webkitBackdropFilter,
   radius:getComputedStyle(node).borderRadius,
   background:getComputedStyle(node).backgroundImage
  }));
  assert(optics.radius!=="0px"&&optics.background.includes("gradient"),"Real layered glass material");
  if(device.name.startsWith("ios"))assert(/blur\(23px\)/.test(optics.blur),
   "Supported WebViews keep stationary backdrop glass blur");
  await screenshot(page,device.name);
  // Verify the original Profile Morph pointer interaction remains available.
  await page.locator(".deck-active .feed-v2-expand").click({force:true});
  await page.locator('.deck-active .feed-v2-card[data-expanded="true"]').waitFor({timeout:2400});
  await screenshot(page,device.name+"-expanded");
  await page.locator(".deck-active .feed-v2-expand").click({force:true});
  await page.locator('.deck-active .feed-v2-card[data-expanded="false"]').waitFor({timeout:2400});
  assert.deepEqual(errors,[],`No runtime errors in ${device.name}`);
  console.log("FEED_REFERENCE_BROWSER_PASS",device.name,{glass:optics.blur,photo:f.h,nav:n.y,actions:a.y});
  await ctx.close();
 }
}finally{await browser.close();}
