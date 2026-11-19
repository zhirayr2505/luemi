import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const contractsUrl=new URL("../packages/contracts/dist/index.js",import.meta.url).href;

const load=async(path)=>{
 const source=readFileSync(new URL("../"+path,import.meta.url),"utf8");
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll('"@luemi/contracts"',JSON.stringify(contractsUrl));
 return await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
};
const m=await load("apps/web/src/discovery/model.ts");
const d=await load("apps/web/src/discovery/demo-people.ts");
const draft={city:"Краснодар",countryCode:"ru",interests:["музыка","путешествия"]};
const people=d.demoPeople;
assert.equal(people.length,6,"six private synthetic QA profiles");
assert.equal(new Set(people.map(p=>p.id)).size,people.length,"no duplicate fake people");
assert.ok(people.every(p=>p.gender==="woman"&&p.age>=18&&p.premium===false&&p.verified===false),
 "all current private QA fixtures are adults, unverified and non-premium");
assert.ok(people.every(p=>p.photos.length===4&&
 p.photos.every((photo,index)=>photo.src===
  "/api/v2/qa/portraits/"+p.id.replace(/^qa-2026-/,"")+"/"+(index+1)+".webp")),
 "QA photo paths stay private, server-authorized, and never fall back to public CDNs");
assert.equal(m.filterDemoPeople(people,m.defaultFilters,draft).length,people.length,"worldwide fixture results");
assert.equal(m.filterDemoPeople(people,{...m.defaultFilters,scope:"country"},draft).every(p=>p.countryCode==="RU"),true);
assert.equal(m.filterDemoPeople(people,{...m.defaultFilters,goal:"serious"},draft).every(p=>p.goal==="serious"),true);
assert.equal(m.filterDemoPeople(people,{...m.defaultFilters,language:"hy"},draft).every(p=>p.languages.includes("hy")),true);
assert.equal(m.filterDemoPeople(people,{...m.defaultFilters,minAge:29,maxAge:30},draft).every(p=>p.age>=29&&p.age<=30),true);
assert.ok(m.commonInterests(people[0],draft).includes("музыка"));
const ids=people.map(p=>p.id);
let state=m.freshDemoState();
state=m.demoAct(state,ids,"save");
assert.deepEqual(state.saved,[ids[0]]);
state=m.demoAct(state,ids,"like");
assert.equal(state.index,1);
assert.deepEqual(state.liked,[ids[0]]);
state=m.demoUndo(state);
assert.equal(state.index,0);assert.deepEqual(state.liked,[]);
assert.deepEqual(state.saved,[ids[0]],"undo like preserves previous save");
state=m.demoUndo(state);
assert.deepEqual(state.saved,[],"undo save restores previous membership");
state=m.demoAct(state,ids,"special");
assert.equal(state.index,1);assert.deepEqual(state.liked,[ids[0]]);
state=m.demoUndo(state);
assert.equal(state.index,0);
console.log("✓ Stage 03 model tests: synthetic profiles, country/goal/language/age filters, save, like, special and undo");
