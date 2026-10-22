/** REM-04A / LU-36: critical auth and optional media readiness are independent.
 * One hard 15s critical deadline (caller default), short optional preparation
 * budget. No optional timeout can convert an auth rejection into success.
 * Callbacks from disposed/expired attempts are ignored.
 */
export type StartupOutcome<T>={kind:"success";value:T}|{kind:"error";reason:string};
export interface StartupOptions<T>{
 critical:(signal:AbortSignal)=>Promise<T>;
 optional:(signal:AbortSignal)=>Promise<unknown>;
 onCritical:(result:StartupOutcome<T>)=>void;
 onOptionalReady:()=>void;
 deadlineMs?:number;
 optionalBudgetMs?:number;
}
export interface StartupHandle{dispose:()=>void;isActive:()=>boolean;}
export function startStartup<T>(options:StartupOptions<T>):StartupHandle{
 const critical=new AbortController(),optional=new AbortController();
 let active=true,criticalDone=false,optionalDone=false;
 const deadline=options.deadlineMs??15000;
 const optionalBudget=options.optionalBudgetMs??650;
 const finishCritical=(result:StartupOutcome<T>)=>{
  if(!active||criticalDone)return;
  criticalDone=true;clearTimeout(authTimer);options.onCritical(result);
 };
 const finishOptional=()=>{
  if(!active||optionalDone)return;
  optionalDone=true;clearTimeout(mediaTimer);options.onOptionalReady();
 };
 const authTimer=setTimeout(()=>{
  critical.abort();
  finishCritical({kind:"error",reason:"auth-deadline"});
 },deadline);
 const mediaTimer=setTimeout(()=>{
  optional.abort();
  finishOptional();
 },optionalBudget);
 void Promise.resolve().then(()=>options.critical(critical.signal))
  .then(value=>finishCritical({kind:"success",value}),
   error=>finishCritical({kind:"error",reason:error instanceof Error?error.message:"auth-failed"}));
 void Promise.resolve().then(()=>options.optional(optional.signal))
  .then(finishOptional,finishOptional);
 return {
  isActive:()=>active,
  dispose:()=>{
   if(!active)return;
   active=false;critical.abort();optional.abort();
   clearTimeout(authTimer);clearTimeout(mediaTimer);
  }
 };
}
