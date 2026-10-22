/** LU-22: deterministic, side-effect-free viewport revision model.
 * Physical Telegram Android WebView / WKWebView validation is separate.
 * CSS pixel dimensions, never physical device pixels. */
export type ViewportReason="initial"|"window"|"visual"|"telegram-moving"|"telegram-stable"|"fullscreen"|"orientation"|"focus"|"blur"|"safe-area";
export type KeyboardState="open"|"closed"|"uncertain";
export interface Insets {top:number;right:number;bottom:number;left:number}
export interface ViewportInput {
 layoutWidth:number;layoutHeight:number;
 visualWidth:number;visualHeight:number;visualOffsetTop:number;visualOffsetLeft:number;
 telegramHeight?:number;telegramStableHeight?:number;
 orientation:"portrait"|"landscape";
 focusedEditable:boolean;
 safeInsets:Insets;contentInsets:Insets;
}
export interface ViewportSnapshot extends ViewportInput {
 revision:number;
 stableHeight:number;
 stableWidth:number;
 visibleHeight:number;
 shellHeight:number;
 shellTop:number;
 keyboardState:KeyboardState;
 keyboardOverlap:number;
 /** A stable Telegram measurement is allowed to shrink at unchanged width. */
 acceptedStableHeight:number|null;
}
export const VIEWPORT_REVISION_EVENT="luemi:viewport-revision" as const;
const size=(value:number,fallback:number):number=>Number.isFinite(value)&&value>0?value:fallback;
const nonNegative=(value:number):number=>Number.isFinite(value)?Math.max(0,value):0;
const maybeSize=(v:number|undefined):number|null=>
 typeof v==="number"&&Number.isFinite(v)&&v>0?v:null;
const dimension=(n:number):number=>Math.round(n*100)/100;
function insets(value:Insets):Insets {
 return {top:nonNegative(value.top),right:nonNegative(value.right),
  bottom:nonNegative(value.bottom),left:nonNegative(value.left)};
}
export function reduceViewport(
 previous:ViewportSnapshot|null,
 source:ViewportInput,
 reason:ViewportReason
):ViewportSnapshot {
 const layoutWidth=size(source.layoutWidth,previous?.layoutWidth??390);
 const layoutHeight=size(source.layoutHeight,previous?.layoutHeight??700);
 const visualHeight=size(source.visualHeight,layoutHeight);
 const visualWidth=size(source.visualWidth,layoutWidth);
 const top=Math.min(nonNegative(source.visualOffsetTop),Math.max(0,layoutHeight-1));
 const left=nonNegative(source.visualOffsetLeft);
 const orientation=source.orientation;
 const newGeometry=!previous||previous.orientation!==orientation||
  Math.abs(previous.layoutWidth-layoutWidth)>1;
 // On a window resize with no editable focus, trust the actual new layout:
 // this handles exiting fullscreen without a Telegram stable callback.
 // Focused resizes may be keyboard animation and must keep the prior baseline.
 const layoutRebased=reason==="window"&&!source.focusedEditable&&
  Math.abs((previous?.layoutHeight??layoutHeight)-layoutHeight)>1;
 const stableFromTelegram=maybeSize(source.telegramStableHeight);
 let acceptedStableHeight=previous?.acceptedStableHeight??null;
 let stableHeight=previous?.stableHeight??layoutHeight;
 if(newGeometry||layoutRebased){
  acceptedStableHeight=null;
  stableHeight=layoutHeight;
 }
 if(reason==="telegram-stable"&&stableFromTelegram!==null){
  // Deliberately accepts decreases without width change.
  acceptedStableHeight=stableFromTelegram;
  stableHeight=stableFromTelegram;
 } else if(reason==="telegram-stable"){
  const telegramViewport=maybeSize(source.telegramHeight);
  if(telegramViewport!==null){
   acceptedStableHeight=telegramViewport;stableHeight=telegramViewport;
  }else if(!source.focusedEditable){
   acceptedStableHeight=null;stableHeight=layoutHeight;
  }
 }else if(!previous){
  // Initial Telegram stable reading is provisional only if it is plausible
  // for this layout; stale readings after rotation cannot pin the shell.
  if(stableFromTelegram!==null&&stableFromTelegram<=layoutHeight+2&&
     stableFromTelegram>=Math.min(240,layoutHeight*.4)){
   acceptedStableHeight=stableFromTelegram;stableHeight=stableFromTelegram;
  }
 }
 if(!acceptedStableHeight&&reason==="window"&&!source.focusedEditable)
  stableHeight=layoutHeight;
 // The visual viewport is the current visible frame, even when layoutHeight
 // is stale due to keyboard, split view or browser chrome. offsetTop is in
 // layout-viewport CSS coordinates (not a second keyboard inset).
 const visibleHeight=dimension(Math.min(visualHeight,Math.max(1,layoutHeight-top)));
 const shellHeight=dimension(Math.max(1,Math.min(visibleHeight,
  acceptedStableHeight??Number.POSITIVE_INFINITY)));
 const shellTop=dimension(top);
 // Focusing alone never proves that the software keyboard is open.
 // An explicit stable fullscreen shrink rebases the baseline, so it is
 // never mislabeled as a keyboard solely for being shorter than before.
 const difference=Math.max(0,stableHeight-visibleHeight);
 let keyboardState:KeyboardState="closed";
 if(source.focusedEditable){
  if(difference>=110&&visibleHeight<=stableHeight*.83)keyboardState="open";
  else if(difference>=32)keyboardState="uncertain";
 }else if(previous?.keyboardState==="open"&&difference>=110&&
          reason!=="telegram-stable"&&reason!=="fullscreen"&&reason!=="orientation"){
  // The focus can vanish a frame before the native keyboard closes.
  // Do not claim it is open without focus, but do not claim closed either.
  keyboardState="uncertain";
 }
 const keyboardOverlap=keyboardState==="open"?dimension(difference):0;
 return {
  layoutWidth,layoutHeight,visualWidth,visualHeight,visualOffsetTop:top,
  visualOffsetLeft:left,orientation,focusedEditable:source.focusedEditable,
  telegramHeight:source.telegramHeight,telegramStableHeight:source.telegramStableHeight,
  safeInsets:insets(source.safeInsets),contentInsets:insets(source.contentInsets),
  stableHeight:dimension(stableHeight),stableWidth:layoutWidth,
  visibleHeight,shellHeight,shellTop,keyboardState,keyboardOverlap,
  acceptedStableHeight,revision:(previous?.revision??0)+1
 };
}
