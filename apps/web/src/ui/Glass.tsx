import type {ReactNode,ComponentPropsWithRef} from "react";
import {Check,ArrowLeft,ArrowRight} from "lucide-react";
export function GlassField({label,children,hint}:{label:string;children:ReactNode;hint?:string}){
 return <label className="glass-field"><span className="glass-field-label">{label}</span>{children}{hint&&<small>{hint}</small>}</label>;
}
export function GlassCheckbox({checked,onChange,children}:{checked:boolean;onChange:(v:boolean)=>void;children:ReactNode}){
 return <label className="glass-check">
   <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/>
   <span className="glass-check-indicator" aria-hidden="true"><Check size={15} strokeWidth={3}/></span>
   <span className="glass-check-copy">{children}</span>
 </label>;
}
export function GlassChoice({chosen,onClick,children,icon}:{chosen:boolean;onClick:()=>void;children:ReactNode;icon?:ReactNode}){
 return <button type="button" className={"glass-choice"+(chosen?" selected":"")} aria-pressed={chosen} onClick={onClick}>{icon}{children}</button>;
}
export function GlassArrow({forward=false,disabled=false,onClick}:{forward?:boolean;disabled?:boolean;onClick:()=>void}){
 return <button type="button" className={"nav-circle"+(forward?" forward":"")} aria-label={forward?"Далее":"Назад"} disabled={disabled} onClick={onClick}>
   {forward?<ArrowRight size={26} strokeWidth={1.9}/>:<ArrowLeft size={26} strokeWidth={1.9}/>}
 </button>;
}
export function GlassTextInput(props:ComponentPropsWithRef<"input">){
 return <input {...props} className={"glass-control "+(props.className??"")}/>;
}
