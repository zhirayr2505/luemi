/** Explicit one-shot access; never watches a hidden/suspended WebView.
 * Browser high accuracy is preferred; Telegram native permission is a fallback.
 * No coordinate is cached or persisted on the device. */
export type PreciseReading={lat:number;lon:number;accuracyM:number|null};
export interface TelegramLiveLocationManager {
 isInited?:boolean;isLocationAvailable?:boolean;isAccessGranted?:boolean;
 init:(cb:()=>void)=>void;
 getLocation:(cb:(value:{latitude:number;longitude:number;horizontal_accuracy?:number|null}|null)=>void)=>void;
}
const ok=(lat:number,lon:number)=>Number.isFinite(lat)&&Number.isFinite(lon)&&
 Math.abs(lat)<=90&&Math.abs(lon)<=180;
const accuracy=(n:unknown)=>typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=3000?Math.round(n):null;
export async function hasLiveLocationPermission(native?:TelegramLiveLocationManager):Promise<boolean>{
 if(native?.isAccessGranted===true)return true;
 try{
  if(typeof navigator!=="undefined"&&navigator.permissions?.query){
   return(await navigator.permissions.query({name:"geolocation"})).state==="granted";
  }
 }catch{/* Unsupported permission queries should never cause a silent prompt. */}
 return false;
}
export function readPreciseLocation(signal:AbortSignal,native?:TelegramLiveLocationManager):Promise<PreciseReading>{
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(new Error("location_cancelled"));return;}
  let finished=false;
  const finish=(value?:PreciseReading,error="location_unavailable")=>{
   if(finished)return;finished=true;
   signal.removeEventListener("abort",abort);window.clearTimeout(watchdog);
   if(value)resolve(value);else reject(new Error(error));
  };
  const abort=()=>finish(undefined,"location_cancelled");
  signal.addEventListener("abort",abort,{once:true});
  const watchdog=window.setTimeout(()=>finish(undefined,"location_timeout"),14000);
  const fallback=()=>{
   if(finished)return;
   if(!native?.getLocation){finish(undefined,"location_unavailable");return;}
   const read=()=>{
    if(finished)return;
    if(native.isLocationAvailable===false){finish(undefined,"location_unavailable");return;}
    try{native.getLocation(value=>{
     if(!value){finish(undefined,"location_denied");return;}
     if(!ok(value.latitude,value.longitude)){finish(undefined,"location_invalid");return;}
     finish({lat:value.latitude,lon:value.longitude,accuracyM:accuracy(value.horizontal_accuracy)});
    });}catch{finish(undefined,"location_unavailable");}
   };
   try{if(native.isInited)read();else native.init(read);}
   catch{finish(undefined,"location_unavailable");}
  };
  if(typeof navigator==="undefined"||!navigator.geolocation){fallback();return;}
  try{navigator.geolocation.getCurrentPosition(pos=>{
    const {latitude,longitude,accuracy:meters}=pos.coords;
    if(!ok(latitude,longitude)){finish(undefined,"location_invalid");return;}
    if(!Number.isFinite(meters)||meters>3000){finish(undefined,"location_inaccurate");return;}
    finish({lat:latitude,lon:longitude,accuracyM:accuracy(meters)});
   },error=>{
    // Telegram supports a native location permission even if a WebView denies
    // browser Geolocation. Only the direct user action or a previously granted
    // permission can reach this function.
    if(native)fallback();
    else finish(undefined,error.code===1?"location_denied":"location_unavailable");
   },{enableHighAccuracy:true,maximumAge:0,timeout:10000});
  }catch{fallback();}
 });
}
