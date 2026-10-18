import {createContext,useContext,useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {AnimationBatch,SLIDE_DURATION,SLIDE_EASING,slideDirection,slideFrames} from './slide';
const ReducedMotion=createContext(false);
export function MotionProvider({reduced,children}:{reduced:boolean;children:ReactNode}){
 const [system,setSystem]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setSystem(m.matches);m.addEventListener('change',change);return()=>m.removeEventListener('change',change);},[]);
 return <ReducedMotion.Provider value={reduced||system}>{children}</ReducedMotion.Provider>;
}
/** Keeps visited pages mounted: photo index, filters, forms and scroll survive tab changes. */
export function SlideDeck({active,order,pages,className='',flow=false}:{active:string;order:readonly string[];pages:Record<string,ReactNode>;className?:string;flow?:boolean}){
 const reduced=useContext(ReducedMotion),elements=useRef(new Map<string,HTMLDivElement>()),last=useRef(active),batch=useRef(new AnimationBatch());
 const [visited,setVisited]=useState([active]);
 if(!visited.includes(active))setVisited([...visited,active]);
 useLayoutEffect(()=>{
  const previous=last.current;const from=elements.current.get(previous),to=elements.current.get(active);if(!to)return;
  // Capture the current offset before cancelling. A third tab must start next to
  // the departing pane, not at a separate fixed offset that would overlap it.
  const viewport=to.parentElement!;
  const viewportRect=viewport.getBoundingClientRect();
  const fromOffset=from?from.getBoundingClientRect().left-viewportRect.left:0;
  batch.current.cancel();last.current=active;
  for(const [key,node] of elements.current){node.dataset.visible=String(key===active||key===previous);node.style.willChange='';node.style.transform='';}
  const settle=()=>{for(const [key,node] of elements.current){node.dataset.visible=String(key===active);node.style.transform='';node.style.willChange='';}};
  const focus=document.activeElement;if(from&&focus instanceof HTMLElement&&from.contains(focus))focus.blur();
  if(reduced||previous===active||!from||!viewportRect.width||typeof to.animate!=='function'){settle();return;}
  const direction=slideDirection(previous,active,order);
  from.style.willChange='transform';to.style.willChange='transform';
  const options:KeyframeAnimationOptions={duration:SLIDE_DURATION,easing:SLIDE_EASING,fill:'both'};
  const frames=slideFrames(direction,viewportRect.width,fromOffset);
  const outgoing=from.animate(frames.outgoing,options);
  const incoming=to.animate(frames.incoming,options);
  batch.current.run([outgoing,incoming],settle);
  // Pixel offsets are valid only for this viewport width (rotation / resizing).
  const resize=new ResizeObserver(()=>{if(viewport.getBoundingClientRect().width!==viewportRect.width){batch.current.cancel();settle();}});
  resize.observe(viewport);
  return()=>resize.disconnect();
 },[active,reduced,order]);
 useEffect(()=>()=>batch.current.cancel(),[]);
 return <div className={`slide-deck ${flow?'slide-deck--flow':''} ${className}`}>{visited.map(key=><div key={key} className="slide-pane" data-page={key} aria-hidden={key!==active} inert={key!==active} ref={el=>{if(el)elements.current.set(key,el);else elements.current.delete(key);}}>{pages[key]}</div>)}</div>;
}
/** Animated replacement for small nested tab contents using the same engine. */
export function SlideSwap({active,order,children,className='',flow=true}:{active:string;order:readonly string[];children:ReactNode;className?:string;flow?:boolean}){
 const cache=useRef<Record<string,ReactNode>>({});cache.current[active]=children;
 return <SlideDeck active={active} order={order} pages={cache.current} className={className} flow={flow}/>;
}