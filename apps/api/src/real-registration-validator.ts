/**
 * REAL-REG-01: only PRIVATE draft data is accepted here.
 * A selected city ID is not proof of geocoding and is NEVER authority for publication.
 */
export const realRegistrationFields = [
  "displayName","birthDate","consentVersion","gender","city","countryCode",
  "placeId","radius","searchScope","audience","ageMin","ageMax","goal",
  "interests","about","languages","height","occupation","education","lifestyle","pets","facts","family"
] as const;
export type RealRegistrationFields = Partial<Record<(typeof realRegistrationFields)[number],unknown>>;
export type ValidationResult =
  | {ok:true;payload:Record<string,unknown>;birthDate:string|null;consentVersion:string}
  | {ok:false;error:"invalid_draft"|"consent_required"|"draft_too_large"};
const allowed=new Set<string>(realRegistrationFields);
function object(v:unknown):v is Record<string,unknown>{
  return v!==null&&typeof v==="object"&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
}
function string(v:unknown,min:number,max:number):v is string{
  return typeof v==="string"&&v===v.trim()&&[...v].length>=min&&[...v].length<=max;
}
export function adultDate(value:unknown,now=new Date()):value is string{
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const dob=new Date(value+"T00:00:00.000Z");
  if(!Number.isFinite(dob.getTime())||dob.toISOString().slice(0,10)!==value)return false;
  const y=now.getUTCFullYear()-dob.getUTCFullYear();
  const mo=now.getUTCMonth()-dob.getUTCMonth();
  const d=now.getUTCDate()-dob.getUTCDate();
  return (y>18||y===18&&(mo>0||mo===0&&d>=0))&&y<130;
}
const enumOk=(v:unknown,choices:readonly string[])=>typeof v==="string"&&choices.includes(v);
const list=(v:unknown,max:number):v is string[]=>Array.isArray(v)&&v.length<=max&&
  v.every(x=>string(x,1,40))&&new Set(v).size===v.length;
function valid(key:string,v:unknown,now:Date):boolean{
  switch(key){
    case "displayName":return string(v,2,48)&&
      /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(v);
    case "birthDate":return adultDate(v,now);
    case "gender":return enumOk(v,["man","woman","other"]);
    case "city":return string(v,2,120);
    case "countryCode":return typeof v==="string"&&/^[A-Z]{2}$/.test(v);
    case "placeId":return typeof v==="string"&&/^[a-z0-9:_-]{3,180}$/i.test(v);
    case "radius":return Number.isInteger(v)&&Number(v)>=1&&Number(v)<=5000;
    case "searchScope":return enumOk(v,["radius","country","world"]);
    case "audience":return enumOk(v,["women","men","everyone"]);
    case "ageMin":case "ageMax":return Number.isInteger(v)&&Number(v)>=18&&Number(v)<=80;
    case "goal":return enumOk(v,["serious","relationship","dates","friendship","communication","new_people","flirt","activities","undecided"]);
    case "interests":return list(v,15);
    case "languages":return list(v,10);
    case "lifestyle":return list(v,12);
    case "pets":return list(v,12);
    case "facts":return list(v,3);
    case "family":return list(v,12);
    case "about":return string(v,0,750);
    case "height":return v===null||(Number.isInteger(v)&&Number(v)>=100&&Number(v)<=250);
    case "occupation":case "education":return string(v,0,120);
    default:return false;
  }
}
export function validateRealRegistrationDraft(
  raw:unknown,approvedConsentVersion:string,now=new Date()
):ValidationResult{
  if(!object(raw)||Object.keys(raw).some(k=>!allowed.has(k)))
    return {ok:false,error:"invalid_draft"};
  if(!approvedConsentVersion||raw.consentVersion!==approvedConsentVersion)
    return {ok:false,error:"consent_required"};
  const fields:Record<string,unknown>={};
  for(const [k,v] of Object.entries(raw)){
    if(k==="consentVersion")continue;
    if(!valid(k,v,now))return {ok:false,error:"invalid_draft"};
    fields[k]=v;
  }
  if(fields.ageMin!==undefined&&fields.ageMax!==undefined&&Number(fields.ageMin)>Number(fields.ageMax))
    return {ok:false,error:"invalid_draft"};
  const birthDate=typeof fields.birthDate==="string"?fields.birthDate:null;
  delete fields.birthDate;
  if(Buffer.byteLength(JSON.stringify(fields),"utf8")>7000)return {ok:false,error:"draft_too_large"};
  return {ok:true,payload:fields,birthDate,consentVersion:approvedConsentVersion};
}
