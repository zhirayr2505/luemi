/** REM-04D baseline witness: accepted REM-04C versus current on same Chromium
 * viewport and local synthetic fixtures. No baseline failure is suppressed:
 * failing OLD invariants are observations, new invariants must pass.
 */
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {mkdirSync,writeFileSync} from "node:fs";
const dir="qa-artifacts/rem-04d";mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function sample(name,url){
 const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
  userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"});
 const page=await context.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto(url+"/profile-qa.html",{waitUntil:"domcontentloaded"});
  await page.getByRole("tab",{name:"Для тебя"}).click();
  await sleep(340);
  await page.locator(".fy-scroll").evaluate(el=>el.scrollTop=360);
  await sleep(90);
  const library=await page.evaluate(()=>({scroll:document.querySelector(".fy-scroll").scrollTop,
   header:Number(document.querySelector(".lh-header").style.getPropertyValue("--lh-p")||0)}));
  await page.locator(".fy-scroll .fy-section-header>button").first().evaluate(el=>el.click());
  await page.locator(".fy-expanded").waitFor();await sleep(80);
  const expanded=await page.evaluate(()=>Number(document.querySelector(".lh-header").style.getPropertyValue("--lh-p")||0));
  await page.locator(".fy-expanded .fy-back").evaluate(el=>el.click());
  await page.locator(".fy-expanded").waitFor({state:"detached"});
  await sleep(80);
  const returned=await page.evaluate(()=>({scroll:document.querySelector(".fy-scroll").scrollTop,
   header:Number(document.querySelector(".lh-header").style.getPropertyValue("--lh-p")||0)}));
  // Move the collection which used to be forced first; persist once.
  await page.locator(".fy-toolbar button").click();
  await page.locator(".fy-manage-row").filter({hasText:"Много общего"}).getByRole("button",{name:/Опустить/}).click();
  await page.locator(".fy-manage").getByRole("button",{name:"Готово"}).click();
  const order=await page.locator(".fy-scroll .fy-section-header h3").allTextContents();
  const filter=page.locator(".lh-tool-filter");
  await filter.evaluate(el=>el.click());
  await page.locator(".discovery-filter-sheet").waitFor();
  const filterBackgroundInert=await page.locator(".discovery-main-panels").evaluate(el=>el.inert);
  await page.locator(".discovery-filter-sheet button[aria-label='Закрыть фильтры']").evaluate(el=>el.click());
  await page.locator(".discovery-bottom-nav button").filter({hasText:"Профиль"}).click();
  const profileInactiveInert=await page.locator(".pm-inline .pm-page[inert]").count();
  const result={name,library,expanded,returned,commonOrderIndex:order.indexOf("Много общего"),
   filterBackgroundInert,profileInactiveInert,errors};
  assert.ok(library.scroll>=350,"fixture library must scroll");
  assert.deepEqual(errors,[],"no browser JS error");
  console.log("REM04D_BASELINE_WITNESS "+JSON.stringify(result));
  return result;
 }finally{await context.close();}
}
try{
 results.push(await sample("accepted-REM-04C","http://127.0.0.1:5174"));
 results.push(await sample("current-REM-04D","http://127.0.0.1:5173"));
 const [before,after]=results;
 assert.ok(after.returned.header>.95&&after.returned.scroll>=350,
  "REM-04D header must reflect library immediately after collection close");
 assert.ok(after.expanded<.08,"fresh collection must own header context");
 assert.ok(after.commonOrderIndex>1,"configured collection reorder must actually apply");
 assert.equal(after.filterBackgroundInert,true,"modal browsing background must be inert");
 assert.equal(after.profileInactiveInert,4,"all four offscreen profile pages inert");
 writeFileSync(dir+"/before-after.json",JSON.stringify({before,after,method:"same Chromium 393x852 mobile viewport and synthetic local fixture; actual A55/iOS NOT VERIFIED"},null,2));
}finally{await browser.close();}
