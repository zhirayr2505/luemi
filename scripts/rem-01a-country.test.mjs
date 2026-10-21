import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
import {normalizeCountryCode} from "@luemi/contracts";
const contractsUrl=new URL("../packages/contracts/dist/index.js",import.meta.url).href;
async function load(path){
 const text=readFileSync(new URL("../"+path,import.meta.url),"utf8");
 const js=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}})
  .outputText.replaceAll('"@luemi/contracts"',JSON.stringify(contractsUrl));
 if(path.endsWith("for-you-data.ts")){
  const demoText=readFileSync(new URL("../apps/web/src/discovery/demo-people.ts",import.meta.url),"utf8");
  const demoJs=ts.transpileModule(demoText,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}})
   .outputText.replaceAll('"@luemi/contracts"',JSON.stringify(contractsUrl));
  const demoUrl="data:text/javascript;base64,"+Buffer.from(demoJs).toString("base64");
  return import("data:text/javascript;base64,"+Buffer.from(js.replace('"./demo-people"',JSON.stringify(demoUrl))).toString("base64"));
 }
 return import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
}
for(const [value,expected] of [["RU","RU"],["ru","RU"],["  rU  ","RU"],["AM","AM"],[" us ","US"],["",""],[null,""],[undefined,""],["RUS",""],["R1",""],["яя",""],["ß",""],["ıı",""],[2,""]])
 assert.equal(normalizeCountryCode(value)??"",expected,"canonical country for "+String(value));
const [model,ranking,nearby,people,extra,profile,reg]=await Promise.all([
 load("apps/web/src/discovery/model.ts"),load("apps/web/src/discovery/for-you-ranking.ts"),
 load("apps/web/src/discovery/nearby-logic.ts"),load("apps/web/src/discovery/demo-people.ts"),
 load("apps/web/src/discovery/for-you-data.ts"),load("apps/web/src/discovery/ProfileModel.ts"),
 load("apps/web/src/registration/model.ts")
]);
const draft={...reg.newDraft("QA"),placeId:"offline:ru:krasnodar",city:"Краснодар",country:"Россия",countryCode:" ru ",interests:["музыка"],languages:["ru"],goal:"relationship"};
const upper={...draft,countryCode:"RU"},lower={...draft,countryCode:"ru"};
assert.equal(reg.selectedCityValid(draft),true,"legacy whitespace/case selection normalizes for validation");
assert.equal(reg.validateStep(draft,3,0),null,"registration step 3 remains valid");
assert.ok(people.demoPeople.every(x=>/^[A-Z]{2}$/.test(x.countryCode)),"Feed demo adapters canonical");
assert.ok(extra.forYouDemoPeople.every(x=>/^[A-Z]{2}$/.test(x.countryCode)),"For You demo adapters canonical");
const countryFilter={...model.defaultFilters,scope:"country"};
const c1=model.filterDemoPeople(extra.forYouDemoPeople,countryFilter,upper).map(x=>x.id);
const c2=model.filterDemoPeople(extra.forYouDemoPeople,countryFilter,lower).map(x=>x.id);
const c3=model.filterDemoPeople(extra.forYouDemoPeople,countryFilter,draft).map(x=>x.id);
assert.deepEqual(c1,c2);assert.deepEqual(c1,c3);assert.ok(c1.length>1,"real fixtures remain visible in own country");
assert.ok(c1.every(id=>extra.forYouDemoPeople.find(x=>x.id===id).countryCode==="RU"));
const nearbyCountry=nearby.selectNearbyDemos(extra.forYouDemoPeople,lower,"country").map(x=>x.id);
assert.deepEqual([...c1].sort(),[...nearbyCountry].sort(),"Nearby country results match discovery country");
const ownNear=ranking.membersFor("nearby",extra.forYouDemoPeople,upper,{...countryFilter,scope:"radius"}).map(x=>x.id);
const lowNear=ranking.membersFor("nearby",extra.forYouDemoPeople,lower,{...countryFilter,scope:"radius"}).map(x=>x.id);
assert.deepEqual(ownNear,lowNear);assert.ok(ownNear.length>0);
assert.ok(ownNear.every(id=>nearby.selectNearbyDemos(extra.forYouDemoPeople,lower,"radius").some(x=>x.id===id)));
const travel=ranking.membersFor("international",extra.forYouDemoPeople,draft,model.defaultFilters);
assert.ok(travel.length>0);assert.ok(travel.every(x=>x.countryCode!=="RU"),"foreign rail never contains own country");
assert.ok(!travel.some(x=>c1.includes(x.id)));
const restoredProfile=profile.fromLocalDraft(draft,[]);
assert.equal(restoredProfile.countryCode,"RU","fromLocalDraft preserves canonical format");
assert.equal(profile.projectProfile(restoredProfile,"owner").profile.countryCode,"RU");
for(const invalid of ["","zzz","123",null]){
 const input={...draft,countryCode:invalid??""};
 assert.equal(reg.selectedCityValid(input),false,"unsupported code rejected, not fabricated RU");
 assert.deepEqual(ranking.membersFor("international",extra.forYouDemoPeople,input,model.defaultFilters),[]);
}
console.log("REM-01A LU-17 canonical country PASS: ISO, country feed/for-you/nearby, own/foreign, validation, profile projection.");
