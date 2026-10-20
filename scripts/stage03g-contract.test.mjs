import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const source=read("apps/web/src/discovery/ProfileModel.ts");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const m=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const base={id:"internal-telegram-identifier",source:"local-draft",name:" Тест ",age:25,
 city:"Город",country:"Страна",countryCode:"ru",goal:null,about:"Обо мне",interests:["музыка"],
 languages:["ru"],photos:[{id:"a",src:"draft.jpg",status:"draft"},{id:"b",src:"approved.jpg",status:"published"},
 {id:"c",src:"private.jpg",status:"hidden"},{id:"d",src:"moderation.jpg",status:"pending"}],
 premium:true,verified:true,registeredAt:"2025-01-01",updatedAt:"2026-01-01"};
const visitor=m.projectProfile(base,"visitor");
assert.deepEqual(visitor.photos.map(p=>p.id),["b"],"never expose draft, hidden or moderation images");
assert.equal(visitor.profile.id,null,"never expose local internal ID");
assert.equal(visitor.profile.premium,false,"local claims never attest paid status");
assert.equal(visitor.profile.verified,false,"local claims never attest verification");
assert.equal(visitor.profile.registeredAt,null);
assert.equal(visitor.canEdit,false);assert.equal(visitor.canReorderMain,false);
assert.equal(visitor.canReport,false,"no invented backend moderation");
const preview=m.projectProfile(base,"preview");
assert.deepEqual(preview.photos.map(p=>p.id),visitor.photos.map(p=>p.id),"preview equals visitor permissions");
assert.equal(preview.canEdit,false);
const owner=m.projectProfile(base,"owner");
assert.deepEqual(owner.photos.map(p=>p.id),["a","b","d"],"owner sees local draft and moderation, not hidden");
assert.equal(owner.canEdit,true);assert.equal(m.canMakeMain(owner,"b"),false,"draft has no server publication");
const server=m.projectProfile({...base,source:"server"},"owner");
assert.equal(m.canMakeMain(server,"b"),true);
assert.equal(m.canMakeMain(server,"a"),false,"draft photo cannot become public main");
assert.equal(m.displayPhotoDate({id:"x",src:"",status:"published"}),"Дата добавления недоступна");
assert.equal(m.draftAge({day:"30",month:"2",year:"2000"},new Date("2026-10-20")),null);
console.log("✓ Stage 03G.A: public projection, unpublished photo guards, demo badges, owner/preview permission boundaries");
