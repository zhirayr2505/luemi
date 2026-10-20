import type {RegistrationDraft} from "../registration/model";
import type {DemoPerson,DiscoveryFilter} from "./model";

/** Only observable fixture fields; there is no invented percentage or AI claim. */
export function evidence(person:DemoPerson,draft:RegistrationDraft){
 const interests=person.interests.filter(id=>draft.interests.includes(id));
 const languages=person.languages.filter(id=>draft.languages.includes(id));
 const sameGoal=!!draft.goal&&draft.goal!=="undecided"&&draft.goal===person.goal;
 return {interests,languages,sameGoal,score:interests.length*3+languages.length*2+(sameGoal?4:0)};
}
export function rankDemonstrations(people:DemoPerson[],draft:RegistrationDraft){
 return [...people].sort((a,b)=>evidence(b,draft).score-evidence(a,draft).score);
}
export const collectionDefinitions=[
 {id:"online",title:"Сейчас в сети",description:"Показываются только люди, разрешившие видеть свой онлайн-статус."},
 {id:"common",title:"Много общего",description:"Общие интересы в анкетах."},
 {id:"goals",title:"Похожие цели",description:"Вы хотите похожего от знакомств."},
 {id:"new",title:"Новые в LUEMI",description:"Проверенные новые анкеты."},
 {id:"nearby",title:"Рядом с тобой",description:"Люди из указанного города, не GPS."},
 {id:"travel",title:"Любят путешествовать",description:"Те, кому нравятся путешествия."},
 {id:"music",title:"Музыка нас объединяет",description:"Те, кто любит музыку."},
 {id:"international",title:"Из других стран",description:"Знакомства за пределами твоей страны."}
] as const;
export type CollectionId=typeof collectionDefinitions[number]["id"];
export function membersFor(id:CollectionId,people:DemoPerson[],draft:RegistrationDraft,filter:DiscoveryFilter):DemoPerson[]{
 switch(id){
  // Neither online status nor registration timestamps are present in demo data.
  case "online":case "new":return [];
  case "common":return people.filter(p=>evidence(p,draft).interests.length>0);
  case "goals":return people.filter(p=>!!draft.goal&&draft.goal!=="undecided"&&p.goal===draft.goal);
  case "nearby":return filter.scope==="world"||!draft.city?[]:
   people.filter(p=>p.countryCode===draft.countryCode&&p.city.toLocaleLowerCase("ru")===draft.city.toLocaleLowerCase("ru"));
  case "travel":return people.filter(p=>p.interests.includes("путешествия"));
  case "music":return people.filter(p=>p.interests.includes("музыка"));
  case "international":return people.filter(p=>!!draft.countryCode&&p.countryCode!==draft.countryCode);
 }
}
