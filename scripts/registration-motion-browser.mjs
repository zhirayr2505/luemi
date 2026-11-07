import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const root="http://127.0.0.1:5173/registration-motion-qa.html";
const out="qa-artifacts/registration-motion";
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:412,height:915},
  deviceScaleFactor:2.5,isMobile:true,hasTouch:true,
  userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0 Mobile Safari/537.36"});
 const page=await context.newPage();
 const failures=[];
 page.on("pageerror",error=>failures.push(error.message));
 await page.route("**/api/**",async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith("/geo/search")){
   return route.fulfill({status:200,contentType:"application/json",
    body:JSON.stringify({results:[{id:"qa:moscow",city:"Москва",country:"Россия",countryCode:"RU"}],coverage:"world"})});
  }
  return route.fulfill({status:404,contentType:"application/json",body:"{}"});
 });
 await page.goto(root,{waitUntil:"domcontentloaded"});
 const screenshot=async(label)=>page.screenshot({path:out+"/"+label+".png"});
 const stage=async(id)=>{
  await page.waitForFunction(expected=>{
   const d=document.querySelector(".v2-device");
   return d?.getAttribute("data-screen")===expected &&
    d?.getAttribute("data-step-moving")!=="true";
  },id,{timeout:6000});
  assert.equal(await page.locator(".v2-body").count(),1,id+" should have one body");
  assert.equal(await page.locator(".v2-stage-heading").count(),1,id+" should have one heading");
  await screenshot(id);
 };
 const next=async(id)=>{
  // Confirming an editor keeps it above the closing IME. Only tap Continue
  // once the same button has switched back from the circular checkmark.
  const button=page.getByRole("button",{name:"Продолжить"});
  await button.waitFor({timeout:2500});
  await button.click();
  // A real visible loading indicator replaces the arrow while the stage moves.
  assert.equal(await button.getAttribute("aria-busy"),"true","pending transition must expose spinner");
  await stage(id);
  assert.equal(await page.locator(".v2-next-spinner").count(),0,"spinner must settle");
 };
 await stage("identity");
 await page.getByPlaceholder("Как тебя зовут?").fill("Артём");
 await page.getByRole("button",{name:"Подтвердить поле"}).click();
 await next("birthday");
 await page.getByPlaceholder("ДД.ММ.ГГГГ").fill("12.05.1998");
 // A complete eight-digit birthday automatically dismisses the active editor,
 // but deliberately does not navigate to the next stage.
 await page.locator(".dob-focus-shell.is-focused").waitFor({state:"hidden",timeout:2500});
 assert.equal(await page.locator(".v2-device").getAttribute("data-screen"),"birthday");
 await page.getByRole("button",{name:"Мужчина"}).click();
 await page.getByRole("checkbox").check();
 await next("location");
 await page.getByRole("button",{name:"Выбрать город вручную"}).click();
 await page.getByPlaceholder("Введи город или страну").fill("Москва");
 await page.getByRole("option",{name:/Москва/}).first().click();
 await next("intent");
 await page.getByRole("button",{name:"Женщин"}).click();
 await page.getByRole("button",{name:"Серьёзные отношения"}).click();
 // The optional languages and biography screens now live inside the published profile.
 await page.evaluate(()=>{
  const d=document.querySelector(".v2-device");
  const log=[];
  const trace=()=>log.push({
   screen:d?.getAttribute("data-screen"),
   bodies:d?.querySelectorAll(".v2-body").length,
   headings:d?.querySelectorAll(".v2-stage-heading").length
  });
  const ob=new MutationObserver(trace);
  ob.observe(d,{subtree:true,childList:true,attributes:true});
  window.__stopStepTrace=()=>{ob.disconnect();return log};
 });
 await next("photos");
 const events=await page.evaluate(()=>window.__stopStepTrace());
 assert(events.length>0,"transition should generate DOM mutations");
 assert(events.every(event=>event.bodies<=1&&event.headings<=1),
  "No overlapping old/new stage content trees are allowed");
 assert.equal(await page.locator(".optional-profile-toggle").count(),0,
  "Profile detail editor must not interrupt fast registration");
 // Telegram back returns to the previous required step.
 await page.evaluate(()=>window.__luemiQABack?.());
 await stage("intent");
 await next("photos");
 const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9u/JqYQAAAAASUVORK5CYII=","base64");
 await page.locator('input.native-photo-input[type="file"]').setInputFiles([0,1,2].map((i)=>({
  name:"synthetic-"+i+".png",mimeType:"image/png",
  buffer:Buffer.concat([png,Buffer.from([i])])
 })));
 assert.equal(await page.locator(".mosaic img").count(),3,"three photos are ready");
 await page.getByRole("button",{name:"Создать анкету"}).click();
 await page.getByTestId("qa-synthetic-complete").waitFor({timeout:6000});
 await screenshot("synthetic-published");
 assert.deepEqual(failures,[],"no browser errors through complete registration flow");
 console.log("LUEMI registration motion browser five-step photo-first synthetic flow PASS");
}finally{await browser.close();}
