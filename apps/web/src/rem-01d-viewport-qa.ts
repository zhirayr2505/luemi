/** Isolated actual production viewport controller + actual onboarding flex CSS.
 * The TEST host emulates Telegram and VisualViewport; not a real device. */
import {installViewportController} from "./viewport/viewport-controller";
import type {Insets,ViewportSnapshot} from "./viewport/viewport-model";
import "./styles.css";
type Handler=(event?:{isStateStable?:boolean})=>void;
const callbacks=new Map<string,Set<Handler>>();
const listeners=(key:string)=>{let set=callbacks.get(key);if(!set){set=new Set();callbacks.set(key,set);}return set;};
const telegram={
 viewportHeight:800,viewportStableHeight:800,
 safeAreaInset:{top:0,right:0,bottom:0,left:0} as Insets,
 contentSafeAreaInset:{top:0,right:0,bottom:0,left:0} as Insets,
 onEvent:(name:string,fn:Handler)=>listeners(name).add(fn),
 offEvent:(name:string,fn:Handler)=>listeners(name).delete(fn)
};
const shell=document.querySelector<HTMLElement>("#viewport-shell")!;
const vv=window.visualViewport;
const nativeHeight=vv?Object.getOwnPropertyDescriptor(Object.getPrototypeOf(vv),"height")?.get:null;
const nativeOffset=vv?Object.getOwnPropertyDescriptor(Object.getPrototypeOf(vv),"offsetTop")?.get:null;
let overrideHeight:number|null=null,overrideTop:number|null=null;
if(vv){
 Object.defineProperty(vv,"height",{configurable:true,get:()=>overrideHeight??nativeHeight?.call(vv)??innerHeight});
 Object.defineProperty(vv,"offsetTop",{configurable:true,get:()=>overrideTop??nativeOffset?.call(vv)??0});
}
const controller=installViewportController(shell,()=>telegram);
function emit(name:string,payload?:{isStateStable?:boolean}){
 for(const fn of callbacks.get(name)??[])fn(payload);
}
declare global{interface Window{__REM01D_QA__?:{
  telegram:typeof telegram;
  emit:typeof emit;visual:(height:number|null,top?:number|null)=>void;
  snapshot:()=>ViewportSnapshot|null;
  dispose:()=>void;
  listeners:()=>number;
 }}}
window.__REM01D_QA__={
 telegram,emit,
 visual(height,top=null){
  overrideHeight=height;overrideTop=top;
  vv?.dispatchEvent(new Event("resize"));
  if(top!==null)vv?.dispatchEvent(new Event("scroll"));
 },
 snapshot:()=>controller.snapshot(),
 dispose:()=>controller.dispose(),
 listeners:()=>Array.from(callbacks.values()).reduce((a,v)=>a+v.size,0)
};
