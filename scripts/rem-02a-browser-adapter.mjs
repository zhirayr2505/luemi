import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,
 hasTouch:true,userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"});
const page=await context.newPage();
const errors=[];page.on("pageerror",error=>errors.push(error.message));
const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
try{
 await page.goto(base+"/profile-qa.html",{waitUntil:"domcontentloaded"});
 const result=await page.evaluate(async()=>{
  const m=await import("/src/ui/motion-controller.ts");
  const a=await import("/src/discovery/profile-motion.ts");
  const v=await import("/src/viewport/viewport-model.ts");
  const el=document.createElement("div");
  el.style.position="absolute";el.style.opacity="0";
  document.body.appendChild(el);
  const authority=a.createProfileMotionAuthority();
  authority.run("sheet",a.PROFILE_MOTION_WRITER_TABLE.sheet,()=>{
   el.style.opacity=".35";el.style.transform="translate3d(0,22px,0)";
  });
  const computed=getComputedStyle(el);
  const painted=computed.transform!=="none"&&Math.abs(Number(computed.opacity)-.35)<.01;
  let clash=false;
  try{authority.run("route",["sheet-scroll"],()=>{});}catch{clash=true;}
  const scheduler={frame:cb=>requestAnimationFrame(cb),cancelFrame:id=>cancelAnimationFrame(id)};
  const controller=new m.MotionController("route",scheduler,0,3);
  const token=controller.begin(0);controller.claim(token);
  controller.schedulePaint(token,50,x=>{el.style.left=x+"px";});
  controller.schedulePaint(token,77,x=>{el.style.left=x+"px";});
  await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
  const coalesced=controller.snapshot().current===77&&el.style.left==="77px";
  const old=token;
  controller.settle(token,393);
  const commit=[];
  const completion=a.createGuardedCompletion(controller,token,x=>{
   el.style.left=x+"px";commit.push("paint");
  },()=>commit.push("commit"));
  const once=completion()&&!completion()&&commit.join(",")==="paint,commit";
  const before=controller.snapshot().current;
  const newToken=controller.begin(before);
  controller.claim(newToken);
  controller.schedulePaint(newToken,200,()=>{el.dataset.stale="bad";});
  controller.rebase(4,150,393);
  await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
  const stale=controller.snapshot().phase==="suspended"&&
   controller.snapshot().current===150&&el.dataset.stale!=="bad"&&!controller.finish(old,{paint:()=>{}});
  const seen=[];
  const unbind=a.bindMotionViewport(window,(revision)=>seen.push(revision));
  window.dispatchEvent(new CustomEvent(v.VIEWPORT_REVISION_EVENT,{detail:{revision:200}}));
  window.dispatchEvent(new CustomEvent(v.VIEWPORT_REVISION_EVENT,{detail:{revision:200}}));
  window.dispatchEvent(new CustomEvent(v.VIEWPORT_REVISION_EVENT,{detail:{revision:199}}));
  unbind();
  window.dispatchEvent(new CustomEvent(v.VIEWPORT_REVISION_EVENT,{detail:{revision:201}}));
  const viewport=seen.length===1&&seen[0]===200;
  const pending=controller.resume(controller.token(),"settling",393);
  let disposed=0;controller.track(pending,()=>disposed++);
  controller.dispose();controller.dispose();authority.dispose();el.remove();
  return {painted,clash,coalesced,once,stale,viewport,disposed:disposed===1,
   profilePresent:document.querySelector(".pm-shell")!==null};
 });
 for(const [name,passed] of Object.entries(result)){
  assert.equal(passed,true,"live Chromium motion adapter "+name);
  console.log("REM02A_BROWSER_PASS "+name);
 }
 assert.deepEqual(errors,[]);
 console.log("REM-02A BROWSER ADAPTER QA PASS · Chromium Android-UA; physical A55/iOS NOT VERIFIED");
}finally{await context.close();await browser.close();}
