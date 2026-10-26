import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const target="http://127.0.0.1:5173/profile-v3-preview.html";
const output="qa-artifacts/profile-v3";
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const settings of [
  {label:"390x740",viewport:{width:390,height:740},isMobile:false},
  {label:"a55-412x915",viewport:{width:412,height:915},isMobile:true}
 ]){
  const context=await browser.newContext({viewport:settings.viewport,deviceScaleFactor:2.6,
   isMobile:settings.isMobile,hasTouch:settings.isMobile,
   userAgent:settings.isMobile?"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0 Mobile Safari/537.36":undefined});
  const page=await context.newPage();
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(target);
  const root=page.getByTestId("v3-root"),handle=page.getByRole("button",{name:"Переключить профиль"});
  await root.waitFor();
  const progress=async()=>Number(await root.getAttribute("data-progress"));
  const img=page.locator(".v3-mask img"),sheet=page.getByTestId("v3-sheet");
  assert.equal(await progress(),0,"must start COMPACT");
  assert.equal(await img.count(),1,"one persistent portrait node");
  const image=await img.evaluate(el=>({complete:el.complete,width:el.naturalWidth,height:el.naturalHeight}));
  assert.deepEqual(image,{complete:true,width:800,height:1100},"authorized synthetic image decoded");
  const photoElement=await img.elementHandle();
  const initial=await sheet.boundingBox();
  assert(initial&&initial.y>100,"compact sheet is visible");
  await page.screenshot({path:`${output}/${settings.label}-compact.png`});
  await handle.click();
  await page.waitForFunction(()=>Number(document.querySelector('[data-testid="v3-root"]')?.getAttribute("data-progress")??0)>.999,
   null,{timeout:2500});
  const expanded=await sheet.boundingBox();
  assert(expanded&&expanded.y>initial.y+80,"expanded sheet really travels down");
  await page.screenshot({path:`${output}/${settings.label}-expanded.png`});
  const bounds=await handle.boundingBox();
  assert(bounds,"handle is visible");
  const x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
  // Explicitly drag further than half the range, so a slow or quick release
  // MUST resolve COMPACT. Do not add a second tap during an in-flight settle.
  const travel=expanded.y-initial.y,dragDistance=Math.max(110,Math.min(travel*.73,y-80));
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(x,y-dragDistance,{steps:12});
  const dragged=await progress();
  assert(dragged>0&&dragged<.5,`drag should follow finger below midpoint; p=${dragged}`);
  await page.screenshot({path:`${output}/${settings.label}-interrupted.png`});
  await page.mouse.up();
  await page.waitForFunction(()=>Number(document.querySelector('[data-testid="v3-root"]')?.getAttribute("data-progress")??1)<.001,
   null,{timeout:2500});
  assert.equal(await img.count(),1,"same img survives full interrupted morph");
  assert(await img.evaluate((el,original)=>el===original,photoElement),
   "morph never replaces active img element");
  await handle.click();
  await page.waitForFunction(()=>Number(document.querySelector('[data-testid="v3-root"]')?.getAttribute("data-progress")??0)>.999,
   null,{timeout:2500});
  await handle.click();
  await page.waitForFunction(()=>Number(document.querySelector('[data-testid="v3-root"]')?.getAttribute("data-progress")??1)<.001,
   null,{timeout:2500});
  assert.deepEqual(errors,[],"no unhandled page errors");
  console.log(`Profile V3 Chromium DOM smoke PASS: ${settings.label}, decoded persistent image, compact/expanded, drag/release, tap reversals`);
  await context.close();
 }
}finally{await browser.close();}
