import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=read("apps/web/src/App.tsx"),steps=read("apps/web/src/registration/Steps.tsx");
const style=read("apps/web/src/styles.css"),sorter=read("apps/web/src/registration/PhotoSorter.tsx");
const preview=read("apps/web/src/registration/Preview.tsx"),geo=read("apps/web/src/registration/GeoPicker.tsx");
const model=read("apps/web/src/registration/model.ts");
const catalog=read("apps/web/src/ui/InterestCatalog.tsx");
const realRegistration=read("apps/web/src/registration/v2/RealRegistration.tsx");
const languages=read("apps/web/src/ui/Languages.ts");
const assertCheck=(s,test)=>{assert.ok(test,s);console.log("✓",s)};
assertCheck("cinematic welcome stages branding and CTA after auth, draft and publication readiness",
 app.includes('heroSceneReady=visualReady&&heroViewportReady&&heroImageReady')&&
 app.includes('registrationEntryReady=heroSceneReady&&introSequenceComplete&&auth==="authorized"')&&
 app.includes('photosRestored&&storageState!=="loading"&&storageState!=="error"')&&
 app.includes('publicationCheck==="ready"')&&
 app.includes('"Зарегистрироваться"')&&app.includes('"Продолжить регистрацию"')&&
 style.includes("text-enter")&&!style.includes("brand-liquid")&&!style.includes(".intro-mark::after"));
assertCheck("no old loader overlay",!style.includes("loading-track")&&!app.includes("welcome-screen"));
assertCheck("Telegram native BackButton; NO custom top back button",app.includes("BackButton")&&app.includes("onboard-brand-row")&&!app.includes("top-back"));
const welcomeChrome=read("apps/web/src/registration/cinematic-welcome.css");
const sharedHeader=read("apps/web/src/discovery/global-header.css");
assertCheck("all routes use Telegram fullscreen with one brand safe-area offset",
 app.includes('webApp.requestFullscreen()')&&
 app.includes('webApp?.onEvent?.("activated",enterFullscreen)')&&
 !app.includes('webApp.exitFullscreen?.()')&&
 style.includes("--top-safe:max(")&&
 /--brand-top:max\(calc\(var\(--top-safe\) \+ 18px\),84px\)/.test(style)&&
 welcomeChrome.includes("top:var(--brand-top);left:20px")&&
 sharedHeader.includes("top:var(--brand-top);left:14px")&&
 !welcomeChrome.includes("top:calc(var(--top-safe) + 32px)")&&
 !sharedHeader.includes("top:calc(var(--top-safe) + 28px)"));
assertCheck("Sunset Cherry dark theme is the only application theme",app.includes('const activeTheme="dark"')&&!app.includes("changeTheme")&&!app.includes("themeButton"));
assertCheck("keyboard preserves footer and uses one viewport model instead of double-compensating",app.includes("installViewportController")&&style.includes("height:var(--app-height")&&style.includes(".onboard-body{flex:1")&&!style.includes("[data-keyboard=open] .onboard-footer{display:none}")&&!style.includes("margin-bottom:var(--keyboard-overlay")&&style.includes("data-viewport-compact"));
assertCheck("input focus glass uses subtle inset ring without clipping",style.includes("inset 0 0 0 1px")&&style.includes(".glass-control:focus"));
assertCheck("city, radius, world and legacy country search scopes are backward-compatible",
 model.includes('SearchScope = "radius" | "city" | "country" | "world"')&&
 geo.includes('["city","Мой город"')&&geo.includes("geo-liquid-city")&&
 geo.includes('data.searchScope==="country"'));
assertCheck("nearby automatically ranks by city distance without a user-adjusted slider",
 geo.includes("Ближайшие сначала")&&!geo.includes("radiusAt")&&
 !geo.includes('aria-label="Радиус поиска, километры"'));
assertCheck("expanded goals, undecided first and gendered selection",
 model.includes('{id:"undecided"')&&model.includes('{id:"family_goal"')&&
 model.includes('{id:"travel_partner"')&&steps.includes("goalLabel(goal.id,data.gender)"));
assertCheck("202 stable interests, curated colors and search in onboarding",
 catalog.includes("expandedSource")&&catalog.includes("export const categories")&&
 steps.includes("interest-search")&&realRegistration.includes("v2-sticky-interests")&&
 steps.includes("data.interests.length>=20")&&app.includes("SelectedInterests")&&
 style.includes(".selected-interests-floating"));
