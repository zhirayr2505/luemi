/** Dev-only React Profiler evidence for REM-04A; no production instrumentation.
 * Recorded entries correspond to committed render passes, NOT hardware FPS.
 */
import {Profiler,type ProfilerOnRenderCallback,type ReactNode} from "react";
declare global { interface Window { __luemiRem04aTrace?: Array<{
 id:string;phase:string;actualDuration:number;baseDuration:number;commitTime:number;
 }> } }
const onRender:ProfilerOnRenderCallback=(id,phase,actualDuration,baseDuration,_startTime,commitTime)=>{
 if(typeof window!=="undefined"&&window.__luemiRem04aTrace)
  window.__luemiRem04aTrace.push({id,phase,actualDuration,baseDuration,commitTime});
};
export function QaProfiler({id,children}:{id:string;children:ReactNode}){
 if(!import.meta.env.DEV)return children;
 return <Profiler id={id} onRender={onRender}>{children}</Profiler>;
}
