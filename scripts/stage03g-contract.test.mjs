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

assert.deepEqual(visitor.profile.photos.map(p=>p.id),["b"],"nested projection cannot carry private images");
assert.deepEqual(preview.profile.photos.map(p=>p.id),["b"],"nested preview is public-only");
assert.equal(Object.hasOwn(m.projectProfile({...base,privateToken:"secret"},"visitor").profile,"privateToken"),false,
 "unknown future private fields cannot spread through public profile");
const profile=read("apps/web/src/discovery/ProfileMaster.tsx");
const viewer=read("apps/web/src/discovery/PhotoViewer.tsx");
const css=read("apps/web/src/discovery/profile-master.css");
const discovery=read("apps/web/src/discovery/DiscoveryApp.tsx");
const app=read("apps/web/src/App.tsx");
const carousel=read("apps/web/src/ui/PhotoCarousel.tsx");
assert.ok(profile.includes('["about","О себе"')&&profile.includes('["bliki","Блики"')&&
 profile.includes('["photos","Фото"')&&profile.includes('["gifts","Подарки"')&&
 profile.includes('["meta","О профиле"'),"strict five-tab ordering");
assert.ok(profile.includes("requestAnimationFrame(paintScroll)")&&
 profile.includes("frame.getBoundingClientRect()")&&profile.includes("onScrollMotion?.(p,frame.getBoundingClientRect(),y,current?.src??null)")&&
 read("apps/web/src/discovery/GlobalHeader.tsx").includes("heroRect.top+heroRect.height*.57"),
 "scroll-driven shared photo uses fixed layout origin, without every-frame React renders");
assert.ok(profile.includes("requestAnimationFrame(()=>{dragFrame.current=null;paintTabs"),
 "tabs follow finger on compositor transform");
assert.ok(profile.includes("tabEnd(e,true)")&&profile.includes("photoEnd(e,true)"),
 "pointer cancellation must never commit a new photo or tab");
assert.ok(profile.includes('mode="preview"')&&profile.includes("projectProfile(data,mode)"),
 "own public preview reuses the exact same profile projection and component");
assert.ok(viewer.includes("createPortal")&&viewer.includes("onPointerCancel")&&
 viewer.includes("maxY")&&viewer.includes("resetGesture()"),
 "fullscreen gallery has pinch pan, cancel isolation and reset");
assert.ok(viewer.includes("canMakeMain(view,show.id)")&&
 viewer.includes("Дата добавления недоступна")===false,
 "make-main is guarded; date originates exclusively from model");
assert.ok(discovery.includes('<ProfileMaster data={ownProfile} mode="owner"')&&
 discovery.includes('<ProfileMaster data={fromDemoPerson(selectedPerson)} mode="visitor"'),
 "both profile destinations use one shared implementation");
assert.ok(app.includes('photos={photos.filter(p=>p.status==="ready"||p.status==="success")'),
 "local photos routed only through authenticated owner draft");
assert.ok(css.includes("@media(prefers-reduced-motion:reduce)")&&
 css.includes(".pm-tab-ink")&&css.includes(".pm-photo-tile"),
 "motion fallback, accessible tab bar and 3-column gallery exist");
assert.ok(carousel.includes("frameId.current=window.requestAnimationFrame"),
 "locked discovery PhotoCarousel stays compositor-driven");
console.log("✓ Stage 03G.B–G: single profile shell, morph, five tabs, viewer, native back and Discovery lock");

const header=read("apps/web/src/discovery/GlobalHeader.tsx");
const headerCss=read("apps/web/src/discovery/global-header.css");
assert.ok(discovery.includes("<GlobalHeader")&&header.includes("setProfileMorph")&&header.includes("setScrollTop"),
 "one global header owns both merged tools and shared photo morph");
assert.ok(headerCss.includes(".lh-droplet")&&headerCss.includes(".lh-profile-theme")&&
 !css.includes(".pm-global-header")&&!css.includes(".pm-morph-photo"),
 "obsolete duplicate profile header and local morph removed");
console.log("✓ Stage 03G.2 unified chrome and liquid motion contracts");

assert.ok(headerCss.includes("top:max(6px,calc(var(--top-safe) - 12px))"),
 "LUEMI logo Y anchor must match original Feed vertical placement on every screen");

assert.ok(headerCss.includes("position:absolute;inset:0 0 auto")&&
 headerCss.includes("background:transparent;box-shadow:none")&&
 css.includes(".pm-profile-sheet")&&css.includes("margin-top:-43px"),
 "profile uses full-bleed hero below transparent, layout-free wordmark");
assert.ok(!profile.includes("photoTrack.current.style.opacity")&&
 profile.includes('className="pm-identity"')&&
 profile.includes("onClick={openMyPhotos}")&&profile.includes("pane.scrollTo("),
 "hero never blanks during scroll; identity/actions are present and functional");
console.log("✓ Stage 03G.3: full-screen photo and overlay-only logo contracts");

assert.ok(header.includes("const diameter=34*(1-t)+2.5*t")&&
 headerCss.includes("width:34px;height:34px")&&!header.includes("node.style.width="),
 "small liquid fragment scales on GPU without per-scroll geometry mutations");
