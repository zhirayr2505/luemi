import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const p=await browser.newPage({viewport:{width:393,height:852}});
p.on("pageerror",error=>console.log("REM03B_CLOSE_PAGE_ERROR",error.message,error.stack));
try{
 await p.goto("http://127.0.0.1:5173/profile-qa.html");
 await p.waitForFunction(()=>!!window.__luemiQaMedia);
 await p.evaluate(()=>window.__luemiQaMedia.open("qa-alpha"));
 await p.locator(".pm-viewer-image").waitFor();
 await p.getByRole("button",{name:"Следующее фото"}).click();
 await p.waitForFunction(()=>document.querySelector(".pm-viewer-image")?.dataset.photoId==="qa-beta");
 await p.getByRole("button",{name:"Закрыть просмотр"}).click();
 await p.waitForTimeout(600);
 const d=await p.evaluate(()=>{
  const v=document.querySelector(".pm-viewer"),stage=v?.querySelector(".pm-viewer-stage"),
   s=v?.querySelector(".pm-viewer-surface");
  return {open:!!v,called:stage?.dataset.debugCloseCalled,step:stage?.dataset.debugStep,failure:stage?.dataset.debugFailure,owner:stage?.dataset.debugOwner,
   finished:stage?.dataset.debugCloseFinish,opacity:stage?.style.opacity,
   transform:s?.style.transform,stats:window.__luemiQaMedia.stats()};
 });
 console.log("REM03B_CLOSE_DIAGNOSTIC",JSON.stringify(d));
 if(d.open)throw Error("Viewer remains open after 600ms");
}finally{await browser.close();}
