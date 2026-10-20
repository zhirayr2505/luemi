import {forwardRef,useImperativeHandle,useRef} from "react";
import {ArrowLeft,Bookmark,Moon,SlidersHorizontal,Sun} from "lucide-react";
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
  onFilters:()=>void;onSaved:()=>void;onBack?:()=>void;
  name?:string;location?:string;
};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(p:number)=>p*p*(3-2*p);

export const GlobalHeader=forwardRef<HeaderMotion,Props>(function GlobalHeader(
 {mode,theme,onTheme,onFilters,onSaved,onBack,name,location},ref
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
  setProfileMorph:(progress:number,heroRect:DOMRect,scrollTop:number,photo:string|null)=>{
   if(mode!=="profile")return;
   const node=droplet.current,img=portrait.current,target=island.current,root=host.current;
   if(!node||!img||!target||!root)return;
   const p=clamp(progress),e=1-Math.pow(1-p,1.65);
   const compact=smooth(clamp((p-.26)/.52));
   root.style.setProperty("--lh-compact",String(compact));
   root.style.setProperty("--lh-text-x",(-8*(1-compact))+"px");
   const impulse=Math.exp(-Math.pow((p-.87)/.095,2))*.057;
   root.style.setProperty("--lh-impact",String(impulse));
   if(!photo||p<.008||p>=1){node.style.opacity="0";return;}
   if(imageSrc.current!==photo){img.src=photo;imageSrc.current=photo;}
   // Source is measured in viewport coordinates and restored to its
   // unscrolled origin; the shared element lives outside the clipping scroll.
   const x0=heroRect.left,y0=heroRect.top+scrollTop;
   const w0=heroRect.width,h0=heroRect.height;
   const goal=target.getBoundingClientRect();
   const goalX=goal.left+goal.width*.5-9,goalY=goal.top+goal.height*.5-9;
   const x=x0+(goalX-x0)*e,y=y0+(goalY-y0)*e;
   const w=w0+(18-w0)*e,h=h0+(18-h0)*e;
   node.style.width=w0+"px";node.style.height=h0+"px";
   node.style.transform=`translate3d(${x}px,${y}px,0) scale(${w/Math.max(w0,1)},${h/Math.max(h0,1)})`;
   // Oval, continuously rounded liquid silhouette. Never render an
   // intermediate square and never move the actual brand wordmark.
   const radiusX=(25/Math.max(w0,1)*100)*(1-e)+50*e;
   const radiusY=(25/Math.max(h0,1)*100)*(1-e)+50*e;
   node.style.borderRadius=`${radiusX}% ${radiusX*.93}% ${radiusX}% ${radiusX*.89}% / ${radiusY*.92}% ${radiusY}% ${radiusY*.9}% ${radiusY}%`;
   node.style.opacity=String(clamp((p-.008)/.045)*clamp((1-p)/.105));
  },
  reset:()=>{
   lastScroll.current=0;manual.current=false;
   if(host.current){host.current.style.setProperty("--lh-p","0");host.current.style.setProperty("--lh-compact","0");host.current.style.setProperty("--lh-impact","0");host.current.style.setProperty("--lh-text-x","-8px");host.current.style.setProperty("--lh-control-opacity","1");host.current.style.setProperty("--lh-control-scale","1");host.current.style.setProperty("--lh-control-y","0px");host.current.style.setProperty("--lh-left-x","0px");host.current.style.setProperty("--lh-right-x","0px");host.current.style.setProperty("--lh-control-stretch","1");host.current.setAttribute("data-tools-merged","false");}
   if(droplet.current)droplet.current.style.opacity="0";
  }
 }),[mode]);
 const toggleIsland=()=>{
  if(mode==="profile")return;
  if(lastScroll.current<12)return;
  manual.current=!manual.current;paintTools(lastScroll.current);
 };
 return <header ref={host} className={"lh-header lh-"+mode} style={{"--lh-p":0,"--lh-compact":0,"--lh-impact":0} as React.CSSProperties}>
  {mode==="profile"&&onBack&&<button className="lh-back" type="button" onClick={onBack} aria-label="Назад"><ArrowLeft size={19}/></button>}
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
