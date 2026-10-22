import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const source=read("apps/web/src/discovery/ProfileModel.ts");
const code=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
}}).outputText.replaceAll('"@luemi/contracts"',JSON.stringify(new URL("../packages/contracts/dist/index.js",import.meta.url).href));
const m=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
const draft={name:" Лея ",trialConsent:true,day:"29",month:"02",year:"2000",gender:"woman",
 country:"Армения",city:"Ереван",countryCode:"AM",placeId:"yerevan-test",radius:30,searchScope:"radius",
 audience:"everyone",ageMin:18,ageMax:45,goal:"serious",interests:["art","music"],
 about:"Слушаю музыку\nПутешествую",languages:["ru","hy"]};
const photo=i=>({id:"local-"+i,src:"blob:local-"+i,status:"ready"});
const project=items=>m.fromLocalDraft(draft,m.readyRegistrationPhotos(items));
for(const count of [0,1,6]){
 const input=Array.from({length:count},(_,i)=>photo(i));
 const data=project(input),self=m.projectProfile(data,"local-self-preview"),
  owner=m.projectProfile(data,"owner"),publicPreview=m.projectProfile(data,"preview"),
  visitor=m.projectProfile(data,"visitor");
 assert.deepEqual(self.photos.map(x=>x.id),owner.photos.map(x=>x.id));
 assert.deepEqual(self.photos.map(x=>x.src),owner.photos.map(x=>x.src));
 assert.deepEqual(self.profile.photos,self.photos,"nested self projection shares same items");
 assert.equal(self.photos.length,count);
 assert.deepEqual(visitor.photos,[],"local draft never enters public visitor projection");
 assert.deepEqual(publicPreview.photos,[],"unpublished local photos never enter public preview");
 assert.equal(self.canEdit,false);assert.equal(self.canReport,false);assert.equal(self.canReorderMain,false);
 assert.equal(self.published,false);assert.equal(self.profile.verified,false);
 assert.equal(self.profile.premium,false);assert.equal(self.profile.registeredAt,null);
 assert.deepEqual(self.photos.map(x=>x.status),Array(count).fill("draft"));
 console.log("REM01E_MODEL_PASS "+count+" prepared local photos: owner=self, public empty");
}
const items=[photo(0),{...photo(1),status:"reading"},photo(2),{...photo(3),status:"error"},
 {...photo(4),status:"success"},{...photo(5),src:""},photo(0)];
assert.deepEqual(m.readyRegistrationPhotos(items).map(p=>p.id),["local-0","local-2","local-4"]);
const reordered=[photo(5),photo(2),photo(0)];
assert.deepEqual(project(reordered).photos.map(p=>p.id),["local-5","local-2","local-0"]);
assert.deepEqual(m.projectProfile(project(items),"local-self-preview").photos.map(p=>p.id),
 ["local-0","local-2","local-4"]);
console.log("REM01E_MODEL_PASS reading/error/blank/repeated IDs excluded; source order retained");
const fields=["name","age","city","country","countryCode","goal","about","interests","languages"];
const self=m.projectProfile(project([photo(2),photo(1)]),"local-self-preview");
const owner=m.projectProfile(project([photo(2),photo(1)]),"owner");
for(const key of fields)assert.deepEqual(self.profile[key],owner.profile[key],"shared field "+key);
assert.equal(self.profile.name,"Лея");assert.equal(self.profile.countryCode,"AM");
assert.equal(self.profile.goal,"serious");
assert.equal(m.draftAge(draft,new Date("2026-02-28T00:00:00Z")),25);
assert.equal(m.draftAge(draft,new Date("2026-03-01T00:00:00Z")),26);
assert.equal(m.draftAge({...draft,day:"31",month:"02"},new Date("2026-10-22T00:00:00Z")),null);
assert.equal(m.draftAge({...draft,day:"29",month:"02",year:"2001"},new Date("2026-10-22T00:00:00Z")),null);
console.log("REM01E_MODEL_PASS shared age and birthdate boundary, country/goal/about/interests/languages");
const server={...project([]),source:"server",id:"server-55",registeredAt:"2024-01-01",verified:true,
 premium:true,photos:[
 {id:"pub-1",src:"https://cdn.example.com/one.jpg",status:"published"},
 {id:"pending",src:"https://cdn.example.com/pending.jpg",status:"pending"},
 {id:"hidden",src:"https://cdn.example.com/hidden.jpg",status:"hidden"},
 {id:"rejected",src:"https://cdn.example.com/rejected.jpg",status:"rejected"},
 {id:"pub-2",src:"https://cdn.example.com/two.jpg",status:"published"}]};
for(const mode of ["visitor","preview","local-self-preview"]){
 const view=m.projectProfile(server,mode);
 assert.deepEqual(view.photos.map(p=>p.id),["pub-1","pub-2"],
  mode+" must never expose pending/hidden/rejected");
 assert.deepEqual(view.profile.photos,view.photos);
 assert.equal(view.published,true);
}
assert.equal(m.canMakeMain(m.projectProfile(server,"owner"),"pub-1"),true);
assert.equal(m.canMakeMain(m.projectProfile(server,"preview"),"pub-1"),false);
assert.equal(m.canMakeMain(self,"local-2"),false);
console.log("REM01E_MODEL_PASS server published/hidden/rejected policy unaffected; no local main/reports");
const preview=read("apps/web/src/registration/Preview.tsx");
assert.ok(preview.includes('<ProfileMaster data={profile} mode="local-self-preview"'));
assert.ok(!preview.includes("PhotoCarousel"));
assert.ok(preview.includes("editStep(7)")&&preview.includes("openDemo")&&
 preview.includes("disabled-submit"),"step-8 controls stay accessible");
const app=read("apps/web/src/App.tsx");
assert.ok(app.includes("readyRegistrationPhotos(photos)"));
const master=read("apps/web/src/discovery/ProfileMaster.tsx");
assert.ok(master.includes('mode={data.source==="local-draft"?"local-self-preview":"preview"}'));
assert.ok(!preview.includes("GlobalHeader"),"registration never creates another header");
console.log("REM-01E MODEL AND PRIVACY QA PASS");
