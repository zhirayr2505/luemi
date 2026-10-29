import {normalizeCountryCode} from "@luemi/contracts";
import {newDraft,type RegistrationDraft} from "./model";

export const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const DRAFT_SCHEMA_VERSION = 2 as const;
export interface StoredPhoto {id:string;file:File;preview?:Blob}
export interface DraftEnvelope {
  schemaVersion:2;
  draftId:string;
  scope:string;
  revision:number;
  step:number;
  updatedAt:number;
  expiresAt:number;
  draft:RegistrationDraft;
  photos:StoredPhoto[];
}
export type Parsed<T> = {ok:true;value:T} | {ok:false;reason:string};
const fail = (reason:string):Parsed<never> => ({ok:false,reason});
const object = (value:unknown):value is Record<string,unknown> =>
  value!==null&&typeof value==="object"&&!Array.isArray(value);
const text = (value:unknown,max:number):value is string =>
  typeof value==="string"&&[...value].length<=max;
const oneOf = (value:unknown,choices:readonly string[]):value is string =>
  typeof value==="string"&&choices.includes(value);
const integer = (value:unknown,min:number,max:number):value is number =>
  typeof value==="number"&&Number.isSafeInteger(value)&&value>=min&&value<=max;
const finiteTimestamp = (value:unknown,now:number):value is number =>
  integer(value,1,now+DRAFT_TTL_MS+5*60*1000);
const plainStrings = (value:unknown,maxItems:number,maxChars:number):value is string[] =>
  Array.isArray(value)&&value.length<=maxItems&&
  value.every(item=>text(item,maxChars)&&item.length>0)&&new Set(value).size===value.length;

/** Structural validation, not registration completion validation.
 * Incomplete fields from step 1 are legal. Malformed types never enter React. */
export function parseRegistrationDraft(raw:unknown):Parsed<RegistrationDraft>{
 if(!object(raw))return fail("draft-object");
 const defaults=newDraft();
 const d:RegistrationDraft={...defaults};
 const strings = {
  name:48,day:2,month:2,year:4,country:120,city:120,placeId:180,countryCode:8,about:750
 } as const;
 for(const key of Object.keys(strings) as Array<keyof typeof strings>){
  const value=raw[key]===undefined?defaults[key]:raw[key];
  if(!text(value,strings[key]))return fail("field-"+key);
  d[key]=value;
 }
 if(raw.trialConsent!==undefined&&typeof raw.trialConsent!=="boolean")return fail("consent-type");
 d.trialConsent=raw.trialConsent===true;
 const enums={
  gender:["","man","woman","other"],searchScope:["radius","country","world"],
  audience:["","women","men","everyone"],
  goal:["","serious","relationship","dates","friendship","communication","undecided"]
 } as const;
 for(const key of Object.keys(enums) as Array<keyof typeof enums>){
  const value=raw[key]===undefined?defaults[key]:raw[key];
  if(!oneOf(value,enums[key]))return fail("enum-"+key);
  (d as unknown as Record<string,unknown>)[key]=value;
 }
 const numbers={radius:[1,5000],ageMin:[18,80],ageMax:[18,80]} as const;
 for(const key of Object.keys(numbers) as Array<keyof typeof numbers>){
  const value=raw[key]===undefined?defaults[key]:raw[key];
  if(!integer(value,numbers[key][0],numbers[key][1]))return fail("number-"+key);
  d[key]=value;
 }
 const height=raw.height===undefined?defaults.height:raw.height;
 if(height!==null&&!integer(height,100,250))return fail("height");
 d.height=height;
 for(const key of ["occupation","education"] as const){
  const value=raw[key]===undefined?defaults[key]:raw[key];
  if(!text(value,120))return fail("field-"+key);
  d[key]=value;
 }
 if(d.ageMin>d.ageMax)return fail("age-range");
 for(const key of ["interests","languages","lifestyle","pets","facts"] as const){
  const value=raw[key]===undefined?defaults[key]:raw[key];
  const maxItems=key==="interests"?15:key==="languages"?30:key==="facts"?3:12;
  if(!plainStrings(value,maxItems,80))return fail("array-"+key);
  d[key]=value;
 }
 if(d.countryCode){
  const normalized=normalizeCountryCode(d.countryCode);
  if(normalized===null)return fail("country-code");
  d.countryCode=normalized;
 }
 if(d.day&&!/^\d{1,2}$/.test(d.day))return fail("day");
 if(d.month&&!/^\d{1,2}$/.test(d.month))return fail("month");
 if(d.year&&!/^\d{1,4}$/.test(d.year))return fail("year");
 return {ok:true,value:d};
}
export function parsePhotos(value:unknown):Parsed<StoredPhoto[]> {
 if(!Array.isArray(value)||value.length>6)return fail("photo-count");
 const ids=new Set<string>(),photos:StoredPhoto[]=[];
 for(const entry of value){
  if(!object(entry)||!text(entry.id,128)||!entry.id||
     !/^[A-Za-z0-9:_-]+$/.test(entry.id)||ids.has(entry.id)||
     !(entry.file instanceof Blob)||entry.file.size===0||
     entry.file.size>12*1024*1024)return fail("photo-record");
  if(entry.preview!==undefined&&(!(entry.preview instanceof Blob)||
     entry.preview.size===0||entry.preview.size>12*1024*1024))return fail("photo-preview");
  ids.add(entry.id);
  photos.push({id:entry.id,file:entry.file as File,preview:entry.preview as Blob|undefined});
 }
 return {ok:true,value:photos};
}
export function parseEnvelope(raw:unknown,scope:string,now=Date.now()):Parsed<DraftEnvelope>{
 if(!object(raw)||raw.schemaVersion!==DRAFT_SCHEMA_VERSION)return fail("schema-version");
 if(raw.scope!==scope)return fail("scope");
 if(!text(raw.draftId,128)||!raw.draftId||
    !integer(raw.revision,1,Number.MAX_SAFE_INTEGER)||
    !integer(raw.step,1,8)||
    !finiteTimestamp(raw.updatedAt,now)||
    !finiteTimestamp(raw.expiresAt,now)||
    raw.expiresAt!==raw.updatedAt+DRAFT_TTL_MS)return fail("envelope");
 const draft=parseRegistrationDraft(raw.draft),photos=parsePhotos(raw.photos);
 if(!draft.ok)return fail(draft.reason);
 if(!photos.ok)return fail(photos.reason);
 return {ok:true,value:{
  schemaVersion:2,draftId:raw.draftId,scope,revision:raw.revision,step:raw.step,
  updatedAt:raw.updatedAt,expiresAt:raw.expiresAt,draft:draft.value,photos:photos.value
 }};
}
export function isExpired(updatedAt:number,now=Date.now()):boolean {
 return updatedAt>now+5*60*1000||now-updatedAt>DRAFT_TTL_MS;
}
