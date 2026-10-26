import assert from "node:assert/strict";
import {chromium} from "playwright";
/** A2 viewport/geometry invariants: Chromium Android emulation, not hardware A55. */
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"});
const page=await context.newPage(),errors=[];
page.on("pageerror",e=>errors.push(e.message));
const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const read=()=>page.evaluate(()=>{
 const root=document.querySelector(".pm-inline.pm-a2-root");
 const sheet=root?.querySelector(".pm-a2-sheet");
 const tabs=root?.querySelector(".pm-a2-tabs");
 const face=root?.querySelector(".pm-a2-face");
 const track=root?.querySelector(".pm-a2-pages-track");
 if(!root||!sheet||!tabs||!face||!track)throw Error("A2 viewport QA selector absent");
 const style=getComputedStyle(root),a=parseFloat(style.getPropertyValue("--a2-compact-top")),
  b=parseFloat(style.getPropertyValue("--a2-expanded-top"));
 const m=new DOMMatrixReadOnly(getComputedStyle(sheet).transform);
 const t=new DOMMatrixReadOnly(getComputedStyle(track).transform);
 return {width:root.clientWidth,height:root.clientHeight,compact:a,expanded:b,
  y:sheet.getBoundingClientRect().top-root.getBoundingClientRect().top,
  p:m.m42/Math.max(1,b-a),sheetHeight:sheet.clientHeight,tabsHeight:tabs.clientHeight,
  faceWidth:face.getBoundingClientRect().width,selected:root.querySelector('.pm-a2-tab[aria-selected=true]')?.textContent?.trim(),
  pageFraction:-t.m41/Math.max(1,root.clientWidth),mode:root.dataset.morphState};
});
const close=(a,b,tolerance=2)=>assert.ok(Math.abs(a-b)<=tolerance,"expected "+a+" near "+b+" within "+tolerance);
const handle=()=>page.locator(".pm-inline .pm-a2-handle");
try{
 await page.goto(base+"/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Профиль",exact:true}).click();
 await page.locator(".pm-inline.pm-a2-root").waitFor({state:"visible"});
 await sleep(100);
 let init=await read();
 assert.equal(init.mode,"compact");close(init.y,init.compact);
 assert.ok(init.expanded>init.compact&&init.sheetHeight>100);
 for(const [percent,height] of [[.25,722],[.50,648],[.75,782]]){
  await handle().press("Enter");
  await sleep(Math.round(260*percent));
  const during=await read();
  assert.ok(during.p>=0&&during.p<=1,"bounded normalized progress during settle");
  await page.setViewportSize({width:393,height});
  await sleep(390);
  const end=await read();
  assert.equal(end.mode,"expanded","viewport change preserves destination");
  close(end.y,end.expanded,2.5);
  assert.ok(end.tabsHeight>35&&Math.abs(end.sheetHeight-init.sheetHeight)<180,
   "sheet keeps measured flex geometry, no per-frame elastic height writer");
  await handle().press("Enter");
  await sleep(310);
  const back=await read();
  assert.equal(back.mode,"compact");
  close(back.y,back.compact,2.5);
  console.log("PROFILE_A2_RESIZE_PASS "+Math.round(percent*100)+"% -> "+height+"px");
 }
 await page.setViewportSize({width:393,height:852});await sleep(150);
 // Interrupt a settle after an actual fractional progress and reverse at once.
 await handle().press("Enter");await sleep(75);
 const first=await read();assert.ok(first.p>0&&first.p<1);
 await handle().press("Enter");await sleep(320);
 const reverse=await read();assert.equal(reverse.mode,"compact");close(reverse.y,reverse.compact);
 console.log("PROFILE_A2_REVERSE_DURING_SETTLE_PASS "+JSON.stringify({mid:first.p,final:reverse.p}));
 // Changing width mid pager transition must not remount identity or detach active content.
 const tabs=page.locator(".pm-inline .pm-a2-tab");
 await tabs.nth(4).click();await sleep(65);
 const early=await read();
 assert.ok(early.pageFraction>=0&&early.pageFraction<=4.1);
 await page.setViewportSize({width:428,height:852});await sleep(310);
 let final=await read();
 assert.equal(final.selected,"Подарки");close(final.pageFraction,4,.04);
 await tabs.nth(2).click();await sleep(260);
 final=await read();assert.equal(final.selected,"Фото");close(final.pageFraction,2,.04);
 console.log("PROFILE_A2_TABS_RESIZE_PASS");
 // Hidden/visible owner and reduced motion preserve reachable real DOM.
 await page.evaluate(()=>{document.querySelector(".pm-inline").style.display="none";});
 await sleep(40);
 await page.evaluate(()=>{document.querySelector(".pm-inline").style.display="";});
 await sleep(180);
 const returned=await read();assert.equal(returned.mode,"compact");close(returned.y,returned.compact);
 assert.deepEqual(errors,[],"no browser runtime errors");
 console.log("REM-02B A2 GEOMETRY BROWSER PASS; physical Samsung A55 not verified");
}finally{await context.close();await browser.close();}
