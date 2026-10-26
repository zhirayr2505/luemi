import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const source=read("apps/web/src/discovery/ProfileModel.ts");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll('"@luemi/contracts"',JSON.stringify(new URL("../packages/contracts/dist/index.js",import.meta.url).href));
const m=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const base={id:"internal-telegram-identifier",source:"local-draft",name:" Тест ",age:25,
 city:"Город",country:"Страна",countryCode:"ru",goal:null,about:"Обо мне",interests:["музыка"],
 languages:["ru"],photos:[{id:"a",src:"draft.jpg",status:"draft"},{id:"b",src:"approved.jpg",status:"published"},
 {id:"c",src:"private.jpg",status:"hidden"},{id:"d",src:"moderation.jpg",status:"pending"}],
 premium:true,verified:true,registeredAt:"2025-01-01",updatedAt:"2026-01-01"};
const visitor=m.projectProfile(base,"visitor");
assert.deepEqual(visitor.photos.map(p=>p.id),[],"local-draft source cannot expose any photo in visitor, even a forged published flag");
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
const futureBlik={id:"published-blik",src:"https://example.com/real-story.jpg",kind:"image",
 expiresAt:new Date(Date.now()+3600_000).toISOString()};
assert.equal(m.projectProfile({...base,activeBlik:futureBlik},"visitor").profile.activeBlik,null,
 "local draft must not advertise an active Blik");
assert.equal(m.projectProfile({...base,source:"server",activeBlik:futureBlik},"visitor").profile.activeBlik,
 null,"REM-05F: HTTPS server payload is not a verified server Blik authorization");
assert.equal(m.projectProfile({...base,source:"server",activeBlik:{...futureBlik,expiresAt:"2025-01-01T00:00:00Z"}},"visitor").profile.activeBlik,
 null,"expired story cannot be shown as active");
assert.equal(m.projectProfile({...base,source:"server",activeBlik:{...futureBlik,src:"javascript:alert(1)"}},"visitor").profile.activeBlik,
 null,"story media links must use HTTPS");
console.log("✓ Stage 03G.A: public projection, unpublished photo guards, demo badges, owner/preview permission boundaries");

assert.deepEqual(visitor.profile.photos.map(p=>p.id),[],"nested visitor projection cannot carry any local-draft photo, even forged published flags");
assert.deepEqual(preview.profile.photos.map(p=>p.id),[],"nested public preview cannot carry any local-draft photo");
assert.equal(Object.hasOwn(m.projectProfile({...base,privateToken:"secret"},"visitor").profile,"privateToken"),false,
 "unknown future private fields cannot spread through public profile");

const profile=read("apps/web/src/discovery/ProfileMorphA2.tsx");
const viewer=read("apps/web/src/discovery/PhotoViewer.tsx");
const css=read("apps/web/src/discovery/profile-morph-a2.css");
const discovery=read("apps/web/src/discovery/DiscoveryApp.tsx");
const visitorRoute=read("apps/web/src/discovery/VisitorProfileRoute.tsx");
const previewSource=read("apps/web/src/registration/Preview.tsx");
assert.ok(profile.includes('projectProfile(data,mode)'),"canonical projection stays in A2");
assert.ok(profile.includes('mode={data.source==="local-draft"?"local-self-preview":"preview"}'),
 "self preview retains private local-only capability");
assert.ok(profile.includes('mode==="owner"')&&profile.includes('onClick={onEdit}'),
 "only owner can render editing actions");
assert.ok(profile.includes('["about","О себе"')&&profile.includes('["bliki","Блики"')&&
 profile.includes('["photos","Фото"')&&profile.includes('["meta","Аккаунт"')&&
 profile.includes('["gifts","Подарки"'),"approved five tabs and A2 order");
assert.ok(profile.includes('useState<"compact"|"expanded">("compact")')&&
 profile.includes("morphFrame(geometry.current,p)"),"A2 compact first, one geometric morph");
assert.ok(profile.includes("PhotoViewer")&&profile.includes("initialPhotoId={viewer.photoId}")&&
 viewer.includes("createPortal"),"existing fullscreen viewer and active photo ID retained");
assert.ok(profile.includes("reconcilePhotoId")&&profile.includes("resourceIdentity"),
 "media identity preserved on reorder and viewer return");
assert.ok(css.includes(".pm-a2-backing")&&css.includes("isolation:isolate")&&
 css.includes(".pm-a2-sheet"),"opaque backing masks underlying feed throughout morph");
assert.ok(discovery.includes('from "./ProfileMorphA2"')&&
 visitorRoute.includes('from "./ProfileMorphA2"')&&
 previewSource.includes('from "../discovery/ProfileMorphA2"'),
 "owner/visitor/registration all use one new profile component");
assert.ok(!profile.includes("ProfileSheetMotion")&&!css.includes("pm-sheet-viewport"),
 "old sheet motion engine absent");
console.log("PROFILE_A2_SOURCE_AND_PRIVACY_CONTRACT_PASS; browser/GPU validation separate");
