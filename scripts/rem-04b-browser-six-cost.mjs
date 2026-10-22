/** REM-04B six-photo independent A/B vs immutable accepted 04A.
 * Both variants run on the same Chrome process / local SVG / viewport, with
 * reversed order across iterations. CPU/layout counters are NOT GPU or FPS.
 */
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {chromium} from "playwright";
const out="qa-artifacts/rem-04b/compare-six";
mkdirSync(out,{recursive:true});
const urls={accepted:process.env.REM04B_ACCEPTED_URL??"http://127.0.0.1:5174",
 current:process.env.REM04B_CURRENT_URL??"http://127.0.0.1:5173"};
const browser=await chromium.launch({headless:true,channel:"chrome",args:["--no-sandbox"]});
const trials=[];
const metrics=ms=>Object.fromEntries(ms.map(m=>[m.name,m.value]));
const keys=["LayoutCount","RecalcStyleCount","LayoutDuration","RecalcStyleDuration","ScriptDuration","TaskDuration"];
const run=async(variant,trial)=>{
 const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
  userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"});
 const page=await ctx.newPage(),errors=[];
 page.on("pageerror",err=>errors.push(err.message));
 const cdp=await ctx.newCDPSession(page);await cdp.send("Performance.enable");
 await page.route("**/*",route=>route.request().url().startsWith(urls[variant]+"/")?
  route.continue():route.abort("blockedbyclient"));
 try{
  if(trial===0)await ctx.tracing.start({screenshots:true,snapshots:true});
  await page.goto(urls[variant]+"/rem-01e-qa.html?mode=local&kind=six",{waitUntil:"domcontentloaded"});
  await page.locator(".pm-shell .pm-photo-slide").first().waitFor({state:"attached"});
  assert.equal(await page.locator(".pm-shell .pm-photo-slide").count(),6);
  await page.getByRole("button",{name:"Развернуть анкету"}).click();
  await page.waitForTimeout(380);
  const measurement=[];
  for(const [from,to] of [[0,5],[5,0]]){
   if(from!==0){await page.waitForTimeout(35);}
   const before=metrics((await cdp.send("Performance.getMetrics")).metrics);
   await page.locator(".pm-shell .pm-photo-progress button").nth(to).evaluate(el=>el.click());
   const frames=await page.evaluate(async()=>{
    const samples=[],started=performance.now();
    await new Promise(resolve=>{
     const frame=t=>{
      const root=document.querySelector(".pm-shell"),clear=root?.querySelector(".pm-photo-track"),
       blur=root?.querySelector(".pm-photo-blur-track"),layer=root?.querySelector(".pm-photo-blur");
      const hero=root?.querySelector(".pm-hero")?.getBoundingClientRect();
      const transform=e=>e?new DOMMatrixReadOnly(getComputedStyle(e).transform).m41:null;
      const x=transform(clear),bx=transform(blur),w=hero?.width??1;
      const shown=[...(clear?.children??[])].flatMap((sl,i)=>{
       const r=sl.getBoundingClientRect(),dx=hero?Math.max(0,Math.min(r.right,hero.right)-Math.max(r.left,hero.left)):0;
       if(dx<=1)return [];
       const bi=blur?.children[i]?.querySelector("img");
       return [{index:i,intersection:dx,blur:!!bi,decoded:!!bi&&bi.complete&&bi.naturalWidth>0}];
      });
      samples.push({t,dt:samples.length?t-samples.at(-1).t:0,x,bx,
       fraction:x===null?null:-x/w,
       activeBlur:blur?.querySelectorAll("img").length??0,
       opacity:Number(layer?getComputedStyle(layer).opacity:0),shown});
      if(t-started>=350)resolve();else requestAnimationFrame(frame);
     };
     requestAnimationFrame(frame);
    });
    return samples;
   });
   const after=metrics((await cdp.send("Performance.getMetrics")).metrics);
   const intervals=frames.map(f=>f.dt).filter(x=>x>0).sort((a,b)=>a-b);
   const measured=Object.fromEntries(keys.map(k=>[k,
    Math.round(((after[k]??0)-(before[k]??0))*100000)/100000]));
   const missing=frames.reduce((n,f)=>n+((f.opacity>.2)?
    f.shown.filter(v=>!v.blur||!v.decoded).length:0),0);
   measurement.push({from,to,frames:frames.length,performance:measured,missingVisibleBlurSlots:missing,
    peakBlur:Math.max(...frames.map(f=>f.activeBlur)),maxDrift:Math.max(...frames.map(f=>Math.abs((f.x??0)-(f.bx??0)))),
    p95FrameMs:intervals[Math.max(0,Math.ceil(intervals.length*.95)-1)]??null,
    xEnd:frames.at(-1)?.x??null});
   console.log("REM04B_SIX_AB_SAMPLE "+JSON.stringify({variant,trial,...measurement.at(-1)}));
   if(trial===0)await page.screenshot({path:out+"/"+variant+"-"+from+"-"+to+".png"});
  }
  assert.deepEqual(errors,[],"no page errors "+variant);
  if(trial===0)await ctx.tracing.stop({path:out+"/"+variant+".trace.zip"});
  trials.push({variant,trial,measurement});
 }finally{await ctx.close();}
};
try{
 for(const [trial,order] of [[0,["accepted","current"]],[1,["current","accepted"]],[2,["accepted","current"]]])
  for(const variant of order)await run(variant,trial);
 const median=values=>values.sort((a,b)=>a-b)[1];
 const summary={chromeChannel:"chrome",viewport:[393,852],sameSixSvg:true,runsPerVariant:3,
  metrics:{},maxBlur:{},missingBlur:{},maxDrift:{},p95FrameMs:{},
  note:"Desktop headless Chrome, synthetic local SVG. CPU/layout and rAF intervals only: NO claim of GPU memory, RAM or physical Telegram FPS."};
 for(const variant of ["accepted","current"]){
  const m=trials.filter(t=>t.variant===variant).flatMap(t=>t.measurement);
  summary.metrics[variant]=Object.fromEntries(keys.map(k=>[k,median(
   trials.filter(t=>t.variant===variant).map(t=>t.measurement.reduce((n,r)=>n+r.performance[k],0)))]));
  summary.maxBlur[variant]=Math.max(...m.map(x=>x.peakBlur));
  summary.missingBlur[variant]=m.reduce((n,x)=>n+x.missingVisibleBlurSlots,0);
  summary.maxDrift[variant]=Math.max(...m.map(x=>x.maxDrift));
  summary.p95FrameMs[variant]=median(m.map(x=>x.p95FrameMs??0));
 }
 console.log("REM04B_SIX_AB_SUMMARY "+JSON.stringify(summary));
 writeFileSync(out+"/metrics.json",JSON.stringify({summary,trials},null,2));
 assert.ok(summary.maxBlur.current<=3,"no more than three active blur media");
 assert.equal(summary.missingBlur.current,0,"current optical coverage in both directions");
}finally{await browser.close();}
