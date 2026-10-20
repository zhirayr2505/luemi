import {forwardRef,useImperativeHandle,useRef} from "react";
import {Bookmark,Moon,SlidersHorizontal,Sun} from "lucide-react";
import "./global-header.css";

const logo="/assets/brand/wordmark_original_raster_alpha_W06.webp";
export type HeaderMode="browse"|"profile";
export type HeaderMotion={
  setScrollTop:(top:number)=>void;
  setProfileMorph:(progress:number,heroRect:DOMRect,scrollTop:number,photo:string|null)=>void;
  reset:()=>void;
};
type Props={
  mode:HeaderMode;theme:"light"|"dark";onTheme:()=>void;
  onFilters:()=>void;onSaved:()=>void;
  name?:string;location?:string;
};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(p:number)=>p*p*(3-2*p);

export const GlobalHeader=forwardRef<HeaderMotion,Props>(function GlobalHeader(
 {mode,theme,onTheme,onFilters,onSaved,name,location},ref
){
 const host=useRef<HTMLElement>(null);
 const island=useRef<HTMLButtonElement>(null);
 const droplet=useRef<HTMLDivElement>(null);
 const portrait=useRef<HTMLImageElement>(null);
 const lastScroll=useRef(0);
 const manual=useRef(false);
 const imageSrc=useRef("");
 const paintTools=(top:number)=>{
  if(mode==="profile")return;
  const p=smooth(clamp(top/105));
  const v=manual.current?0:p,el=host.current;
  el?.style.setProperty("--lh-p",String(v));
  el?.style.setProperty("--lh-control-opacity",String(1-v));
  el?.style.setProperty("--lh-control-scale",String(1-.84*v));
  el?.style.setProperty("--lh-control-y",(-31*v)+"px");
  el?.style.setProperty("--lh-left-x",(38*v)+"px");
  el?.style.setProperty("--lh-right-x",(-38*v)+"px");
  el?.style.setProperty("--lh-control-stretch",String(1+.24*Math.sin(Math.PI*v)));
  el?.style.setProperty("--lh-impact",String(.036*Math.sin(Math.PI*clamp((v-.66)/.34))));
  host.current?.setAttribute("data-tools-merged",!manual.current&&p>.96?"true":"false");
 };
 useImperativeHandle(ref,()=>({
  setScrollTop:(top:number)=>{
   if(Math.abs(top-lastScroll.current)>.5)manual.current=false;
   lastScroll.current=top;paintTools(top);
  },
  setProfileMorph:(progress:number,heroRect:DOMRect,_scrollTop:number,photo:string|null)=>{
   if(mode!=="profile")return;
   const root=host.current,target=island.current,node=droplet.current,img=portrait.current;
   if(!root||!target||!node||!img)return;
   const p=clamp(progress);
   const compact=smooth(clamp((p-.55)/.33));
   const goal=target.getBoundingClientRect();
   root.style.setProperty("--lh-compact",String(compact));
   root.style.setProperty("--lh-text-x",(-9*(1-compact))+"px");
   // A temporary soft halo, never a permanent pill surrounding the logo.
   const impact=Math.exp(-Math.pow((p-.88)/.075,2));
   root.style.setProperty("--lh-glow",String(impact*.88));
   root.style.setProperty("--lh-impact",String(impact*.035));
   if(!photo||p<=.46||p>=.995){
     node.style.opacity="0";
     return;
   }
   if(imageSrc.current!==photo){img.src=photo;imageSrc.current=photo;}
   // An intentionally SMALL crop of the original photo forms the droplet.
   // The hero itself stays fully visible and scrolls naturally; there is no
   // duplicate full-size rectangle and no empty gradient beneath the morph.
   // A tapered 46px liquid fragment, never a freestanding 78px avatar.
   // Its tip points towards the stationary LUEMI mark.
   const t=smooth(clamp((p-.46)/.48));
   const diameter=46*(1-t)+3*t;
   const sourceX=heroRect.left+heroRect.width/2;
   const sourceY=Math.max(goal.bottom+38,Math.min(heroRect.top+heroRect.height*.57,heroRect.bottom-32));
   const targetX=goal.left+goal.width/2,targetY=goal.top+goal.height/2;
   const left=sourceX*(1-t)+targetX*t-diameter/2;
   const top=sourceY*(1-t)+targetY*t-diameter/2;
   node.style.transform=`translate3d(${left}px,${top}px,0) rotate(-45deg) scaleY(${1+.28*Math.sin(Math.PI*t)}) scale(${diameter/46})`;
   // Transform-based scaling avoids recomputing a layer's width/height on scroll.
   node.style.borderRadius="70% 7% 70% 70% / 72% 7% 72% 72%";
   const appear=smooth(clamp((p-.46)/.07));
   const vanish=1-smooth(clamp((p-.80)/.14));
   node.style.opacity=String(appear*vanish);
  },
  reset:()=>{
   lastScroll.current=0;manual.current=false;
   if(host.current){host.current.style.setProperty("--lh-p","0");host.current.style.setProperty("--lh-compact","0");host.current.style.setProperty("--lh-impact","0");host.current.style.setProperty("--lh-glow","0");host.current.style.setProperty("--lh-text-x","-8px");host.current.style.setProperty("--lh-control-opacity","1");host.current.style.setProperty("--lh-control-scale","1");host.current.style.setProperty("--lh-control-y","0px");host.current.style.setProperty("--lh-left-x","0px");host.current.style.setProperty("--lh-right-x","0px");host.current.style.setProperty("--lh-control-stretch","1");host.current.setAttribute("data-tools-merged","false");}
   if(droplet.current)droplet.current.style.opacity="0";
  }
 }),[mode]);
 const toggleIsland=()=>{
  if(mode==="profile")return;
  if(lastScroll.current<12)return;
  manual.current=!manual.current;paintTools(lastScroll.current);
 };
 return <header ref={host} className={"lh-header lh-"+mode} style={{"--lh-p":0,"--lh-compact":0,"--lh-impact":0} as React.CSSProperties}>
  
  <div className="lh-center">
   <button className="lh-island" type="button" ref={island} onClick={toggleIsland}
     aria-label={mode==="browse"?"Раскрыть инструменты LUEMI":"LUEMI"} title="LUEMI">
    <img src={logo} alt="luemi" decoding="sync" fetchPriority="high"/>
   </button>
   {mode==="browse"&&<div className="lh-tools" aria-label="Инструменты LUEMI">
    <button type="button" className="lh-tool lh-tool-filter" onClick={onFilters} aria-label="Фильтры"><SlidersHorizontal size={17}/></button>
    <button type="button" className="lh-tool lh-tool-theme" onClick={onTheme} aria-label={theme==="light"?"Тёмная тема":"Светлая тема"}>{theme==="light"?<Moon size={17}/>:<Sun size={17}/>}</button>
    <button type="button" className="lh-tool lh-tool-saved" onClick={onSaved} aria-label="Сохранённые анкеты"><Bookmark size={17}/></button>
   </div>}
  </div>
  {mode==="profile"&&<>
   <div className="lh-profile-info" aria-label="Сведения профиля">
    <strong>{name||"Профиль"}</strong><small>{location||"Местоположение не указано"}</small>
   </div>
   <button type="button" className="lh-profile-theme" onClick={onTheme} aria-label={theme==="light"?"Тёмная тема":"Светлая тема"}>{theme==="light"?<Moon size={16}/>:<Sun size={16}/>}</button>
  </>}
  <div ref={droplet} className="lh-droplet" aria-hidden="true"><img ref={portrait} alt="" draggable={false}/></div>
 </header>;
});
