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
 const device=page.locator(".v2-device");
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
  const button=page.locator(".v2-next");
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
 await page.getByRole("button",{name:"Подтвердить поле"}).click();
 await page.getByRole("button",{name:"Мужчина"}).click();
 await page.getByRole("checkbox").check();
 await next("location");
 await page.getByRole("button",{name:"Выбрать город вручную"}).click();
 await page.getByPlaceholder("Введи город или страну").fill("Москва");
 await page.getByRole("option",{name:/Москва/}).first().click();
 await next("intent");
 await page.getByRole("button",{name:"Женщин"}).click();
 await page.getByRole("button",{name:"Серьёзные отношения"}).click();
 await next("languages");
 const languages=page.locator(".language-option");
 assert.equal(await languages.count(),60,"all language options must remain available");
 const langInput=page.getByPlaceholder("Найди язык из 60");
 await langInput.fill("арм");
 assert.equal(await page.locator(".language-option").count(),1,"search narrows languages immediately");
 await page.getByRole("button",{name:/Армянский/}).click();
 await page.getByRole("button",{name:"Подтвердить поле"}).click();
 await page.evaluate(()=>{
  const d=document.querySelector(".v2-device");
  const log=[];
  const trace=()=>log.push({screen:d?.getAttribute("data-screen"),
   optional:d?.querySelectorAll(".optional-profile-toggle").length,
   bodies:d?.querySelectorAll(".v2-body").length,
   headings:d?.querySelectorAll(".v2-stage-heading").length});
  const ob=new MutationObserver(trace);
  ob.observe(d,{subtree:true,childList:true,attributes:true});
  window.__stopStepTrace=()=>{ob.disconnect();return log};
 });
 await next("personality");
 const events=await page.evaluate(()=>window.__stopStepTrace());
 assert(events.length>0,"transition should generate DOM mutations");
 assert(events.every(event=>!(event.screen==="languages"&&event.optional>0)),
  "Next step's 'Добавить о себе' must not mount over the languages screen");
 assert(events.every(event=>event.bodies<=1&&event.headings<=1),
  "No overlapping old/new step DOM trees are allowed");
 await page.locator("textarea[placeholder='Что тебя радует? Чем любишь заниматься?']").fill("Люблю музыку и прогулки");
 await page.getByRole("button",{name:"Подтвердить поле"}).click();
 const optional=page.locator(".optional-profile-toggle");
 await optional.click();
 await page.getByRole("dialog").waitFor();
 await page.getByRole("dialog").getByRole("button",{name:"Назад"}).click();
 await page.getByRole("dialog").waitFor({state:"hidden"});
 // Real app Telegram back is registered; check backwards and forwards too.
 await page.evaluate(()=>window.__luemiQABack?.());
 await stage("languages");
 await next("personality");
 await next("photos");
 const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9u/JqYQAAAAASUVORK5CYII=","base64");
 await page.getByLabel("Добавить фотографии").setInputFiles([0,1,2].map((i)=>({
  name:"synthetic-"+i+".png",mimeType:"image/png",
  buffer:Buffer.concat([png,Buffer.from([i])])
 })));
 assert.equal(await page.locator(".mosaic img").count(),3,"three photos are ready");
 await next("review");
 assert.equal(await page.getByRole("img",{name:"Главное фото"}).count(),1);
 await page.getByRole("button",{name:"Создать анкету"}).click();
 await page.getByTestId("qa-synthetic-complete").waitFor({timeout:6000});
 await screenshot("synthetic-published");
 assert.deepEqual(failures,[],"no browser errors through complete registration flow");
 console.log("LUEMI registration motion browser full 8-stage synthetic flow PASS");
}finally{await browser.close();}
