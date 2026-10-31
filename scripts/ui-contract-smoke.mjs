import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=read("apps/web/src/App.tsx"),steps=read("apps/web/src/registration/Steps.tsx");
const style=read("apps/web/src/styles.css"),sorter=read("apps/web/src/registration/PhotoSorter.tsx");
const preview=read("apps/web/src/registration/Preview.tsx"),geo=read("apps/web/src/registration/GeoPicker.tsx");
const model=read("apps/web/src/registration/model.ts");
const catalog=read("apps/web/src/ui/InterestCatalog.tsx");
const languages=read("apps/web/src/ui/Languages.ts");
const assertCheck=(s,test)=>{assert.ok(test,s);console.log("✓",s)};
assertCheck("approved single intro keeps the auth/publication gate without duplicated white raster shimmer",/auth==="authorized"&&introElapsed&&visualReady&&\s*!\(realFeedPilot\.enabled&&publicationCheck==="checking"\)&&<div className="intro-cta">/.test(app)&&style.includes("text-enter")&&!style.includes("brand-liquid")&&!style.includes(".intro-mark::after"));
assertCheck("no old loader overlay",!style.includes("loading-track")&&!app.includes("welcome-screen"));
assertCheck("Telegram native BackButton; NO custom top back button",app.includes("BackButton")&&app.includes("onboard-brand-row")&&!app.includes("top-back"));
assertCheck("dark theme is the only application theme",app.includes('const theme:ThemeChoice="dark"')&&!app.includes("themeButton"));
assertCheck("keyboard preserves footer and uses one viewport model instead of double-compensating",app.includes("installViewportController")&&style.includes("height:var(--app-height")&&style.includes(".onboard-body{flex:1")&&!style.includes("[data-keyboard=open] .onboard-footer{display:none}")&&!style.includes("margin-bottom:var(--keyboard-overlay")&&style.includes("data-viewport-compact"));
assertCheck("input focus glass uses subtle inset ring without clipping",style.includes("inset 0 0 0 1px")&&style.includes(".glass-control:focus"));
assertCheck("three exclusive search modes",model.includes('SearchScope = "radius" | "country" | "world"')&&geo.includes("scopeOptions"));
assertCheck("range 5000km mapped nonlinearly",geo.includes("radiusAt")&&geo.includes("4999"));
assertCheck("six goals including undecided",model.includes('"undecided"')&&model.includes("Серьёзные отношения")&&steps.includes("goalIcons"));
assertCheck("ten interest categories and floating selection",catalog.includes("export const categories")&&app.includes("SelectedInterests")&&style.includes(".selected-interests-floating"));
assertCheck("60 searchable languages with true vector flags",languages.includes("export const languages")&&read("apps/web/src/registration/LanguagePicker.tsx").includes("<Flag"));
assertCheck("portal drag renders at actual viewport finger coordinates",sorter.includes("createPortal")&&sorter.includes("getBoundingClientRect")&&sorter.includes("setDrag"));
assertCheck("photo reorder has FLIP animation and main label",sorter.includes("node.animate(")&&sorter.includes("Главное"));
assertCheck("single static registration preview with explicit edit and confirm actions",preview.includes("registration-static-profile")&&preview.includes("registration-static-avatar")&&app.includes("registration-static-actions")&&app.includes("Редактировать")&&app.includes("Всё верно")&&!preview.includes("ProfileMaster")&&!preview.includes("preview-tabs"));
assertCheck("local images remain local only",sorter.includes("snapshot")&&!app.includes("uploadPhoto"));

const realRegistration=read("apps/web/src/registration/v2/RealRegistration.tsx");
const simpleReview=read("apps/web/src/registration/SimpleProfileReview.tsx");
const journey=read("apps/web/src/registration/PublicationJourney.tsx");
assertCheck("single registration consent appears on identity step",
 steps.includes('Я принимаю <a href="/privacy"')&&
 realRegistration.includes('stage.id==="identity"')&&
 realRegistration.includes("step(1)")&&
 !realRegistration.includes("setServerConsent")&&
 !realRegistration.includes("photoServerCount")&&
 !realRegistration.includes("onRetryPhotoSync"));
assertCheck("photo selection and sorting finish before network publication",
 realRegistration.includes('stage.id==="photos"')&&
 realRegistration.includes("findExactDuplicatePhotoIds(photos)")&&
 !app.includes("void syncChosenPhotos(serverConsent)")&&
 !realRegistration.includes("syncChosenPhotos"));
assertCheck("new review is simple and has a single create-profile action",
 realRegistration.includes('<SimpleProfileReview draft={draft} photos={photos}/>')&&
 realRegistration.includes('onClick={p.onSave}')&&
 realRegistration.includes("Создать анкету")&&
 simpleReview.includes("luemi-simple-review")&&
 !simpleReview.includes("Сохраняем фотографии на сервере"));
assertCheck("branded publication curtain starts before private photo upload",
 app.includes('setJourney("publishing")')&&
 app.includes("const uploadedIds=await syncChosenPhotos(true)")&&
 app.indexOf('setJourney("publishing")')<app.indexOf("const uploadedIds=await syncChosenPhotos(true)")&&
 journey.includes("luemi-publication-orbit")&&
 journey.includes("luemi-publication-progress")&&
 journey.includes("onRetry")&&journey.includes("onBack"));
assertCheck("connecting and existing-profile checks display logo without extra welcome copy",
 app.includes('auth!=="connecting"')&&
 app.includes('publicationCheck==="checking"')&&
 !app.includes('className="luemi-privacy-footer"'));


