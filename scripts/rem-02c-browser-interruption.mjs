import assert from "node:assert/strict";
import {chromium} from "playwright";

/** V3 touch ownership, tabs and photo track; Chromium Android emulation, not device signoff. */
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"});
const page=await context.newPage(),errors=[],base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
page.on("pageerror",e=>errors.push(e.message));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const swipe=async(x,y,dx,dy,steps=12)=>{
 const cdp=await context.newCDPSession(page);
 try{
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y,id:1}]});
  for(let n=1;n<=steps;n++){
   await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x+dx*n/steps,y:y+dy*n/steps,id:1}]});
   await delay(15);
  }
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
 }finally{await cdp.detach();}
};
const root=page.locator(".v3-int-root");
const selected=()=>root.locator('.v3-int-tab[aria-selected="true"]');
const activePhoto=()=>root.locator('.v3-int-photo-dots button[aria-current="true"]');
const state=()=>root.getAttribute("data-sheet-state");
try{
 await page.goto(base+"/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Профиль",exact:true}).click();
 await root.waitFor({state:"visible"});
 assert.equal(await state(),"collapsed");
 const face=root.locator(".v3-int-mask");
 const compact=await face.boundingBox();assert.ok(compact?.width&&compact.height);
 await face.click();await delay(420);
 assert.equal(await state(),"expanded");
 assert.equal(await page.locator(".pm-viewer").count(),0);
 const hero=await face.boundingBox();
 assert.ok(hero&&hero.width>compact.width*1.2&&hero.height>compact.height*1.2);
 assert.equal(await root.locator(".v3-int-photo-dots button").count(),3);
 await swipe(hero.x+hero.width*.77,hero.y+hero.height*.48,-hero.width*.42,0);
 await delay(280);
 assert.equal(await activePhoto().count(),1);
 assert.equal(await root.locator(".v3-int-photo-dots button").nth(1).getAttribute("aria-current"),"true",
  "left swipe in expanded photo opens adjacent real gallery image");
 await swipe(hero.x+hero.width*.22,hero.y+hero.height*.48,hero.width*.42,0);
 await delay(280);
 assert.equal(await root.locator(".v3-int-photo-dots button").first().getAttribute("aria-current"),"true");
 console.log("PROFILE_V3_GESTURE_PASS gallery left/right");
 await root.locator(".v3-int-handle").press("Enter");await delay(400);
 assert.equal(await state(),"collapsed");
 const pages=root.locator(".v3-int-pages"),rect=await pages.boundingBox();
 assert.ok(rect&&rect.height>90,"V3 tab content surface remains visible");
 await swipe(rect.x+rect.width*.75,rect.y+Math.min(95,rect.height*.5),-rect.width*.51,0);
 await delay(300);
 assert.equal(await selected().innerText(),"Блики","horizontal content gesture selects adjacent tab");
 console.log("PROFILE_V3_GESTURE_PASS tab swipe");
 await root.locator(".v3-int-tab").nth(4).click();await delay(45);
 await root.locator(".v3-int-tab").nth(2).click();await delay(320);
 assert.equal(await selected().innerText(),"Фото","rapid replacement settles on latest tab");
 assert.equal(await selected().count(),1);
 console.log("PROFILE_V3_GESTURE_PASS interrupted tab transition");
 await root.locator(".v3-int-tab").first().click();await delay(280);
 const contentBox=await pages.boundingBox();
 assert.ok(contentBox);
 await page.mouse.move(contentBox.x+contentBox.width*.72,contentBox.y+Math.min(95,contentBox.height*.55));
 await page.mouse.down();
 await page.mouse.move(contentBox.x+contentBox.width*.23,contentBox.y+Math.min(95,contentBox.height*.55),{steps:9});
 await page.mouse.up();await delay(320);
 assert.equal(await selected().innerText(),"Блики","mouse horizontal pager works");
 console.log("PROFILE_V3_GESTURE_PASS mouse horizontal pager");
 assert.deepEqual(errors,[],"no browser exceptions");
 console.log("REM-02C V3 GESTURE BROWSER QA PASS; physical A55 NOT VERIFIED");
}finally{await context.close();await browser.close();}
