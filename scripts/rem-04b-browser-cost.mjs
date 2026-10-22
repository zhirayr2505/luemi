/** Identical real-Chromium A/B for accepted REM-04A vs REM-04B.
 * Measures browser Performance domain, rAF intervals, decoded blur peers and
 * real clip/transforms. No GPU-residency or compositor completion is inferred.
 */
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {chromium} from "playwright";
const BASE=process.env.REM04B_ACCEPTED_URL||"http://127.0.0.1:5174";
const AFTER=process.env.REM04B_CURRENT_URL||"http://127.0.0.1:5173";
const dir="qa-artifacts/rem-04b/compare";mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome",args:["--no-sandbox"]});
const metricsToObject=rows=>Object.fromEntries(rows.map(m=>[m.name,m.value]));
const diff=(a,b,key)=>Math.round(((b[key]??0)-(a[key]??0))*10000)/10000;
const results=[];
const run=async(name,url,iteration)=>{
 const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
  userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"});
 const page=await ctx.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
 // Identical local SVG fixture; external/demo network is excluded both sides.
 await page.route("**/*",route=>route.request().url().startsWith(url+"/")?
  route.continue():route.abort("blockedbyclient"));
 const cdp=await ctx.newCDPSession(page);await cdp.send("Performance.enable");
 try{
  if(iteration===0)await ctx.tracing.start({screenshots:true,snapshots:true,sources:false});
  await page.goto(url+"/profile-qa.html",{waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"Профиль",exact:true}).click();
  await page.locator(".pm-inline .pm-photo-track img").first().waitFor();
  await page.getByRole("button",{name:"Развернуть анкету"}).click();
  await page.waitForTimeout(410);
  const metrics0=metricsToObject((await cdp.send("Performance.getMetrics")).metrics);
  const before=await page.evaluate(()=>{
   const hero=document.querySelector(".pm-inline .pm-hero");
   const clear=document.querySelector(".pm-inline .pm-photo-track");
   const blur=document.querySelector(".pm-inline .pm-photo-blur");
   return {blurCount:blur?.querySelectorAll("img").length,
    photoCount:clear?.querySelectorAll(".pm-photo-slide").length,
    opacity:blur?getComputedStyle(blur).opacity:null,
    heroRect:hero?.getBoundingClientRect().toJSON(),
    count:document.querySelectorAll(".pm-inline .pm-photo-track img").length};
  });
  await page.locator(".pm-inline .pm-photo-progress button").nth(1).evaluate(el=>el.click());
  // Record actual frame cadence and element matrices during same 290ms tween.
  const samples=await page.evaluate(async()=>{
   const track=document.querySelector(".pm-inline .pm-photo-track");
   const blurTrack=document.querySelector(".pm-inline .pm-photo-blur-track");
   const snapshots=[];
   await new Promise(resolve=>{
    const until=performance.now()+320;let previous=0;
    const frame=t=>{
     const matrix=el=>el?new DOMMatrixReadOnly(getComputedStyle(el).transform).m41:null;
     snapshots.push({dt:previous?t-previous:0,clearX:matrix(track),blurX:matrix(blurTrack)});
     previous=t;
     if(t>=until||snapshots.length>34)resolve();else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
   });
   return snapshots;
  });
  const metrics1=metricsToObject((await cdp.send("Performance.getMetrics")).metrics);
  const intervals=samples.map(s=>s.dt).filter(x=>x>0).sort((a,b)=>a-b);
  const p95=intervals[Math.max(0,Math.ceil(intervals.length*.95)-1)]??0;
  const measured={name,iteration,before,p95FrameMs:Math.round(p95*100)/100,frames:samples.length,
   metrics:{
    LayoutCount:diff(metrics0,metrics1,"LayoutCount"),
    RecalcStyleCount:diff(metrics0,metrics1,"RecalcStyleCount"),
    LayoutDuration:diff(metrics0,metrics1,"LayoutDuration"),
    RecalcStyleDuration:diff(metrics0,metrics1,"RecalcStyleDuration"),
    ScriptDuration:diff(metrics0,metrics1,"ScriptDuration"),
    TaskDuration:diff(metrics0,metrics1,"TaskDuration"),
    NodesAfter:Math.round(metrics1.Nodes??0),
    JSHeapUsedAfter:Math.round(metrics1.JSHeapUsedSize??0)
   },
   samples:samples.length,
   xStart:samples[0]?.clearX,xEnd:samples.at(-1)?.clearX,
   maxBlurClearDrift:samples.filter(x=>x.blurX!==null).length?
    Math.max(...samples.filter(x=>x.blurX!==null).map(x=>Math.abs(x.blurX-x.clearX))):null,
   errors};
  results.push(measured);
  console.log("REM04B_COST_METRICS "+JSON.stringify(measured));
  if(iteration===0){
   await page.screenshot({path:dir+"/"+name+"-final.png"});
   await ctx.tracing.stop({path:dir+"/"+name+".trace.zip"});
  }
  assert.deepEqual(errors,[]);
  assert.equal(before.photoCount,3);
  assert.ok(Number(before.opacity)>.85,"same collapsed visual state");
  assert.ok(measured.xEnd< -380,"real track settled at next photo");
  return measured;
 }finally{await ctx.close();}
};
try{
 // Alternating order controls the first-run warm-cache and runner-load bias.
 await run("accepted",BASE,0);await run("current",AFTER,0);
 await run("current",AFTER,1);await run("accepted",BASE,1);
 await run("accepted",BASE,2);await run("current",AFTER,2);
 const pick=(name,key)=>results.filter(r=>r.name===name).map(r=>r.metrics[key]).sort((a,b)=>a-b)[1];
 const keys=["LayoutCount","RecalcStyleCount","LayoutDuration","RecalcStyleDuration","ScriptDuration","TaskDuration"];
 const medians=Object.fromEntries(keys.map(key=>[key,{accepted:pick("accepted",key),current:pick("current",key)}]));
 const summary={viewport:[393,852],identicalDemoPhotoCount:3,runsPerVariant:3,medians,
  maxBlurDriftCurrent:Math.max(...results.filter(r=>r.name==="current").map(r=>r.maxBlurClearDrift??0)),
  acceptedBlurImages:results.find(r=>r.name==="accepted")?.before.blurCount,
  currentBlurImages:results.find(r=>r.name==="current")?.before.blurCount,
  note:"CPU/layout/style/JS timings are noisy desktop Chrome counters, not GPU raster, Telegram, memory or device-FPS proof"};
 console.log("REM04B_AB_COST_SUMMARY "+JSON.stringify(summary));
 writeFileSync(dir+"/metrics.json",JSON.stringify({results,summary},null,2));
}finally{await browser.close();}
