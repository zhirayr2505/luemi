import assert from "node:assert/strict";
import {chromium} from "playwright";

/** V3 viewport/geometry invariants in simulated Android Chrome; not hardware certification. */
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({
 viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"
});
const page=await context.newPage(),errors=[];
page.on("pageerror",error=>errors.push(error.message));
const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const root=page.locator(".v3-int-root");
const handle=page.locator(".v3-int-root .v3-int-handle");
const snapshot=()=>page.evaluate(()=>{
 const node=document.querySelector(".v3-int-root");
 const sheet=node?.querySelector(".v3-int-sheet");
 const tabs=node?.querySelector(".v3-int-tabs");
 const face=node?.querySelector(".v3-int-mask");
 const track=node?.querySelector(".v3-int-pages-track");
 if(!node||!sheet||!tabs||!face||!track)throw Error("V3 profile viewport selectors absent");
 const nodeRect=node.getBoundingClientRect(),rect=sheet.getBoundingClientRect();
 const matrix=new DOMMatrixReadOnly(getComputedStyle(track).transform);
 return {width:node.clientWidth,height:node.clientHeight,top:rect.top-nodeRect.top,
  compactTop:Number.parseFloat(sheet.style.top),sheetHeight:sheet.clientHeight,
  tabsHeight:tabs.clientHeight,faceWidth:face.getBoundingClientRect().width,
  pageFraction:-matrix.m41/Math.max(1,node.clientWidth),
  selected:node.querySelector('.v3-int-tab[aria-selected="true"]')?.textContent?.trim(),
  state:node.dataset.sheetState};
});
const near=(a,b,delta=4)=>assert.ok(Math.abs(a-b)<=delta,"expected "+a+" near "+b+" (±"+delta+")");
try{
 await page.goto(base+"/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Профиль",exact:true}).click();
 await root.waitFor({state:"visible"});
 await wait(130);
 const initial=await snapshot();
 assert.equal(initial.state,"collapsed");
 assert.ok(initial.top>0&&initial.width>=300&&initial.faceWidth>20);
 near(initial.top,initial.compactTop,4);
 for(const height of [722,648,782]){
  await handle.press("Enter");await wait(450);
  let open=await snapshot();
  assert.equal(open.state,"expanded","V3 expands via keyboard and keeps state after settle");
  assert.ok(open.top>open.compactTop+20,"sheet moves while photo expands");
  await page.setViewportSize({width:393,height});await wait(280);
  open=await snapshot();
  assert.equal(open.state,"expanded","viewport resize preserves expanded state");
  assert.ok(open.top>open.compactTop+20&&open.tabsHeight>30&&open.sheetHeight>100);
  await handle.press("Enter");await wait(450);
  const closed=await snapshot();
  assert.equal(closed.state,"collapsed");
  near(closed.top,closed.compactTop,5);
  console.log("PROFILE_V3_RESIZE_PASS "+height);
 }
 await page.setViewportSize({width:393,height:852});await wait(220);
 const tabs=page.locator(".v3-int-root .v3-int-tab");
 await tabs.nth(4).click();await wait(85);
 await page.setViewportSize({width:428,height:852});await wait(370);
 let result=await snapshot();
 assert.equal(result.selected,"Подарки");
 near(result.pageFraction,4,.09);
 await tabs.nth(2).click();await wait(360);
 result=await snapshot();assert.equal(result.selected,"Фото");near(result.pageFraction,2,.09);
 console.log("PROFILE_V3_TABS_RESIZE_PASS");
 await page.evaluate(()=>{const element=document.querySelector(".v3-profile-host");if(element)element.style.display="none";});
 await wait(70);
 await page.evaluate(()=>{const element=document.querySelector(".v3-profile-host");if(element)element.style.display="";});
 await wait(220);
 const returned=await snapshot();
 assert.equal(returned.state,"collapsed");
 near(returned.top,returned.compactTop,5);
 assert.deepEqual(errors,[],"no browser runtime errors");
 console.log("REM-02B V3 GEOMETRY BROWSER PASS; physical Samsung A55 not verified");
}finally{await context.close();await browser.close();}
