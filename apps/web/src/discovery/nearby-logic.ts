import type {RegistrationDraft} from "../registration/model";
import {normalizeCountryCode} from "@luemi/contracts";
import type {DemoPerson,DiscoveryFilter} from "./model";

// The demo has declared cities/countries, but no verified person coordinates.
// Never use the legacy illustrative demoDistanceKm for Nearby eligibility.
export function sameDeclaredCity(person:Pick<DemoPerson,"city"|"countryCode">,
 draft:Pick<RegistrationDraft,"city"|"countryCode">):boolean{
 const norm=(value:string)=>value.trim().normalize("NFC").toLocaleLowerCase("ru");
 return !!draft.city.trim()&&normalizeCountryCode(draft.countryCode)!==null&&
  normalizeCountryCode(person.countryCode)===normalizeCountryCode(draft.countryCode)&&
  norm(person.city)===norm(draft.city);
}
export function selectNearbyDemos(people:DemoPerson[],draft:RegistrationDraft,scope:DiscoveryFilter["scope"]):DemoPerson[]{
 let candidates:DemoPerson[];
 if(scope==="world")candidates=people;
 else if(scope==="country")
  candidates=normalizeCountryCode(draft.countryCode)?people.filter(person=>normalizeCountryCode(person.countryCode)===normalizeCountryCode(draft.countryCode)):[];
 else candidates=people.filter(person=>sameDeclaredCity(person,draft));
 // Stable order, using only actually declared interests; never inferred kilometres.
 const overlap=(p:DemoPerson)=>p.interests.filter(id=>draft.interests.includes(id)).length;
 return [...candidates].sort((a,b)=>overlap(b)-overlap(a)||a.id.localeCompare(b.id));
}
export function nearbyTitle(scope:DiscoveryFilter["scope"]):string{
 return scope==="world"?"Люди со всего мира":scope==="country"?"Люди из выбранной страны":"Люди из выбранного города";
}
