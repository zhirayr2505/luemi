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
