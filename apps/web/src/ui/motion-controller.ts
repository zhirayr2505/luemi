/**
 * REM-02A · motion ownership / lifecycle contract.
 *
 * Pure transitions are separate from DOM painting. Legacy animation curves,
 * timings and gesture policies stay untouched until explicitly approved REM-02B+.
 * Every callback is guarded by both generation and geometry revision.
 */
export type MotionPhase="idle"|"candidate"|"dragging"|"settling"|"suspended"|"closing";
export type MotionOwner="sheet"|"tabs"|"hero"|"browse"|"route";
export type MotionProperty=
 "sheet-scroll"|"elastic-sheet"|"parallax"|"blur"|"avatar"|"grab"|
 "tab-scroll"|"tab-ink"|"hero-track"|"browse-track"|"browse-underline"|
 "route-transform"|"route-reveal";

export const MOTION_PROPERTY_OWNERS={
 "sheet-scroll":"sheet","elastic-sheet":"sheet","parallax":"sheet","blur":"sheet",
 "avatar":"sheet","grab":"sheet","tab-scroll":"tabs","tab-ink":"tabs",
 "hero-track":"hero","browse-track":"browse","browse-underline":"browse",
 "route-transform":"route","route-reveal":"route"
} as const satisfies Record<MotionProperty,MotionOwner>;

export type MotionCancelReason="gesture-cancel"|"interrupted"|"route-handoff"|
 "geometry-changed"|"unmount"|"superseded"|"external";
export interface MotionSnapshot {
 owner:MotionOwner;
 phase:MotionPhase;
 current:number;
 target:number;
 lastSettled:number;
 velocity:number;
 geometryRevision:number;
 generation:number;
 committedGeneration:number|null;
 cancelReason:MotionCancelReason|null;
 disposed:boolean;
}
export type MotionToken=Readonly<Pick<MotionSnapshot,"owner"|"generation"|"geometryRevision">>;
export type MotionCommand=
 |{type:"begin";value:number;revision?:number}
 |{type:"claim";token:MotionToken}
 |{type:"paint";token:MotionToken;value:number;velocity?:number}
 |{type:"settle";token:MotionToken;target:number}
 |{type:"close";token:MotionToken;target:number}
 |{type:"interrupt";token:MotionToken;reason:MotionCancelReason}
 |{type:"suspend";token:MotionToken;reason:MotionCancelReason}
 |{type:"resume";token:MotionToken;phase:"dragging"|"settling";target?:number}
 |{type:"rebase";revision:number;value?:number;target?:number}
 |{type:"cancel";token:MotionToken;reason:MotionCancelReason}
 |{type:"finish";token:MotionToken}
 |{type:"dispose"};

export const createMotionSnapshot=(owner:MotionOwner,current=0,revision=0):MotionSnapshot=>({
 owner,phase:"idle",current,target:current,lastSettled:current,velocity:0,
 geometryRevision:revision,generation:0,committedGeneration:null,
 cancelReason:null,disposed:false
});
export const motionToken=(s:MotionSnapshot):MotionToken=>({
 owner:s.owner,generation:s.generation,geometryRevision:s.geometryRevision
});
export const isMotionToken=(s:MotionSnapshot,t:MotionToken):boolean=>
 !s.disposed&&s.owner===t.owner&&s.generation===t.generation&&
 s.geometryRevision===t.geometryRevision;
const finite=(value:number)=>Number.isFinite(value);

