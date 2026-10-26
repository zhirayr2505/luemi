import type {MorphLayout} from "../geometry/ProfileGeometry";
import {clamp} from "../geometry/ProfileGeometry";
export type Phase="COMPACT"|"DRAGGING"|"SETTLING_TO_COMPACT"|"SETTLING_TO_EXPANDED"|"EXPANDED"|"SUSPENDED"|"DISPOSED";
export type MotionSnapshot={progress:number;elastic:number;phase:Phase;target:0|1|null;generation:number};
export type Clock={now():number;request(cb:(time:number)=>void):number;cancel(id:number):void};
const browserClock:Clock={now:()=>performance.now(),request:cb=>requestAnimationFrame(cb),cancel:id=>cancelAnimationFrame(id)};
const ease=(t:number)=>1-Math.pow(1-t,3);
const MAX_PULL=24,SOFTNESS=60,MAX_INPUT=160;
const resist=(distance:number)=>MAX_PULL*Math.min(MAX_INPUT,Math.max(0,distance))/
 (Math.min(MAX_INPUT,Math.max(0,distance))+SOFTNESS);
const unresist=(distance:number)=>Math.min(MAX_INPUT,SOFTNESS*distance/Math.max(.001,MAX_PULL-distance));
export class ProfileMotionEngine {
 private p=0;private elastic=0;private phase:Phase="COMPACT";private target:0|1|null=null;
 private generation=0;private frameId:number|null=null;
 private dragFrame:number|null=null;private pendingDrag:{progress:number;elastic:number}|null=null;
 private run:{from:number;fromElastic:number;to:0|1;at:number;duration:number}|null=null;
 private drag:{y:number;anchorPx:number;lastY:number}|null=null;
 constructor(private layout:MorphLayout,private readonly paint:(p:number,elastic:number)=>void,
  private readonly commit?:(target:0|1)=>void,private readonly reduced=()=>false,
  private readonly clock:Clock=browserClock){paint(0,0);}
 private stop(){this.generation++;if(this.frameId!==null)this.clock.cancel(this.frameId);
  if(this.dragFrame!==null)this.clock.cancel(this.dragFrame);
  this.frameId=null;this.dragFrame=null;this.pendingDrag=null;this.run=null;}
 private write(p:number,elastic=0){this.p=clamp(p,0,1);this.elastic=Math.max(0,elastic);
  this.paint(this.p,this.elastic);}
 getProgress(){return this.sample();}
 getSnapshot():MotionSnapshot{return {progress:this.sample(),elastic:this.sampleElastic(),phase:this.phase,
  target:this.target,generation:this.generation};}
 private sample(){if(!this.run)return this.p;
  const t=clamp((this.clock.now()-this.run.at)/this.run.duration,0,1);
  return clamp(this.run.from+(this.run.to-this.run.from)*ease(t),0,1);
 }
 private sampleElastic(){if(!this.run)return this.elastic;
  return this.run.fromElastic*(1-ease(clamp((this.clock.now()-this.run.at)/this.run.duration,0,1)));
 }
 private terminal(to:0|1){this.stop();this.write(to,0);this.target=null;
  this.phase=to?"EXPANDED":"COMPACT";this.commit?.(to);}
 private tick=(generation:number)=>{if(generation!==this.generation||!this.run||this.phase==="DISPOSED")return;
  const p=this.sample(),elastic=this.sampleElastic(),to=this.run.to;
  this.write(p,elastic);if(Math.abs(p-to)<.0005&&elastic<.05){this.terminal(to);return;}
  this.frameId=this.clock.request(()=>this.tick(generation));
 };
 animateTo(to:0|1,velocityY=0){if(this.phase==="DISPOSED"||this.phase==="SUSPENDED")return;
  if(this.run?.to===to)return;
  const from=this.sample(),fromElastic=this.sampleElastic();this.stop();this.drag=null;this.write(from,fromElastic);
  if((Math.abs(from-to)<.0005&&fromElastic<.05)||this.reduced()){this.terminal(to);return;}
  const distance=Math.max(Math.abs(from-to),fromElastic/MAX_PULL*.55),speed=Math.min(2.5,Math.max(.7,1+Math.abs(velocityY)*.25));
  this.target=to;this.phase=to?"SETTLING_TO_EXPANDED":"SETTLING_TO_COMPACT";
  this.run={from,fromElastic,to,at:this.clock.now(),
   duration:Math.max(fromElastic>0?150:70,Math.min(320,290*distance/speed))};
  const generation=this.generation;this.frameId=this.clock.request(()=>this.tick(generation));
 }
 beginDrag(y:number){if(this.phase==="DISPOSED"||this.phase==="SUSPENDED")return;
  const current=this.sample(),elastic=this.sampleElastic();this.stop();this.target=null;
  this.drag={y,anchorPx:current*this.layout.span+unresist(elastic),lastY:y};
  this.phase="DRAGGING";this.write(current,elastic);
 }
 updateDrag(y:number){if(this.phase!=="DRAGGING"||!this.drag)return;
  this.drag.lastY=y;
  const physical=this.drag.anchorPx+y-this.drag.y;
  this.pendingDrag={progress:clamp(physical/Math.max(1,this.layout.span),0,1),
   elastic:resist(physical-this.layout.span)};
  this.p=this.pendingDrag.progress;this.elastic=this.pendingDrag.elastic;
  if(this.dragFrame===null){const generation=this.generation;
   this.dragFrame=this.clock.request(()=>{this.dragFrame=null;
    if(generation!==this.generation||this.phase!=="DRAGGING"||this.pendingDrag===null)return;
    const next=this.pendingDrag;this.pendingDrag=null;this.write(next.progress,next.elastic);
   });}
 }
 endDrag(velocityY=0){if(this.phase!=="DRAGGING")return;
  if(this.pendingDrag!==null)this.write(this.pendingDrag.progress,this.pendingDrag.elastic);
  const to:0|1=velocityY>.35?1:velocityY<-.35?0:this.p>=.5?1:0;
  this.drag=null;this.animateTo(to,velocityY);
 }
 cancelDrag(){if(this.phase==="DRAGGING"){if(this.pendingDrag!==null)this.write(this.pendingDrag.progress,this.pendingDrag.elastic);
  this.drag=null;this.animateTo(this.p>=.5?1:0);}}
 rebaseViewport(next:MorphLayout){if(this.phase==="DISPOSED")return;
  const old=this.layout,current=this.sample(),physical=old.compactTop+old.span*current+this.sampleElastic();
  const moving=this.phase==="DRAGGING"||!!this.run;
  const oldRun=this.run,remaining=oldRun?Math.max(70,oldRun.duration-(this.clock.now()-oldRun.at)):0;
  this.stop();this.layout=next;
  const rebased=moving?clamp((physical-next.compactTop)/Math.max(1,next.span),0,1):current;
  const rebasedElastic=moving&&rebased===1?
   Math.min(resist(MAX_INPUT),Math.max(0,physical-next.expandedTop)):0;
  this.write(rebased,rebasedElastic);
  if(this.drag)this.drag={y:this.drag.lastY,anchorPx:rebased*next.span+unresist(rebasedElastic),lastY:this.drag.lastY};
  if(oldRun){this.target=oldRun.to;this.phase=oldRun.to?"SETTLING_TO_EXPANDED":"SETTLING_TO_COMPACT";
   this.run={from:rebased,fromElastic:rebasedElastic,to:oldRun.to,at:this.clock.now(),duration:remaining};
   const generation=this.generation;this.frameId=this.clock.request(()=>this.tick(generation));}
 }
 suspend(){if(this.phase==="DISPOSED"||this.phase==="SUSPENDED")return;
  const p=this.sample(),elastic=this.sampleElastic(),to=this.target;this.stop();this.write(p,elastic);this.drag=null;
  this.target=to;this.phase="SUSPENDED";
 }
 resume(){if(this.phase!=="SUSPENDED")return;
  const to=this.target??(this.p>=.5?1:0);this.target=null;
  this.phase=this.p>=.5?"EXPANDED":"COMPACT";this.animateTo(to);
 }
 dispose(){if(this.phase==="DISPOSED")return;this.stop();this.drag=null;this.target=null;this.phase="DISPOSED";}
}
