/** Static geometry from one viewport snapshot, no reads in RAF. */
export type MorphGeometry={
 width:number;height:number;compactTop:number;expandedTop:number;span:number;
 avatarX:number;avatarY:number;avatarSize:number;heroHeight:number;
};
export const between=(a:number,b:number,p:number)=>a+(b-a)*p;
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export function profileMorphGeometry(width:number,height:number,chromeBottom=86):MorphGeometry{
 const w=Math.max(280,width),h=Math.max(410,height);
 const avatarSize=clamp(w*.285,88,116);
 const avatarY=clamp(chromeBottom+24,92,160);
 const compactTop=clamp(Math.max(avatarY+avatarSize+24,h*.355),235,Math.max(235,h-220));
 const expandedTop=clamp(h*.68,compactTop+120,Math.max(compactTop+120,h-138));
 return {width:w,height:h,compactTop,expandedTop,
  span:Math.max(1,expandedTop-compactTop),avatarX:20,avatarY,avatarSize,
  heroHeight:expandedTop};
}
export function morphFrame(g:MorphGeometry,p:number){
 const progress=clamp(p,0,1);
 const scaleX=between(g.avatarSize/g.width,1,progress);
 const scaleY=between(g.avatarSize/g.heroHeight,1,progress);
 return {sheetY:g.span*progress,
  photoX:between(g.avatarX,0,progress),photoY:between(g.avatarY,0,progress),
  scaleX,scaleY,radius:between(50,0,progress),compactAlpha:clamp((.55-progress)/.35,0,1),
  expandedAlpha:clamp((progress-.42)/.38,0,1)};
}
