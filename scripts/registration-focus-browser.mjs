import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const url="http://127.0.0.1:5173/registration-motion-qa.html";
const dir="qa-artifacts/registration-focus-devices";
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const sizes=[
 {width:320,height:568,label:"compact"},
 {width:360,height:640,label:"small-android"},
 {width:390,height:844,label:"iphone"},
 {width:412,height:915,label:"galaxy"},
 {width:768,height:1024,label:"tablet"},
 {width:1024,height:768,label:"tablet-landscape"}
];
try{
 for(const size of sizes){
  const context=await browser.newContext({
   viewport:{width:size.width,height:size.height},
   isMobile:size.width<800,hasTouch:size.width<800,deviceScaleFactor:2
  });
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto(url,{waitUntil:"domcontentloaded"});
  const input=page.getByPlaceholder("Как тебя зовут?");
  await input.waitFor();
  await input.focus();
  await page.locator(".name-focus-shell.is-focused").waitFor();
  // Use computed CSS docking top, not interpolated transform during the hop.
  const anchor=await page.locator(".name-focus-shell").evaluate(el=>parseFloat(
   getComputedStyle(el).getPropertyValue("--focused-dock-top")));
  assert(Number.isFinite(anchor),size.label+" must compute a device-relative top");
  const progress=await page.locator(".v2-progress").boundingBox();
  assert(anchor>(progress?.y??0)+2,size.label+" must dock below Telegram header");
  await page.waitForTimeout(510);
  const topBefore=await page.locator(".name-focus-shell").evaluate(el=>el.getBoundingClientRect().top);
  const keyboardHeight=Math.max(300,Math.round(size.height*.58));
  if(keyboardHeight<size.height-85){
   await page.setViewportSize({width:size.width,height:keyboardHeight});
   await page.waitForTimeout(180);
   const whileOpen=await page.locator(".name-focus-shell").evaluate(el=>el.getBoundingClientRect().top);
   assert(Math.abs(whileOpen-topBefore)<2.5,
     size.label+": opening software keyboard repositioned the focused editor by "+
     (whileOpen-topBefore).toFixed(1)+"px");
   await page.screenshot({path:dir+"/"+size.label+"-keyboard-emulated.png"});
   await page.setViewportSize({width:size.width,height:size.height});
   await page.waitForTimeout(180);
   const afterClose=await page.locator(".name-focus-shell").evaluate(el=>el.getBoundingClientRect().top);
   assert(Math.abs(afterClose-topBefore)<2.5,
     size.label+": closing software keyboard repositioned focused editor by "+
     (afterClose-topBefore).toFixed(1)+"px");
  }
  await input.evaluate(el=>el.blur());
  await page.locator(".name-focus-shell.is-focused").waitFor({state:"hidden",timeout:2500});
  assert.equal(await page.locator(".v2-device").getAttribute("data-field-focus"),null,
   "Glass cannot disappear while keyboard is still dismissing");

  // DOB invalid -> stays focused; valid -> closes without changing step.
  await input.fill("Артём");
  await page.getByRole("button",{name:"Подтвердить поле"}).click();
  await page.getByRole("button",{name:"Продолжить"}).click();
  await page.locator('.v2-device[data-screen="birthday"][data-step-moving="true"]')
   .waitFor({state:"hidden",timeout:6000});
  await page.locator('.v2-device[data-screen="birthday"]').waitFor();
  const dob=page.getByPlaceholder("ДД.ММ.ГГГГ");
  await dob.fill("12.05.2015");
  await page.waitForTimeout(140);
  assert.equal(await dob.evaluate(el=>document.activeElement===el),true,
   size.label+" must keep the keyboard on invalid or underage birthday");
  await dob.fill("12.05.1998");
  await page.waitForFunction(()=>document.activeElement?.getAttribute("placeholder")!=="ДД.ММ.ГГГГ");
  await page.locator(".dob-focus-shell.is-focused").waitFor({state:"hidden",timeout:2500});
  assert.equal(await page.locator(".v2-device").getAttribute("data-screen"),"birthday",
   "DOB completion must not automatically advance registration");
  assert.deepEqual(errors,[],size.label+" JavaScript console errors");
  await context.close();
  console.log("Responsive IME/DOB QA PASS:",size.label,size.width+"x"+size.height);
 }
}finally{await browser.close();}
