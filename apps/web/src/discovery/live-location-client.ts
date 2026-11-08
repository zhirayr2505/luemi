import {geoCsrf} from "../auth/session-adapter";
import type {PreciseReading} from "./live-location-device";

export type LiveLocationStatus={enabled:boolean;updatedAt:string|null};
export type ObservedCity={id:string;city:string;country:string;countryCode:string};
const object=(v:unknown):v is Record<string,unknown>=>
 !!v&&typeof v==="object"&&!Array.isArray(v);
async function readJson(url:string,method:"GET"|"POST"="GET",body?:object,signal?:AbortSignal):Promise<unknown>{
 const csrf=method==="POST"?geoCsrf():null;
 if(method==="POST"&&!csrf)throw new Error("session_required");
 const response=await fetch(url,{method,cache:"no-store",credentials:"same-origin",signal,
  headers:method==="POST"?{"Content-Type":"application/json","X-Luemi-CSRF":csrf!}:undefined,
  ...(method==="POST"?{body:JSON.stringify(body??{})}:{})});
 if(!response.ok)throw new Error("location_http_"+response.status);
 return response.json() as Promise<unknown>;
}
export async function getLiveLocationStatus(signal?:AbortSignal):Promise<LiveLocationStatus>{
 const data=await readJson("/api/v3/location/status","GET",undefined,signal);
 if(!object(data)||typeof data.enabled!=="boolean"||
    !(data.updatedAt===null||typeof data.updatedAt==="string"))throw new Error("location_status_invalid");
 return{enabled:data.enabled,updatedAt:data.updatedAt};
}
export async function consentLiveLocation(reading:PreciseReading):Promise<void>{
 const data=await readJson("/api/v3/location/consent","POST",
  {...reading,consent:true,version:"precise-location-v1"});
 if(!object(data)||data.enabled!==true)throw new Error("location_consent_invalid");
}
export async function refreshLiveLocation(reading:PreciseReading):Promise<void>{
 const data=await readJson("/api/v3/location/refresh","POST",reading);
 if(!object(data)||data.enabled!==true)throw new Error("location_refresh_invalid");
}
export async function revokeLiveLocation():Promise<void>{
 const data=await readJson("/api/v3/location/revoke","POST");
 if(!object(data)||data.deleted!==true||data.enabled!==false)throw new Error("location_revoke_invalid");
}
export async function resolveObservedCity(reading:PreciseReading,signal?:AbortSignal):Promise<ObservedCity|null>{
 // The existing consent-controlled reverse lookup can be unavailable when the
 // world geocoder is offline. Never guess a city from approximate distance.
 try{
  const value=await readJson("/api/v2/geo/reverse","POST",{lat:reading.lat,lon:reading.lon},signal);
  if(!object(value)||!object(value.result))return null;
  const place=value.result;
  if(typeof place.id!=="string"||typeof place.city!=="string"||
   typeof place.country!=="string"||typeof place.countryCode!=="string")return null;
  return{id:place.id,city:place.city,country:place.country,countryCode:place.countryCode};
 }catch{return null;}
}
export async function confirmObservedCity(place:ObservedCity):Promise<ObservedCity>{
 const data=await readJson("/api/v3/location/confirm-city","POST",
  {city:place.city,country:place.country,countryCode:place.countryCode,placeId:place.id});
 if(!object(data)||data.city!==place.city||data.countryCode!==place.countryCode)
  throw new Error("location_city_confirmation_failed");
 return place;
}
