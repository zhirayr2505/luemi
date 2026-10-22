/** REM-03B / LU-01. Pure viewport-local three-slot track geometry.
 * Track transform: translateX(calc(-100% + x px)); each slide is 100% viewport width.
 */
import type {ProfilePhoto} from "./ProfileModel";
import {photoIndex} from "./photo-viewer-state";

export type SlideRole="previous"|"current"|"next";
export type SlideSlot={role:SlideRole;photo:ProfilePhoto|null;index:number};
export const trackWindow=(photos:readonly ProfilePhoto[],id:string|null):SlideSlot[]=>{
 const n=photoIndex(photos,id);
 return ([-1,0,1] as const).map((offset,i)=>({
  role:(["previous","current","next"] as const)[i],
  photo:n>=0?photos[n+offset]??null:null,
  index:n+offset
 }));
};
export const viewportWidth=(width:number):number=>Number.isFinite(width)&&width>0?width:1;
export const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export function edgeResistance(delta:number,width:number):number{
 // Resistance only outside the first/last image, monotonic and bounded.
 const limit=Math.max(1,width*.32);
 return Math.sign(delta)*limit*(1-Math.exp(-Math.abs(delta)/limit));
}
export function allowedOffset(x:number,width:number,hasPrevious:boolean,hasNext:boolean):number{
 const w=viewportWidth(width);
 if(x>0&&!hasPrevious)return edgeResistance(x,w);
 if(x<0&&!hasNext)return edgeResistance(x,w);
 if(x>w)return w+edgeResistance(x-w,w);
 if(x< -w)return -w+edgeResistance(x+w,w);
 return x;
}
/** Recent-velocity is last 80 ms of pointer samples; not long-drag average. */
export function recentVelocity(samples:readonly {x:number;t:number}[]):number{
 if(samples.length<2)return 0;
 const last=samples[samples.length-1];
 let first=samples[0];
 for(let i=samples.length-2;i>=0;i--){
  if(last.t-samples[i].t>80)break;
  first=samples[i];
 }
 return last.t>first.t?(last.x-first.x)/(last.t-first.t):0;
}
export function destination(x:number,width:number,velocity:number,hasPrevious:boolean,hasNext:boolean):0|-1|1{
 const w=viewportWidth(width);
 if(hasNext&&(x<=-w*.17||velocity<=-.52))return -1;
 if(hasPrevious&&(x>=w*.17||velocity>=.52))return 1;
 return 0;
}
/** Pixel-equivalent position during DOM-key-preserving recenter: when moving to
 * next, old x=-W becomes new x=0 and the reused target slide shifts left W.
 */
export function recenterOffset(oldTrack:number,shift:-1|1,width:number):number{
 return oldTrack+shift*viewportWidth(width);
}
export function resizeOffset(x:number,oldWidth:number,newWidth:number):number{
 return x*viewportWidth(newWidth)/viewportWidth(oldWidth);
}
