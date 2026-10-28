// Disabled unless approved legal policy and v2 session are configured.
// Never transmit image Blobs, local draft IDs or Telegram initData.
import type {RegistrationDraft} from "./model";
import {geoCsrf} from "../auth/session-adapter";
const version=import.meta.env.VITE_LUEMI_CONSENT_VERSION??"";
const policy=import.meta.env.VITE_LUEMI_PRIVACY_POLICY_PATH??"";
export const remoteDraftPilot={
 enabled:import.meta.env.VITE_LUEMI_AUTH_V2==="1"&&
   import.meta.env.VITE_LUEMI_PRIVATE_DRAFT_UI==="1"&&
   /^[a-z0-9][a-z0-9._:-]{2,63}$/i.test(version)&&
   /^\/[a-z0-9][a-z0-9/_-]*$/i.test(policy)&&
   (import.meta.env.VITE_LUEMI_FRIENDS_TEST_MODE==="1"||policy!=="/friends-test.html"),
 policy
};
function ensurePilot(){if(!remoteDraftPilot.enabled)throw new Error("pilot_disabled");}
export async function readRemoteRevision():Promise<{state:"private"|"empty";revision:number;fields:Record<string,unknown>}>{
 ensurePilot();
 const response=await fetch("/api/v3/registration/draft",{credentials:"same-origin",cache:"no-store"});
 if(!response.ok)throw new Error("read_failed");
 const data:unknown=await response.json();
 if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("invalid_read");
 const x=data as {state?:unknown;revision?:unknown;fields?:unknown};
 if((x.state!=="private"&&x.state!=="empty")||!Number.isSafeInteger(x.revision)||
    typeof x.revision!=="number"||x.revision<0||!x.fields||typeof x.fields!=="object"||Array.isArray(x.fields))throw new Error("invalid_read");
 return{state:x.state,revision:x.revision,fields:x.fields as Record<string,unknown>};
}
export async function saveRemoteDraft(d:RegistrationDraft,revision:number):Promise<void>{
 ensurePilot();
 const birthDate=[d.year,d.month.padStart(2,"0"),d.day.padStart(2,"0")].join("-");
 const fields={displayName:d.name.trim(),birthDate,gender:d.gender,city:d.city.trim(),
  countryCode:d.countryCode,placeId:d.placeId,radius:d.radius,searchScope:d.searchScope,
  audience:d.audience,ageMin:d.ageMin,ageMax:d.ageMax,goal:d.goal,
  interests:[...d.interests],about:d.about.trim(),languages:[...d.languages],consentVersion:version};
 return saveRemoteFields(fields,revision);
}
export async function saveRemoteFields(fields:Record<string,unknown>,revision:number):Promise<void>{
 ensurePilot();
 if(!Number.isSafeInteger(revision)||revision<0)throw new Error("invalid_revision");
 const csrf=geoCsrf();
 if(!csrf)throw new Error("session_required");
 const response=await fetch("/api/v3/registration/draft",{
  method:"PUT",credentials:"same-origin",cache:"no-store",
  headers:{"Content-Type":"application/json","X-Luemi-CSRF":csrf},
  body:JSON.stringify({revision,fields})
 });
 if(response.status===409)throw new Error("revision_conflict");
 if(!response.ok)throw new Error("save_failed");
 const receipt:unknown=await response.json();
 if(!receipt||typeof receipt!=="object"||Array.isArray(receipt)||
    (receipt as {state?:unknown}).state!=="private"||
    (receipt as {revision?:unknown}).revision!==revision+1||
    (receipt as {published?:unknown}).published!==false)throw new Error("invalid_receipt");
}