/** No side effects. A rejected transition returns the identical snapshot. */
export function reduceMotion(s:MotionSnapshot,cmd:MotionCommand):MotionSnapshot{
 if(cmd.type==="dispose")return s.disposed?s:{...s,disposed:true,phase:"idle",
  generation:s.generation+1,cancelReason:"unmount",velocity:0};
 if(s.disposed)return s;
 if(cmd.type==="begin"){
  if(!finite(cmd.value))return s;
  if(cmd.revision!==undefined&&(!Number.isSafeInteger(cmd.revision)||cmd.revision<s.geometryRevision))return s;
  return {...s,phase:"candidate",current:cmd.value,target:cmd.value,
   geometryRevision:cmd.revision??s.geometryRevision,
   generation:s.generation+1,velocity:0,committedGeneration:null,
   cancelReason:null};
 }
 if(cmd.type==="rebase"){
  if(!Number.isSafeInteger(cmd.revision)||cmd.revision<=s.geometryRevision||
    (cmd.value!==undefined&&!finite(cmd.value))||
    (cmd.target!==undefined&&!finite(cmd.target)))return s;
  return {...s,geometryRevision:cmd.revision,generation:s.generation+1,
   current:cmd.value??s.current,target:cmd.target??s.target,
   phase:s.phase==="idle"?"idle":"suspended",
   velocity:0,cancelReason:s.phase==="idle"?null:"geometry-changed"};
 }
 if(!isMotionToken(s,cmd.token))return s;
 switch(cmd.type){
  case "claim":return s.phase==="candidate"?{...s,phase:"dragging"}:s;
  case "paint":
   if(s.phase!=="dragging"||!finite(cmd.value)||
      (cmd.velocity!==undefined&&!finite(cmd.velocity)))return s;
   return {...s,current:cmd.value,velocity:cmd.velocity??s.velocity};
  case "settle":case "close":
   if(!["candidate","dragging","settling","suspended"].includes(s.phase)||
      !finite(cmd.target))return s;
   return {...s,phase:cmd.type==="close"?"closing":"settling",
    target:cmd.target,velocity:0,cancelReason:null};
  case "interrupt":case "suspend":
   if(s.phase==="idle"||s.phase==="suspended")return s;
   return {...s,phase:"suspended",generation:s.generation+1,
    cancelReason:cmd.reason,velocity:0};
  case "resume":
   if(s.phase!=="suspended"||(cmd.target!==undefined&&!finite(cmd.target)))return s;
   return {...s,phase:cmd.phase,target:cmd.target??s.target,
    generation:s.generation+1,cancelReason:null};
  case "cancel":
   if(s.phase==="idle")return s;
   return {...s,phase:"idle",generation:s.generation+1,target:s.current,
    velocity:0,cancelReason:cmd.reason};
  case "finish":
   if(s.phase!=="settling"&&s.phase!=="closing")return s;
   return {...s,phase:"idle",current:s.target,lastSettled:s.target,
    velocity:0,committedGeneration:s.generation,cancelReason:null};
 }
}

