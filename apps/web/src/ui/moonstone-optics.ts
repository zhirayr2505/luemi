/** Moonstone: touch-following optical glint for stationary glass controls.
 * Only one active pointer; no intervals, React state, window resize listeners or
 * event work during scrolling when a glass control is not pressed.
 * Background/profile transforms and the moving photo stack are untouched. */
const GLASS_TARGETS=[
 ".luemi-v5-glass",".luemi-v5-icon-button",
 ".lh-browse-control",
 ".real-discovery-settings",".real-feed-filter-apply",
 ".v2-runtime .v2-next",".v2-runtime .v2-draft-save",
 ".discovery-bottom-nav",".discovery-top-tabs",
 ".lc-search",".lc-categories-panel",".lc-chat-header"
].join(",");
type ActiveOptic={id:number;el:HTMLElement;left:number;top:number;width:number;height:number};
export function installMoonstoneOptics(doc:Document):()=>void{
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
