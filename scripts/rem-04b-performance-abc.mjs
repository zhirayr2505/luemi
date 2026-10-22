/** REM-04B CPU/layout investigation: identical immutable A/B/C in one Chrome.
 * A = accepted REM-04A (5174), B = existing REM-04B 95be2d18 (5175),
 * C = current isolated PR #48 HEAD (5173).
 * Chrome Performance domain + sampling profiler, DOM media mutations, RAF trace.
 * Never treats desktop Chrome as physical WebView or GPU-residency proof.
 */
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {mkdirSync,writeFileSync} from "node:fs";
const out="qa-artifacts/rem-04b/performance-abc";mkdirSync(out,{recursive:true});
const urls={A:"http://127.0.0.1:5174",B:"http://127.0.0.1:5175",C:"http://127.0.0.1:5173"};
const browser=await chromium.launch({headless:true,channel:"chrome",args:["--no-sandbox"]});
const keys=["ScriptDuration","TaskDuration","LayoutCount","RecalcStyleCount","LayoutDuration","RecalcStyleDuration"];
const all=[],profiles=[];
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]??null;};
const round=x=>Math.round(x*100000)/100000;
const metrics=rows=>Object.fromEntries(rows.map(m=>[m.name,m.value]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const unique=(a)=>[...new Set(a)];
async function run(variant,trial){
 const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
  userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"});
 const page=await ctx.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const perf={reactCommits:0,commitDurations:[],injectCalls:0};
  Object.defineProperty(window,"__rem04bReactPerf",{value:perf});
  const hook={supportsFiber:true,renderers:new Map(),inject(renderer){
    const id=this.renderers.size+1;this.renderers.set(id,renderer);perf.injectCalls++;return id;
   },onCommitFiberRoot(){perf.reactCommits++;perf.commitDurations.push(performance.now());},
   onCommitFiberUnmount(){},onPostCommitFiberRoot(){}};
  Object.defineProperty(window,"__REACT_DEVTOOLS_GLOBAL_HOOK__",{configurable:true,value:hook});
 });
 const cdp=await ctx.newCDPSession(page);
 await cdp.send("Performance.enable");
 // Chrome CPU sampling is independent of the app's animation owner.
 await cdp.send("Profiler.enable");
 try{
  await page.goto(urls[variant]+"/rem-01e-qa.html?mode=local&kind=six",{waitUntil:"domcontentloaded"});
  await page.locator(".pm-shell .pm-photo-progress button").nth(5).waitFor();
  assert.equal(await page.locator(".pm-shell .pm-photo-slide").count(),6);
  await page.getByRole("button",{name:"Развернуть анкету"}).click();
  await sleep(380);
  await page.evaluate(async()=>{
   await Promise.all(Array.from(document.querySelectorAll(".pm-shell .pm-photo-slide img")).map(img=>
     img.decode?.().catch(()=>{})??Promise.resolve()));
  });
  await sleep(75);
  const samples=[];
  if(trial===0)await cdp.send("Profiler.start");
  for(const [from,to] of [[0,5],[5,0],[0,1],[1,0]]){
   // One true same-browser click + identical 340ms frame window, no screenshots inside.
   const before=metrics((await cdp.send("Performance.getMetrics")).metrics);
   const current=await page.evaluate(()=>{
    const root=document.querySelector(".pm-shell"),blur=root?.querySelector(".pm-photo-blur-track");
    const perf=window.__rem04bReactPerf;
    const sizes=blur?[...blur.children].map(x=>!!x.querySelector("img")):[];
    const obj={changes:0,mutations:0,highWater:0,decoded:0};
    const observer=blur?new MutationObserver(records=>{
     const windowMedia=[...blur.children].map(x=>!!x.querySelector("img"));
     const key=windowMedia.map((yes,i)=>yes?i:"").filter(x=>x!=="").join(",");
     if(obj.key!==key){obj.key=key;obj.changes++;}
     obj.mutations+=records.length;obj.highWater=Math.max(obj.highWater,windowMedia.filter(Boolean).length);
    }):null;
    observer?.observe(blur,{subtree:true,childList:true});
    window.__rem04bObserve={obj,observer};
    return {commits:perf?.reactCommits??null,injectCalls:perf?.injectCalls??0,blurStart:sizes.filter(Boolean).length};
   });
   await page.locator(".pm-shell .pm-photo-progress button").nth(to).evaluate(el=>el.click());
   const frames=await page.evaluate(async()=>{
    const list=[],root=document.querySelector(".pm-shell"),
     clear=root?.querySelector(".pm-photo-track"),
     blur=root?.querySelector(".pm-photo-blur-track"),
     layer=root?.querySelector(".pm-photo-blur"),hero=root?.querySelector(".pm-hero");
    await new Promise(resolve=>{
     const start=performance.now();
     const tick=t=>{
      const mx=e=>e?new DOMMatrixReadOnly(getComputedStyle(e).transform).m41:null;
      const x=mx(clear),bx=mx(blur),w=hero?.clientWidth??393;
      const visible=[];
      if(x!==null){
       const pos=-x/w;
       for(let i=Math.max(0,Math.floor(pos));i<=Math.min(5,Math.ceil(pos));i++){
        const distance=Math.abs(i-pos);
        if(distance<1-.003){
         const img=blur?.children[i]?.querySelector("img");
         visible.push({i,blur:!!img,decoded:!!img&&img.complete&&img.naturalWidth>0});
        }
       }
      }
      list.push({t,dt:list.length?t-list.at(-1).t:0,x,bx,
       blurCount:blur?.querySelectorAll("img").length??0,
       decodedCount:[...(blur?.querySelectorAll("img")??[])].filter(img=>img.complete&&img.naturalWidth>0).length,
       opacity:layer?Number(getComputedStyle(layer).opacity):0,
       visible});
      if(t-start>=345)resolve();else requestAnimationFrame(tick);
     };
     requestAnimationFrame(tick);
    });
    return list;
   });
   const after=metrics((await cdp.send("Performance.getMetrics")).metrics);
   const counts=await page.evaluate(()=>{
    const p=window.__rem04bReactPerf,o=window.__rem04bObserve;
    o?.observer?.disconnect();
    return {commits:p?.reactCommits??null,injectCalls:p?.injectCalls??0,
      mediaChanges:o?.obj?.changes??0,mediaMutations:o?.obj?.mutations??0,
      mediaPeak:o?.obj?.highWater??0};
   });
   const sorted=frames.map(f=>f.dt).filter(x=>x>0).sort((a,b)=>a-b);
   const missing=frames.reduce((n,f)=>n+(f.opacity>.2?
     f.visible.filter(v=>!v.blur||!v.decoded).length:0),0);
   const summary={from,to,performance:Object.fromEntries(keys.map(k=>[k,round((after[k]??0)-(before[k]??0))])),
     frames:frames.length,p95FrameMs:round(sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)]??0),
     reactCommits:counts.commits===null||current.commits===null?null:counts.commits-current.commits,
     reactHookAttached:counts.injectCalls>0,mediaWindowChanges:counts.mediaChanges,
     mediaDomMutations:counts.mediaMutations,mediaPeak:Math.max(counts.mediaPeak,...frames.map(f=>f.blurCount)),
     decodedPeak:Math.max(...frames.map(f=>f.decodedCount)),missingVisibleBlurSlots:missing,
     maxDrift:Math.max(...frames.filter(f=>f.bx!==null).map(f=>Math.abs(f.x-f.bx)),0)};
   samples.push(summary);
   console.log("REM04B_ABC_SAMPLE "+JSON.stringify({variant,trial,...summary}));
   if(variant==="C"){
    assert.ok(summary.mediaPeak<=3,"at most three blur img");
    assert.equal(summary.missingVisibleBlurSlots,0,"continuous blur coverage");
    assert.ok(summary.maxDrift<=1,"clear/blur matrices stay equal");
   }
   await sleep(75);
  }
  if(trial===0){
   const cpu=await cdp.send("Profiler.stop");
   const nodes=cpu.profile.nodes||[],byId=new Map(nodes.map(n=>[n.id,n]));const hits=new Map();
   for(const id of cpu.profile.samples??[]){
    const f=byId.get(id)?.callFrame;const name=f?.functionName||"(anonymous)";
    const label=name+"@"+(f?.url??"").split("/").slice(-2).join("/");
    hits.set(label,(hits.get(label)??0)+1);
   }
   const top=[...hits].sort((a,b)=>b[1]-a[1]).slice(0,35);
   profiles.push({variant,top,totalSamples:cpu.profile.samples?.length??0});
   console.log("REM04B_ABC_CPU_PROFILE "+JSON.stringify({variant,top:top.slice(0,17),samples:cpu.profile.samples?.length??0}));
   writeFileSync(out+"/cpu-"+variant+".json",JSON.stringify({top,profile:cpu.profile},null,2));
  }
  assert.deepEqual(errors,[],"browser runtime errors in "+variant);
  all.push({variant,trial,samples});
 }finally{await ctx.close();}
}
try{
 const orders=[["A","B","C"],["C","B","A"],["B","A","C"]];
 for(let trial=0;trial<orders.length;trial++)for(const name of orders[trial])await run(name,trial);
 const summary={browser:"same installed Chrome, same process",viewport:[393,852],trialsPerVariant:3,
  scenarios:["0→5→0","0→1→0"],statistics:{},profiles,
  sourceRefs:{A:"561145925efe04199235070e4d0c56be295ef2a4",
   B:"95be2d18f7a94dc5deb897e02cb5d1b9c106a5d0",C:process.env.GITHUB_SHA??"branch"},
  notice:"CPU, task, style and layout are desktop Chrome counters; no universal FPS/device inference"};
 for(const name of ["A","B","C"]){
  const group=all.filter(x=>x.variant===name);
  summary.statistics[name]={};
  for(const key of keys)summary.statistics[name][key]=median(group.map(x=>round(x.samples.reduce((t,s)=>t+s.performance[key],0))));
  for(const key of ["reactCommits","mediaWindowChanges","mediaDomMutations"]){
   const values=group.map(x=>x.samples.reduce((t,s)=>t+(s[key]??0),0));
   summary.statistics[name][key]=key==="reactCommits"&&!group[0].samples[0].reactHookAttached?null:median(values);
  }
  summary.statistics[name].reactHookAttached=group[0].samples[0].reactHookAttached;
  summary.statistics[name].p95FrameMs=median(group.map(x=>median(x.samples.map(s=>s.p95FrameMs))));
  summary.statistics[name].missingVisibleBlurSlots=group.reduce((t,g)=>t+g.samples.reduce((n,s)=>n+s.missingVisibleBlurSlots,0),0);
  summary.statistics[name].maxDrift=Math.max(...group.flatMap(x=>x.samples.map(s=>s.maxDrift)));
  summary.statistics[name].peakBlur=Math.max(...group.flatMap(x=>x.samples.map(s=>s.mediaPeak)));
  summary.statistics[name].decodedPeak=Math.max(...group.flatMap(x=>x.samples.map(s=>s.decodedPeak)));
 }
 console.log("REM04B_ABC_SUMMARY "+JSON.stringify(summary));
 writeFileSync(out+"/summary.json",JSON.stringify({summary,trials:all},null,2));
 assert.equal(summary.statistics.C.missingVisibleBlurSlots,0,"no C empty visible blur slots");
 assert.ok(summary.statistics.C.maxDrift<=1,"no C CSS matrix drift");
 assert.ok(summary.statistics.C.peakBlur<=3,"bounded decoded media");
}finally{await browser.close();}
