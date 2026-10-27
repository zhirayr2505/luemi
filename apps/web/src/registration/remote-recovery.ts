import {newDraft,type RegistrationDraft} from "./model";
import {parseRegistrationDraft} from "./draft-schema";

/** Server stores selected profile fields, not the local city selection or photo Blobs. */
export function recoverServerFields(fields:Record<string,unknown>):RegistrationDraft|null {
 const birth=typeof fields.birthDate==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(fields.birthDate)
  ?fields.birthDate.split("-"):null;
 const raw={...newDraft(),trialConsent:true,
  name:fields.displayName,year:birth?.[0],month:birth?.[1],day:birth?.[2],
  gender:fields.gender,city:fields.city,countryCode:fields.countryCode,
  radius:fields.radius,searchScope:fields.searchScope,audience:fields.audience,
  ageMin:fields.ageMin,ageMax:fields.ageMax,goal:fields.goal,
  interests:fields.interests,about:fields.about,languages:fields.languages};
 const parsed=parseRegistrationDraft(raw);
 return parsed.ok?parsed.value:null;
}