const catalogSource=catalog.match(/const source=(\[.*?\]);\s*export const categories/s);
assertCheck("catalog contains exactly ten 12–16 item categories",Boolean(catalogSource) && (() => {
 const all=JSON.parse(catalogSource[1]);return all.length===10 && all.every(c=>c.items.length>=12&&c.items.length<=16);
})());
const listSource=languages.match(/export const languages:LanguageOption\[\]=(\[.*?\]);\s*export function/s);
assertCheck("language catalog contains exactly sixty distinct BCP47 codes",Boolean(listSource)&&(()=>{
 const all=JSON.parse(listSource[1]);return all.length===60&&new Set(all.map(x=>x.id)).size===60;
})());
const flags=readdirSync(new URL("../apps/web/public/assets/flags/",import.meta.url)).filter(x=>/^[a-z]{2}\.svg$/.test(x));
assertCheck("66 genuine circular SVG flags shipped locally",flags.length===66);
assertCheck("one theme and preview; registration route uses scoped transition",!style.includes(".preview-tabs{")&&!style.includes(".review-actions{")&&!style.includes(".theme-pulsing")&&app.includes("viewDocument.startViewTransition")&&app.includes('dataset.luemiRoute="true"'));

const draftStore=read("apps/web/src/registration/local-draft.ts");
const lang=read("apps/web/src/registration/LanguagePicker.tsx");
const forms=read("apps/web/src/registration/Steps.tsx");
assertCheck("device-local registration data and photos survive Telegram reopening",app.includes("loadDraftSnapshot")&&app.includes("saveDraftSnapshot")&&app.includes("clearDraftSnapshot")&&draftStore.includes("indexedDB")&&draftStore.includes('transaction(STORE,"readwrite")')&&draftStore.includes("parseEnvelope"));
assertCheck("photo preparation completes after the bounded screen copy is ready",app.includes("preparePhotoPreview")&&app.includes('status:"success",progress:100')&&sorter.includes("photo-processing-bar"));
assertCheck("no redundant arrow photo controls",!sorter.includes("photo-reorder-buttons")&&sorter.includes('event.altKey'));
assertCheck("native tap highlight disabled globally",style.includes("-webkit-tap-highlight-color:transparent"));
assertCheck("selected interest chips have visible increased feedback",style.includes("transform:scale(1.055)")&&style.includes(".interest-chip.selected::after"));
assertCheck("interest categories fixed while only interest list scrolls",style.includes(".onboard-body:has(.interests-step)")&&style.includes(".interests-step .interest-choices"));
assertCheck("selected languages show only accessible flags",lang.includes('className="language-flag-selected"')&&!lang.includes('className="language-chip active"'));
assertCheck("language search uses three columns",style.includes("grid-template-columns:repeat(3,minmax(0,1fr))"));
assertCheck("name validation reports invalid characters visibly",forms.includes("name-input-hint")&&forms.includes("updateName"));
console.log("LUEMI Stage 02G UI contracts PASS");

const discovery=read("apps/web/src/discovery/DiscoveryApp.tsx");
const feedCard=read("apps/web/src/discovery/FeedCard.tsx");
const feedCss=read("apps/web/src/discovery/feed-v2.css");
const discoveryCss=read("apps/web/src/discovery/discovery.css");
const header=read("apps/web/src/discovery/GlobalHeader.tsx");
const carousel=read("apps/web/src/ui/PhotoCarousel.tsx");
const profile=read("apps/web/src/discovery/ProfileMorphA2.tsx");
assertCheck("Discovery retains four main navigation destinations and three discovery tabs",
 ["Знакомства","Симпатии","Чаты","Профиль","Лента","Для тебя","Рядом"].every(x=>discovery.includes(x)));
assertCheck("feed card retains four explicit reaction controls",["undo","pass","special","like"].every(x=>feedCard.includes('"'+x+'"')));
assertCheck("photos remain an independent carousel",feedCard.includes("<PhotoCarousel")&&carousel.includes("requestAnimationFrame")&&discovery.includes("target.closest"));
assertCheck("card details and photo edges hand off horizontal swipes to the pager",
 discovery.includes("cardGestureZone(event.clientY,rect.top,rect.height)")&&
 discovery.includes('target.closest(".feed-v2-details,.feed-v2-photo .carousel-frame")')&&
 feedCard.includes('photo.current?.canAdvance')&&carousel.includes('canAdvance:(direction:-1|1)')&&
 read("apps/web/src/discovery/card-gesture-zone.ts").includes("height*.85"));
assertCheck("feed V2 overlays profile information on photo",feedCard.includes('className="feed-v2-information"')&&feedCard.includes('discovery-photo feed-v2-photo')&&feedCss.includes(".feed-v2-information"));
assertCheck("collapsed about and expanded interests remain available",feedCard.includes("discovery-short-about")&&feedCard.includes("setExpanded")&&feedCard.includes("feed-v2-interests"));
assertCheck("action buttons remain within the keyed card",feedCard.includes('className="discovery-actions"')&&discovery.includes("<FeedCard person={person}")&&discovery.includes("<FeedCard person={profiles[feed.index+1]}"));
assertCheck("save bookmark stays on card",feedCard.includes("discovery-save-control")&&feedCard.includes('onAction("save")'));
assertCheck("responsive card height uses ResizeObserver",feedCard.includes("ResizeObserver")&&feedCard.includes("dataset.size"));
assertCheck("single original LUEMI logo retained without removed global controls",header.includes("wordmark_original_raster_alpha_W06.webp")&&!header.includes("lh-tool-filter")&&!header.includes("lh-tool-saved"));
assertCheck("feed deck and Telegram back handling retained",discovery.includes("pendingCommit.current")&&discovery.includes("registerBack")&&discoveryCss.includes(".discovery-page"));
assertCheck("profile photo viewer and independent gestures remain present",profile.includes("PhotoViewer")&&profile.includes("setPointerCapture"));
console.log("LUEMI Discovery V2 UI contracts PASS");
