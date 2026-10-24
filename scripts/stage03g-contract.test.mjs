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
const profile=read("apps/web/src/discovery/ProfileMaster.tsx");
const viewer=read("apps/web/src/discovery/PhotoViewer.tsx");
const css=read("apps/web/src/discovery/profile-master.css");
const discovery=read("apps/web/src/discovery/DiscoveryApp.tsx");
const visitorRoute=read("apps/web/src/discovery/VisitorProfileRoute.tsx");
const app=read("apps/web/src/App.tsx");
const carousel=read("apps/web/src/ui/PhotoCarousel.tsx");
assert.ok(profile.includes('["about","О себе"')&&profile.includes('["bliki","Блики"')&&
 profile.includes('["photos","Фото"')&&profile.includes('["gifts","Подарки"')&&
 profile.includes('["meta","О профиле"'),"strict five-tab ordering");
assert.ok(profile.includes('pane.addEventListener("touchmove",move,{passive:!gesture.blocking})')&&
 profile.includes('viewport.current.scrollTop=Math.max(0,expandedY.current-Math.min(next,expandedY.current))')&&
 profile.includes('g.origin+dy')&&profile.includes('contentPages.current['),
 "sheet follows its actual origin while each tab retains native vertical scrolling");
assert.ok(profile.includes('if(g.axis==="x")paintTabs(g.index,dx)')&&
 profile.includes('frame=requestAnimationFrame'),
 "touch pager paints once per frame");
assert.ok(profile.includes("tabEnd(e,true)")&&profile.includes("photoEnd(e,true)"),
 "pointer cancellation must never commit a new photo or tab");
assert.ok(profile.includes('mode={data.source==="local-draft"?"local-self-preview":"preview"}')&&
 profile.includes("projectProfile(data,mode)"),
 "owner local preview uses explicit self-only projection, server preview remains public-only and both reuse ProfileMaster");
assert.ok(viewer.includes("createPortal")&&viewer.includes("onPointerCancel")&&
 viewer.includes("maxY")&&viewer.includes("resetGesture()"),
 "fullscreen gallery has pinch pan, cancel isolation and reset");
assert.ok(viewer.includes("canMakeMain(view,show.id)")&&
 viewer.includes("Дата добавления недоступна")===false,
 "make-main is guarded; date originates exclusively from model");
assert.ok(discovery.includes('<ProfileMaster data={ownProfile} mode="owner"')&&
 discovery.includes("<VisitorProfileRoute")&&visitorRoute.includes('<ProfileMaster data={data} mode="visitor"'),
 "both profile destinations use one shared implementation");
assert.ok(app.includes('photos={readyPhotos}')&&app.includes('readyRegistrationPhotos(photos)')&&
 read("apps/web/src/registration/Preview.tsx").includes('readyRegistrationPhotos(photos)')&&
 read("apps/web/src/registration/Preview.tsx").includes('mode="local-self-preview"')&&
 !read("apps/web/src/registration/Preview.tsx").includes("<PhotoCarousel"),
 "owner and step-8 share the exact ready-only photo adapter and authoritative ProfileMaster renderer");
assert.ok(css.includes("@media(prefers-reduced-motion:reduce)")&&
 css.includes(".pm-tab-ink")&&css.includes(".pm-photo-tile"),
 "motion fallback, accessible tab bar and 3-column gallery exist");
assert.ok(carousel.includes("frameId.current=window.requestAnimationFrame"),
 "locked discovery PhotoCarousel stays compositor-driven");
console.log("✓ Stage 03G profile projection, gestures, viewer, and safe public data");

const header=read("apps/web/src/discovery/GlobalHeader.tsx");
const headerCss=read("apps/web/src/discovery/global-header.css");
assert.ok(discovery.includes("<GlobalHeader")&&header.includes("setScrollTop")&&
 !header.includes("setProfileMorph")&&!headerCss.includes(".lh-droplet")&&
 !headerCss.includes(".lh-profile-info")&&!profile.includes("onScrollMotion"),
 "global W06 wordmark is unboxed, with no liquid/avatar or duplicated floating identity");
assert.ok(headerCss.includes("top:max(6px,calc(var(--top-safe) - 12px))"),
 "fixed global logo Y anchor across screens");
assert.ok(headerCss.includes("position:absolute;inset:0 0 auto")&&
 headerCss.includes("background:transparent;box-shadow:none")&&
 css.includes(".pm-profile-sheet")&&css.includes(".pm-sheet-viewport"),
 "full-bleed hero and rounded sheet keep independent stationary chrome");
assert.ok(profile.includes('className="pm-mini-avatar"')||
 profile.includes('className={"pm-mini-avatar"'),
 "small photo appears only in collapsed profile");
assert.ok(profile.includes('onClick={openMyPhotos}')&&profile.includes('settleSheet(true)')&&
 !profile.includes("BlikViewer")&&!profile.includes("setBlikOpen"),
 "gallery shortcut remains; unverified Blik viewer activation is fail-closed");
