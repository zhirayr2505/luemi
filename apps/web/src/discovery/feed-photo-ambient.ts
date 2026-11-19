/** LUEMI feed ambience.
 * One global, non-interactive backdrop outside the photo card. Both layers
 * reuse the authenticated photo URL; they never move with the carousel.
 * Pointer updates only opacity via DOM styles (zero React renders / gesture).
 */
type AmbientState={
 current:string; next:string; timer:number|null; generation:number;
};
const states=new WeakMap<HTMLElement,AmbientState>();
const photoUrl=(src:string)=>"url("+JSON.stringify(src)+")";
function layers(host:HTMLElement|null){
 const root=host?.closest<HTMLElement>(".real-discovery-home");
 if(!root)return null;
 const ambient=root.querySelector<HTMLElement>(".discovery-photo-ambient");
 const current=ambient?.querySelector<HTMLElement>(".discovery-photo-ambient-current");
 const next=ambient?.querySelector<HTMLElement>(".discovery-photo-ambient-next");
 if(!ambient||!current||!next)return null;
 let state=states.get(ambient);
 if(!state){state={current:"",next:"",timer:null,generation:0};states.set(ambient,state);}
 return {ambient,current,next,state};
}
function cancel(state:AmbientState){
 state.generation++;
 if(state.timer!==null){window.clearTimeout(state.timer);state.timer=null;}
}
function resetOverlay(ambient:HTMLElement,next:HTMLElement,state:AmbientState){
 next.style.transition="none";next.style.opacity="0";next.style.backgroundImage="none";
 state.next="";ambient.dataset.isScrubbing="false";
}
function setBase(current:HTMLElement,state:AmbientState,src:string){
 if(state.current===src)return;
 current.style.backgroundImage=src?photoUrl(src):"none";
 state.current=src;
}
function settleTimer(
 l:NonNullable<ReturnType<typeof layers>>,duration:number,accepted:boolean,target:string
){
 const {ambient,current,next,state}=l;
 const gen=state.generation;
 state.timer=window.setTimeout(()=>{
  if(state.generation!==gen)return;
  state.timer=null;
  if(accepted)setBase(current,state,target);
  resetOverlay(ambient,next,state);
 },duration+38);
}
/** A newly active profile gently replaces the old profile's global backdrop. */
export function activateFeedAmbient(host:HTMLElement|null,src:string){
 if(!src)return;
 const l=layers(host);if(!l)return;
 const {ambient,current,next,state}=l;
 if(src===state.current&&!state.next)return;
 cancel(state);
 if(!state.current){setBase(current,state,src);resetOverlay(ambient,next,state);return;}
 // An interrupted transition resolves to its dominant visible layer first.
 if(state.next&&Number(next.style.opacity)>.5)setBase(current,state,state.next);
 resetOverlay(ambient,next,state);
 if(src===state.current)return;
 state.next=src;next.style.backgroundImage=photoUrl(src);
 next.style.transition="none";next.style.opacity="0";
 void next.offsetWidth;
 const duration=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches?0:390;
 next.style.transition="opacity "+duration+"ms ease-in-out";
 next.style.opacity="1";
 settleTimer(l,duration,true,src);
}
/** Crossfade proportional to the real finger displacement: no translation. */
export function scrubFeedAmbient(host:HTMLElement|null,from:string,to:string,progress:number){
 const l=layers(host);if(!l||!from||!to||from===to)return;
 const {ambient,current,next,state}=l;
 cancel(state);
 setBase(current,state,from);
 if(state.next!==to){
  state.next=to;
  next.style.backgroundImage=photoUrl(to);
 }
 const p=Math.max(0,Math.min(1,progress));
 next.style.transition="none";
 next.style.opacity=String(p);
 ambient.dataset.isScrubbing="true";
}
/** Continue from the exact drag opacity on release, or dissolve back on cancel. */
export function settleFeedAmbient(
 host:HTMLElement|null,from:string,to:string,advance:boolean,progress:number
){
 const l=layers(host);if(!l)return;
 const {ambient,current,next,state}=l;
 if(!from||!to||from===to){if(from)activateFeedAmbient(host,from);return;}
 const p=Math.max(0,Math.min(1,progress));
 cancel(state);
 setBase(current,state,from);
 if(state.next!==to){state.next=to;next.style.backgroundImage=photoUrl(to);}
 next.style.transition="none";next.style.opacity=String(p);
 ambient.dataset.isScrubbing="false";
 void next.offsetWidth;
 const distance=Math.abs((advance?1:0)-p);
 const duration=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches?
  0:Math.max(120,Math.round(310*distance));
 next.style.transition="opacity "+duration+"ms cubic-bezier(.22,.77,.23,1)";
 next.style.opacity=advance?"1":"0";
 settleTimer(l,duration,advance,to);
}
/** Clear only on a route reset; no unmount of a queued card can clear it. */
export function clearFeedAmbient(host:HTMLElement|null){
 const l=layers(host);if(!l)return;
 const {ambient,current,next,state}=l;cancel(state);
 setBase(current,state,"");resetOverlay(ambient,next,state);
}
