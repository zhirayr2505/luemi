/** One requestAnimationFrame owner per motion; callers cancel before retargeting. */
export function easeAt(x:number,x1:number,y1:number,x2:number,y2:number):number {
 const curve=(t:number,a:number,b:number)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
 let low=0,high=1,t=x;
 for(let i=0;i<12;i++){
  const value=curve(t,x1,x2);
  if(Math.abs(value-x)<.0001)break;
  if(value<x)low=t;else high=t;
  t=(low+high)/2;
 }
 return curve(t,y1,y2);
}
export function animateValue(from:number,to:number,duration:number,
 easing:readonly [number,number,number,number],paint:(value:number)=>void):()=>void {
 if(Math.abs(from-to)<.1||window.matchMedia("(prefers-reduced-motion: reduce)").matches){
  paint(to);return ()=>{};
 }
 const started=performance.now();
 let frame=0,cancelled=false;
 const tick=(now:number)=>{
  if(cancelled)return;
  const p=Math.min(1,(now-started)/duration);
  paint(p===1?to:from+(to-from)*easeAt(p,...easing));
  if(p<1)frame=requestAnimationFrame(tick);
 };
 frame=requestAnimationFrame(tick);
 return ()=>{cancelled=true;cancelAnimationFrame(frame);};
}
