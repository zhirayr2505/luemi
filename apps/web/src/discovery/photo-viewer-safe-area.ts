/** LU-07 · portal-safe snapshot sourced from the REM-01D shell variables.
 * CSS --top-safe / --bottom-safe already normalize browser+Telegram content
 * safe areas using max(...), NOT sum. Resolve them in the original shell.
 */
export type ViewerInsets={top:number;bottom:number;left:number;right:number};
const pixels=(s:string)=>{const v=parseFloat(s);return Number.isFinite(v)?Math.max(0,v):0};
export function normalizeInsets(browser:ViewerInsets,tg:ViewerInsets,content:ViewerInsets):ViewerInsets{
 return {top:Math.max(browser.top,tg.top,content.top),
  bottom:Math.max(browser.bottom,tg.bottom,content.bottom),
  left:Math.max(browser.left,tg.left,content.left),
  right:Math.max(browser.right,tg.right,content.right)};
}
export function readViewerInsets(shell:HTMLElement|null):ViewerInsets{
 if(!shell)return {top:0,bottom:0,left:0,right:0};
 const probe=document.createElement("span");
 probe.style.cssText="position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;"+
  "padding-top:var(--top-safe,0px);padding-bottom:var(--bottom-safe,0px);"+
  "padding-left:max(env(safe-area-inset-left,0px),var(--tg-safe-area-inset-left,0px),var(--tg-content-safe-area-inset-left,0px));"+
  "padding-right:max(env(safe-area-inset-right,0px),var(--tg-safe-area-inset-right,0px),var(--tg-content-safe-area-inset-right,0px))";
 shell.appendChild(probe);
 const style=getComputedStyle(probe);
 const snapshot={top:pixels(style.paddingTop),bottom:pixels(style.paddingBottom),
  left:pixels(style.paddingLeft),right:pixels(style.paddingRight)};
 probe.remove();return snapshot;
}
export function watchViewerInsets(shell:HTMLElement|null,notify:(insets:ViewerInsets)=>void):()=>void{
 const measure=()=>notify(readViewerInsets(shell));
 const webApp=window.Telegram?.WebApp;
 const visual=window.visualViewport;
 const events=["safeAreaChanged","contentSafeAreaChanged","viewportChanged"] as const;
 window.addEventListener("resize",measure);
 visual?.addEventListener("resize",measure);
 visual?.addEventListener("scroll",measure);
 for(const event of events)webApp?.onEvent?.(event,measure);
 measure();
 return ()=>{
  window.removeEventListener("resize",measure);
  visual?.removeEventListener("resize",measure);
  visual?.removeEventListener("scroll",measure);
  for(const event of events)webApp?.offEvent?.(event,measure);
 };
}
