export type LikesAction="skip"|"super"|"ordinary";
export type Point={x:number;y:number};
export const LIKES_HOLD_MS=320;
export const LIKES_DRAG_SLOP=9;
export const likesActions=["skip","super","ordinary"] as const;

export function likesDrag(dx:number,dy:number){
 if(Math.max(Math.abs(dx),Math.abs(dy))<LIKES_DRAG_SLOP)return "hold";
 return Math.abs(dx)>Math.abs(dy)*1.18?"photos":"scroll";
}

export function fanTargets(origin:Point,width:number,height:number){
 const center=origin.x<107?0:origin.x>width-107?Math.PI:origin.y<165?Math.PI/2:-Math.PI/2;
 return likesActions.map((kind,index)=>{
  const angle=center+(index-1)*.88;
  return {kind,x:Math.min(width-29,Math.max(29,origin.x+Math.cos(angle)*77)),
   y:Math.min(height-85,Math.max(88,origin.y+Math.sin(angle)*77))};
 });
}

export function fanSelection(point:Point,origin:Point,targets:ReturnType<typeof fanTargets>):LikesAction|null{
 if(Math.hypot(point.x-origin.x,point.y-origin.y)<31)return null;
 let selected:LikesAction|null=null,closest=30;
 for(const target of targets){
  const distance=Math.hypot(point.x-target.x,point.y-target.y);
  if(distance<closest){selected=target.kind;closest=distance;}
 }
 return selected;
}
