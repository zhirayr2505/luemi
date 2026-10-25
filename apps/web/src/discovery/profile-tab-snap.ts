/** Profile tab release must never restart a full 295ms timeline after a
 * finger already covered most of the distance. Values are page fractions;
 * taps and keyboard navigation retain their existing 295ms duration. */
export function tabReleaseDuration(from:number,to:number):number{
 if(!Number.isFinite(from)||!Number.isFinite(to))return 295;
 const distance=Math.abs(to-from);
 if(distance<=.06)return 0;
 return Math.min(210,Math.max(50,Math.round(distance*295)));
}
