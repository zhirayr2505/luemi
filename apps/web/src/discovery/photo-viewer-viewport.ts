/** REM-03D/LU-07: read the already-approved REM-01D viewport revision.
 * The portal does not inherit .luemi-shell custom properties; normalize them
 * explicitly using MAX, never sum overlapping Telegram safe/content insets.
 */
import {VIEWPORT_REVISION_EVENT,type ViewportSnapshot} from "../viewport/viewport-model";
export type SafeEdges={top:number;bottom:number;left:number;right:number};
export type ViewerViewport={width:number;height:number;safe:SafeEdges;revision:number};
const positive=(x:number)=>Number.isFinite(x)?Math.max(0,x):0;
export function normalizeSafe(
 browser:Partial<SafeEdges>,telegram:Partial<SafeEdges>,
 content:Partial<SafeEdges>,snapshot:Partial<SafeEdges>={}
):SafeEdges {
 return {
  top:Math.max(positive(browser.top??0),positive(telegram.top??0),positive(content.top??0),positive(snapshot.top??0)),
  bottom:Math.max(positive(browser.bottom??0),positive(telegram.bottom??0),positive(content.bottom??0),positive(snapshot.bottom??0)),
  left:Math.max(positive(browser.left??0),positive(telegram.left??0),positive(content.left??0),positive(snapshot.left??0)),
  right:Math.max(positive(browser.right??0),positive(telegram.right??0),positive(content.right??0),positive(snapshot.right??0))
 };
}
export function safeFromSnapshot(snapshot:ViewportSnapshot):SafeEdges{
 return normalizeSafe({},snapshot.safeInsets,snapshot.contentInsets);
}
export function sameViewerViewport(a:ViewerViewport,b:ViewerViewport):boolean{
 return a.width===b.width&&a.height===b.height&&
  a.safe.top===b.safe.top&&a.safe.bottom===b.safe.bottom&&
  a.safe.left===b.safe.left&&a.safe.right===b.safe.right;
}
export function readPortalViewport(doc:Document,snapshot:ViewportSnapshot|null):ViewerViewport {
 const win=doc.defaultView??window;
 const root=doc.querySelector<HTMLElement>(".luemi-shell");
 const rootStyle=root?getComputedStyle(root):null;
 const num=(name:string)=>positive(Number.parseFloat(rootStyle?.getPropertyValue(name)??"")||0);
 const fallback={top:num("--viewport-safe-top"),bottom:num("--viewport-safe-bottom"),left:0,right:0};
 const element=doc.createElement("div");
 element.style.cssText="position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;"+
  "padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);"+
  "padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)";
 doc.body.appendChild(element);
 const css=getComputedStyle(element);
 const browser={top:positive(Number.parseFloat(css.paddingTop)),bottom:positive(Number.parseFloat(css.paddingBottom)),
  left:positive(Number.parseFloat(css.paddingLeft)),right:positive(Number.parseFloat(css.paddingRight))};
 element.remove();
 const telegram=win.Telegram?.WebApp;
 const safe=normalizeSafe(browser,telegram?.safeAreaInset??{},telegram?.contentSafeAreaInset??{},
  snapshot?safeFromSnapshot(snapshot):fallback);
 return {width:Math.max(1,win.innerWidth),height:Math.max(1,win.innerHeight),
  safe,revision:snapshot?.revision??0};
}
export function bindViewerViewport(win:Window,callback:(snapshot:ViewportSnapshot|null)=>void):()=>void{
 const revision=(e:Event)=>callback((e as CustomEvent<ViewportSnapshot>).detail??null);
 const fallback=()=>callback(null);
 win.addEventListener(VIEWPORT_REVISION_EVENT,revision);
 win.addEventListener("resize",fallback);
 win.visualViewport?.addEventListener("resize",fallback);
 win.addEventListener("orientationchange",fallback);
 const telegram=win.Telegram?.WebApp;
 telegram?.onEvent?.("safeAreaChanged",fallback);
 telegram?.onEvent?.("contentSafeAreaChanged",fallback);
 telegram?.onEvent?.("viewportChanged",fallback);
 return ()=>{
  win.removeEventListener(VIEWPORT_REVISION_EVENT,revision);
  win.removeEventListener("resize",fallback);
  win.visualViewport?.removeEventListener("resize",fallback);
  win.removeEventListener("orientationchange",fallback);
  telegram?.offEvent?.("safeAreaChanged",fallback);
  telegram?.offEvent?.("contentSafeAreaChanged",fallback);
  telegram?.offEvent?.("viewportChanged",fallback);
 };
}
