import assert from "node:assert/strict";
import {chromium} from "playwright";
const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const ua="Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36";
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,userAgent:ua});
const page=await context.newPage(),errors=[];
page.on("pageerror",e=>errors.push(e.message));
const log=(scenario)=>console.log("REM01C_BROWSER_PASS "+scenario);
async function reset(){
 await page.goto(base+"/rem-01c-sorter-qa.html",{waitUntil:"domcontentloaded"});
 await page.locator('[data-testid="photo-order"]').waitFor();
 await page.locator(".mosaic-slot").first().waitFor({state:"visible"});
}
const moveCount=()=>page.evaluate(()=>window.__REM01C_SORTER__.moves.length);
const active=()=>page.locator(".photo-drag-ghost").count();
const slots=async()=>[await page.locator('[data-photo-slot="0"]').boundingBox(),await page.locator('[data-photo-slot="1"]').boundingBox()];
try{
 await page.goto(base+"/rem-01b-qa.html",{waitUntil:"domcontentloaded"});
 await page.locator("#ready").filter({hasText:"ready"}).waitFor();
 const prep=await page.evaluate(async()=>{
  const header=await import("/src/registration/photo-header.ts");
  const {preparePhotoPreview}=await import("/src/registration/photo-preview.ts");
  const canvas=document.createElement("canvas");canvas.width=2300;canvas.height=1700;
  const original=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
  const outcome=await preparePhotoPreview(original,new AbortController().signal);
  const decoded=await createImageBitmap(outcome);
  const info={size:outcome.size,originalSize:original.size,width:decoded.width,height:decoded.height,
    maxPixels:header.MAX_PREVIEW_SOURCE_PIXELS,format:outcome.type};
  decoded.close();return info;
 });
 assert.equal(prep.width,2048);assert.ok(prep.height>1000&&prep.height<2048);
 assert.equal(prep.format,"image/png");assert.ok(prep.size>0&&prep.originalSize>0);
 log("real PNG 2300x1700 preflight → <=2048 side; original Blob unchanged");
 const guard=await page.evaluate(async()=>{
  const {preparePhotoPreview}=await import("/src/registration/photo-preview.ts");
  const data=new Uint8Array(33),dv=new DataView(data.buffer);
  data.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
  dv.setUint32(16,9000);dv.setUint32(20,9000);data[24]=8;data[25]=6;
  const huge=new Blob([data],{type:"image/png"}),orig=createImageBitmap;
  let decodes=0,error="";
  window.createImageBitmap=()=>{decodes++;throw new Error("SHOULD_NEVER_DECODE");};
  try{await preparePhotoPreview(huge,new AbortController().signal);}
  catch(e){error=e.message;}
  finally{window.createImageBitmap=orig;}
  return {decodes,error};
 });
 assert.deepEqual(guard,{decodes:0,error:"PHOTO_DIMENSIONS_UNSUPPORTED"});
 log("huge pixel-count rejected before decoder even with tiny compressed bytes");
 const fallback=await page.evaluate(async()=>{
  const {preparePhotoPreview}=await import("/src/registration/photo-preview.ts");
  const canvas=document.createElement("canvas");canvas.width=2200;canvas.height=1800;
  const file=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.88));
  const original=window.createImageBitmap,revoke=URL.revokeObjectURL;
  let revoked=0;
  window.createImageBitmap=undefined;
  URL.revokeObjectURL=(url)=>{revoked++;revoke.call(URL,url);};
  let outcome;
  try{outcome=await preparePhotoPreview(file,new AbortController().signal);}
  finally{window.createImageBitmap=original;URL.revokeObjectURL=revoke;}
  return {revoked,prepared:outcome?.size>0};
 });
 assert.deepEqual(fallback,{revoked:1,prepared:true});
 log("Image.decode fallback revokes object URL and renders JPEG preview");
 const aborted=await page.evaluate(async()=>{
  const {preparePhotoPreview}=await import("/src/registration/photo-preview.ts");
  const canvas=document.createElement("canvas");canvas.width=2300;canvas.height=1800;
  const file=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg"));
  const orig=window.createImageBitmap,controller=new AbortController();
  let resolveBitmap,closed=0;
  window.createImageBitmap=()=>new Promise(resolve=>{resolveBitmap=resolve;});
  try{
   const job=preparePhotoPreview(file,controller.signal).then(()=>null,e=>e.name);
   for(let n=0;n<80&&!resolveBitmap;n++)await new Promise(r=>setTimeout(r,3));
   if(!resolveBitmap)throw new Error("No bitmap request");
   controller.abort();
   resolveBitmap({width:2300,height:1800,close(){closed++;}});
   return {outcome:await job,closed};
  }finally{window.createImageBitmap=orig;}
 });
 assert.deepEqual(aborted,{outcome:"AbortError",closed:1});
 log("abort during pending decode closes late bitmap and produces terminal AbortError");
 const toBlob=await page.evaluate(async()=>{
  const {preparePhotoPreview}=await import("/src/registration/photo-preview.ts");
  const canvas=document.createElement("canvas");canvas.width=2100;canvas.height=1700;
  const file=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
  const original=HTMLCanvasElement.prototype.toBlob;
  let message="";
  try{
   HTMLCanvasElement.prototype.toBlob=function(callback){callback(null);};
   await preparePhotoPreview(file,new AbortController().signal);
  }catch(e){message=e.message;}
  finally{HTMLCanvasElement.prototype.toBlob=original;}
  return message;
 });
 assert.equal(toBlob,"Photo encoding failed");
 log("toBlob failure stays error, not falsely saved");

 await reset();
 const native=await page.evaluate(()=>getComputedStyle(document.querySelector(".mosaic-slot")).touchAction);
 assert.equal(native,"pan-y");
 const first=await page.locator('[data-photo-slot="0"]').boundingBox();
 assert.ok(first);
 const cdp=await context.newCDPSession(page);
 const x=first.x+first.width*.48,y=first.y+first.height*.7;
 await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y,id:3}]});
 for(let i=1;i<=8;i++){
  await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x,y:y-i*16,id:3}]});
  await sleep(15);
 }
 await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
 await sleep(300);
 const scroll=await page.locator(".onboard-body").evaluate(node=>node.scrollTop);
 assert.ok(scroll>15,"native vertical swipe on photo must scroll, actual scroll="+scroll);
 assert.equal(await active(),0);
 log("native touch pan on photo scrolls without waiting for long press");
 await cdp.detach();

 await reset();
 const [a,b]=await slots();assert.ok(a&&b);
 await page.mouse.move(a.x+a.width*.55,a.y+a.height*.45);
 await page.mouse.down();await sleep(330);
 assert.equal(await active(),1,"held photo acquires drag ghost");
 await page.mouse.move(b.x+b.width*.5,b.y+b.height*.5,{steps:8});
 await page.mouse.up();await sleep(150);
 assert.equal(await moveCount(),1,"drop commits once");
 assert.equal(await active(),0,"ghost released");
 assert.equal(await page.locator('[data-testid="photo-order"]').innerText().then(x=>x.split(",")[0]),"photo-1");
 log("long press + drop commits exactly once and preserves FLIP sorter order");

 await reset();
 const target=await page.locator('[data-photo-slot="0"]').boundingBox();
 const pane=await page.locator(".onboard-body").boundingBox();assert.ok(target&&pane);
 await page.mouse.move(target.x+target.width*.48,target.y+target.height*.48);
 await page.mouse.down();await sleep(325);
 const before=await page.locator(".onboard-body").evaluate(node=>node.scrollTop);
 await page.mouse.move(pane.x+pane.width*.52,pane.y+pane.height-14,{steps:5});
 await sleep(630); // NO pointer moves: only continuously running edge RAF may scroll.
 const after=await page.locator(".onboard-body").evaluate(node=>node.scrollTop);
 assert.ok(after>before+20,"stationary edge must keep scrolling; before="+before+" after="+after);
 await page.mouse.up();
 const held=await page.locator(".onboard-body").evaluate(node=>node.scrollTop);
 await sleep(250);
 const stopped=await page.locator(".onboard-body").evaluate(node=>node.scrollTop);
 assert.ok(Math.abs(stopped-held)<1,"RAF must stop immediately after release");
 assert.equal(await active(),0);
 log("stationary edge-scroll progresses by elapsed time and stops on pointer up");

 await reset();
 const p=await page.locator('[data-photo-slot="0"]').boundingBox();
 await page.mouse.move(p.x+15,p.y+15);await page.mouse.down();
 await page.locator(".mosaic").evaluate(node=>node.dispatchEvent(new PointerEvent("pointerdown",
  {bubbles:true,pointerId:778,isPrimary:false,pointerType:"touch"})));
 await sleep(320);
 assert.equal(await active(),0,"second finger cancels pending drag");
 await page.locator(".mosaic").evaluate(node=>node.dispatchEvent(new PointerEvent("pointerup",
  {bubbles:true,pointerId:778,isPrimary:false,pointerType:"touch"})));
 await page.mouse.up();
 assert.equal(await moveCount(),0);
 log("second pointer cancels pending hold without replacing primary");

 await reset();
 const d=await page.locator('[data-photo-slot="0"]').boundingBox();
 await page.mouse.move(d.x+18,d.y+18);await page.mouse.down();await sleep(325);
 assert.equal(await active(),1);
 await page.locator(".mosaic").evaluate(node=>node.dispatchEvent(new PointerEvent("lostpointercapture",
  {bubbles:true,pointerId:1,pointerType:"mouse"})));
 await sleep(70);
 assert.equal(await active(),0);await page.mouse.up();assert.equal(await moveCount(),0);
 log("lostpointercapture cancels drag without committing stale drop");

 await reset();
 const e=await page.locator('[data-photo-slot="0"]').boundingBox();
 await page.mouse.move(e.x+18,e.y+18);await page.mouse.down();
 await page.locator(".remove-photo").first().evaluate(button=>button.click());
 await sleep(320);assert.equal(await active(),0);
 await page.mouse.up();assert.equal(await moveCount(),0);
 log("removing selected photo while hold pending disarms timer");

 await reset();
 await page.locator('[data-photo-slot="0"]').focus();
 await page.keyboard.press("Alt+ArrowRight");
 assert.equal(await moveCount(),1);
 assert.equal((await page.locator('[data-testid="photo-order"]').innerText()).split(",")[0],"photo-1");
 log("keyboard Alt+ArrowRight reorders without gesture");

 assert.deepEqual(errors,[],"no uncaught React or page exceptions");
 console.log("REM-01C BROWSER QA PASS — synthetic Chromium Android-UA; physical A55/iOS NOT VERIFIED");
}finally{await context.close();await browser.close();}
