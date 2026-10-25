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
 if(!motionDebugEnabled||typeof document==="undefined")return ()=>{};
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
  area.readOnly=true;area.value=motionDebugDump();
  area.style.cssText="width:100%;flex:1;min-height:160px;font:10px monospace";
  const addButton=(label:string,action:()=>void)=>{
   const button=document.createElement("button");
   button.type="button";button.textContent=label;
   button.style.cssText="padding:9px;border:1px solid #999;border-radius:6px";
   button.addEventListener("click",action);buttons.append(button);
  };
  addButton("Копировать",()=>{
   area.value=motionDebugDump();area.focus();area.select();
   if(navigator.clipboard?.writeText){
    void navigator.clipboard.writeText(area.value).then(()=>{
     area.setSelectionRange(0,0);
    }).catch(()=>{area.focus();area.select();});
   }
  });
  addButton("Выделить весь лог",()=>{area.value=motionDebugDump();area.focus();area.select();});
  addButton("Очистить",()=>{records.length=0;area.value="";});
  addButton("Закрыть",()=>{overlay?.remove();overlay=null;});
  overlay.append(buttons,area);document.body.append(overlay);
 };
 trigger.addEventListener("click",open);
 document.body.append(trigger);
 return ()=>{overlay?.remove();trigger.remove();};
}
