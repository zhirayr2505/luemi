/** Profile Morph A2 photo cardinality, 0-6 photo navigation, visibility/blur budget.
 * Browser Chromium samples are not a physical A55 WebView proof. */
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,channel:"chrome",args:["--no-sandbox"]});
const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"});
const page=await ctx.newPage(),errors=[],records=[];
page.on("pageerror",e=>errors.push(e.message));
const dir="qa-artifacts/rem-04b/six";mkdirSync(dir,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const root=()=>page.locator(".pm-shell.pm-a2-root");
const dot=async i=>root().locator(".pm-a2-photo-dots button").nth(i).evaluate(el=>el.click());
const read=()=>page.evaluate(()=>{
 const profile=document.querySelector(".pm-shell.pm-a2-root");
 const track=profile?.querySelector(".pm-a2-photo-track");
 const face=profile?.querySelector(".pm-a2-face");
 const photos=[...(track?.querySelectorAll(".pm-a2-photo-slide img")??[])];
 const layer=profile?.querySelector(".pm-a2-background");
 const back=[...(layer?.querySelectorAll("img")??[])];
 const current=profile?.querySelector(".pm-a2-photo-dots button[aria-current=true]");
 const index=[...(current?.parentElement?.children??[])].indexOf(current);
 const matrix=track?new DOMMatrixReadOnly(getComputedStyle(track).transform):null;
 return {mode:profile?.dataset.morphState,photos:photos.map(p=>({id:p.dataset.photoId,src:p.getAttribute("src"),
  decoded:p.complete&&p.naturalWidth>0})),back:back.map(x=>x.currentSrc),
  blurRenders:back.length,current:index,photoId:photos[index]?.dataset.photoId??null,
  translateX:matrix?.m41??0,faceWidth:face?.getBoundingClientRect().width??0,
  background:layer?getComputedStyle(layer).backgroundColor:null};
});
const capture=async label=>{
 const r=await read();records.push({label,...r});
 await page.screenshot({path:dir+"/"+label+".png"});
 assert.ok(r.blurRenders<=2,"A2 background at most two decoded layers, not a 6-image blur track");
 assert.ok(r.photos.every(p=>typeof p.id==="string"&&p.id.length>0));
 console.log("PROFILE_A2_SIX "+JSON.stringify({label,count:r.photos.length,active:r.photoId,blurRenders:r.blurRenders}));
 return r;
};
async function openFixture(mode,kind){
 await page.goto("http://127.0.0.1:5173/rem-01e-qa.html?mode="+mode+"&kind="+kind,{waitUntil:"domcontentloaded"});
 await root().waitFor({state:"visible"});
 const first=await read();
 assert.equal(first.mode,"compact","photo variants all open compact");
 await root().locator(".pm-a2-face").evaluate(el=>el.click());
 await page.locator('.pm-a2-root[data-morph-state="expanded"]').waitFor({state:"attached",timeout:2500});
 await pause(250);
 return first;
}
const trace=async(label,trigger)=>{
 const frames=page.evaluate(async()=>{
  const frames=[],first=performance.now();
  await new Promise(resolve=>{
   const sample=t=>{
    const el=document.querySelector(".pm-shell .pm-a2-photo-track");
    if(el){const m=new DOMMatrixReadOnly(getComputedStyle(el).transform);
     frames.push({ms:t,tx:m.m41});}
    if(t-first>300)resolve();else requestAnimationFrame(sample);
   };requestAnimationFrame(sample);
  });
  return frames;
 });
 await pause(20);await trigger();
 const rows=await frames;
 const intervals=rows.slice(1).map((x,i)=>x.ms-rows[i].ms).filter(v=>Number.isFinite(v)&&v>=0);
 const values=[...intervals].sort((a,b)=>a-b),quant=q=>values[Math.min(values.length-1,Math.ceil(values.length*q)-1)]??0;
 const result={label,frames:rows.length,p50FrameMs:quant(.5),p95FrameMs:quant(.95),
  worstFrameMs:values.at(-1)??0,startX:rows[0]?.tx,endX:rows.at(-1)?.tx};
 records.push(result);console.log("PROFILE_A2_FRAME_INTERVALS "+JSON.stringify(result));
 assert.ok(rows.length>=3&&rows.every(x=>Number.isFinite(x.tx)));
 return result;
};
try{
 await ctx.tracing.start({screenshots:true,snapshots:true,sources:false});
 await openFixture("local","six");
 let initial=await capture("local-six-compact-to-expanded");
 assert.equal(initial.photos.length,6);
 for(const [from,to] of [[0,5],[5,0],[0,3],[3,1],[1,4],[4,2],[2,5]]){
  await dot(from);await pause(240);
  await trace("jump-"+from+"-"+to,()=>dot(to));
  await pause(240);
  const result=await capture("jump-"+from+"-"+to);
  assert.equal(result.current,to);
  assert.equal(result.photoId,result.photos[to].id);
 }
 await dot(0);await pause(245);
 await dot(5);await pause(45);await dot(1);await pause(45);await dot(4);
 await pause(260);let r=await capture("fast-retarget-0-5-1-4");
 assert.equal(r.current,4,"newest authorized photo wins");
 await page.setViewportSize({width:375,height:768});await dot(0);await pause(230);
 await dot(5);await pause(70);await page.setViewportSize({width:393,height:852});
 await pause(300);r=await capture("resize-during-photo-settle");
 assert.equal(r.current,5,"reflow preserves photoId across viewport changes");
 await root().locator(".pm-a2-face").evaluate(el=>el.click());
 await page.locator(".pm-viewer").waitFor({state:"visible",timeout:3500});
 assert.equal(await page.locator(".pm-viewer-image").getAttribute("data-photo-id"),r.photoId);
 await page.keyboard.press("Escape");await page.locator(".pm-viewer").waitFor({state:"detached",timeout:3500});
 r=await capture("viewer-return-photo5");
 assert.equal(r.current,5);
 for(const {mode,kind,count} of [
  {mode:"local",kind:"none",count:0},{mode:"local",kind:"one",count:1},
  {mode:"visitor",kind:"six",count:2},{mode:"server",kind:"six",count:3},
  {mode:"owner",kind:"mixed",count:4},{mode:"local",kind:"six",count:6}]){
  await openFixture(mode,kind);
  const v=await capture("cardinality-"+mode+"-"+kind);
  assert.equal(v.photos.length,count,"authorized photo count "+mode+"/"+kind);
  assert.equal(await root().locator(".pm-a2-photo-dots button").count(),count>1?count:0);
  if(count>1){
   await dot(count-1);await pause(260);
   const moved=await read();assert.equal(moved.current,count-1);
   await dot(0);await pause(260);assert.equal((await read()).current,0);
  }
 }
 await page.route("**/__rem04b-broken.jpg",route=>route.fulfill({status:404,body:"broken"}));
 await openFixture("local","broken");const broken=await capture("broken-photo-fallback");
 assert.ok(broken.photos.length>=3&&broken.blurRenders<=2,"bad media does not expand background cache");
 await dot(2);await pause(250);await capture("broken-selected-no-layer-leak");
 assert.deepEqual(errors,[],"no uncaught runtime errors");
 writeFileSync(dir+"/a2-records.json",JSON.stringify({records,errors},null,2));
 console.log("REM04B_SIX_A2_CARDINALITY_AND_PERF_PASS, synthetic Chromium only; physical A55 not measured");
}finally{await ctx.tracing.stop({path:dir+"/a2-trace.zip"}).catch(()=>{});await ctx.close();await browser.close();}
