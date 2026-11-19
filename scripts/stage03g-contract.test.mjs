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

const profile=read("apps/web/src/discovery/ProfileMasterV3.tsx");
const ownerSurface=read("apps/web/src/discovery/owner-profile/OwnerPremiumProfile.tsx");
const ownerGeometry=read("apps/web/src/discovery/owner-profile/OwnerProfileGeometry.ts");
const viewer=read("apps/web/src/discovery/PhotoViewer.tsx");
const css=read("apps/web/src/discovery/owner-profile/owner-premium-profile.css");
const discovery=read("apps/web/src/discovery/DiscoveryApp.tsx");
const visitorRoute=read("apps/web/src/discovery/VisitorProfileRoute.tsx");
const previewSource=read("apps/web/src/registration/Preview.tsx");
assert.ok(profile.includes('projectProfile(data,mode)'),"canonical projection stays in ProfileMaster");
assert.ok(profile.includes('mode={data.source==="local-draft"?"local-self-preview":"preview"}'),
 "self preview retains private local-only capability");
assert.ok(profile.includes('mode==="owner"')&&ownerSurface.includes("onClick={onEdit}"),
 "only the owner surface renders editing actions");
assert.ok(ownerSurface.includes('[["about","О себе"],["photos","Фото"],["bliki","Блики"],["gifts","Подарки"]]'),
 "approved shared premium profile has the requested four tabs in order");
assert.ok(ownerSurface.includes('isOwner&&<div className="owner-profile-actions"')&&
 ownerSurface.includes('isOwner&&<button ref={topEdit}'),
 "visitor profiles cannot access owner action controls");
assert.ok(ownerSurface.includes('data-morph-state="expanded"')&&
 ownerSurface.includes("ownerMorphFrame(layout.current,progress)"),"owner opens expanded and uses one geometric morph");
assert.ok(profile.includes("gestureArbiter={gestureArbiter}")&&ownerSurface.includes("ownerMorphEndpoint")&&
 ownerSurface.includes('new GeometryMotion("sheet"'),
 "shared owner/visitor profile uses the route arbiter and one endpoint-settle authority");
assert.ok(profile.includes("PhotoViewer")&&profile.includes("initialPhotoId={viewer.photoId}")&&
 viewer.includes("createPortal"),"existing fullscreen viewer and active photo ID retained");
assert.ok(profile.includes("reconcilePhotoId")&&profile.includes("resourceIdentity"),
 "media identity preserved on reorder and viewer return");
assert.ok(css.includes(".owner-premium-profile")&&css.includes("isolation:isolate")&&
 css.includes(".owner-profile-photo-mask"),"opaque owner backing masks the feed throughout morph");
assert.ok(ownerGeometry.includes("ownerMorphProgress")&&ownerGeometry.includes("compactAvatar")&&
 ownerGeometry.includes("height:width")&&ownerGeometry.includes("ownerMorphEndpoint"),
 "owner geometry keeps a square hero, normalizes scroll and centers the compact avatar");
const gateway=read("apps/web/src/discovery/ProfileV3Gateway.tsx");
const v3=read("apps/web/src/discovery/ProfileMasterV3.tsx");
const v3Surface=read("apps/web/src/discovery/profile-v3/rendering/IntegratedProfileV3.tsx");
assert.ok(discovery.includes('from "./ProfileV3Gateway"')&&
 visitorRoute.includes('from "./ProfileV3Gateway"')&&
 previewSource.includes("registration-static-profile")&&
 !previewSource.includes("ProfileV3Gateway"),
 "owner and visitor use controlled profile gateway; registration uses approved independent static preview");
assert.ok(gateway.includes('return <ProfileV3 {...props}/>')&&
 !gateway.includes("ProfileA2")&&
 !gateway.includes("window.location.hostname"),
 "approved gateway cannot reactivate a retired profile through stale Telegram URLs");
assert.ok(v3.includes("projectProfile(data,mode)")&&
 v3.includes("PhotoViewer")&&v3.includes("initialPhotoId={viewer.photoId}")&&
 v3.includes("mode={data.source===")&&v3.includes("reconcilePhotoId")&&
 v3.includes("resourceIdentity")&&v3Surface.includes("view.canEdit"),
 "V3 must retain permissions, viewer source identity, draft-only preview and owner-only edits");
assert.ok(!profile.includes("ProfileSheetMotion")&&!css.includes("pm-sheet-viewport"),
 "old sheet motion engine absent");
console.log("OWNER_PREMIUM_PROFILE_SOURCE_AND_PRIVACY_CONTRACT_PASS; browser/GPU validation separate");