/** Pluggable browser scheduler, enabling deterministic tests without DOM. */
export interface MotionScheduler {
 frame:(cb:()=>void)=>number;
 cancelFrame:(id:number)=>void;
}
export interface MotionWriter {
 /** Writes final pixels BEFORE semantic onCommit. */
 paint:(value:number)=>void;
 onCommit?:(value:number)=>void;
}
export class MotionController {
 private state:MotionSnapshot;
 private frameId:number|null=null;
 private frameOwner:MotionToken|null=null;
 private pendingPaint:{token:MotionToken;value:number;velocity:number;paint:(v:number)=>void}|null=null;
 private releases=new Set<()=>void>();
 constructor(owner:MotionOwner,private scheduler:MotionScheduler,current=0,revision=0){
  this.state=createMotionSnapshot(owner,current,revision);
 }
 snapshot():Readonly<MotionSnapshot>{return {...this.state};}
 token():MotionToken{return motionToken(this.state);}
 owns(token:MotionToken):boolean{return isMotionToken(this.state,token);}
 private abortResources(){
  if(this.frameId!==null)this.scheduler.cancelFrame(this.frameId);
  this.frameId=null;this.frameOwner=null;this.pendingPaint=null;
  const releases=[...this.releases];this.releases.clear();
  for(const release of releases)release();
 }
 begin(value:number,revision?:number):MotionToken|null{
  const next=reduceMotion(this.state,{type:"begin",value,revision});
  if(next===this.state)return null;
  this.abortResources();this.state=next;return this.token();
 }
 claim(token:MotionToken):boolean{
  const next=reduceMotion(this.state,{type:"claim",token});
  if(next===this.state)return false;
  this.state=next;return true;
 }
 paint(token:MotionToken,value:number,paint:(value:number)=>void,velocity=0):boolean{
  const next=reduceMotion(this.state,{type:"paint",token,value,velocity});
  if(next===this.state)return false;
  this.state=next;paint(value);return true;
 }
 /** Coalesce to one pending RAF; stale paint callbacks cannot escape the guard. */
 schedulePaint(token:MotionToken,value:number,paint:(value:number)=>void,velocity=0):boolean{
  if(!this.owns(token)||this.state.phase!=="dragging"||!finite(value)||!finite(velocity))return false;
  this.pendingPaint={token,value,velocity,paint};
  if(this.frameId!==null)return true;
  this.frameOwner=token;
  const tick=()=>{
   this.frameId=null;this.frameOwner=null;
   const pending=this.pendingPaint;this.pendingPaint=null;
   if(pending)this.paint(pending.token,pending.value,pending.paint,pending.velocity);
  };
  this.frameId=this.scheduler.frame(tick);
  return true;
 }
 settle(token:MotionToken,target:number):boolean{return this.target(token,target,false);}
 close(token:MotionToken,target:number):boolean{return this.target(token,target,true);}
 private target(token:MotionToken,target:number,closing:boolean):boolean{
  const next=reduceMotion(this.state,{type:closing?"close":"settle",token,target});
  if(next===this.state)return false;
  // A queued finger frame is no longer allowed to paint over the settle endpoint.
  this.abortResources();this.state=next;return true;
 }
 /** Exactly once; endpoint write happens before any React semantic commit. */
 finish(token:MotionToken,writer:MotionWriter):boolean{
  if(!this.owns(token)||(this.state.phase!=="settling"&&this.state.phase!=="closing"))return false;
  this.abortResources();
  const next=reduceMotion(this.state,{type:"finish",token});
  if(next===this.state)return false;
  writer.paint(next.current);
  this.state=next;
  writer.onCommit?.(next.current);
  return true;
 }
 interrupt(token:MotionToken,reason:MotionCancelReason="interrupted"):MotionToken|null{
  return this.pause(token,reason,false);
 }
 suspend(token:MotionToken,reason:MotionCancelReason="external"):MotionToken|null{
  return this.pause(token,reason,true);
 }
 private pause(token:MotionToken,reason:MotionCancelReason,suspended:boolean):MotionToken|null{
  const next=reduceMotion(this.state,{type:suspended?"suspend":"interrupt",token,reason});
  if(next===this.state)return null;
  this.abortResources();this.state=next;return this.token();
 }
 resume(token:MotionToken,phase:"dragging"|"settling",target?:number):MotionToken|null{
  const next=reduceMotion(this.state,{type:"resume",token,phase,target});
  if(next===this.state)return null;
  this.abortResources();this.state=next;return this.token();
 }
 rebase(revision:number,value?:number,target?:number):MotionToken|null{
  const next=reduceMotion(this.state,{type:"rebase",revision,value,target});
  if(next===this.state)return null;
  this.abortResources();this.state=next;return this.token();
 }
 cancel(token:MotionToken,reason:MotionCancelReason="gesture-cancel"):boolean{
  const next=reduceMotion(this.state,{type:"cancel",token,reason});
  if(next===this.state)return false;
  this.abortResources();this.state=next;return true;
 }
 /** Register external CSS transition timer / existing animateValue cancellation. */
 track(token:MotionToken,release:()=>void):boolean{
  if(!this.owns(token)){release();return false;}
  this.releases.add(release);return true;
 }
 dispose():void{
  if(this.state.disposed)return;
  this.abortResources();this.state=reduceMotion(this.state,{type:"dispose"});
 }
}
