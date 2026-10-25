/** REM-02A · DOM adapter contract. No changed curves, CSS, or gesture physics. */
import {MOTION_PROPERTY_OWNERS,type MotionOwner,type MotionProperty} from "../ui/motion-controller";
import {VIEWPORT_REVISION_EVENT,type ViewportSnapshot} from "../viewport/viewport-model";

export const PROFILE_MOTION_WRITER_TABLE={
 sheet:["sheet-scroll","elastic-sheet","parallax","blur","avatar","grab"],
 tabs:["tab-scroll","tab-ink"],hero:["hero-track"],
 browse:["browse-track","browse-underline"],
 route:["route-transform"]
} as const satisfies Record<MotionOwner,ReadonlyArray<MotionProperty>>;

/** One writer capability per property, per mounted profile/root. Controls
 * access to existing imperative paint functions; never triggers extra frames. */
export class MotionPropertyAuthority {
 private claimed=new Map<MotionProperty,MotionOwner>();
 private disposed=false;
 run(owner:MotionOwner,properties:ReadonlyArray<MotionProperty>,paint:()=>void):void{
  if(this.disposed)throw new Error("motion authority disposed");
  for(const property of properties){
   const expected:MotionOwner=MOTION_PROPERTY_OWNERS[property];
   if(expected!==owner||this.claimed.has(property)&&this.claimed.get(property)!==owner)
    throw new Error("conflicting motion writer for "+property);
  }
  for(const property of properties)this.claimed.set(property,owner);
  paint();
 }
 ownerOf(property:MotionProperty):MotionOwner|null{return this.claimed.get(property)??null;}
 dispose():void{this.disposed=true;this.claimed.clear();}
}
export function createProfileMotionAuthority():MotionPropertyAuthority{
 return new MotionPropertyAuthority();
}
/**
 * REM-01D viewport bridge: only new revisions are broadcast. Existing
 * live physics are NOT rebound in 02A; old settle coordinates are migrated in
 * REM-02B after corresponding touch anchor and animation endpoint tests.
 */
export function bindMotionViewport(
 target:Pick<Window,"addEventListener"|"removeEventListener">,
 onRevision:(revision:number,snapshot:ViewportSnapshot)=>void
):()=>void{
 let highest=-1,disposed=false;
 const changed:EventListener=(event:Event)=>{
  if(disposed)return;
  const snapshot=(event as CustomEvent<ViewportSnapshot>).detail;
  if(!snapshot||!Number.isSafeInteger(snapshot.revision)||snapshot.revision<=highest)return;
  highest=snapshot.revision;
  onRevision(highest,snapshot);
 };
 target.addEventListener(VIEWPORT_REVISION_EVENT,changed);
 return ()=>{disposed=true;target.removeEventListener(VIEWPORT_REVISION_EVENT,changed);};
}
