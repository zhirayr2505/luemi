import test from "node:test";
import assert from "node:assert/strict";
import {recoverServerFields} from "../../web/src/registration/remote-recovery.js";
import {selectedCityValid,validateStep} from "../../web/src/registration/model.js";

function savedFields(countryCode:"RU"|"AM",placeId:string){
 return {
  displayName:"Анна",birthDate:"1998-05-12",gender:"woman",
  city:countryCode==="RU"?"Краснодар":"Ереван",
  countryCode,placeId,
  radius:100,searchScope:"radius",audience:"everyone",
  ageMin:18,ageMax:40,goal:"friendship",
  interests:["music"],about:"Привет",languages:["ru"],
  consentVersion:"friends-test-v1"
 };
}
test("an invited user's persisted profile restores the exact selected city ID and valid country label",()=>{
 for(const [code,id] of [["RU","luemi:ru_krasnodar"],["AM","luemi:am_yerevan"]] as const){
  const result=recoverServerFields(savedFields(code,id));
  assert(result);
  assert.equal(result.placeId,id);
  assert.equal(result.countryCode,code);
  assert(result.country.length>1);
  assert.equal(selectedCityValid(result),true);
  assert.equal(validateStep(result,3,0),null);
  assert.equal(result.trialConsent,true);
 }
});
test("recovery never fabricates an unsupported city or silently supplies local photos",()=>{
 const recovered=recoverServerFields({...savedFields("AM",""),city:"Ереван"});
 assert(recovered);
 assert.equal(selectedCityValid(recovered),false);
 assert.equal(recovered.placeId,"");
 assert.equal(Object.hasOwn(recovered,"photos"),false);
});
