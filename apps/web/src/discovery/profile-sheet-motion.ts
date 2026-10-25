/**
 * LUEMI profile white sheet — replacement motion system.
 *
 * Only this class owns sheet position and its single rAF timeline. No native
 * scrollTop animation, GeometryMotion, competing CSS transitions, or stale
 * endpoints. One authoritative Y in profile-root local CSS pixels.
 * Finger input writes synchronously; a settle always starts at THAT pixel.
 */
import {easeAt} from "../ui/motion";

type Stage="idle"|"settling"|"paused";
type Run={from:number;to:number;began:number;duration:number;
 collapsed:boolean;done:()=>void};
type Paused={collapsed:boolean;remaining:number;done:()=>void};
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const ease=(fraction:number)=>easeAt(fraction,.22,.79,.22,1);
export class ProfileSheetMotion {
 private y:number;
 private min=0;
 private max=1000;
 private run:Run|null=null;
 private paused:Paused|null=null;
 private frame:number|null=null;
 private epoch=0;
 private destroyed=false;
 constructor(initial:number,private readonly paint:(y:number,dragging:boolean)=>void,
  private readonly now:()=>number=()=>performance.now(),
  private readonly raf:(callback:(t:number)=>void)=>number=callback=>requestAnimationFrame(callback),
  private readonly caf:(frame:number)=>void=frame=>cancelAnimationFrame(frame)){
  this.y=initial;
 }
 isDisposed(){return this.destroyed;}
 get phase():Stage{return this.run?"settling":this.paused?"paused":"idle";}
 get value():number{return this.y;}
 sample():number{return this.interpolate(this.now());}
 get destinationCollapsed():boolean|null{return this.run?.collapsed??this.paused?.collapsed??null;}
 private invalidate(){
  this.epoch++;
  if(this.frame!==null)this.caf(this.frame);
  this.frame=null;
 }
 private interpolate(time:number){
  const r=this.run;
  if(!r)return this.y;
  const t=clamp((time-r.began)/Math.max(1,r.duration),0,1);
  return r.from+(r.to-r.from)*ease(t);
 }
 private put(value:number,dragging:boolean){
  if(this.destroyed)return;
  this.y=clamp(value,this.min,this.max+28);
  this.paint(this.y,dragging);
 }
 /** Stop a transition by sampling its current pixel, never the last target. */
 interrupt():number{
  if(this.destroyed)return this.y;
  const current=this.interpolate(this.now());
  this.invalidate();this.run=null;this.paused=null;
  this.put(current,true);
  return this.y;
 }
 /** A finger is authoritative; no queued frame may paint over it. */
 drag(value:number){
  if(this.destroyed)return;
  if(this.run||this.paused)this.interrupt();
  this.put(value,true);
 }
 /** New settle ALWAYS starts from the last actual finger-painted pixel. */
 settle(collapsed:boolean,done:()=>void,duration=290){
  if(this.destroyed)return;
  this.interrupt();
  this.start(collapsed,done,duration);
 }
 private start(collapsed:boolean,done:()=>void,duration:number){
  const target=collapsed?this.min:this.max;
  if(Math.abs(target-this.y)<.15||duration<=0||
   (typeof matchMedia==="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches)){
   this.put(target,false);done();return;
  }
  this.run={from:this.y,to:target,began:this.now(),duration,collapsed,done};
  this.tick();
 }
 private tick(){
  if(!this.run||this.destroyed)return;
  const token=this.epoch;
  this.frame=this.raf(time=>{
   if(this.destroyed||token!==this.epoch)return;
   this.frame=null;
   const r=this.run;
   if(!r)return;
   this.put(this.interpolate(time),false);
   if(time-r.began>=r.duration){
    this.run=null;
    this.put(r.to,false);
    r.done();
   }else this.tick();
  });
 }
 /**
  * Viewport/logo/safe-area remeasurement: caller preserves screen-space
  * pixel. Continue the UNEXPIRED part of the existing transition, or snap an
  * idle (not being dragged) sheet to its semantic endpoint.
  */
 resize(min:number,max:number,screenMappedY:number,committedCollapsed:boolean,
  fingerActive:boolean){
  if(this.destroyed||![min,max,screenMappedY].every(Number.isFinite)||max<=min)return;
  const now=this.now(),r=this.run,p=this.paused;
  const remaining=r?Math.max(0,r.duration-(now-r.began)):0;
  this.invalidate();this.run=null;
  this.min=min;this.max=max;
  this.put(!r&&!p&&!fingerActive?(committedCollapsed?min:max):screenMappedY,
   fingerActive);
  if(r){this.paused=null;this.start(r.collapsed,r.done,remaining);}
  else if(p)this.paused=p;
 }
 /** Freeze on Telegram background/route transition without committing a target. */
 pause(){
  if(this.destroyed||this.paused)return;
  const now=this.now(),r=this.run;
  const current=this.interpolate(now);
  this.invalidate();this.run=null;
  this.put(current,false);
  if(r)this.paused={collapsed:r.collapsed,
   remaining:Math.max(0,r.duration-(now-r.began)),done:r.done};
 }
 resume(){
  if(this.destroyed||!this.paused)return;
  const p=this.paused;
  this.paused=null;
  this.start(p.collapsed,p.done,p.remaining);
 }
 dispose(){
  this.invalidate();
  this.run=null;this.paused=null;this.destroyed=true;
 }
}
