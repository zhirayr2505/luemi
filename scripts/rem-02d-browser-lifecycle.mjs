import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"});
const page=await context.newPage(),errors=[],BASE=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
page.on("pageerror",e=>errors.push(e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const visitor=()=>page.locator(".discovery-visitor-route");
const profile=()=>visitor().locator(".v3-profile-host");
const handle=()=>profile().locator(".v3-int-handle");
const translation=()=>visitor().evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
const physical=()=>profile().evaluate(el=>{
 const root=el.querySelector(".v3-int-root"),sheet=root?.querySelector(".v3-int-sheet");
 if(!root||!sheet)throw Error("V3 lifecycle surface absent");
 const style=getComputedStyle(root),a=parseFloat(sheet.style.top);
 const b=a+parseFloat(style.getPropertyValue("--v3-extra-scroll"))-24;
 return {mode:el.dataset.morphState,y:sheet.getBoundingClientRect().top-root.getBoundingClientRect().top,a,b};
});
const near=(a,b,tol=4)=>assert.ok(Math.abs(a-b)<=tol,"V3 route mismatch: "+a+" vs "+b);
const open=async()=>{
 await page.getByRole("button",{name:/Открыть демо-профиль/}).first().click();
 await visitor().waitFor({state:"visible"});
 await sleep(310);
 assert.equal((await physical()).mode,"compact");
};
const setBackground=async hidden=>page.evaluate(hidden=>{
 if(!("__v3Hidden" in window)){
  window.__v3Hidden=false;
  Object.defineProperty(document,"visibilityState",{configurable:true,get(){return window.__v3Hidden?"hidden":"visible";}});
 }
 window.__v3Hidden=hidden;document.dispatchEvent(new Event("visibilitychange"));
},hidden);
const routeDrag=async(dx,hold=15)=>{
 const target=await handle().boundingBox();assert.ok(target?.height>=25);
 const x=target.x+Math.min(target.width*.17,60),y=target.y+target.height*.5;
 await page.mouse.move(x,y);await page.mouse.down();
 await page.mouse.move(x+dx,y,{steps:10});await sleep(hold);await page.mouse.up();
};
try{
 await page.goto(BASE+"/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Знакомства",exact:true}).click();
 await page.getByRole("tab",{name:"Для тебя",exact:true}).click();
 await open();
 near(await translation(),0,3);
 let initial=await physical();near(initial.y,initial.a);
 await handle().press("Enter");
 await sleep(60);
 let mid=await physical();assert.ok(mid.y>initial.y+2&&mid.y<mid.b,"sheet really settling");
 await setBackground(true);await sleep(150);
 const frozen=await physical();await sleep(70);
 near((await physical()).y,frozen.y,1.5);
 await setBackground(false);await sleep(370);
 let expanded=await physical();
 assert.equal(expanded.mode,"expanded");near(expanded.y,expanded.b);
 console.log("PROFILE_V3_LIFECYCLE_PASS suspend/resume at fractional morph");
 await routeDrag(40,75);await sleep(320);
 assert.equal(await visitor().count(),1);
 near(await translation(),0,3);
 expanded=await physical();assert.equal(expanded.mode,"expanded");
 await profile().getByRole("tab",{name:"Фото",exact:true}).click();
 await sleep(240);
 assert.equal(await profile().locator('.v3-int-tab[aria-selected=true]').innerText(),"Фото");
 await routeDrag(40,60);await sleep(310);
 near(await translation(),0,3);
 assert.equal(await profile().locator('.v3-int-tab[aria-selected=true]').innerText(),"Фото");
 console.log("PROFILE_V3_LIFECYCLE_PASS route rollback and tab state");
 await setBackground(true);
 await page.setViewportSize({width:393,height:765});await sleep(75);
 await setBackground(false);await sleep(340);
 expanded=await physical();assert.equal(expanded.mode,"expanded");near(expanded.y,expanded.b);
 await page.keyboard.press("Escape");await sleep(360);
 assert.equal(await visitor().count(),0);
 await open();near(await translation(),0,3);
 await routeDrag(192,30);await sleep(410);
 assert.equal(await visitor().count(),0,"rightward route gesture closes visitor");
 await open();await page.keyboard.press("Escape");await sleep(390);
 assert.equal(await visitor().count(),0,"system Escape/back also closes");
 console.log("PROFILE_V3_LIFECYCLE_PASS route close/reopen and no stale owner callbacks");
 assert.deepEqual(errors,[],"no browser runtime exceptions");
 console.log("REM-02D V3 BROWSER LIFECYCLE QA PASS; physical A55 NOT VERIFIED");
}finally{await context.close();await browser.close();}
