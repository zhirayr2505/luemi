/**
 * Profile Morph A2 — the sole writer of normalized SHEET/HERO morph progress.
 * No DOM reads or React updates in the frame loop. Units: p=0 COMPACT, p=1 EXPANDED.
 * Every command cancels its predecessor with a monotonically growing generation.
 */
export type MorphPhase="idle"|"dragging"|"settling"|"suspended"|"disposed";
export type MorphClock={
 now():number;request(callback:(time:number)=>void):number;cancel(id:number):void;
};
export type MorphSnapshot=Readonly<{progress:number;phase:MorphPhase;target:0|1|null;generation:number}>;
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const ease=(t:number)=>1-Math.pow(1-t,3);
export class ProfileMorphMotion{
 private progress=0;
 private phase:MorphPhase="idle";
 private target:0|1|null=null;
 private generation=0;
 private raf:number|null=null;
 private run:{from:number;to:0|1;at:number;duration:number}|null=null;
 private dragOrigin:{y:number;p:number;span:number}|null=null;
 constructor(private readonly paint:(p:number)=>void,
  private readonly clock:MorphClock={
   now:()=>performance.now(),request:cb=>requestAnimationFrame(cb),cancel:id=>cancelAnimationFrame(id)
  },private readonly onCommit?:(target:0|1)=>void,private readonly reducedMotion=()=>false){
  this.paint(0);
 }
 snapshot():MorphSnapshot{return {progress:this.sample(),phase:this.phase,target:this.target,generation:this.generation};}
 private stop(){this.generation++;if(this.raf!==null)this.clock.cancel(this.raf);this.raf=null;this.run=null;}
 sample():number{
  if(this.phase!=="settling"||!this.run)return this.progress;
  const t=clamp((this.clock.now()-this.run.at)/Math.max(1,this.run.duration));
  return clamp(this.run.from+(this.run.to-this.run.from)*ease(t));
 }
 private write(p:number){this.progress=clamp(p);this.paint(this.progress);}
 private end(target:0|1){
  this.stop();this.write(target);this.target=null;this.phase="idle";this.onCommit?.(target);
 }
 private frame=(generation:number)=>{
  if(generation!==this.generation||this.phase!=="settling"||!this.run)return;
  const p=this.sample(),goal=this.run.to,done=Math.abs(p-goal)<.0005;
  this.write(p);
  if(done){this.end(goal);return;}
  this.raf=this.clock.request(()=>this.frame(generation));
 };
 settle(target:0|1,velocity=0){
  if(this.phase==="disposed")return;
  if(this.phase==="idle"&&Math.abs(this.progress-target)<.0005)return;
  if(this.phase==="settling"&&this.target===target)return;
  const current=this.sample();this.stop();this.dragOrigin=null;this.write(current);
  if(this.reducedMotion()||Math.abs(current-target)<.0005){this.end(target);return;}
  const distance=Math.abs(target-current);
  const speed=Math.min(2.4,Math.max(.55,1+Math.abs(velocity)*.12));
  const duration=Math.max(65,Math.min(280,260*distance/speed));
  this.target=target;this.phase="settling";
  this.run={from:current,to:target,at:this.clock.now(),duration};
  const generation=this.generation;
  this.raf=this.clock.request(()=>this.frame(generation));
 }
 dragStart(clientY:number,span:number){
  if(this.phase==="disposed")return;
  const current=this.sample();this.stop();this.write(current);
  this.target=null;this.phase="dragging";this.dragOrigin={y:clientY,p:current,span:Math.max(1,span)};
 }
 drag(clientY:number){
  if(this.phase!=="dragging"||!this.dragOrigin)return;
  this.write(this.dragOrigin.p+(clientY-this.dragOrigin.y)/this.dragOrigin.span);
 }
 release(velocityY=0,cancelled=false){
  if(this.phase!=="dragging")return;
  const target:0|1=cancelled?(this.dragOrigin?.p??0)>=.5?1:0:
   velocityY>.32?1:velocityY<-.32?0:this.progress>=.5?1:0;
  this.settle(target,velocityY);
 }
 toggle(){this.settle(this.target===1?0:this.target===0?1:this.progress>=.5?0:1);}
 suspend(){
  if(this.phase==="disposed")return;
  const current=this.sample(),wasDragging=this.phase==="dragging";
  const target=this.target;
  this.stop();this.write(current);this.dragOrigin=null;
  this.target=wasDragging?null:target;this.phase="suspended";
 }
 resume(){
  if(this.phase!=="suspended")return;
  const target=this.target;
  this.phase="idle";this.target=null;
  if(target!==null)this.settle(target);
  else this.settle(this.progress>=.5?1:0);
 }
 dispose(){
  if(this.phase==="disposed")return;
  this.stop();this.phase="disposed";this.dragOrigin=null;this.target=null;
 }
}
