import {newDraft,type RegistrationDraft} from "./model";
import {parseRegistrationDraft} from "./draft-schema";

/** Returns a display label only; server persists the ISO country code. */
function countryName(code:unknown):string{
 if(typeof code!=="string"||!/^[A-Z]{2}$/.test(code))return "";
 try{
  // International users can recover their city without installing a
  // device-local city selection or making an external reverse lookup.
  const label=new Intl.DisplayNames(["ru"],{type:"region"}).of(code);
  if(typeof label==="string"&&label.length>1&&label!==code)return label;
 }catch{/* Older WebViews may not have Intl.DisplayNames. */}
 return code; // safe ISO fallback (2 characters; not an untrusted HTML string)
}

/** Server stores selected profile fields, not the local city selection or photo Blobs. */
export function recoverServerFields(fields:Record<string,unknown>):RegistrationDraft|null {
 const birth=typeof fields.birthDate==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(fields.birthDate)
  ?fields.birthDate.split("-"):null;
 const raw={...newDraft(),trialConsent:true,
  name:fields.displayName,year:birth?.[0],month:birth?.[1],day:birth?.[2],
  gender:fields.gender,city:fields.city,countryCode:fields.countryCode,
  // This ID is saved server-side and is required to edit step 3. An absent
  // country label must be re-created from the ISO code: the private API stores
  // countryCode, not the locally selected country display name.
  placeId:fields.placeId,
  country:countryName(fields.countryCode),
  radius:fields.radius,searchScope:fields.searchScope,audience:fields.audience,
  ageMin:fields.ageMin,ageMax:fields.ageMax,goal:fields.goal,
  interests:fields.interests,about:fields.about,languages:fields.languages,
  height:fields.height,occupation:fields.occupation,education:fields.education,
  lifestyle:fields.lifestyle,pets:fields.pets,facts:fields.facts};
 const parsed=parseRegistrationDraft(raw);
 return parsed.ok?parsed.value:null;
}
