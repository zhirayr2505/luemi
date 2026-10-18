/** A single cancellable transition per viewport; no permanent animation loop. */
export const SLIDE_DURATION = 360;
export const SLIDE_EASING = 'cubic-bezier(0.22, 0.8, 0.22, 1)';
export function slideDirection(previous:string,next:string,order:readonly string[]):1|-1 {
 const a=order.indexOf(previous),b=order.indexOf(next);
 return a>=0&&b>=0&&b<a?-1:1;
}
/** Both panes share one displacement and remain exactly one viewport apart. */
export function slideFrames(direction:1|-1,width:number,start:number):{outgoing:Keyframe[];incoming:Keyframe[]}{
 const frame=(x:number):Keyframe=>({transform:`translate3d(${x}px,0,0)`});
 return {outgoing:[frame(start),frame(-direction*width)],incoming:[frame(start+direction*width),frame(0)]};
}
export class AnimationBatch {
 private animations:Animation[]=[];
 private epoch=0;
 cancel(){this.epoch++;for(const a of this.animations)a.cancel();this.animations=[];}
 run(animations:Animation[],complete:()=>void){this.cancel();const epoch=this.epoch;this.animations=animations;
  void Promise.all(animations.map(a=>a.finished)).then(()=>{if(epoch===this.epoch){complete();this.cancel();}}).catch(()=>{/* cancelled transitions cannot settle a newer screen */});
 }
}