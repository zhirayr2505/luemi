import {mkdir,writeFile} from "node:fs/promises";
import {chromium} from "playwright";

const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const dest="qa-artifacts/feed-b-screenshots";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const errors=[];
await mkdir(dest,{recursive:true});
const capture=async(width,height,prefix)=>{
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true,
  userAgent:width>400?"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36":
   "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"});
 const page=await ctx.newPage();
 page.on("pageerror",err=>errors.push(prefix+":"+err.message));
 try{
  await page.goto(base+"/profile-qa.html",{waitUntil:"domcontentloaded"});
  const card=page.locator(".discovery-deck-layer.deck-active .feed-v2-card");
  await card.waitFor({state:"visible",timeout:15000});
  // Hide ONLY the developer QA focus button. All LUEMI components are real.
  await page.addStyleTag({content:".pm-qa-focus{display:none!important}"});
  await page.evaluate(()=>window.__luemiQaPerf.theme());
  await page.waitForTimeout(550);
  const portrait=card.locator(".feed-v2-photo .carousel-track img").first();
  await portrait.evaluate(async img=>{
   await Promise.race([img.decode().catch(()=>{}),new Promise(ok=>setTimeout(ok,4500))]);
  });
  const save=async(name)=>{
   const file=dest+"/"+prefix+"-"+name+".png";
   await page.screenshot({path:file,type:"png",animations:"disabled"});
   console.log("LUEMI_FEED_SCREENSHOT "+JSON.stringify({file,width,height,profile:await card.locator(".discovery-name-button").first().innerText(),
    dark:await page.locator(".luemi-shell").getAttribute("data-theme"),
    image:await portrait.evaluate(img=>({loaded:img.complete&&img.naturalWidth>0,src:img.currentSrc.slice(0,110)}))}));
  };
  await save("01-compact");
  await card.getByRole("button",{name:"Раскрыть информацию"}).click();
  await card.locator('[aria-label="Свернуть информацию"]').waitFor({state:"attached",timeout:3000});
  await page.waitForTimeout(430);
  await save("02-expanded");
  await card.getByRole("button",{name:"Свернуть информацию"}).click();
  await page.waitForTimeout(400);
  await card.getByRole("button",{name:"Нравится",exact:true}).click();
  await page.waitForTimeout(550);
  await save("03-next-card");
 }finally{await ctx.close();}
};
try{
 await capture(412,915,"android-a55");
 await capture(393,852,"iphone-393");
 if(errors.length)console.warn("LUEMI_FEED_PAGE_ERRORS "+JSON.stringify(errors));
 console.log("LUEMI_FEED_B_CAPTURE_COMPLETE");
}finally{await browser.close();}
