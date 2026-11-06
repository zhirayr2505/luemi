import assert from "node:assert/strict";
import test from "node:test";
import {adultDate,validateRealRegistrationDraft} from "../src/real-registration-validator.js";

const consent="beta-policy-v1";
const now=new Date("2026-10-25T14:00:00.000Z");
const ok=(fields:Record<string,unknown>)=>validateRealRegistrationDraft({consentVersion:consent,...fields},consent,now);
test("DOB: exact 18th birthday allowed, next day and malformed rejected",()=>{
 assert.equal(adultDate("2008-10-25",now),true);
 assert.equal(adultDate("2008-10-26",now),false);
 assert.equal(adultDate("2008-02-30",now),false);
 assert.equal(adultDate("1880-01-01",now),false);
});
test("no consent, unknown keys, or forged owner fields can enter private drafts",()=>{
 assert.deepEqual(validateRealRegistrationDraft({displayName:"Анна"},consent,now),
  {ok:false,error:"consent_required"});
 for(const field of ["ownerId","telegramId","publication_status","published","storageKey","isAdmin"]){
  assert.equal(ok({[field]:"1"}).ok,false);
 }
 assert.equal(ok({displayName:"Анна",consentVersion:"wrong"}).ok,false);
});
test("valid international private form is projected WITHOUT public credentials",()=>{
 const value=ok({displayName:"Անահիտ",birthDate:"1998-05-12",gender:"woman",
 city:"Ереван",countryCode:"AM",placeId:"offline:am:yerevan",radius:5000,
 searchScope:"world",audience:"everyone",ageMin:18,ageMax:75,
 goal:"friendship",interests:["music","sport"],languages:["ru","hy"],about:"Привет"});
 assert.equal(value.ok,true);
 if(value.ok){
  assert.equal(value.birthDate,"1998-05-12");
  assert.equal(value.payload.birthDate,undefined);
  assert.equal(value.payload.displayName,"Անահիտ");
  assert.equal(value.consentVersion,consent);
 }
});
test("reject invalid choice, range, duplicate or oversized fields",()=>{
 const invalid=[
  {displayName:"A"}, {displayName:"Ann99"},{birthDate:"2009-12-01"},
  {ageMin:75,ageMax:25},{radius:5001},{searchScope:"outside"},
  {countryCode:"Russian"},{placeId:"https://evil.test"},
  {interests:["art","art"]},{languages:Array(11).fill("x")},
  {about:"б".repeat(751)}, {interests:["x".repeat(41)]}
 ];
 for(const fields of invalid)assert.equal(ok(fields).ok,false,JSON.stringify(fields).slice(0,120));
});
test("prototype pollution and custom object prototypes rejected",()=>{
 const x=Object.create({admin:true});x.consentVersion=consent;
 assert.equal(validateRealRegistrationDraft(x,consent,now).ok,false);
 assert.equal(validateRealRegistrationDraft([],consent,now).ok,false);
});
