/** LUEMI single-image photo morph. Pure geometry shared by runtime and tests. */
export const PROFILE_AVATAR_SIZE = 56;
export const PROFILE_HERO_RADIUS = 27;
export const SNAP_CLOSE_THRESHOLD = .30;
export const SNAP_OPEN_THRESHOLD = .70;
export function clamp01(n:number){return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;}
export function morphTravel(stageWidth:number){return Number.isFinite(stageWidth)&&stageWidth>0?Math.min(325,Math.max(220,stageWidth*.78)):220;}
export function morphProgress(scrollY:number,stageWidth:number){return clamp01(scrollY/morphTravel(stageWidth));}
export function morphFrame(scrollY:number,stageWidth:number){
 const width=Number.isFinite(stageWidth)&&stageWidth>0?stageWidth:PROFILE_AVATAR_SIZE;
 const progress=morphProgress(scrollY,stageWidth);
 // Ease out at the compact end. Shrinking ahead of normal-flow content
 // guarantees that the photograph never covers the first About card.
 const eased=progress*(2-progress);
 const scale=1+(PROFILE_AVATAR_SIZE/Math.max(PROFILE_AVATAR_SIZE,width)-1)*eased;
 return {progress,eased,scale,x:7*eased,translateY:Number.isFinite(scrollY)?Math.max(0,scrollY):0,
  radius:PROFILE_HERO_RADIUS+(width/2-PROFILE_HERO_RADIUS)*eased,
  heroOpacity:clamp01(1-progress*4),compactOpacity:clamp01((progress-.54)/.3),
  rimSourceWidth:1.45/Math.max(scale,.12)};
}
/** null means: reader is exploring content BELOW the collapsed header. */
export function snapTarget(y:number,width:number,wasCollapsed:boolean,velocity=0):number|null{
 const travel=morphTravel(width),pos=clamp01(y/travel);
 if(y>travel+20)return null;
 if(y<=1)return 0;
 // A quick intentional flick trumps distance only after a meaningful 18px drag.
 if(Math.abs(velocity)>.55&&y>18&&y<travel-18)return velocity>0?travel:0;
 return pos>=(wasCollapsed?SNAP_OPEN_THRESHOLD:SNAP_CLOSE_THRESHOLD)?travel:0;
}