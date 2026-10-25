/** LU-09: math shared by sheet & tab geometry adapters; no DOM reads. */
const clampPosition=(value:number,lower:number,upper:number):number=>
 Math.max(lower,Math.min(upper,value));
/** Keep the same *screen-space* position when a container changes its top. */
export function remapSheetPixel(
 priorLocal:number,oldRootTop:number,newRootTop:number,collapsed:number,expanded:number
):{local:number;clamped:boolean;unclamped:number}{
 const unclamped=priorLocal+oldRootTop-newRootTop;
 const local=clampPosition(unclamped,collapsed,expanded+28);
 return {local,clamped:Math.abs(unclamped-local)>.001,unclamped};
}
/** The touch's stored beginning stays untouched; update its origin instead.
 * Continuing clientY produces the same local value under the finger. */
export function reanchorSheet(current:number,startY:number,lastY:number):number{
 return current-(lastY-startY);
}
/** Keep a fractional tab page under a continuing pointer/touch session. */
export function reanchorPage(fraction:number,startX:number,lastX:number,width:number):number{
 return fraction+(lastX-startX)/Math.max(1,width);
}
