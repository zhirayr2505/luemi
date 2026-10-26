import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"});
const page=await context.newPage(),errors=[],base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
page.on("pageerror",e=>errors.push(e.message));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const touch=async(x,y,dx,dy,steps=12)=>{
 const cdp=await context.newCDPSession(page);
 try{
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y,id:1}]});
  for(let n=1;n<=steps;n++){
   await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x+dx*n/steps,y:y+dy*n/steps,id:1}]});
   await sleep(15);
  }
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
 }finally{await cdp.detach()}
};
const source=()=>page.locator(".pm-inline.pm-a2-root");
const tab=()=>source().locator('.pm-a2-tab[aria-selected=true]');
const photo=()=>source().locator('.pm-a2-photo-dots button[aria-current=true]');
const report=msg=>console.log("PROFILE_A2_GESTURE_PASS "+msg);
try{
 await page.goto(base+"/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Профиль",exact:true}).click();
 await source().waitFor({state:"visible"});
 assert.equal(await source().getAttribute("data-morph-state"),"compact");
 const compact=await source().locator(".pm-a2-face").boundingBox();
 await source().locator(".pm-a2-face").click();
 await page.locator('.pm-inline[data-morph-state="expanded"]').waitFor({state:"attached",timeout:2200});
 assert.equal(await page.locator(".pm-viewer").count(),0);
 const hero=await source().locator(".pm-a2-face").boundingBox();
 assert.ok(hero.width>compact.width*2&&hero.height>compact.height*2);
 assert.equal(await source().locator(".pm-a2-photo-dots button").count(),3);
 await touch(hero.x+hero.width*.8,hero.y+hero.height*.43,-hero.width*.48,0);
 await sleep(255);
 assert.equal(await photo().count(),1,"one active source ID after horizontal hero swipe");
 assert.equal(await source().locator(".pm-a2-photo-dots button").nth(1).getAttribute("aria-current"),"true",
  "real horizontal touch chooses the second authorized gallery photo");
 await touch(hero.x+hero.width*.25,hero.y+hero.height*.43,hero.width*.48,0);
 await sleep(255);
 assert.equal(await source().locator(".pm-a2-photo-dots button").first().getAttribute("aria-current"),"true");
 report("photo track left/right and active ID");
 // Compact content remains native vertical scroll; horizontal flicks select tabs.
 await source().locator(".pm-a2-handle").press("Enter");
 await page.locator('.pm-inline[data-morph-state="compact"]').waitFor({state:"attached",timeout:2200});
 const content=source().locator(".pm-a2-pages");
 const cbox=await content.boundingBox();assert.ok(cbox&&cbox.height>100);
 const about=source().locator(".pm-a2-page").first();
 await about.evaluate(el=>{el.scrollTop=Math.min(92,el.scrollHeight-el.clientHeight)});
 const before=await about.evaluate(el=>el.scrollTop);
 assert.ok(before>0,"native tab scroll must be physically scrollable");
 await touch(cbox.x+cbox.width*.72,cbox.y+Math.min(100,cbox.height*.5),-cbox.width*.51,0);
 await sleep(260);
 assert.equal(await tab().innerText(),"Блики","horizontal content touch selects adjacent tab");
 assert.equal(await about.evaluate(el=>el.scrollTop),before,"inactive page preserves scrollTop");
 report("native vertical content/independent horizontal tab pager");
 // Reverse a tab transition before its endpoint; no stale target may commit.
 await source().locator(".pm-a2-tab").nth(4).click();
 await sleep(45);
 await source().locator(".pm-a2-tab").nth(2).click();
 await sleep(270);
 assert.equal(await tab().innerText(),"Фото","newest tab wins rapid interruption");
 assert.equal(await source().locator('.pm-a2-tab[aria-selected=true]').count(),1);
 report("tab interruption targets and exclusive selected state");
 // Mouse/pen pointer alternative on desktop remains usable.
 await source().locator(".pm-a2-tab").first().click();await sleep(230);
 const box=await content.boundingBox();
 await page.mouse.move(box.x+box.width*.7,box.y+Math.min(140,box.height*.6));
 await page.mouse.down();
 await page.mouse.move(box.x+box.width*.22,box.y+Math.min(140,box.height*.6),{steps:8});
 await page.mouse.up();await sleep(270);
 assert.equal(await tab().innerText(),"Блики","mouse/pen pager mirrors touch ownership");
 report("mouse pointer horizontally paged");
 assert.deepEqual(errors,[],"no uncaught errors");
 console.log("REM-02C A2 GESTURE BROWSER QA PASS · Chromium only, actual A55 NOT VERIFIED");
}finally{await context.close();await browser.close();}
