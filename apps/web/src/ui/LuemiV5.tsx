import type {ButtonHTMLAttributes,HTMLAttributes,ReactNode} from "react";
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
 return <span className={`luemi-v5-avatar is-${size}${activeBlik?" has-blik":""} ${className}`.trim()}>
  {src?<img src={src} alt="" loading="lazy" decoding="async"/>:<span aria-hidden="true">{name.trim().slice(0,1).toUpperCase()||"L"}</span>}
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

export function LuemiBottomNavigation<T extends string>({items,value,onChange,className=""}:{
 items:ReadonlyArray<{id:T;label:string;icon:LucideIcon}>;value:T;onChange:(id:T)=>void;className?:string;
}){
 return <nav className={`discovery-bottom-nav luemi-v5-bottom-nav ${className}`.trim()} aria-label="Главная навигация LUEMI">
  {items.map(item=>{const Icon=item.icon;return <button type="button" key={item.id}
   className={`discovery-nav-item${value===item.id?" active":""}`}
   aria-current={value===item.id?"page":undefined} onClick={()=>onChange(item.id)}>
   <Icon size={22} strokeWidth={1.75}/><span>{item.label}</span></button>;})}
 </nav>;
}
