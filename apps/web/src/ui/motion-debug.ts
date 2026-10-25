/**
 * Stage A ONLY: opt-in profile-motion diagnostics; no animation ownership.
 * ?luemiDebugMotion=1 enables localStorage["luemi:debugMotion"] on staging.
 * ?luemiDebugMotion=0 disables it. Disabled sessions have no debug RAF/UI.
 */
const KEY="luemi:debugMotion";
export const motionDebugEnabled=(()=>{
 if(typeof window==="undefined")return false;
 try {
  const query=new URLSearchParams(window.location.search).get("luemiDebugMotion");
  if(query==="1")window.localStorage.setItem(KEY,"1");
  if(query==="0")window.localStorage.removeItem(KEY);
  return window.localStorage.getItem(KEY)==="1";
 } catch {return false;}
})();
const records:string[]=[];
let serial=0;
export const motionDebugId=()=>++serial;
export function motionDebug(event:string,fields:Record<string,unknown>={},withStack=true){
 if(!motionDebugEnabled)return;
 const stack=withStack?(new Error().stack??"").split("\n").slice(2,6).map(s=>s.trim()).join(" <- "):"";
 records.push(JSON.stringify({t:Math.round(performance.now()*100)/100,event,...fields,...(stack?{stack}:{})}));
 if(records.length>7200)records.splice(0,1200);
}
export function motionDebugDump(){
 return "LUEMI STAGE A / "+new Date().toISOString()+"\n"+records.join("\n");
}
/** A bounded, human-readable diagnostic, not a replacement for the full trace.
 * Preserve settle/resize/render ordering, and sample or flag abrupt Y changes.
 * The full original records remain available for offline review as a TXT file.
 */
export function compactMotionLog(lines:readonly string[],maxChars=14000):string{
 type Entry={t:number;event:string;[key:string]:unknown};
 const entries:Entry[]=[];
 for(const line of lines){
  try{
   const item=JSON.parse(line) as Partial<Entry>;
   if(typeof item.t==="number"&&typeof item.event==="string")entries.push(item as Entry);
  }catch{/* a partial line cannot invalidate other diagnostics */}
 }
 const settles=entries.flatMap((e,i)=>e.event==="settleSheet"?[i]:[]);
 const startIndex=settles.length?Math.max(0,settles[Math.max(0,settles.length-6)]-45):
  Math.max(0,entries.length-700);
 const segment=entries.slice(startIndex);
 const relevant=new Set(["settleSheet","engine.construct","engine.settle","engine.start",
  "engine.resize","engine.resize.afterPut","engine.done","engine.pause","engine.resume",
  "engine.dispose","collapsedRef.write","setCollapsed.invoke","ProfileMaster.render",
  "measure.enter","measure.apply","measure.hidden"]);
 const round=(v:unknown)=>typeof v==="number"?Math.round(v*10)/10:v;
 const fields=["source","next","reason","engine","phase","destination","collapsed",
  "collapsedRef","committedCollapsed","fingerActive","min","max","nextMin","nextMax",
  "screenMappedY","remaining","from","to","target","duration","y","paintedY",
  "engineY","dragging","wasRunning","wasPaused","state","domTop"];
 const formatted:string[]=[];
 let lastFrameAt=-Infinity,lastFrameY:number|null=null,lastFrameT=0;
 let lastPaintY:number|null=null,lastPutY:number|null=null,jumps=0;
 for(const item of segment){
  const kind=item.event;
  const rawY=kind==="frame.y"?(item.paintedY??item.engineY):item.y;
  const y=typeof rawY==="number"?rawY:null;
  let special="";
  if(kind==="frame.y"){
   if(y!==null&&lastFrameY!==null&&Math.abs(y-lastFrameY)>=24&&item.t-lastFrameT<=90){
    special="FRAME_JUMP";jumps++;
   }
   const capture=special!==""||item.t-lastFrameAt>=100;
   if(y!==null){lastFrameY=y;lastFrameT=item.t;}
   if(!capture)continue;
   lastFrameAt=item.t;
  }else if(kind==="paintSheet"||kind==="engine.put"){
   const prior=kind==="paintSheet"?lastPaintY:lastPutY;
   if(kind==="paintSheet")lastPaintY=y;
   else lastPutY=y;
   if(y===null||prior===null||Math.abs(y-prior)<40)continue;
   special="PAINT_DELTA";
  }else if(!relevant.has(kind))continue;
  const content:Record<string,unknown>={};
  for(const key of fields)if(item[key]!==undefined)content[key]=round(item[key]);
  if(kind==="frame.y"&&item.collapsedRef!==undefined)content.collapsedRef=item.collapsedRef;
  // For stacks, only the original source of an event is useful; repeated
  // third-party frames are intentionally excluded from the short report.
  if(kind==="settleSheet"||kind==="measure.apply"||kind==="engine.resize"||
     kind==="engine.done"||kind==="setCollapsed.invoke"){
   if(typeof item.stack==="string")content.stack=item.stack.slice(0,240);
  }
  const name=special?snapshotTag(special,kind):kind;
  formatted.push(item.t.toFixed(1)+" "+name+" "+JSON.stringify(content));
 }
 const header="LUEMI STAGE A SHORT / "+new Date().toISOString()+
  "\nsourceEvents="+entries.length+" / sampled="+formatted.length+
  " / recentSettleCount="+Math.min(6,settles.length)+
  " / jumpCandidates="+jumps+
  "\nNOTE: frame sampling is reduced; see full TXT for every frame.\n";
 const budget=Math.max(200,maxChars-header.length-120);
 let kept=formatted,removed=0,total=formatted.reduce((n,v)=>n+v.length+1,0);
 while(kept.length>1&&total>budget){
  total-=kept[0].length+1;kept=kept.slice(1);removed++;
 }
 return header+(removed?"[earliest "+removed+" short lines omitted]\n":"")+
  kept.join("\n").slice(0,budget);
}
function snapshotTag(prefix:string,name:string){return prefix+"."+name;}
export function motionDebugShort(){return compactMotionLog(records);}

