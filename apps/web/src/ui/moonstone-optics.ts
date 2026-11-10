/** Moonstone: touch-following optical glint for stationary glass controls.
 * Only one active pointer; no intervals, React state, window resize listeners or
 * event work during scrolling when a glass control is not pressed.
 * Background/profile transforms and the moving photo stack are untouched. */
const GLASS_TARGETS=[
 ".luemi-v5-glass",".luemi-v5-icon-button",
 ".real-discovery-settings",".real-feed-filter-apply",
 ".v2-runtime .v2-next",".v2-runtime .v2-draft-save",
 ".discovery-bottom-nav",".discovery-top-tabs",
 ".moonstone-profile-drawer",".moonstone-pass-button",".moonstone-like-button",".moonstone-goal",
 ".lc-search",".lc-categories-panel",".lc-chat-header"
].join(",");
type ActiveOptic={id:number;el:HTMLElement;left:number;top:number;width:number;height:number};
export function installMoonstoneOptics(doc:Document):()=>void{
 // Progressive optics: the premium SVG rim is enabled on platforms where
 // backdrop sampling and SVG CSS filters are both available. Android Telegram
 // retains every visible optical layer but avoids live GPU displacement.
 const view=doc.defaultView;
 const root=doc.documentElement;
 const userAgent=view?.navigator.userAgent??"";
 const reducedTransparency=view?.matchMedia?.("(prefers-reduced-transparency: reduce)").matches??false;
 const reducedMotion=view?.matchMedia?.("(prefers-reduced-motion: reduce)").matches??false;
 const supported=!!(view?.CSS?.supports("backdrop-filter","blur(2px)")||
   view?.CSS?.supports("-webkit-backdrop-filter","blur(2px)"));
 const refractive=!!view?.CSS?.supports("filter","url('/assets/glass/liquid-refraction-v2.svg#luemi-refraction-v2')");
 root.dataset.lgOptics=!/Android/i.test(userAgent)&&supported&&refractive&&
  !reducedTransparency&&!reducedMotion?"full":"safe";
 // Safari/WebKit still has an unresolved GPU crash with SVG *backdrop* URL
 // filters; CSS.supports alone cannot detect that rendering failure. SVG
 // distortion of the painted bevel can remain; only native background sampling
 // is limited to desktop Chromium outside the Apple engine.
 const desktopChromium=/Chrome\/|Chromium\/|Edg\//i.test(userAgent)&&
  !/Android|iPhone|iPad|iPod/i.test(userAgent);
 root.dataset.lgNativeRefraction=root.dataset.lgOptics==="full"&&desktopChromium?
  "on":"off";
 let active:ActiveOptic|null=null;
 let pending:{x:number;y:number}|null=null;
 let raf=0;
 const paint=()=>{
  raf=0;
  if(!active||!pending)return;
  const {el,left,top,width,height}=active,{x,y}=pending;
  const clamp=(n:number)=>Math.max(0,Math.min(100,n));
  el.style.setProperty("--moonstone-x",clamp((x-left)/width*100).toFixed(1)+"%");
  el.style.setProperty("--moonstone-y",clamp((y-top)/height*100).toFixed(1)+"%");
 };
 const down=(e:PointerEvent)=>{
  if(!e.isPrimary||e.button!==0||!(e.target instanceof Element))return;
  const el=e.target.closest<HTMLElement>(GLASS_TARGETS);
  if(!el||!el.closest(".luemi-shell")||el.closest("[disabled]"))return;
  const rect=el.getBoundingClientRect();
  if(rect.width<=0||rect.height<=0)return;
  active={id:e.pointerId,el,left:rect.left,top:rect.top,width:rect.width,height:rect.height};
  pending={x:e.clientX,y:e.clientY};paint();
 };
 const move=(e:PointerEvent)=>{
  if(!active||e.pointerId!==active.id)return;
  pending={x:e.clientX,y:e.clientY};
  if(!raf)raf=requestAnimationFrame(paint);
 };
 const up=(e:PointerEvent)=>{
  if(!active||active.id!==e.pointerId)return;
  active=null;pending=null;
  if(raf){cancelAnimationFrame(raf);raf=0;}
 };
 doc.addEventListener("pointerdown",down,{passive:true});
 doc.addEventListener("pointermove",move,{passive:true});
 doc.addEventListener("pointerup",up,{passive:true});
 doc.addEventListener("pointercancel",up,{passive:true});
 return()=>{
  doc.removeEventListener("pointerdown",down);
  doc.removeEventListener("pointermove",move);
  doc.removeEventListener("pointerup",up);
  doc.removeEventListener("pointercancel",up);
  if(raf)cancelAnimationFrame(raf);
  active=null;pending=null;
 };
}
