/** Chromium (Android/iOS UA emulation): theme-switch response & sheet geometry. */
import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true});
const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const cases=[
 {name:"A55",ua:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"},
 {name:"iPhone-UA",ua:"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"}
];
const record=[];
try{
 for(const c of cases){
  const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,userAgent:c.ua});
  const page=await ctx.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(base+"/profile-qa.html",{waitUntil:"domcontentloaded"});
  await page.locator(".discovery-app").waitFor();
  await page.locator(".discovery-deck-layer.deck-active .discovery-name-button").first().click();
  await page.locator(".discovery-visitor-route .pm-shell").waitFor();
  await page.waitForTimeout(380);
  const root=page.locator(".discovery-visitor-route .pm-shell");
  for(let i=0;i<8;i++){
   const before=await root.evaluate(node=>({
    top:node.querySelector(".pm-profile-sheet").getBoundingClientRect().top,
    bg:getComputedStyle(node.querySelector(".pm-profile-sheet")).backgroundColor,
    selected:node.querySelector('.pm-tab[aria-selected="true"]')?.textContent
   }));
   const button=page.locator(".discovery-visitor-route .lh-profile-theme");
   const current=await button.getAttribute("aria-label");
   const expected=current==="Тёмная тема"?"Светлая тема":"Тёмная тема";
   const started=Date.now();
   await button.click();
   await page.waitForFunction(label=>document.querySelector(".discovery-visitor-route .lh-profile-theme")?.getAttribute("aria-label")===label,expected,{timeout:1600});
   const lag=Date.now()-started;
   assert.ok(lag<1200,c.name+" theme click blocked "+lag);
   await page.waitForTimeout(210);
   const after=await root.evaluate(node=>({
    top:node.querySelector(".pm-profile-sheet").getBoundingClientRect().top,
    bg:getComputedStyle(node.querySelector(".pm-profile-sheet")).backgroundColor,
    selected:node.querySelector('.pm-tab[aria-selected="true"]')?.textContent
   }));
   assert.ok(Math.abs(after.top-before.top)<2,c.name+" theme switch displaced profile sheet");
   assert.notEqual(after.bg,before.bg,c.name+" theme did not repaint profile surface");
   assert.equal(after.selected,before.selected,c.name+" theme switch lost active tab");
   record.push({device:c.name,lag});
  }
  assert.deepEqual(errors,[],c.name+" browser errors");
  await ctx.close();
 }
 const lag=record.map(x=>x.lag).sort((a,b)=>a-b);
 console.log("LUEMI_THEME_SWITCH_QA_PASS "+JSON.stringify({
  count:record.length,p50Ms:lag[Math.floor(lag.length*.5)],p95Ms:lag[Math.ceil(lag.length*.95)-1],worstMs:lag.at(-1),
  cases:record
 }));
}catch(e){
 console.error("LUEMI_THEME_SWITCH_QA_FAIL "+(e?.stack??String(e)));
 process.exitCode=1;
}finally{await browser.close();}
