/** REM-02C / LU-10, LU-11: common gesture ownership, not another animation driver.
 * An interaction has candidates and exactly one claimed owner. Native scrolling
 * is a real, exclusive owner: custom writers must never run while it owns input.
 * The REM-02A MotionController supplies token generations and cleanup.
 */
import {MotionController,type MotionOwner,type MotionToken} from "../ui/motion-controller";

export type GestureOwner=MotionOwner|"native";
export type InputKind="pointer"|"touch";
export type Axis="x"|"y";
export interface GestureCapabilities {
 canScrollY:boolean;canPageX:boolean;canBack:boolean;modalBlocked:boolean;
}
export const gestureCapabilities=(target:Element|null,canBack:boolean):GestureCapabilities=>{
 if(!target)return {canScrollY:false,canPageX:false,canBack:false,modalBlocked:true};
 const modalBlocked=!!target.closest(".pm-viewer,.pm-blik-viewer,.pm-preview-toolbar,[role=dialog]:not(.pm-shell),.discovery-filter-sheet,.fy-expanded,.fy-rail,.nb-card,.nb-location,.carousel-frame");
 const scroller=target.closest<HTMLElement>(".pm-page,.fy-scroll,.nb-scroll,.discovery-page");
 const canScrollY=!!scroller&&scroller.scrollHeight>scroller.clientHeight+1&&scroller.scrollTop>1;
 const canPageX=!!target.closest(".pm-hero,.pm-pages,.pm-tabs,.discovery-pages,.discovery-top-tabs");
 return {canScrollY,canPageX,canBack:canBack&&!modalBlocked,modalBlocked};
};
export class GestureArbiter {
 private motion:MotionController;
 private session=0;
 private identity:number|null=null;
 private claimed:GestureOwner|null=null;
 private candidates=new Set<GestureOwner>();
 private blockedNative=false;
 private terminals=0;
 constructor(){
  this.motion=new MotionController("route",{
   frame:cb=>requestAnimationFrame(cb),cancelFrame:id=>cancelAnimationFrame(id)
  });
 }
 begin(kind:InputKind,id:number,owner:GestureOwner):number|null{
  if(!Number.isFinite(id))return null;
  // Pointer and Touch callbacks from one physical touch join the same logical
  // candidate instead of opening two independently painting gesture sessions.
  if(this.identity===null){
   // React StrictMode performs a provisional effect cleanup; reconstruct the
   // isolated REM-02A controller on the next real input, never revive its old
   // disposed generation or a stale callback from the first mount.
   if(this.motion.snapshot().disposed)this.motion=new MotionController("route",{
    frame:cb=>requestAnimationFrame(cb),cancelFrame:id=>cancelAnimationFrame(id)
   });
   this.session++;this.identity=id;this.claimed=null;this.candidates.clear();
   this.blockedNative=false;
   if(!this.motion.begin(0))return null;
  }else if(this.claimed!==null)return null;
  this.candidates.add(owner);
  void kind;
  return this.session;
 }
 candidate(owner:GestureOwner,serial:number):boolean{
  return serial===this.session&&this.identity!==null&&
   this.claimed===null&&this.candidates.has(owner);
 }
 claim(owner:GestureOwner,serial:number):boolean{
  if(!this.candidate(owner,serial))return false;
  const token:MotionToken=this.motion.token();
  if(!this.motion.claim(token))return false;
  this.claimed=owner;this.blockedNative=owner==="native";return true;
 }
 owns(owner:GestureOwner,serial:number):boolean{
  return this.session===serial&&this.identity!==null&&this.claimed===owner;
 }
 owner():GestureOwner|null{return this.claimed;}
 serial():number{return this.session;}
 nativeScroll(serial:number):boolean{return this.claim("native",serial);}
 /** A second finger cancels the one-finger custom interaction. */
 secondFinger():void{this.cancel();}
 /** Idempotent terminal. Any callback from a previous generation is invalid. */
 cancel():void{
  if(this.identity===null)return;
  this.terminals++;
  const token=this.motion.token();this.motion.cancel(token,"gesture-cancel");
  this.identity=null;this.claimed=null;this.candidates.clear();this.blockedNative=false;
 }
 finish(owner:GestureOwner,serial:number):boolean{
  if(!this.owns(owner,serial))return false;
  this.cancel();return true;
 }
 finishCandidate(serial:number):void{
  if(serial===this.session&&this.claimed===null)this.cancel();
 }
 blocksNative():boolean{return this.blockedNative;}
 snapshot(){return {generation:this.session,owner:this.claimed,
  active:this.identity!==null,terminals:this.terminals};}
 dispose(){this.cancel();this.motion.dispose();}
}
/** CSS may still be interpolating after semantic index changes. Read once at
 * actual gesture capture; never reconstruct from a potentially stale index. */
export function computedTranslation(el:Element|null):number{
 if(!el)return 0;
 const value=getComputedStyle(el).transform;
 if(value==="none")return 0;
 try{
  const m=new DOMMatrixReadOnly(value);
  return Number.isFinite(m.m41)?m.m41:0;
 }catch{return 0;}
}
export function fractionalTrack(el:Element|null,width:number,fallback:number):number{
 if(!el||width<=0)return fallback;
 return -computedTranslation(el)/width;
}
export function preservePhotoId<T extends {id:string}>(
 previous:readonly T[],next:readonly T[],id:string|null,fallback=0
):number{
 if(next.length===0)return 0;
 const selected=id??previous[Math.max(0,Math.min(previous.length-1,fallback))]?.id;
 const index=next.findIndex(photo=>photo.id===selected);
 return index>=0?index:Math.max(0,Math.min(next.length-1,fallback));
}
