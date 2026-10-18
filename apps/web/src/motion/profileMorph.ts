/** Pure geometry. One render transform and one native scroll offset. */
export const PROFILE_AVATAR_SIZE=56;
export const PROFILE_RADIUS=27;
export const SNAP_THRESHOLD=.30;
export const clamp01=(n:number)=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;
export function morphTravel(width:number){return Number.isFinite(width)&&width>0?Math.min(325,Math.max(220,width*.78)):220;}
export function morphFrame(scroll:number,width:number){
 const size=Number.isFinite(width)&&width>56?width:56;
 const progress=clamp01(scroll/morphTravel(width));
 const ease=progress*(2-progress);
 const scale=1+(PROFILE_AVATAR_SIZE/size-1)*ease;
 return {
  progress,scale,
  x:7*ease,
  radius:PROFILE_RADIUS+(size/2-PROFILE_RADIUS)*ease,
  rimWidth:1.45/scale,
  captionOpacity:clamp01(1-progress*3.75),
  compactOpacity:clamp01((progress-.50)/.28),
  barsOpacity:clamp01(1-progress*5),
  expanded:progress<.025,
 };
}
export function snapTarget(scroll:number,width:number,lastClosed:boolean,velocity:number){
 const travel=morphTravel(width),fraction=clamp01(scroll/travel);
 if(scroll<=1)return 0;
 if(scroll>travel+24)return null; // navigating content, do not pull back
 if(velocity>.6&&scroll>18&&scroll<travel-18)return travel;
 if(velocity<-.6&&scroll>18&&scroll<travel-18)return 0;
 return fraction>=(lastClosed?.70:SNAP_THRESHOLD)?travel:0;
}