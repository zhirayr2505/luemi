/** One state machine owns input across React pointer and native Touch adapters.
 * No MotionController here: this class owns events, not pixels or RAF frames.
 * Rendering controllers stay separately scoped to the actual moving surface.
 * Candidate release cannot cancel another still-live candidate.
 */
import type {MotionOwner} from "../ui/motion-controller";

export type GestureOwner=MotionOwner|"native";
export type InputKind="pointer"|"touch";
/** Nested visitor-profile modal gate only: browse cards, Nearby and ForYou
 * are never children of the visitor profile and must not participate here.
 * Never query scrollHeight/scrollTop while processing
 * the pointerdown critical path: existing list position is NOT active pan-y.
 * Direction arbitration is performed by the actual gesture owner on movement. */
export const isGestureModalBlocked=(target:Element|null):boolean=>
 !target||!!target.closest(
  ".pm-viewer,.pm-preview-toolbar,[role=dialog]:not(.pm-shell)"
 );
export class GestureArbiter {
 private session=0;
 private identity:number|null=null;
 private ids:{pointer:number|null;touch:number|null}={pointer:null,touch:null};
 private claimed:GestureOwner|null=null;
 private candidates=new Set<GestureOwner>();
 begin(kind:InputKind,id:number,owner:GestureOwner):number|null{
  if(!Number.isSafeInteger(id))return null;
  // A native touch and its synthetic pointer use different ID namespaces.
  // Same-kind different IDs without a terminal mean a second finger, never
  // another writer in the existing interaction.
  if(this.identity!==null&&this.ids[kind]!==null&&this.ids[kind]!==id){
   this.secondFinger();return null;
  }
  if(this.identity===null){
   this.session++;this.identity=id;this.claimed=null;this.candidates.clear();
   this.ids={pointer:null,touch:null};
  }else if(this.claimed!==null)return null;
  this.ids[kind]=id;
  this.candidates.add(owner);
  return this.session;
 }
 candidate(owner:GestureOwner,serial:number):boolean{
  return serial===this.session&&this.identity!==null&&
   this.claimed===null&&this.candidates.has(owner);
 }
 claim(owner:GestureOwner,serial:number):boolean{
  if(!this.candidate(owner,serial))return false;
  this.claimed=owner;return true;
 }
 owns(owner:GestureOwner,serial:number):boolean{
  return this.session===serial&&this.identity!==null&&this.claimed===owner;
 }
 owner():GestureOwner|null{return this.claimed;}
 nativeScroll(serial:number):boolean{return this.claim("native",serial);}
 /** A second finger cancels the one-finger custom interaction. */
 secondFinger():void{this.cancel();}
 /** Idempotent terminal. Any callback from a previous generation is invalid. */
 cancel():void{
  if(this.identity===null)return;
  this.identity=null;this.ids={pointer:null,touch:null};
  this.claimed=null;this.candidates.clear();
 }
 finish(owner:GestureOwner,serial:number):boolean{
  if(!this.owns(owner,serial))return false;
  this.cancel();return true;
 }
 finishCandidate(serial:number,owner?:GestureOwner):void{
  if(serial!==this.session||this.claimed!==null)return;
  if(owner!==undefined)this.candidates.delete(owner);
  if(owner===undefined||this.candidates.size===0)this.cancel();
 }
 snapshot(){return {generation:this.session,owner:this.claimed,
  active:this.identity!==null};}
 dispose(){this.cancel();}
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