export type SheetFrameTrace={start:()=>void;finished:()=>void;dispose:()=>void};
export function createSheetFrameTrace(snapshot:()=>Record<string,unknown>):SheetFrameTrace{
 if(!motionDebugEnabled)return {start:()=>{},finished:()=>{},dispose:()=>{}};
 let frame:number|null=null,active=false,stopAt=Infinity,disposed=false;
 const tick=()=>{
  frame=null;
  if(disposed||!active)return;
  motionDebug("frame.y",snapshot(),false);
  if(performance.now()>=stopAt){active=false;return;}
  frame=requestAnimationFrame(tick);
 };
 return {
  start(){
   if(disposed)return;
   stopAt=Infinity;
   if(active)return;
   active=true;
   frame=requestAnimationFrame(tick);
  },
  finished(){if(active)stopAt=performance.now()+400;},
  dispose(){
   disposed=true;active=false;
   if(frame!==null)cancelAnimationFrame(frame);
   frame=null;
  }
 };
}
/** Tiny diagnostic-only export UI for Android Telegram WebView without DevTools. */
export function installMotionDebugPanel():()=>void{
 if(typeof document==="undefined")return ()=>{};
 // On the real Telegram Mini App, a bot menu URL cannot be edited by users.
 // Five quick taps on the central LUEMI logo inside ProfileMaster enable
 // diagnostics in the SAME Telegram WebView origin, without DevTools or UI changes.
 if(!motionDebugEnabled){
  let taps=0,lastAt=0;
  const enable=(event:MouseEvent)=>{
   const target=event.target;
   if(!(target instanceof Element)||!target.closest(".lh-island"))return;
   const now=performance.now();
   taps=now-lastAt<=1200?taps+1:1;
   lastAt=now;
   if(taps<5)return;
   taps=0;
   try{
    window.localStorage.setItem(KEY,"1");
    window.location.reload();
   }catch{/* Storage blocked: do not mutate the application state. */}
  };
  document.addEventListener("click",enable,true);
  return ()=>document.removeEventListener("click",enable,true);
 }
 const trigger=document.createElement("button");
 trigger.type="button";trigger.textContent="LOG";
 trigger.setAttribute("aria-label","Открыть журнал движения LUEMI");
 Object.assign(trigger.style,{
  position:"fixed",right:"8px",bottom:"8px",zIndex:"2147483647",
  background:"#24202e",color:"#fff",padding:"9px",border:"1px solid #bbb",
  borderRadius:"7px",font:"12px monospace",opacity:"0.8"
 });
 let overlay:HTMLDivElement|null=null;
 const open=()=>{
  overlay?.remove();
  overlay=document.createElement("div");
  Object.assign(overlay.style,{
   position:"fixed",inset:"8px",zIndex:"2147483647",background:"#fff",
   color:"#111",padding:"12px",display:"flex",flexDirection:"column",gap:"8px"
  });
  const buttons=document.createElement("div");
  buttons.style.cssText="display:flex;gap:8px;flex-wrap:wrap";
  const area=document.createElement("textarea");
  area.readOnly=true;area.value=motionDebugShort();
  area.style.cssText="width:100%;flex:1;min-height:160px;font:10px monospace";
  const addButton=(label:string,action:()=>void)=>{
   const button=document.createElement("button");
   button.type="button";button.textContent=label;
   button.style.cssText="padding:9px;border:1px solid #999;border-radius:6px";
   button.addEventListener("click",action);buttons.append(button);
  };
  const compactCopy=()=>{
   const short=motionDebugShort();
   area.value=short;area.focus();area.select();
   if(navigator.clipboard?.writeText){
    void navigator.clipboard.writeText(short).then(()=>{
     area.setSelectionRange(0,0);
    }).catch(()=>{area.focus();area.select();});
   }
  };
  addButton("Копировать короткий",compactCopy);
  addButton("Сохранить полный TXT",()=>{
   const blob=new Blob([motionDebugDump()],{type:"text/plain;charset=utf-8"});
   const url=URL.createObjectURL(blob);
   const anchor=document.createElement("a");
   anchor.href=url;anchor.download="luemi-motion-log-"+Date.now()+".txt";
   document.body.append(anchor);anchor.click();anchor.remove();
   window.setTimeout(()=>URL.revokeObjectURL(url),30000);
  });
  addButton("Выделить короткий",()=>{area.value=motionDebugShort();area.focus();area.select();});
  addButton("Очистить",()=>{records.length=0;area.value="";});
  addButton("Выключить LOG",()=>{
   try{window.localStorage.removeItem(KEY);window.location.reload();}catch{/* leave visible */}
  });
  addButton("Закрыть",()=>{overlay?.remove();overlay=null;});
  overlay.append(buttons,area);document.body.append(overlay);
 };
 trigger.addEventListener("click",open);
 document.body.append(trigger);
 return ()=>{overlay?.remove();trigger.remove();};
}