assertCheck("retired registration language UI removed while profile catalog remains",languages.includes("export const languages")&&!steps.includes("LanguagePicker")&&!style.includes(".language-picker"));
assertCheck("portal drag renders at actual viewport finger coordinates",sorter.includes("createPortal")&&sorter.includes("getBoundingClientRect")&&sorter.includes("setDrag"));
assertCheck("photo reorder has FLIP animation and main label",sorter.includes("node.animate(")&&sorter.includes("Главное"));
assertCheck("single static registration preview with explicit edit and confirm actions",preview.includes("registration-static-profile")&&preview.includes("registration-static-avatar")&&app.includes("registration-static-actions")&&app.includes("Редактировать")&&app.includes("Всё верно")&&!preview.includes("ProfileMaster")&&!preview.includes("preview-tabs"));
assertCheck("local images remain local only",sorter.includes("snapshot")&&!app.includes("uploadPhoto"));

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
assertCheck("About, photo reordering and local review lead to explicit publication",
  realRegistration.includes('stage.id==="about"')&&
  realRegistration.includes('step(6)')&&
  realRegistration.includes('step(5)')&&
  realRegistration.includes('stage.id==="photos"')&&
  realRegistration.includes('stage.id==="review"')&&
  realRegistration.includes("else nav(index+1)")&&
  realRegistration.includes('case "review":p.onSave();return;')&&
  realRegistration.includes("Посмотреть анкету")&&
  realRegistration.includes("Редактировать")&&
  realRegistration.includes("Создать анкету")&&
  !realRegistration.includes('id:"languages"'));
assertCheck("branded publication curtain starts before private photo upload",
 app.includes('setJourney("publishing")')&&
 app.includes("const uploadedIds=await syncChosenPhotos(true)")&&
 app.indexOf('setJourney("publishing")')<app.indexOf("const uploadedIds=await syncChosenPhotos(true)")&&
 journey.includes("luemi-publication-orbit")&&
 journey.includes("luemi-publication-progress")&&
 journey.includes("onRetry")&&journey.includes("onBack"));
assertCheck("first-entry hero headline and subtitle can appear while auth is preparing",
 app.includes('>Больше, чем знакомства</h1>')&&
 app.includes('className="intro-subtitle">Реальные люди. Настоящие эмоции.')&&
 app.includes('heroSceneReady&&introSequenceComplete')&&
 !app.includes('className="luemi-privacy-footer"'));
assertCheck("cinematic hero, staged copy and touch feedback respect reduced motion",
 welcomeChrome.includes("luemi-hero-drift")&&welcomeChrome.includes("luemi-hero-logo")&&
 welcomeChrome.includes("luemi-hero-line")&&
 welcomeChrome.includes(".primary-action:active:not(:disabled)")&&
 welcomeChrome.includes("@media(prefers-reduced-motion:reduce)"));

const catalogSource=catalog.match(/const source=(\[[^\n]+?\]);/);
const expandedCatalog=catalog.match(/const expandedSource=(\[[^\n]+?\]);/);
assertCheck("catalog contains 202 unique interests across 17 stable categories",
 Boolean(catalogSource)&&Boolean(expandedCatalog)&&(()=>{
  const all=[...JSON.parse(catalogSource[1]),...JSON.parse(expandedCatalog[1])];
  return all.length===17 && new Set(all.flatMap(c=>c.items.map(i=>i.id))).size===202 &&
    all.every(c=>c.items.length>=12&&c.items.length<=16);
 })());
const listSource=languages.match(/export const languages:LanguageOption\[\]=(\[.*?\]);\s*export function/s);
assertCheck("language catalog contains exactly sixty distinct BCP47 codes",Boolean(listSource)&&(()=>{
 const all=JSON.parse(listSource[1]);return all.length===60&&new Set(all.map(x=>x.id)).size===60;
})());
const flags=readdirSync(new URL("../apps/web/public/assets/flags/",import.meta.url)).filter(x=>/^[a-z]{2}\.svg$/.test(x));
assertCheck("66 genuine circular SVG flags shipped locally",flags.length===66);
assertCheck("one theme and preview; registration route uses scoped transition",!style.includes(".preview-tabs{")&&!style.includes(".review-actions{")&&!style.includes(".theme-pulsing")&&app.includes("viewDocument.startViewTransition")&&app.includes('dataset.luemiRoute="true"'));

