/** Consent-driven, one-shot location read. No storage, no passive tracking. */
export interface DeviceCoordinates {lat:number;lon:number}
export interface TelegramLocationManager {
 isInited?:boolean;
 isLocationAvailable?:boolean;
 init:(callback:()=>void)=>void;
 getLocation:(callback:(value:{latitude:number;longitude:number}|null)=>void)=>void;
}
export interface LocationDevice {
 native?:TelegramLocationManager;
 browser?:Pick<Geolocation,"getCurrentPosition">;
}
const valid=(lat:number,lon:number):boolean=>Number.isFinite(lat)&&Number.isFinite(lon)&&
 lat>=-90&&lat<=90&&lon>=-180&&lon<=180;
export function requestDeviceCoordinates(device:LocationDevice,signal:AbortSignal):Promise<DeviceCoordinates>{
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(new Error("location_cancelled"));return;}
  let done=false;
  const finish=(value?:DeviceCoordinates,error?:string)=>{
   if(done)return;
   done=true;
   signal.removeEventListener("abort",abort);
   if(value)resolve(value);
   else reject(new Error(error??"location_unavailable"));
  };
  const abort=()=>finish(undefined,"location_cancelled");
  signal.addEventListener("abort",abort,{once:true});
  const browser=()=>{
   if(done)return;
   const location=device.browser;
   if(!location){finish(undefined,"location_unavailable");return;}
   try{
    location.getCurrentPosition(
     pos=>{
      const lat=pos.coords.latitude,lon=pos.coords.longitude;
      valid(lat,lon)?finish({lat,lon}):finish(undefined,"location_invalid");
     },
     error=>finish(undefined,error.code===1?"location_denied":"location_unavailable"),
     {enableHighAccuracy:false,maximumAge:120000,timeout:9000}
    );
   }catch{finish(undefined,"location_unavailable");}
  };
  const manager=device.native;
  if(!manager){browser();return;}
  const getNative=()=>{
   if(done)return;
   if(manager.isLocationAvailable===false){browser();return;}
   try{
    manager.getLocation(position=>{
     if(!position){finish(undefined,"location_denied");return;}
     const lat=position.latitude,lon=position.longitude;
     valid(lat,lon)?finish({lat,lon}):finish(undefined,"location_invalid");
    });
   }catch{browser();}
  };
  try{
   if(manager.isInited)getNative();
   else manager.init(getNative);
  }catch{browser();}
 });
}
