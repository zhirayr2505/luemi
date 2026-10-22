/** REM-04B independent six-photo visible optical coverage investigation.
 * Measures every requestAnimationFrame; a missing DOM node is only a DEFECT
 * if its slot actually intersects the visible hero while blur opacity > .2.
 */
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,channel:"chrome",args:["--no-sandbox"]});
const dir="qa-artifacts/rem-04b/six";mkdirSync(dir,{recursive:true});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"});
const page=await context.newPage(),errors=[],records=[];
page.on("pageerror",e=>errors.push(e.message));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const snapshot=()=>page.evaluate(()=>{
 const root=document.querySelector(".pm-inline .pm-shell")??document.querySelector(".pm-dialog .pm-shell");
 const hero=root?.querySelector(".pm-hero"),clear=root?.querySelector(".pm-photo-track"),
  blur=root?.querySelector(".pm-photo-blur-track"),layer=root?.querySelector(".pm-photo-blur");
 const rect=e=>{const r=e?.getBoundingClientRect();return r?{x:r.left,y:r.top,w:r.width,h:r.height,right:r.right,bottom:r.bottom}:null;};
 const matrix=e=>e?new DOMMatrixReadOnly(getComputedStyle(e).transform):null;
 const viewport=rect(hero),clearX=matrix(clear)?.m41??null,blurX=matrix(blur)?.m41??null;
 const opacity=layer?Number(getComputedStyle(layer).opacity):0;
 const slides=[...(clear?.querySelectorAll(".pm-photo-slide")??[])];
 const blurSlides=[...(blur?.querySelectorAll(".pm-photo-blur-slide")??[])];
 const visible=(r)=>viewport&&r&&r.right>viewport.x+.5&&r.x<viewport.right-.5&&
   r.bottom>viewport.y+.5&&r.y<viewport.bottom-.5;
 const pairs=slides.map((e,i)=>{
  const a=e.querySelector("img"),b=blurSlides[i]?.querySelector("img"),cr=rect(e),br=rect(blurSlides[i]);
  const intersection=viewport&&cr?Math.max(0,Math.min(cr.right,viewport.right)-Math.max(cr.x,viewport.x)):0;
  return {index:i,id:a?.getAttribute("data-photo-id")??"photo-"+i,blurId:blurSlides[i]?.dataset.blurPhotoId,
   clearSrc:a?.currentSrc?.slice(0,85),blurSrc:b?.currentSrc?.slice(0,85),
   clearRect:cr,blurRect:br,intersection,visible:visible(cr),blurExists:!!b,
   blurDecoded:!!b&&b.complete&&b.naturalWidth>0,clearDecoded:!!a&&a.complete&&a.naturalWidth>0,
   filter:b?getComputedStyle(b).filter:null};
 });
 const affected=pairs.filter(p=>p.intersection>.5&&opacity>.2&&(!p.blurExists||!p.blurDecoded||
  p.blurSrc!==p.clearSrc||p.blurId!==p.id));
 return {timestamp:performance.now(),clearX,blurX,width:viewport?.w??null,
  fractionalIndex:clearX!==null&&viewport?.w? -clearX/viewport.w:null,
  opacity,filter:pairs.find(p=>p.blurExists)?.filter??null,
  activeBlur:pairs.filter(p=>p.blurExists).length,visible:pairs.filter(p=>p.intersection>.5),
  affected:affected.map(p=>({index:p.index,id:p.id,intersection:p.intersection,blurExists:p.blurExists,
  blurDecoded:p.blurDecoded,blurId:p.blurId})),pairs};
});
const frameTrace=async(label,ms=365)=>{
 const samples=await page.evaluate(async(ms)=>{
  const result=[];
  const sample=()=>{
   const root=document.querySelector(".pm-inline .pm-shell")??document.querySelector(".pm-dialog .pm-shell");
   const hero=root?.querySelector(".pm-hero"),clear=root?.querySelector(".pm-photo-track"),
    blur=root?.querySelector(".pm-photo-blur-track"),layer=root?.querySelector(".pm-photo-blur");
   const hr=hero?.getBoundingClientRect(),w=hr?.width??1;
   const x=el=>el?new DOMMatrixReadOnly(getComputedStyle(el).transform).m41:null;
   const cx=x(clear),bx=x(blur),op=Number(layer?getComputedStyle(layer).opacity:0);
   const vis=[...(clear?.children??[])].flatMap((sl,i)=>{
    const cr=sl.getBoundingClientRect(),intersection=hr?Math.max(0,Math.min(hr.right,cr.right)-Math.max(hr.left,cr.left)):0;
    if(intersection<1)return [];
    const bs=blur?.children[i],bi=bs?.querySelector("img"),ci=sl.querySelector("img");
    return [{i,intersection,id:ci?.getAttribute("data-photo-id")??"photo-"+i,
     blurId:bs?.dataset.blurPhotoId,blur:!!bi,decoded:!!bi&&bi.complete&&bi.naturalWidth>0,
     clearReady:!!ci&&ci.complete&&ci.naturalWidth>0,
     mediaMatches:!!bi&&bi.currentSrc===ci?.currentSrc,filter:bi?getComputedStyle(bi).filter:null}];
   });
   result.push({t:performance.now(),clearX:cx,blurX:bx,fraction:cx===null?null:-cx/w,
    opacity:op,blurCount:blur?.querySelectorAll("img").length??0,visible:vis});
  };
  await new Promise(resolve=>{
   const t0=performance.now();
   const frame=()=>{
    sample();
    if(performance.now()-t0>=ms)resolve();else requestAnimationFrame(frame);
   };
   requestAnimationFrame(frame);
  });
  return result;
 },ms);
 const issue=samples.flatMap(s=>s.opacity>.2?s.visible.filter(v=>v.intersection>1&&(!v.blur||!v.decoded||!v.mediaMatches||v.blurId!==v.id)).map(v=>({t:s.t,fraction:s.fraction,...v})):[]);
 const maxDrift=Math.max(...samples.map(s=>Math.abs((s.clearX??0)-(s.blurX??0))));
 const result={label,frames:samples.length,issueCount:issue.length,issues:issue.slice(0,18),
  maxDrift,peakBlur:Math.max(...samples.map(s=>s.blurCount)),samples};
 records.push(result);console.log("REM04B_SIX_TRACE "+JSON.stringify({label,frames:result.frames,issueCount:issue.length,
  firstIssues:issue.slice(0,6),maxDrift,peakBlur:result.peakBlur}));
 writeFileSync(dir+"/"+label+".json",JSON.stringify(result,null,2));
 await page.screenshot({path:dir+"/"+label+".png"});
 return result;
};
const dot=async n=>page.locator(".pm-inline .pm-photo-progress button").nth(n).evaluate(el=>el.click());
try{
 await context.tracing.start({screenshots:true,snapshots:true,sources:false});
 await page.goto("http://127.0.0.1:5173/rem-01e-qa.html?mode=local&kind=six",{waitUntil:"domcontentloaded"});
 await page.locator(".pm-inline .pm-photo-slide img").first().waitFor();
 await pause(120);
 await page.getByRole("button",{name:"Развернуть анкету"}).click();
 await pause(430);
 for(const [from,to,label] of [[0,5,"0-5"],[5,0,"5-0"],[0,3,"0-3"],[3,1,"3-1"],[1,4,"1-4"],[4,2,"4-2"],[2,5,"2-5"]]){
  await dot(from);await pause(335);await dot(to);
  await frameTrace(label);
 }
 await dot(0);await pause(340);await dot(5);await pause(85);await dot(1);
 await frameTrace("retarget-0-5-1");
 await dot(5);await pause(65);await dot(2);await pause(55);await dot(4);
 await frameTrace("rapid-retarget");
 await page.setViewportSize({width:375,height:768});await dot(0);await pause(340);
 await dot(5);await pause(55);await page.setViewportSize({width:393,height:852});
 await frameTrace("resize-mid-settle");
 await page.evaluate(()=>document.querySelector(".luemi-shell")?.setAttribute("data-theme","dark"));
 await dot(0);await pause(340);await dot(5);
 await frameTrace("dark-theme");
 const final=await snapshot();
 writeFileSync(dir+"/summary.json",JSON.stringify({records:records.map(({samples,...rest})=>rest),final,errors},null,2));
 const issueCount=records.reduce((n,r)=>n+r.issueCount,0);
 assert.equal(errors.length,0,"No runtime browser errors");
 assert.ok(records.every(r=>r.maxDrift<=1),"Clear/blur CSS matrices drift");
 assert.ok(records.every(r=>r.peakBlur<=3),"Maximum 3 decoded blur image elements");
 assert.equal(issueCount,0,"Every visible clear image during a nonadjacent jump must have matching decoded blur media");
 console.log("REM04B_SIX_BROWSER_PASS all visible nonadjacent optical slots continuously covered with <=3 blur images");
}finally{
 await context.tracing.stop({path:dir+"/trace.zip"}).catch(()=>{});
 await context.close();await browser.close();
}