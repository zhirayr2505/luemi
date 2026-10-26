import type {MorphLayout} from "../geometry/ProfileGeometry";
import {clamp} from "../geometry/ProfileGeometry";
export type Phase="COMPACT"|"DRAGGING"|"SETTLING_TO_COMPACT"|"SETTLING_TO_EXPANDED"|"EXPANDED"|"SUSPENDED"|"DISPOSED";
export type MotionSnapshot={progress:number;phase:Phase;target:0|1|null;generation:number};
export type Clock={now():number;request(cb:(time:number)=>void):number;cancel(id:number):void};
const browserClock:Clock={now:()=>performance.now(),request:cb=>requestAnimationFrame(cb),cancel:id=>cancelAnimationFrame(id)};
const ease=(t:number)=>1-Math.pow(1-t,3);
export class ProfileMotionEngine {
 private p=0;private phase:Phase="COMPACT";private target:0|1|null=null;
 private generation=0;private frameId:number|null=null;
 private run:{from:number;to:0|1;at:number;duration:number}|null=null;
 private drag:{y:number;anchor:number;lastY:number}|null=null;
 constructor(private layout:MorphLayout,private readonly paint:(p:number)=>void,
  private readonly commit?:(target:0|1)=>void,private readonly reduced=()=>false,
  private readonly clock:Clock=browserClock){paint(0);}
 private stop(){this.generation++;if(this.frameId!==null)this.clock.cancel(this.frameId);this.frameId=null;this.run=null;}
 private write(p:number){this.p=clamp(p,0,1);this.paint(this.p);}
 getProgress(){return this.sample();}
 getSnapshot():MotionSnapshot{return {progress:this.sample(),phase:this.phase,target:this.target,generation:this.generation};}
 private sample(){if(!this.run)return this.p;
  const t=clamp((this.clock.now()-this.run.at)/this.run.duration,0,1);
  return clamp(this.run.from+(this.run.to-this.run.from)*ease(t),0,1);
 }
 private terminal(to:0|1){this.stop();this.write(to);this.target=null;
  this.phase=to?"EXPANDED":"COMPACT";this.commit?.(to);}
 private tick=(generation:number)=>{if(generation!==this.generation||!this.run||this.phase==="DISPOSED")return;
  const p=this.sample(),to=this.run.to;
  this.write(p);if(Math.abs(p-to)<.0005){this.terminal(to);return;}
  this.frameId=this.clock.request(()=>this.tick(generation));
 };
 animateTo(to:0|1,velocityY=0){if(this.phase==="DISPOSED"||this.phase==="SUSPENDED")return;
  if(this.run?.to===to)return;
  const from=this.sample();this.stop();this.drag=null;this.write(from);
  if(Math.abs(from-to)<.0005||this.reduced()){this.terminal(to);return;}
  const distance=Math.abs(from-to),speed=Math.min(2.5,Math.max(.7,1+Math.abs(velocityY)*.25));
  this.target=to;this.phase=to?"SETTLING_TO_EXPANDED":"SETTLING_TO_COMPACT";
  this.run={from,to,at:this.clock.now(),duration:Math.max(70,Math.min(320,290*distance/speed))};
  const generation=this.generation;this.frameId=this.clock.request(()=>this.tick(generation));
 }
 beginDrag(y:number){if(this.phase==="DISPOSED"||this.phase==="SUSPENDED")return;
  const current=this.sample();this.stop();this.write(current);this.target=null;
  this.drag={y,anchor:current,lastY:y};this.phase="DRAGGING";
 }
 updateDrag(y:number){if(this.phase!=="DRAGGING"||!this.drag)return;
  this.drag.lastY=y;this.write(this.drag.anchor+(y-this.drag.y)/Math.max(1,this.layout.span));
 }
 endDrag(velocityY=0){if(this.phase!=="DRAGGING")return;
  const to:0|1=velocityY>.35?1:velocityY<-.35?0:this.p>=.5?1:0;
  this.drag=null;this.animateTo(to,velocityY);
 }
 cancelDrag(){if(this.phase==="DRAGGING"){this.drag=null;this.animateTo(this.p>=.5?1:0);}}
 rebaseViewport(next:MorphLayout){if(this.phase==="DISPOSED")return;
  const old=this.layout,current=this.sample(),physical=old.compactTop+old.span*current;
  const moving=this.phase==="DRAGGING"||!!this.run;
  const oldRun=this.run,remaining=oldRun?Math.max(70,oldRun.duration-(this.clock.now()-oldRun.at)):0;
  this.stop();this.layout=next;
  const rebased=moving?clamp((physical-next.compactTop)/Math.max(1,next.span),0,1):current;
  this.write(rebased);
  if(this.drag)this.drag={y:this.drag.lastY,anchor:rebased,lastY:this.drag.lastY};
  if(oldRun){this.target=oldRun.to;this.phase=oldRun.to?"SETTLING_TO_EXPANDED":"SETTLING_TO_COMPACT";
   this.run={from:rebased,to:oldRun.to,at:this.clock.now(),duration:remaining};
   const generation=this.generation;this.frameId=this.clock.request(()=>this.tick(generation));}
 }
 suspend(){if(this.phase==="DISPOSED"||this.phase==="SUSPENDED")return;
  const p=this.sample(),to=this.target;this.stop();this.write(p);this.drag=null;
  this.target=to;this.phase="SUSPENDED";
 }
 resume(){if(this.phase!=="SUSPENDED")return;
  const to=this.target??(this.p>=.5?1:0);this.target=null;
  this.phase=this.p>=.5?"EXPANDED":"COMPACT";this.animateTo(to);
 }
 dispose(){if(this.phase==="DISPOSED")return;this.stop();this.drag=null;this.target=null;this.phase="DISPOSED";}
}