const draftStore=read("apps/web/src/registration/local-draft.ts");
const forms=read("apps/web/src/registration/Steps.tsx");
assertCheck("device-local registration data and photos survive Telegram reopening",app.includes("loadDraftSnapshot")&&app.includes("saveDraftSnapshot")&&app.includes("clearDraftSnapshot")&&draftStore.includes("indexedDB")&&draftStore.includes('transaction(STORE,"readwrite")')&&draftStore.includes("parseEnvelope"));
assertCheck("photo preparation completes after the bounded screen copy is ready",app.includes("preparePhotoPreview")&&app.includes('status:"success",progress:100')&&sorter.includes("photo-processing-bar"));
assertCheck("no redundant arrow photo controls",!sorter.includes("photo-reorder-buttons")&&sorter.includes('event.altKey'));
assertCheck("native tap highlight disabled globally",style.includes("-webkit-tap-highlight-color:transparent"));
assertCheck("selected interest chips use pastel feedback without duplicate checkmarks",
 style.includes(".interest-chip.selected{")&&!style.includes(".interest-chip.selected::after")&&
 read("apps/web/src/registration/v2/runtime.css").includes(".interest-chip.selected{color:#2C1423;transform:none;"));
assertCheck("interest categories fixed while only interest list scrolls",style.includes(".onboard-body:has(.interests-step)")&&style.includes(".interests-step .interest-choices"));
assertCheck("legacy language picker no longer ships its old chip CSS",!style.includes(".language-flag-selected")&&!style.includes(".language-chip active"));
assertCheck("global shell uses Sunset Cherry semantic colors",style.includes("--bg:var(--luemi-bg)")&&style.includes("--ink:var(--luemi-text)"));
assertCheck("name validation reports invalid characters visibly",forms.includes("name-input-hint")&&forms.includes("updateName"));
console.log("LUEMI Stage 02G UI contracts PASS");

const discovery=read("apps/web/src/discovery/DiscoveryApp.tsx");
const feedCard=read("apps/web/src/discovery/FeedCard.tsx");
const feedCss=read("apps/web/src/discovery/moonstone-discovery.css");
const discoveryCss=read("apps/web/src/discovery/discovery.css");
const header=read("apps/web/src/discovery/GlobalHeader.tsx");
const carousel=read("apps/web/src/ui/PhotoCarousel.tsx");
const profile=read("apps/web/src/discovery/ProfileMorphA2.tsx");
assertCheck("Discovery retains four main navigation destinations and three discovery tabs",
 ["Знакомства","Симпатии","Чаты","Профиль","Лента","Для тебя","Мир"].every(x=>discovery.includes(x)));
assertCheck("feed card exposes pass and one combined like/superlike control",
 feedCard.includes('performAction("pass")')&&feedCard.includes('commit("like")')&&feedCard.includes('commit("special")'));
assertCheck("photos remain an independent carousel",feedCard.includes("<PhotoCarousel")&&carousel.includes("requestAnimationFrame")&&discovery.includes("target.closest"));
assertCheck("the card owns photo swipes and profile morph; browse pager never steals them",
 discovery.includes('target.closest(".moonstone-feed-card")')&&
 feedCard.includes('carousel?.canAdvance')&&carousel.includes('canAdvance:(direction:-1|1)')&&
 feedCard.includes('onPointerMoveCapture={move}')&&
 feedCard.includes('axis:"pending"|"photo"|"info"|"scroll"'));
assertCheck("Moonstone overlays compact profile information on the fullscreen photo",feedCard.includes('className="moonstone-compact-info"')&&feedCard.includes('className="moonstone-photo"')&&feedCss.includes(".moonstone-compact-info"));
assertCheck("about and interests exist only in the expanded drawer",feedCard.includes("moonstone-detail-section")&&feedCard.includes("setExpanded")&&feedCard.includes("moonstone-profile-drawer"));
assertCheck("action buttons remain within each keyed card",feedCard.includes('className="moonstone-actions"')&&discovery.includes("<FeedCard person={candidate}")&&discovery.includes('profiles.slice(feed.index,feed.index+2).map'));
assertCheck("retired bookmark and standalone superlike controls are absent",!feedCard.includes("discovery-save-control")&&!feedCard.includes('onAction("save")'));
assertCheck("responsive card motion uses ResizeObserver",feedCard.includes("ResizeObserver")&&feedCard.includes("travel.current"));
assertCheck("single original LUEMI logo retained without removed global controls",header.includes("wordmark_original_raster_alpha_W06.webp")&&!header.includes("lh-tool-filter")&&!header.includes("lh-tool-saved"));
assertCheck("feed deck and Telegram back handling retained",discovery.includes("pendingCommit.current")&&discovery.includes("registerBack")&&discoveryCss.includes(".discovery-page"));
assertCheck("profile photo viewer and independent gestures remain present",profile.includes("PhotoViewer")&&profile.includes("setPointerCapture"));
console.log("LUEMI Discovery V2 UI contracts PASS");
