import {
 reduceViewport,VIEWPORT_REVISION_EVENT,
 type Insets,type ViewportInput,type ViewportReason,type ViewportSnapshot
} from "./viewport-model";

export interface TelegramViewportSource {
 viewportHeight?:number;
 viewportStableHeight?:number;
 safeAreaInset?:Partial<Insets>;
 contentSafeAreaInset?:Partial<Insets>;
 onEvent?:(event:string,handler:()=>void)=>void;
 offEvent?:(event:string,handler:()=>void)=>void;
}
const zero:Insets={top:0,right:0,bottom:0,left:0};
const readInsets=(source:Partial<Insets>|undefined):Insets=>({
 top:source?.top??0,right:source?.right??0,bottom:source?.bottom??0,left:source?.left??0
});
const cssLength=(value:number)=>Math.round(value*100)/100+"px";
function focusEditable(doc:Document):HTMLElement|null {
 const node=doc.activeElement;
 if(!(node instanceof HTMLElement))return null;
 if(node instanceof HTMLInputElement)
  return !node.disabled&&!node.readOnly&&
   !["button","submit","reset","checkbox","radio","hidden","file","range","color"].includes(node.type)?node:null;
 if(node instanceof HTMLTextAreaElement)return !node.disabled&&!node.readOnly?node:null;
 if(node instanceof HTMLSelectElement)return !node.disabled?node:null;
 return node.isContentEditable?node:null;
}
/** Only scroll the registration body; NEVER call scrollIntoView on document.
 * The footer stays in the normal flex layout, above the actual visual viewport. */
function revealFocusedInBody(root:HTMLElement,focused:HTMLElement|null):void {
 if(!focused||!root.contains(focused))return;
 const body=focused.closest<HTMLElement>(".onboard-body");
 if(!body)return;
 const field=focused.getBoundingClientRect(),view=body.getBoundingClientRect();
 if(view.height<36)return;
 const top=view.top+12,bottom=view.bottom-12;
 if(field.bottom>bottom)body.scrollTop+=field.bottom-bottom;
 else if(field.top<top)body.scrollTop-=top-field.top;
}
function equivalent(a:ViewportSnapshot,b:ViewportSnapshot):boolean {
 return a.layoutWidth===b.layoutWidth&&a.layoutHeight===b.layoutHeight&&
  a.visibleHeight===b.visibleHeight&&a.shellHeight===b.shellHeight&&
  a.shellTop===b.shellTop&&a.stableHeight===b.stableHeight&&
  a.keyboardState===b.keyboardState&&a.keyboardOverlap===b.keyboardOverlap&&
  a.focusedEditable===b.focusedEditable&&a.orientation===b.orientation&&
  JSON.stringify(a.safeInsets)===JSON.stringify(b.safeInsets)&&
  JSON.stringify(a.contentInsets)===JSON.stringify(b.contentInsets);
}
export interface ViewportController {
 dispose:()=>void;
 snapshot:()=>ViewportSnapshot|null;
 refresh:(reason?:ViewportReason)=>void;
}
/** Install one coalesced RAF owner for window, VisualViewport, Telegram and focus.
 * Called once per App mount; no global state and no motion-controller changes. */
