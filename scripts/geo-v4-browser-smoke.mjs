import assert from "node:assert/strict";
import {chromium} from "playwright";

/** GeoPicker V4 QA only. The old manual/GPS toggle was removed with the
 * approved compact location screen. This tests real current UI, not old copy. */
const BASE=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"});
const page=await context.newPage(),errors=[];
page.on("pageerror",e=>errors.push(e.message));
const cities=[{id:"offline:ru:krasnodar",city:"Краснодар",country:"Россия",countryCode:"RU"},
 {id:"offline:am:yerevan",city:"Ереван",country:"Армения",countryCode:"AM"}];
try{
 await page.route("**/api/geo/search?*",async route=>{
  const q=new URL(route.request().url()).searchParams.get("q")?.toLowerCase()??"";
  const results=cities.filter(p=>p.city.toLowerCase().startsWith(q.slice(0,3)));
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({results,coverage:"demo"})});
 });
 await page.goto(BASE+"/geo-qa.html",{waitUntil:"domcontentloaded"});
 const card=page.getByRole("button",{name:"Выбрать город",exact:true});
 await card.waitFor({state:"visible",timeout:5000});
 await card.click();
 const input=page.getByRole("combobox",{name:"Название города"});
 // Accessible name may come from the GlassField label rather than placeholder.
 const search=await input.count()?input:page.getByRole("combobox");
 await search.fill("Краснод");
 await page.getByRole("option",{name:/Краснодар/}).waitFor({state:"visible",timeout:5000});
 await page.getByRole("option",{name:/Краснодар/}).click();
 const current=page.locator('[data-testid="geo-current"]');
 await page.waitForFunction(()=>{try{return JSON.parse(document.querySelector('[data-testid="geo-current"]')?.textContent||"{}").city==="Краснодар";}catch{return false;}});
 assert.equal(JSON.parse(await current.innerText()).countryCode,"RU");
 await page.getByRole("button",{name:"Изменить город"}).click();
 await page.getByRole("combobox").fill("Ерев");
 await page.getByRole("option",{name:/Ереван/}).waitFor({state:"visible",timeout:5000});
 await page.getByRole("option",{name:/Ереван/}).click();
 const final=JSON.parse(await current.innerText());
 assert.equal(final.city,"Ереван");assert.equal(final.countryCode,"AM");
 assert.equal(await page.getByRole("button",{name:/Определить моё местоположение/}).count(),1);
 assert.deepEqual(errors,[]);
 console.log("LUEMI_GEO_V4_BROWSER_SMOKE_PASS "+JSON.stringify({city:final.city,countryCode:final.countryCode}));
}finally{await context.close();await browser.close();}
