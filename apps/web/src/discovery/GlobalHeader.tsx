import {forwardRef,useImperativeHandle,useRef} from "react";
import {Bookmark,Moon,SlidersHorizontal,Sun} from "lucide-react";
import "./global-header.css";

const logo="/assets/brand/wordmark_original_raster_alpha_W06.webp";
export type HeaderMode="browse"|"profile";
export type HeaderMotion={
  setScrollTop:(top:number)=>void;
  setProfileProgress:(progress:number,dragging:boolean)=>void;
  reset:()=>void;
};
type Props={
  mode:HeaderMode;theme:"light"|"dark";onTheme:()=>void;
  onFilters:()=>void;onSaved:()=>void;
};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(p:number)=>p*p*(3-2*p);

export const GlobalHeader=forwardRef<HeaderMotion,Props>(function GlobalHeader(
 {mode,theme,onTheme,onFilters,onSaved},ref
){
 const host=useRef<HTMLElement>(null);
 const island=useRef<HTMLButtonElement>(null);
 const lastScroll=useRef(0);
 const manual=useRef(false);
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
  setProfileProgress:(progress:number,dragging:boolean)=>{
   if(mode!=="profile"||!host.current)return;
   const p=clamp(progress);
   host.current.setAttribute("data-profile-dragging",dragging?"true":"false");
   host.current.style.setProperty("--lh-contrast",String(p*.83));
  },
  reset:()=>{
   lastScroll.current=0;manual.current=false;
   host.current?.setAttribute("data-profile-dragging","false");
   host.current?.style.setProperty("--lh-contrast","0");
   if(host.current){host.current.style.setProperty("--lh-p","0");host.current.style.setProperty("--lh-impact","0");host.current.style.setProperty("--lh-control-opacity","1");host.current.style.setProperty("--lh-control-scale","1");host.current.style.setProperty("--lh-control-y","0px");host.current.style.setProperty("--lh-left-x","0px");host.current.style.setProperty("--lh-right-x","0px");host.current.style.setProperty("--lh-control-stretch","1");host.current.setAttribute("data-tools-merged","false");}
  }
 }),[mode]);
 const toggleIsland=()=>{
  if(mode==="profile")return;
  if(lastScroll.current<12)return;
  manual.current=!manual.current;paintTools(lastScroll.current);
 };
 return <header ref={host} className={"lh-header lh-"+mode} style={{"--lh-p":0,"--lh-impact":0} as React.CSSProperties}>
  
  <div className="lh-center">
   <button className="lh-island" type="button" ref={island} onClick={toggleIsland}
     aria-label={mode==="browse"?"Раскрыть инструменты LUEMI":"LUEMI"} title="LUEMI">
    <img src={logo} alt="luemi" decoding="sync" fetchPriority="high"/>
    {mode==="profile"&&<img src={logo} alt="" aria-hidden="true" className="lh-logo-contrast" decoding="sync"/>}
   </button>
   {mode==="profile"&&<button type="button" className="lh-profile-theme" onClick={onTheme}
      aria-label={theme==="light"?"Тёмная тема":"Светлая тема"}>
       {theme==="light"?<Moon size={15}/>:<Sun size={15}/>}
     </button>}
   {mode==="browse"&&<div className="lh-tools" aria-label="Инструменты LUEMI">
    <button type="button" className="lh-tool lh-tool-filter" onClick={onFilters} aria-label="Фильтры"><SlidersHorizontal size={17}/></button>
    <button type="button" className="lh-tool lh-tool-theme" onClick={onTheme} aria-label={theme==="light"?"Тёмная тема":"Светлая тема"}>{theme==="light"?<Moon size={17}/>:<Sun size={17}/>}</button>
    <button type="button" className="lh-tool lh-tool-saved" onClick={onSaved} aria-label="Сохранённые анкеты"><Bookmark size={17}/></button>
   </div>}
  </div>
 </header>;
});