export function installViewportController(
 root:HTMLElement,
 getTelegram:()=>TelegramViewportSource|undefined
):ViewportController {
 const win=root.ownerDocument.defaultView??window,doc=root.ownerDocument;
 const visual=win.visualViewport;
 const telegram=getTelegram();
 let current:ViewportSnapshot|null=null,frame:number|null=null,disposed=false;
 let pendingReason:ViewportReason="initial";
 const read=():ViewportInput=>{
  const currentFocus=focusEditable(doc);
  const vw=visual?.width??win.innerWidth;
  const vh=visual?.height??win.innerHeight;
  const orientation=win.innerWidth>win.innerHeight?"landscape":"portrait";
  return {
   layoutWidth:win.innerWidth,layoutHeight:win.innerHeight,
   visualWidth:vw,visualHeight:vh,
   visualOffsetTop:visual?.offsetTop??0,
   visualOffsetLeft:visual?.offsetLeft??0,
   telegramHeight:telegram?.viewportHeight,
   telegramStableHeight:telegram?.viewportStableHeight,
   orientation,focusedEditable:currentFocus!==null,
   safeInsets:telegram?.safeAreaInset?readInsets(telegram.safeAreaInset):zero,
   contentInsets:telegram?.contentSafeAreaInset?readInsets(telegram.contentSafeAreaInset):zero
  };
 };
 const update=(reason:ViewportReason)=>{
  if(disposed)return;
  const next=reduceViewport(current,read(),reason);
  if(current&&equivalent(current,next)){
   current={...next,revision:current.revision};
   return;
  }
  current=next;
  root.style.setProperty("--app-height",cssLength(next.shellHeight));
  root.style.setProperty("--viewport-offset-top",cssLength(next.shellTop));
  // Existing CSS already uses MAX(env, Telegram safe, Telegram content).
  // Do not add safe+content, and never add keyboard occlusion a second time.
  root.style.setProperty("--viewport-safe-top",
   cssLength(Math.max(next.safeInsets.top,next.contentInsets.top)));
  root.style.setProperty("--viewport-safe-bottom",
   cssLength(Math.max(next.safeInsets.bottom,next.contentInsets.bottom)));
  root.setAttribute("data-keyboard",next.keyboardState);
  root.setAttribute("data-viewport-compact",next.shellHeight<520?"true":"false");
  root.setAttribute("data-viewport-revision",String(next.revision));
  // Contract for later motion-controller integration (REM-02), no consumer wired now.
  win.dispatchEvent(new CustomEvent<ViewportSnapshot>(VIEWPORT_REVISION_EVENT,{detail:next}));
  if(next.focusedEditable&&next.keyboardState!=="closed")
   revealFocusedInBody(root,focusEditable(doc));
 };
 const flush=()=>{
  frame=null;
  const reason=pendingReason;
  pendingReason="visual";
  update(reason);
 };
 const schedule=(reason:ViewportReason)=>{
  if(disposed)return;
  // Real window/orientation changes rebase stale stableHeight. Browser VisualViewport
  // also emits resize for the same event; it must not steal the window reason.
  // Confirmed Telegram stable measurements remain authoritative for that frame.
  const priority:Record<ViewportReason,number>={
   initial:0,focus:1,blur:1,"safe-area":1,visual:2,
   "telegram-moving":3,fullscreen:4,window:5,orientation:6,
   "telegram-stable":7
  };
  if(priority[reason]>=priority[pendingReason])pendingReason=reason;
  if(frame===null)frame=win.requestAnimationFrame(flush);
 };
 update("initial");
 const onWindow=()=>schedule("window");
 const onVisual=()=>schedule("visual");
 const onOrientation=()=>schedule("orientation");
 const onFocus=()=>schedule("focus");
 const onBlur=()=>schedule("blur");
 const onTelegram=(event?:{isStateStable?:boolean})=>
  schedule(event?.isStateStable===true?"telegram-stable":"telegram-moving");
 const onFullscreen=()=>schedule("fullscreen");
 const onSafe=()=>schedule("safe-area");
 win.addEventListener("resize",onWindow);
 win.addEventListener("orientationchange",onOrientation);
 visual?.addEventListener("resize",onVisual);
 visual?.addEventListener("scroll",onVisual);
 doc.addEventListener("focusin",onFocus);
 doc.addEventListener("focusout",onBlur);
 doc.addEventListener("fullscreenchange",onFullscreen);
 telegram?.onEvent?.("viewportChanged",onTelegram);
 telegram?.onEvent?.("fullscreenChanged",onFullscreen);
 telegram?.onEvent?.("safeAreaChanged",onSafe);
 telegram?.onEvent?.("contentSafeAreaChanged",onSafe);
 return {
  snapshot:()=>current,
  refresh:(reason="visual")=>schedule(reason),
  dispose:()=>{
   disposed=true;
   if(frame!==null)win.cancelAnimationFrame(frame);
   win.removeEventListener("resize",onWindow);
   win.removeEventListener("orientationchange",onOrientation);
   visual?.removeEventListener("resize",onVisual);
   visual?.removeEventListener("scroll",onVisual);
   doc.removeEventListener("focusin",onFocus);
   doc.removeEventListener("focusout",onBlur);
   doc.removeEventListener("fullscreenchange",onFullscreen);
   telegram?.offEvent?.("viewportChanged",onTelegram);
   telegram?.offEvent?.("fullscreenChanged",onFullscreen);
   telegram?.offEvent?.("safeAreaChanged",onSafe);
   telegram?.offEvent?.("contentSafeAreaChanged",onSafe);
  }
 };
}
