/** LUEMI Warm Berry / Moonstone Feed visual geometry and interaction QA.
 * Dev-only fixture renders the production DiscoveryApp and card code.
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
const rect=async locator=>locator.evaluate(el=>{
 const r=el.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height,b:r.bottom,r:r.right};
});
const screenshot=async(page,name)=>page.screenshot({path:root+"/"+name+".png",animations:"disabled"});
try{
 for(const device of variants){
  const ctx=await browser.newContext({viewport:{width:device.width,height:device.height},isMobile:true,hasTouch:true,
   userAgent:device.ua,deviceScaleFactor:1});
  const page=await ctx.newPage();
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto(base+"/profile-qa.html",{waitUntil:"domcontentloaded"});
  await page.locator(".deck-active .moonstone-feed-card").waitFor({timeout:15000});
  await page.evaluate(()=>window.__luemiQaPerf?.theme?.());
  await page.locator('.luemi-shell[data-theme="dark"]').waitFor();
  await page.addStyleTag({content:".pm-qa-focus{display:none!important}"});
  await page.locator(".luemi-shell").evaluate(node=>{
   node.style.setProperty("--tg-content-safe-area-inset-top","26px");
   node.style.setProperty("--tg-safe-area-inset-bottom","9px");
  });
  const feed=page.locator(".deck-active .moonstone-feed-card");
  const image=page.locator(".deck-active .moonstone-photo .carousel-track img.is-ready").first();
  await image.waitFor({timeout:15000});
  await image.evaluate(img=>img.decode());
  await page.waitForTimeout(350);
  const summary=page.locator(".deck-active .moonstone-compact-info");
  const details=page.locator(".deck-active .moonstone-name-row");
  const location=page.locator(".deck-active .moonstone-location");
  const goal=page.locator(".deck-active .moonstone-goal");
  const nav=page.locator(".discovery-bottom-nav");
  const logo=page.locator(".lh-browse .lh-center");
  const tabs=page.locator(".discovery-top-tabs");
  const actions=page.locator(".deck-active .moonstone-actions");
  const [f,s,d,loc,g,n,l,t,i,a]=await Promise.all([
   rect(feed),rect(summary),rect(details),rect(location),rect(goal),rect(nav),rect(logo),rect(tabs),rect(image),rect(actions)
  ]);
  assert(near(f.x,0,1)&&near(f.y,0,1)&&near(f.w,device.width,1),
   `Full-bleed Moonstone card must start at viewport origin on ${device.name}: ${JSON.stringify(f)}`);
  assert(near(f.h,device.height,2),`Photo extends behind bottom navigation: ${JSON.stringify(f)}`);
  assert(near(l.x+l.w/2,device.width/2,2),`Original LUEMI wordmark remains centered: ${JSON.stringify(l)}`);
  assert(t.y>=l.y+l.h-2,`Tabs must follow logo: ${JSON.stringify({l,t})}`);
  assert(s.y>t.y+t.h+20,`Compact identity follows top navigation: ${JSON.stringify({s,t})}`);
  assert(s.y>0&&s.b<a.y+10,`Compact identity stays above actions: ${JSON.stringify({s,a})}`);
  assert(a.b<=n.y+5,`Action row cannot be obscured by navigation: ${JSON.stringify({a,n})}`);
  assert(d.y>=s.y-2&&d.b<=s.b+2,`Name/age remains in compact identity: ${JSON.stringify({s,d})}`);
  assert(loc.y>=s.y-2&&loc.b<=s.b+2,`Location remains in compact identity: ${JSON.stringify({s,loc})}`);
  assert(g.y>=s.y-2&&g.b<=s.b+2,`Goal chip remains in compact identity: ${JSON.stringify({s,g})}`);
  assert(near(i.x,0,2)&&near(i.w,device.width,2),`Photo image must cover the viewport width`);
  assert.equal(await actions.locator(".moonstone-pass-button").count(),1);
  assert.equal(await actions.locator(".moonstone-like-button").count(),1);
  assert.equal(await actions.locator(".moonstone-like-button .moonstone-super-star").count(),1);
  assert.equal((await page.locator('.discovery-top-tabs [role=tab]').allTextContents()).join("/"),"Лента/Для тебя/Мир");
  const material=await goal.evaluate(node=>({
   blur:getComputedStyle(node).backdropFilter||getComputedStyle(node).webkitBackdropFilter,
   radius:getComputedStyle(node).borderRadius,
   background:getComputedStyle(node).backgroundImage
  }));
  assert(material.radius!=="0px"&&material.background.includes("gradient"),"Warm Berry goal chip keeps rounded layered glass");
  if(device.name.startsWith("ios"))assert(/blur\(13px\)/.test(material.blur),
   "Supported WebViews retain stationary backdrop blur on the goal chip");
  await screenshot(page,device.name);
  const toggle=page.locator(".deck-active .moonstone-profile-toggle");
  await toggle.click({force:true});
  await page.locator('.deck-active .moonstone-feed-card[data-expanded="true"]').waitFor({timeout:2400});
  const drawer=page.locator(".deck-active .moonstone-profile-drawer");
  const expanded=await rect(drawer);
  assert(expanded.y>=t.b+8,
   `Expanded detail layer must stay below interactive tabs: ${JSON.stringify({expanded,t})}`);
  await screenshot(page,device.name+"-expanded");
  await toggle.click({force:true});
  await page.locator('.deck-active .moonstone-feed-card[data-expanded="false"]').waitFor({timeout:2400});
  assert.deepEqual(errors,[],`No runtime errors in ${device.name}`);
  console.log("FEED_REFERENCE_BROWSER_PASS",device.name,{goalBlur:material.blur,photo:f.h,nav:n.y,actions:a.y});
  await ctx.close();
 }
}finally{await browser.close();}
