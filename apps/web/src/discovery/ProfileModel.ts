import type {RegistrationDraft} from "../registration/model";
import type {DemoPerson} from "./model";

/** A public profile is an explicit projection. Never spread raw registrations or API records into it. */
export type ProfileMode="visitor"|"owner"|"preview";
export type Publication="published"|"draft"|"pending"|"hidden"|"rejected";
export interface ProfilePhoto {id:string;src:string;fallback?:string;status:Publication;addedAt?:string}
/** Future published, server-verified story media. No fixture or local draft claims active Bliki. */
export interface ActiveBlik {id:string;src:string;kind:"image"|"video";expiresAt:string;durationMs?:number}
export interface ProfileMasterData {
 id:string|null; source:"fixture"|"local-draft"|"server";
 name:string;age:number|null;city:string;country:string;countryCode:string;
 goal:string|null;about:string;interests:string[];languages:string[];
 photos:ProfilePhoto[];verified:boolean;premium:boolean;activeBlik?:ActiveBlik|null;
 registeredAt:string|null;updatedAt:string|null;
}
export interface ProfileView {
 mode:ProfileMode; profile:ProfileMasterData; photos:ProfilePhoto[];
 canEdit:boolean;canReorderMain:boolean;canReport:boolean;published:boolean;
}
const publicOnly=(photos:ProfilePhoto[])=>photos.filter(p=>p.status==="published");
const present=(value:string)=>value.trim();
export function projectProfile(profile:ProfileMasterData,mode:ProfileMode):ProfileView {
 const owner=mode==="owner",published=profile.source==="server";
 const photos=owner?profile.photos.filter(p=>p.status!=="hidden"&&p.status!=="rejected"):publicOnly(profile.photos);
 // Explicit allow-list is intentional: runtime input may contain future private fields.
 // The public/preview projection must not carry unpublished photo records anywhere.
 const exposed:ProfileMasterData={
  id:published?profile.id:null,
  source:profile.source,
  name:present(profile.name),
  age:profile.age,
  city:present(profile.city),
  country:present(profile.country),
  countryCode:profile.countryCode,
  goal:profile.goal,
  about:present(profile.about),
  interests:[...profile.interests],
  languages:[...profile.languages],
  photos,
  premium:published&&profile.premium,
  activeBlik:published&&profile.activeBlik&&Date.parse(profile.activeBlik.expiresAt)>Date.now()&&
   /^https:\/\//.test(profile.activeBlik.src)?{...profile.activeBlik}:null,
  verified:published&&profile.verified,
  registeredAt:published?profile.registeredAt:null,
  updatedAt:published?profile.updatedAt:null
 };
 return {mode,photos,profile:exposed,canEdit:owner,
  canReorderMain:owner&&published&&photos.some(p=>p.status==="published"),
  canReport:mode==="visitor"&&published,published};
}
/** Deliberate fixtures contain no verified status, purchase, real join date, or photo timestamp. */
export function fromDemoPerson(person:DemoPerson):ProfileMasterData {
 return {id:null,source:"fixture",name:person.name,age:person.age,
  city:person.city,country:person.country,countryCode:person.countryCode,
  goal:person.goal,about:person.about,interests:[...person.interests],languages:[...person.languages],
  photos:person.photos.map(p=>({...p,status:"published" as const})),
  premium:false,verified:false,registeredAt:null,updatedAt:null};
}
export function draftAge(draft:RegistrationDraft,today=new Date()):number|null {
 const y=Number(draft.year),m=Number(draft.month),d=Number(draft.day);
 if(!y||!m||!d)return null;
 const date=new Date(Date.UTC(y,m-1,d));
 if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)return null;
 let age=today.getUTCFullYear()-y;
 if(today.getUTCMonth()+1<m||(today.getUTCMonth()+1===m&&today.getUTCDate()<d))age--;
 return age>=18&&age<130?age:null;
}
export function fromLocalDraft(draft:RegistrationDraft,photos:ReadonlyArray<{id:string;src:string}>):ProfileMasterData {
 return {id:null,source:"local-draft",name:draft.name,age:draftAge(draft),
  city:draft.city,country:draft.country,countryCode:draft.countryCode.toLowerCase(),
  goal:draft.goal||null,about:draft.about,interests:[...draft.interests],languages:[...draft.languages],
  photos:photos.map(p=>({id:p.id,src:p.src,status:"draft"})),
  premium:false,verified:false,registeredAt:null,updatedAt:null};
}
export function canMakeMain(view:ProfileView,photoId:string):boolean {
 return view.canReorderMain&&view.photos.some(p=>p.id===photoId&&p.status==="published");
}
export function displayPhotoDate(photo:ProfilePhoto):string {
 if(!photo.addedAt)return "Дата добавления недоступна";
 const millis=Date.parse(photo.addedAt);
 return Number.isFinite(millis)?new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"long",year:"numeric"}).format(new Date(millis)):"Дата добавления недоступна";
}