console.log("✓ Stage 03G.4: independent scroll and pinned controls, no liquid morph");
assert.equal((css.match(/^\.pm-profile-sheet\{/gm)||[]).length,1,
 "profile sheet has one authoritative CSS definition, not multiple overriding generations");
assert.ok(!css.includes("border-radius 390ms")&&css.includes("border-radius:34px 34px 0 0"),
 "sheet keeps stable rounded corners while moving on compositor");
assert.ok(css.includes(".pm-photo-blur")&&css.includes("filter:blur(11px)")&&
 profile.includes('blurLayer.current.style.opacity=String(progress*.9)'),
 "fixed blur opacity follows the sheet controller");
assert.ok(profile.includes("imageRect.height*.11")&&
 profile.includes('pane.style.setProperty("--pm-collapsed-top"'),
 "collapsed top overlaps lower 11% of measured actual logo instead of system controls");
assert.ok(profile.includes("const paintSheet=useCallback(")&&
 profile.includes('if(motionActive)motionCallback.current?.(progress,dragging)')&&
 header.includes("setProfileProgress")&&headerCss.includes(".lh-logo-contrast"),
 "only the visible profile drives blur and logo from the same progress");
assert.ok(profile.includes("tabMetrics.current")&&
 profile.includes('if(g.axis!=="x")return;')&&
 !profile.includes("indicator.style.width=width+"),
 "tab swipe does not read offsets/width every frame or replay horizontal motion on vertical scroll");
assert.ok(css.includes("flex-direction:row;")&&
 css.includes(".pm-tab.active{color:#a86ddd;background:transparent"),
 "tabs have horizontal label/icon and no selected rectangle");
assert.ok(css.includes(".pm-photo-progress button::before")&&
 css.includes(".pm-photo-progress button.active::before")&&
 css.includes("width:64px;height:64px"),
 "photo dots replace progress bars; rounded profile avatar is 64px");
console.log("✓ Stage 03G.5: stable safe-area sheet, synchronized blur and logo, compositor tabs and dot pager");



assert.ok(!profile.includes('style={{transform:`translate3d(')&&
 profile.includes('className="pm-pages-track" ref={pageTrack}')&&
 profile.includes('className="pm-photo-track" ref={photoTrack}'),
 "React cannot override imperative touch animation transforms on either photo or profile tabs");
assert.ok(profile.includes('},[motionActive,paintTabs]);')&&
 profile.includes('if(!first&&!changed)return;'),
 "tab geometry is measured only on activation or actual size changes");
assert.ok(profile.includes('pane.removeEventListener("touchmove",move);')&&
 profile.includes('passive:!gesture.blocking'),
 "native tab scroll avoids a permanent blocking touchmove listener");
assert.ok(css.includes('overflow-anchor:none;')&&
 css.includes('.pm-sheet-viewport')&&!css.includes('contain:layout paint')&&
 !css.includes('.pm-pages-track.is-finger-tracking'),
 "native profile scroll surfaces have no nested transformed paint containment");
assert.ok(header.includes("pendingTop.current=top")&&
 header.includes("toolsFrame.current=requestAnimationFrame")&&
 header.includes("lastControlsValue.current=v")&&
 header.includes("cancelAnimationFrame(toolsFrame.current)"),
 "browse logo controls are coalesced to one frame and stale paints are cancelled");
console.log("✓ Stage 03G.6 flicker regressions: single transform owner, passive native scroll, stable paint boundaries");

assert.ok(profile.includes('data-sheet-renderer="scroll"')&&!profile.includes("androidSafeSheet"),
 "one scroll renderer replaces divergent platform motion implementations");
assert.ok(profile.includes('pages.current.scrollLeft=position*tabViewport.current')&&
 !profile.includes('pageTrack.current.style.left'),
 "horizontal movement uses a stationary scroll viewport without animated left");
assert.ok(css.includes(".pm-sheet-viewport")&&
 !css.includes("transition:top")&&!css.includes("transition:left")&&
 !css.includes("data-sheet-renderer=layout"),
 "profile has no legacy layout-property animations or Android override cascade");
console.log("✓ Profile scroll motion replaces legacy top/left and transformed clipping");

const discoveryCss=read("apps/web/src/discovery/discovery.css");
assert.ok(discovery.includes("data-profile-renderer=")&&
 discoveryCss.includes("[data-profile-renderer=android][data-profile-overlay=true]")&&
 discoveryCss.includes(":not([data-route-revealing=true])")&&
 discoveryCss.includes(">.lh-header")&&
 !discovery.includes("data-profile-from-feed"),
 "all Android browsing sources share one hidden underlay, restored during route transitions");
assert.ok(header.includes("androidProfileChrome")&&
 header.includes("!androidProfileChrome&&<img")&&
 profile.includes("collapsedRef.current=next;")&&profile.includes("sheetIntent.current=null;")&&
 profile.includes("driver.rebase(sheetRevision.current,next,destination)")&&
 profile.includes("miniAvatar.current.style.opacity=")&&
 profile.includes("grab.current.style.opacity="),
 "Android single-raster header and progress-driven sheet controls avoid duplicate paints");
assert.ok(!profile.includes('ro.observe(button)')&&
 profile.includes("document.fonts.ready.then"),
 "tab metrics are not repeatedly reset by individual button resize observers");
console.log("✓ Android occluded browse layers, stable logo and sheet progress guards");
