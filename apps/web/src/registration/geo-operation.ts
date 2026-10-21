/** One logical generation owns search, GPS callbacks and reverse geocoding.
 * Browser Geolocation is not abortable, so stale callbacks are checked by token.
 * Safe to use without React and test with controlled async completions. */
export type GeoOperation="idle"|"searching"|"locating"|"resolving"|"success"|"error"|"cancelled";
export interface GeoOperationGate{
 begin:()=>number;isCurrent:(token:number)=>boolean;
 attach:(token:number)=>AbortSignal;
 cancel:(token?:number)=>void;
 dispose:()=>void;resume:()=>void;
}
export function createGeoOperationGate():GeoOperationGate{
 let generation=0,mounted=true,controller:AbortController|null=null;
 const cancel=(token?:number)=>{
  if(token!==undefined&&token!==generation)return;
  generation++;
  controller?.abort();controller=null;
 };
 return {
  begin(){cancel();return generation;},
  isCurrent(token){return mounted&&token===generation;},
  attach(token){
   if(!mounted||token!==generation){const aborted=new AbortController();aborted.abort();return aborted.signal;}
   controller?.abort();
   controller=new AbortController();
   return controller.signal;
  },
  cancel,dispose(){mounted=false;cancel();},resume(){mounted=true;}
 };
}
