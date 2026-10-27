/** Geometry is sampled once at pointerdown. The gesture owner never changes mid-drag. */
export function cardGestureZone(clientY:number,top:number,height:number):"photo"|"browse"|null {
 if(!Number.isFinite(height)||height<=0||clientY<top||clientY>top+height)return null;
 return clientY<top+height*.85?"photo":"browse";
}
