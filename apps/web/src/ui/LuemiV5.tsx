import {useState} from "react";
import type {ButtonHTMLAttributes,ComponentType,HTMLAttributes,ReactNode} from "react";
import type {LucideIcon} from "lucide-react";

export function LuemiGlassPanel({className="",...props}:HTMLAttributes<HTMLDivElement>){
 return <div className={`luemi-v5-glass ${className}`.trim()} data-static-glass="true" {...props}/>;
}

export function LuemiIconButton({label,className="",children,...props}:
 ButtonHTMLAttributes<HTMLButtonElement>&{label:string;children:ReactNode}){
 return <button type="button" className={`luemi-v5-icon-button ${className}`.trim()}
  aria-label={label} title={label} {...props}>{children}</button>;
}

export function LuemiAvatar({name,src,size="medium",activeBlik=false,className=""}:{
 name:string;src?:string|null;size?:"small"|"medium"|"large";activeBlik?:boolean;className?:string;
}){
 const [failedSrc,setFailedSrc]=useState<string|null>(null);
 const imageReady=!!src&&failedSrc!==src;
 return <span className={`luemi-v5-avatar is-${size}${activeBlik?" has-blik":""} ${className}`.trim()}>
  {imageReady?<img src={src} alt="" loading="lazy" decoding="async" onError={()=>setFailedSrc(src)}/>:
   <span aria-hidden="true">{name.trim().slice(0,1).toUpperCase()||"L"}</span>}
 </span>;
}

export function LuemiEmptyState({icon:Icon,title,description,children,className=""}:{
 icon:LucideIcon;title:string;description:string;children?:ReactNode;className?:string;
}){
 return <div className={`luemi-v5-empty ${className}`.trim()}>
  <span className="luemi-v5-empty-mark" aria-hidden="true"><Icon size={30} strokeWidth={1.45}/></span>
  <h3>{title}</h3><p>{description}</p>{children}
 </div>;
}

export function LuemiSkeleton({lines=2,className=""}:{lines?:number;className?:string}){
 return <div className={`luemi-v5-skeleton ${className}`.trim()} role="status" aria-label="Загрузка">
  <span className="luemi-v5-skeleton-avatar" aria-hidden="true"/>
  <span className="luemi-v5-skeleton-copy" aria-hidden="true">
   {Array.from({length:Math.max(1,lines)},(_,index)=><span key={index}/>) }
  </span>
 </div>;
}

export function LuemiSegmentedTabs<T extends string>({items,value,onChange,label,className=""}:{
 items:ReadonlyArray<{id:T;label:string;disabled?:boolean;hint?:string}>;value:T;
 onChange:(id:T)=>void;label:string;className?:string;
}){
 return <div className={`luemi-v5-segments ${className}`.trim()} role="tablist" aria-label={label}>
  {items.map(item=><button key={item.id} type="button" role="tab"
   aria-selected={value===item.id} disabled={item.disabled} title={item.hint}
   className={value===item.id?"active":""} onClick={()=>onChange(item.id)}>{item.label}</button>)}
 </div>;
}

export function LuemiBottomNavigation<T extends string>({items,value,onChange,counts}:{
 items:ReadonlyArray<{id:T;label:string;icon:ComponentType;countLabel?:string}>;value:T;
 onChange:(id:T)=>void;counts?:Partial<Record<T,number>>;
}){
 return <nav className={`discovery-bottom-nav luemi-v5-bottom-nav`} aria-label="Главная навигация LUEMI">
  {items.map(({id,label,icon:Icon,countLabel})=>{
   const count=counts?.[id]??0;
   return <button type="button" key={id}
   className={`discovery-nav-item${value===id?" active":""}`}
   aria-label={label} aria-current={value===id?"page":undefined} aria-description={count>0&&countLabel?`${countLabel}: ${count}`:undefined}
   onClick={()=>onChange(id)}>
   <span className="luemi-nav-glyph" aria-hidden="true"><Icon/>
    {count>0&&<b className="luemi-nav-badge">{count>99?"99+":count}</b>}
   </span>
   <span className="luemi-nav-label">{label}</span>
  </button>;})}
 </nav>;
}
