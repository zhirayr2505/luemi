/** REM-02D / LU-12. Browser and Telegram lifecycle adapter, independent of React.
 * Idempotent while several hosts report the same background transition.
 * It never invents a foreground transition while document.visibilityState is hidden.
 */
export function bindMotionLifecycle(onSuspend:()=>void,onResume:()=>void):()=>void{
 let inactive=false,disposed=false;
 const suspend=()=>{
  if(disposed||inactive)return;
  inactive=true;onSuspend();
 };
 const resume=()=>{
  if(disposed||!inactive||document.visibilityState==="hidden")return;
  inactive=false;onResume();
 };
 const visibility=()=>{if(document.visibilityState==="hidden")suspend();else resume();};
 const webApp=window.Telegram?.WebApp;
 document.addEventListener("visibilitychange",visibility);
 window.addEventListener("pagehide",suspend);
 window.addEventListener("pageshow",resume);
 webApp?.onEvent?.("deactivated",suspend);
 webApp?.onEvent?.("activated",resume);
 if(document.visibilityState==="hidden")suspend();
 return ()=>{
  disposed=true;
  document.removeEventListener("visibilitychange",visibility);
  window.removeEventListener("pagehide",suspend);
  window.removeEventListener("pageshow",resume);
  webApp?.offEvent?.("deactivated",suspend);
  webApp?.offEvent?.("activated",resume);
 };
}
