/** REM-02B / LU-09: geometry-aware RAF settle adapter.
 * Same bezier, duration and endpoint as existing animateValue; a resize only
 * continues the *unused interval* of that easing curve.
 */
import {easeAt} from "../ui/motion";
import {MotionController,type MotionToken} from "../ui/motion-controller";

export type Easing=readonly [number,number,number,number];
export interface GeometryMotionSnapshot {
 phase:"idle"|"settling"|"suspended";
 current:number;target:number;from:number;revision:number;
 elapsed:number;remaining:number;duration:number;velocity:number;
 generation:number;
}
const bounded=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const finite=(n:number)=>Number.isFinite(n);
export class GeometryMotion {
 private controller:MotionController;
 private frame:number|null=null;
 private runId=0;
 private active:{token:MotionToken;from:number;target:number;start:number;duration:number;
  previousProgress:number;progressStart:number;remaining:number;
  paint:(n:number)=>void;commit:()=>void;velocity:number}|null=null;
 private frozen:{progress:number;remaining:number;duration:number;paint:(n:number)=>void;commit:()=>void}|null=null;
 private current:number;private revision:number;
 private disposed=false;
 constructor(private name:"sheet"|"tabs"|"hero",private clock:()=>number,
  private raf:(cb:(time:number)=>void)=>number,private cancelRaf:(id:number)=>void,
  value:number,revision=0){
  this.current=value;this.revision=revision;
  this.controller=new MotionController(name,{frame:cb=>raf(()=>cb()),cancelFrame:cancelRaf},value,revision);
 }
 private stopFrame(){
  this.runId++;
  if(this.frame!==null){this.cancelRaf(this.frame);this.frame=null;}
 }
 private evaluate(now:number){
  const a=this.active;if(!a)return this.current;
  const p=bounded((now-a.start)/Math.max(.001,a.remaining),0,1);
  const ease=(x:number)=>easeAt(x,...(this.easing??[.22,.79,.22,1]));
  const fraction=a.progressStart+(1-a.progressStart)*p;
  const initial=ease(a.progressStart);
  const advanced=(ease(fraction)-initial)/Math.max(1e-8,1-initial);
  return a.from+(a.target-a.from)*bounded(advanced,0,1);
 }
 private easing:Easing|null=null;
 /** Visible pixels per millisecond from the very same unchanged easing curve. */
 private velocityAt(now:number):number{
  if(!this.active)return 0;
  return (this.evaluate(now+.5)-this.evaluate(now-.5));
 }
 snapshot():GeometryMotionSnapshot{
  const a=this.active,now=this.clock();
  const remaining=a?Math.max(0,a.remaining-(now-a.start)):this.frozen?.remaining??0;
  return {phase:a?"settling":this.frozen?"suspended":"idle",
   current:a?this.evaluate(now):this.current,target:a?.target??this.current,
   from:a?.from??this.current,revision:this.revision,
   elapsed:a?a.duration-remaining:0,remaining,duration:a?.duration??this.frozen?.duration??0,
   velocity:a?this.velocityAt(now):0,generation:this.controller.snapshot().generation};
 }
 /** Sample at the actual frame boundary, not the last RAF write. */
 sample():number{return this.active?this.evaluate(this.clock()):this.current;}
 cancel():number{
  const value=this.sample();this.current=value;
  this.stopFrame();this.active=null;this.frozen=null;
  const token=this.controller.token();this.controller.cancel(token,"interrupted");
  return value;
 }
 start(from:number,target:number,duration:number,easing:Easing,
  paint:(n:number)=>void,commit:()=>void,revision=this.revision):void{
  if(this.disposed||![from,target,duration].every(finite))return;
  this.cancel();this.current=from;this.easing=easing;
  this.revision=Math.max(this.revision,revision);
  const token=this.controller.begin(from,this.revision);
  if(!token)return;
  this.controller.settle(token,target);
  const updated=this.controller.token();
  const lowMotion=typeof matchMedia==="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(Math.abs(from-target)<.1||duration<=0||lowMotion){
   this.current=target;this.controller.finish(updated,{paint:n=>{this.current=n;paint(n);},onCommit:commit});
   return;
  }
  this.active={token:updated,from,target,start:this.clock(),duration,remaining:duration,
   previousProgress:0,progressStart:0,paint,commit,velocity:0};
  this.queue();
 }
 private queue(){
  if(!this.active||this.frame!==null)return;
  const id=this.runId;
  this.frame=this.raf(now=>{
   if(id!==this.runId||this.disposed)return;
   this.frame=null;
   const a=this.active;
   if(!a||!this.controller.owns(a.token))return;
   const value=this.evaluate(now);
   this.current=value;a.paint(value);
   if(!this.active||this.active!==a||!this.controller.owns(a.token))return;
   if(now-a.start>=a.remaining){
    this.active=null;this.current=a.target;
    this.controller.finish(a.token,{paint:n=>{this.current=n;a.paint(n);},onCommit:a.commit});
   }else this.queue();
  });
 }
 /** Rebase preserves visible coordinate in its new coordinate space and the
  * *remaining* duration. It does not restart an entire 335/295ms motion. */
 rebase(revision:number,value:number,target:number):void{
  if(this.disposed||revision<=this.revision||!finite(value)||!finite(target))return;
  const a=this.active;const now=this.clock();
  const phaseProgress=a?bounded((now-a.start)/Math.max(.001,a.remaining),0,1):0;
  const remaining=a?Math.max(0,a.remaining-(now-a.start)):this.frozen?.remaining??0;
  const duration=a?.duration??this.frozen?.duration??0;
  const progressStart=a?a.progressStart+(1-a.progressStart)*phaseProgress:
   this.frozen?.progress??0;
  const callbacks=a?{paint:a.paint,commit:a.commit}:this.frozen?
   {paint:this.frozen.paint,commit:this.frozen.commit}:null;
  const velocity=a?this.velocityAt(now):0;
  this.stopFrame();this.active=null;this.current=value;this.revision=revision;
  this.controller.rebase(revision,value,target);
  if(!callbacks)return;
  this.frozen={progress:progressStart,remaining,duration,paint:callbacks.paint,commit:callbacks.commit};
  this.current=value;
  this.resume(target,velocity);
 }
 private resume(target:number,velocity=0):void{
  const frozen=this.frozen;if(!frozen)return;
  const token=this.controller.token();
  const resumed=this.controller.resume(token,"settling",target);
  if(!resumed)return;
  this.frozen=null;
  if(frozen.remaining<=0){
   this.controller.finish(resumed,{paint:n=>{this.current=n;frozen.paint(n);},onCommit:frozen.commit});
   this.current=target;return;
  }
  this.active={token:resumed,from:this.current,target,start:this.clock(),duration:frozen.duration,
   remaining:frozen.remaining,previousProgress:frozen.progress,
   progressStart:frozen.progress,paint:frozen.paint,commit:frozen.commit,velocity};
  this.queue();
 }
 /** Hidden zero-size view: freeze time and keep current snapshot until shown. */
 suspend():void{
  if(this.disposed||this.frozen)return;
  const a=this.active;if(!a)return;
  const now=this.clock(),p=bounded((now-a.start)/Math.max(.001,a.remaining),0,1);
  const current=this.evaluate(now);
  this.stopFrame();this.active=null;this.current=current;
  const remaining=Math.max(0,a.remaining-(now-a.start));
  this.frozen={progress:a.progressStart+(1-a.progressStart)*p,remaining,
   duration:a.duration,paint:a.paint,commit:a.commit};
  this.controller.suspend(a.token,"geometry-changed");
 }
 /** Reappear at a measured nonzero size; preserve the unused easing interval. */
 reveal(revision:number,value:number,target:number):void{
  if(this.disposed||revision<=this.revision)return;
  this.current=value;this.revision=revision;
  this.controller.rebase(revision,value,target);
  this.resume(target);
 }
 /** StrictMode provisional cleanup must never reuse a disposed RAF driver. */
 isDisposed():boolean{return this.disposed;}
 /** Ensure completion cannot paint on an unmounted view. */
 dispose():void{
  if(this.disposed)return;this.disposed=true;this.stopFrame();this.active=null;
  this.frozen=null;this.controller.dispose();
 }
}
