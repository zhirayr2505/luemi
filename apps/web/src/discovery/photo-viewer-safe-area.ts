/** REM-03D LU-07: portal-safe viewport snapshot consumer.
 * Reuses REM-01D's authoritative window event and shell CSS values.
 * Never sums overlapping safeArea/contentSafeArea insets.
 */
import {VIEWPORT_REVISION_EVENT,type Insets,type ViewportSnapshot} from "../viewport/viewport-model";
const zero:Insets={top:0,right:0,bottom:0,left:0};
const positive=(n:unknown)=>typeof n==="number"&&Number.isFinite(n)?Math.max(0,n):0;
const value=(s:string):number=>positive(Number.parseFloat(s));
export function combineInsets(safe:Partial<Insets>|null|undefined,
 content:Partial<Insets>|null|undefined,css:Partial<Insets>|null|undefined):Insets{
 return {top:Math.max(positive(safe?.top),positive(content?.top),positive(css?.top)),
  right:Math.max(positive(safe?.right),positive(content?.right),positive(css?.right)),
  bottom:Math.max(positive(safe?.bottom),positive(content?.bottom),positive(css?.bottom)),
  left:Math.max(positive(safe?.left),positive(content?.left),positive(css?.left))};
}
export type ViewerInsets={insets:Insets;visualTop:number;visualBottom:number;theme:string};
export function readViewerInsets(shell:HTMLElement|null,root:HTMLElement,
 snapshot:ViewportSnapshot|null=null):ViewerInsets{
 const style=shell?getComputedStyle(shell):null;
 const telegram=window.Telegram?.WebApp as ({safeAreaInset?:Partial<Insets>;contentSafeAreaInset?:Partial<Insets>;onEvent?:(name:string,cb:()=>void)=>void;offEvent?:(name:string,cb:()=>void)=>void})|undefined;
 const insets=combineInsets(snapshot?.safeInsets??telegram?.safeAreaInset??zero,
  snapshot?.contentInsets??telegram?.contentSafeAreaInset??zero,
  {top:value(style?.getPropertyValue("--viewport-safe-top")??""),
   bottom:value(style?.getPropertyValue("--viewport-safe-bottom")??"")});
 const top=positive(snapshot?.visualOffsetTop??value(style?.getPropertyValue("--viewport-offset-top")??""));
 const height=positive(snapshot?.shellHeight??value(style?.getPropertyValue("--app-height")??""));
 // In non-Telegram browser mode, window.innerHeight remains the fallback.
 const bottom=height>0?Math.max(0,root.clientHeight-top-height):0;
 return {insets,visualTop:top,visualBottom:bottom,
  theme:shell?.dataset.theme??"dark"};
}
export function applyViewerInsets(viewer:HTMLElement,next:ViewerInsets):void{
 const {insets}=next;
 for(const axis of ["top","bottom","left","right"] as const)
  viewer.style.setProperty("--pv-safe-"+axis,insets[axis]+"px");
 viewer.style.setProperty("--pv-visual-top",next.visualTop+"px");
 viewer.style.setProperty("--pv-visual-bottom",next.visualBottom+"px");
 viewer.dataset.theme=next.theme;
}
/** Paint-only CSS properties update while viewer stays mounted; no track resets. */
export function bindViewerViewport(viewer:HTMLElement):()=>void{
 let disposed=false,snapshot:ViewportSnapshot|null=null;
 const shell=document.querySelector<HTMLElement>(".luemi-shell");
 const update=()=>{if(!disposed)applyViewerInsets(viewer,readViewerInsets(shell,viewer,snapshot));};
 const event=(e:Event)=>{snapshot=(e as CustomEvent<ViewportSnapshot>).detail;update();};
 window.addEventListener(VIEWPORT_REVISION_EVENT,event);
 window.addEventListener("resize",update);
 window.visualViewport?.addEventListener("resize",update);
 window.visualViewport?.addEventListener("scroll",update);
 const observer=shell?new MutationObserver(update):null;
 if(shell)observer?.observe(shell,{attributes:true,attributeFilter:["data-theme","style","data-viewport-revision"]});
 const webApp=window.Telegram?.WebApp;
 for(const type of ["safeAreaChanged","contentSafeAreaChanged","viewportChanged","fullscreenChanged"])
  webApp?.onEvent?.(type,update);
 update();
 return ()=>{
  disposed=true;observer?.disconnect();
  window.removeEventListener(VIEWPORT_REVISION_EVENT,event);
  window.removeEventListener("resize",update);
  window.visualViewport?.removeEventListener("resize",update);
  window.visualViewport?.removeEventListener("scroll",update);
  for(const type of ["safeAreaChanged","contentSafeAreaChanged","viewportChanged","fullscreenChanged"])
   webApp?.offEvent?.(type,update);
 };
}
