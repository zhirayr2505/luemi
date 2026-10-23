import {useLayoutEffect,useRef,type RefObject} from "react";

/** REM-04D LU-34: one owner for DOM modal focus, background isolation and body lock.
 * Layers can be nested in React or rendered through a body portal; we isolate
 * DOM siblings along the actual ancestor path, never an ancestor of the top portal.
 */
type Layer={id:symbol;root:HTMLElement;trigger:HTMLElement|null;escape:()=>void};
const stack:Layer[]=[];
const prior=new Map<HTMLElement,{inert:boolean;aria:string|null}>();
let previousOverflow:string|null=null;
const query='button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';
const isVisible=(element:HTMLElement):boolean=>{
 if(!element.isConnected||element.closest('[inert],[hidden],[aria-hidden="true"]'))return false;
 if(element.getClientRects().length===0)return false;
 const style=getComputedStyle(element);
 return style.visibility!=="hidden"&&style.display!=="none";
};
const candidates=(root:HTMLElement)=>[...root.querySelectorAll<HTMLElement>(query)]
 .filter(element=>isVisible(element)&&element.getAttribute("aria-disabled")!=="true");
const focusSafe=(node:HTMLElement|null|undefined)=>{
 if(node&&isVisible(node)){node.focus({preventScroll:true});return document.activeElement===node;}
 return false;
};
const focusTop=()=>{
 const root=stack[stack.length-1]?.root;
 if(!root)return;
 const preferred=root.querySelector<HTMLElement>("[data-modal-initial]");
 if(focusSafe(preferred))return;
 if(focusSafe(candidates(root)[0]))return;
 focusSafe(root);
};
const restoreOwned=()=>{
 for(const [element,old] of prior){
  element.inert=old.inert;
  if(old.aria===null)element.removeAttribute("aria-hidden");
  else element.setAttribute("aria-hidden",old.aria);
 }
 prior.clear();
};
const synchronize=()=>{
 restoreOwned();
 const top=stack[stack.length-1];
 if(!top)return;
 // Walk the ACTUAL DOM parents: a portalled PhotoViewer stays available even
 // when the application tree under #root is isolated.
 let child:HTMLElement=top.root;
 while(child.parentElement){
  const parent=child.parentElement;
  for(const sibling of Array.from(parent.children)){
   if(!(sibling instanceof HTMLElement)||sibling===child||sibling.tagName==="SCRIPT"||
     sibling.tagName==="STYLE")continue;
   prior.set(sibling,{inert:sibling.inert,aria:sibling.getAttribute("aria-hidden")});
   sibling.inert=true;
   sibling.setAttribute("aria-hidden","true");
  }
  if(parent===document.body)break;
  child=parent;
 }
};
const onKey=(event:KeyboardEvent)=>{
 const top=stack[stack.length-1];
 if(!top)return;
 if(event.key==="Escape"){
  event.preventDefault();event.stopImmediatePropagation();top.escape();return;
 }
 if(event.key!=="Tab")return;
 const items=candidates(top.root);
 if(!items.length){event.preventDefault();focusSafe(top.root);return;}
 const active=document.activeElement;
 const first=items[0],last=items[items.length-1];
 if(!top.root.contains(active)){
  event.preventDefault();focusSafe(event.shiftKey?last:first);return;
 }
 if(event.shiftKey&&active===first){event.preventDefault();focusSafe(last);}
 else if(!event.shiftKey&&active===last){event.preventDefault();focusSafe(first);}
};
const onFocus=(event:FocusEvent)=>{
 const top=stack[stack.length-1];
 if(top&&!top.root.contains(event.target as Node))focusTop();
};
const activate=(layer:Layer)=>{
 if(!stack.length){
  previousOverflow=document.body.style.overflow;
  document.body.style.overflow="hidden";
  document.addEventListener("keydown",onKey,true);
  document.addEventListener("focusin",onFocus,true);
 }
 stack.push(layer);synchronize();focusTop();
};
const deactivate=(id:symbol)=>{
 const index=stack.findIndex(layer=>layer.id===id);
 if(index<0)return;
 const wasTop=index===stack.length-1,removed=stack[index];
 stack.splice(index,1);
 synchronize();
 if(!stack.length){
  document.removeEventListener("keydown",onKey,true);
  document.removeEventListener("focusin",onFocus,true);
  if(previousOverflow!==null)document.body.style.overflow=previousOverflow;
  previousOverflow=null;
 }
 if(!wasTop)return;
 if(focusSafe(removed.trigger))return;
 if(stack.length)focusTop();
 else{
  const fallback=document.querySelector<HTMLElement>(
   '.discovery-top-tabs button.active,.discovery-bottom-nav button.active,.pm-tab.active');
  focusSafe(fallback);
 }
};

/** Registers only while active; no global keyboard listeners when no modal exists.
 * Escape callback is live across renders, registration remains stable.
 */
export function useModalLayer(active:boolean,root:RefObject<HTMLElement|null>,onEscape:()=>void){
 const escapeRef=useRef(onEscape);escapeRef.current=onEscape;
 useLayoutEffect(()=>{
  if(!active||!root.current)return;
  const id=Symbol("luemi-modal");
  const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
  activate({id,root:root.current,trigger,escape:()=>escapeRef.current()});
  return ()=>deactivate(id);
 },[active,root]);
}
export function isTopModal(root:HTMLElement|null){
 return !!root&&stack[stack.length-1]?.root===root;
}
