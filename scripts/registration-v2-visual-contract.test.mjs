/**
 * Visual contract for the public cinematic registration. Static checks
 * catch accidental loss of Telegram chrome clearance, inherited token bridge,
 * input visibility and geo/language icon/dropdown specificity. Browser A55 QA
 * is still required; these assertions are NOT pixel-diff screenshots.
 */
import {readFileSync} from "node:fs";
import {strict as assert} from "node:assert";
const runtime=readFileSync("apps/web/src/registration/v2/runtime.css","utf8");
const form=readFileSync("apps/web/src/registration/v2/RealRegistration.tsx","utf8");
const steps=readFileSync("apps/web/src/registration/Steps.tsx","utf8");
const draftClient=readFileSync("apps/web/src/registration/server-draft.ts","utf8");
const app=readFileSync("apps/web/src/App.tsx","utf8");
const geo=readFileSync("apps/web/src/registration/GeoPicker.tsx","utf8");
const language=readFileSync("apps/web/src/registration/LanguagePicker.tsx","utf8");
const focusDock=readFileSync("apps/web/src/registration/use-field-focus.ts","utf8");
const required=[
 ["V2 runtime tokens",/\.v2-runtime\s*\{[^}]*--ink:/s],
 ["Telegram native clearance",/\.v2-runtime\[data-telegram-ui="true"\]\s+\.v2-device\s*\{[^}]*padding-top:max\(62px,[^}]*--tg-content-safe-area-inset-top[^}]*--tg-safe-area-inset-top[^}]*safe-area-inset-top/s],
 ["dark readable form inputs",/\.v2-runtime\s+\.glass-control,\.v2-runtime\s+\.v2-input\s*\{[^}]*background:rgba\(43,42,57,\.9\)/s],
 ["stable focused field dock",/\.v2-runtime\s+\.focus-field-shell\.is-focused\s*\{[^}]*position:fixed[^}]*--focused-dock-top/s],
 ["single confirm action",/\.v2-runtime\s+\.v2-next\.v2-next-confirm[^}]*display:grid/s],
 ["blurred borderless action fade",/\.v2-runtime\s+\.v2-footer\s*\{[^}]*position:absolute[^}]*border:0/s],
 ["geolocation and language search icon",/\.v2-runtime\s+\.geo-input-wrap>svg:first-child\s*\{/],
 ["search input text gutter",/\.v2-runtime\s+\.geo-input-wrap>\.glass-control\.geo-input/],
 ["opaque search scope list",/\.v2-runtime\s+\.scope-options\s*\{[^}]*background:#292336/s],
 ["scope list opens upward without covering the city field",/\.v2-runtime\s+\.scope-options\s*\{[^}]*position:relative;order:-1/s],
 ["quiet dark canvas",/\.v2-runtime\s*\{[^}]*background:#15131c/s]
];
for(const [description,pattern] of required)
 assert.match(runtime,pattern,description+" must stay visible on Android Telegram");
assert.match(form,/data-telegram-ui=\{window\.Telegram\?\.WebApp\?"true":"false"\}/,
 "Only actual Telegram surface should reserve native controls clearance");
assert.match(steps,/Я принимаю <a href="\/privacy"/,"Public policy acceptance must appear on the first identity step");
assert.match(draftClient,/policy!=="\/friends-test\.html"/,
 "Public remote drafts may not use beta-only privacy notices");
assert.match(form,/const stages:readonly VisualStage\[\]=visualStages/,"Every account follows the same eight visual steps");
assert.match(form,/Создать анкету 💜/,"Single real signup confirmation creates published profile");
assert.match(form,/<SimpleProfileReview draft=\{draft\} photos=\{photos\}/,
 "Signup preview must be a simple gallery, not interactive Profile Morph");
assert.doesNotMatch(form,/mode="local-self-preview" active/,
 "Interactive morph must never interrupt a registration review");
assert.match(form,/stage.id==="photos"&&<div className="v2-real-groups">/,
 "Photo selection and reordering stay on their dedicated step");
assert.doesNotMatch(form,/id:"main-photo"|stage.id==="main-photo"/,
 "The first uploaded photo is already the main photo; do not add a duplicate step");
assert.match(form,/className="v2-stage-heading"/,
 "Scrollable steps keep their heading in a dedicated sticky layer");
assert.match(runtime,/\.v2-stage-heading\{position:sticky;/,
 "Step headings must stay visible while the form scrolls");
assert.doesNotMatch(form,/photoServerCount|photoSyncBusy|onRetryPhotoSync|setServerConsent/,
 "No duplicate photo consent or network upload progress before final confirmation");
assert.match(app,/setJourney\("publishing"\)/,
 "Publication curtain must begin before saving photos on server");
assert.doesNotMatch(form,/id:"face-consent"|id:"liveness"|stage\.id==="main-photo"/,
 "No intermediate biometric or duplicate main-photo screens interrupt signup");
assert.match(form,/wordmark_original_raster_alpha_W06\.webp/,
 "The header uses the actual LUEMI mark, not a text approximation");
assert.match(runtime,/\.v2-header-logo\{[^}]*filter:brightness\(0\) invert\(1\)/s,
 "The original LUEMI mark appears white on the dark registration surface");
assert.match(form,/stage\.id==="personality"&&<div className="v2-real-groups">[\s\S]*?<OptionalProfileDetails/,
 "Optional about details live inside the scrollable interests and biography step");
assert.doesNotMatch(form,/v2-footer-optional|v2-stage-transition/,
 "The footer must not cover optional details, and step content must not animate twice");
assert.match(runtime,/html\[data-luemi-transition="true"\]::view-transition-old\(root\)/,
 "A step transition suppresses the browser's duplicate full-screen crossfade");
assert.match(form,/nativeTransition\.call\(viewDocument,update\)/,
 "WebView document transitions retain their receiver and do not throw Illegal invocation");
assert.match(runtime,/\.v2-runtime\[data-fallback-entry="true"\]\{animation:luemi-registration-enter/,
 "The registration entrance animates only when native route transitions are unavailable");
assert.doesNotMatch(runtime,/^\.v2-runtime\s*\{[^}]*animation:luemi-registration-enter/ms,
 "The native route must not restart its CSS entrance after the transition settles");
assert.match(runtime,/\.v2-body\{[^}]*touch-action:pan-y/s,
 "Long signup steps remain vertically scrollable on touch screens");
assert.match(runtime,/\.v2-runtime \.interest-choices\{overflow:visible;flex:none/,
 "The interests panel must not trap vertical swipes inside the page");
assert.match(runtime,/\.v2-runtime \.mosaic,\.v2-runtime \.mosaic-slot\{touch-action:pan-y\}/,
 "Photos permit vertical page scrolling while the drag handle keeps its own gesture");
assert.doesNotMatch(app,/setWelcomeExiting\(true\)|transitionTimer\.current=window\.setTimeout\(\(\)=>\{\s*setPhase\("form"\)/,
 "Older WebViews enter the form without a timed blank frame between two animations");
assert.doesNotMatch(form,/className="v2-count"/,
 "The decorative step counter must not compete with the progress line");
assert.match(form,/className="v2-progress-fill" style=\{\{transform:`scaleX/,
 "The single progress line fills smoothly");
assert.doesNotMatch(app,/registration-load-card|Открываем регистрацию/,
 "Entering registration must not flash a branded loader");
assert.match(form,/aria-valuemax=\{stages\.length\}/,
 "Progress count must reflect actual signup steps");
assert.match(app,/const registrationV2Pilot=remoteDraftPilot\.enabled/,
 "Every server-backed registration must use V2 without a legacy feature-flag fallback");
assert.match(app,/publicMediaUiMissing=import\.meta\.env\.VITE_LUEMI_OPEN_SIGNUPS_UI/,
 "Open public signup UI must fail closed without private server media");
assert.match(app,/readConfirmedPrivateMediaCount\(photos\.length,uploadedIds\)/,
 "Registration cannot confirm unrelated older private photos");
assert.match(app,/if\(confirmed.state!=="published"\|\|!confirmed.profile\)/,
 "Profile may open only after server-confirmed publication");
assert.match(app,/setRealHome\(false\);setPhase\("form"\)/,
 "Interrupted uploads remain in signup and may be resumed without an empty profile");
assert.match(app,/await warmPublishedRecommendations\(controller.signal/,
 "Publication prepares real recommendations and photos before opening home");
assert.match(app,/setJourney\("error"\)/,
 "A failed upload must offer recovery instead of falsely claiming published status");

assert.match(app,/await saveDraftSnapshot\(scope,draftId\.current,photoRevision,draft,8,photos\)/,
 "Private signup requires a confirmed local photo snapshot before server save");
assert.match(app,/if\(realHome&&auth==="authorized"&&realFeedPilot.enabled\)/,
 "Published users retain the accepted REAL_ONLY discovery shell");
assert.match(app,/<RealDiscoveryHome draft=\{draft\}/,
 "The full discovery and profile route is available after one-tap creation");
assert.match(app,/setWarmFeed\(warmed.page\)/,
 "The accepted home is hydrated from authenticated server feed warmup");
assert.match(app,/if\(!local\.ok\)\{/,
 "Private signup must refuse entry when photo persistence fails");
assert.doesNotMatch(form,/<a[^>]*>\s*условия закрытого теста<\/a>/,
 "Public registration cannot hardcode closed-beta consent links");
assert.match(geo,/<Search size=\{20\}/,"City field needs search icon");
assert.match(geo,/<LocateFixed size=\{15\}/,"Manual city search needs detect icon");
assert.match(language,/<Search size=\{18\}/,"Language input needs search icon");
assert.match(focusDock,/visualViewport[\s\S]*requestAnimationFrame\(update\)/,
 "Keyboard dock must coalesce Android viewport animation into one writer");
assert.match(form,/--registration-visible-bottom[\s\S]*--registration-layout-height/,
 "The focused editor must use one visual viewport bottom coordinate without double keyboard compensation");
assert.match(focusDock,/pinnedTop=Math\.max\(headerBottom\+12,Math\.min\(pinnedTop,[\s\S]*slotTop-dockTop[\s\S]*shell\.animate\(/,
 "Focused field must rise smoothly and stay pinned when the keyboard closes");
assert.doesNotMatch(focusDock,/ResizeObserver|shell\.getBoundingClientRect\(\)\.height/,
 "Changing city suggestions must not feed the editor height back into keyboard placement");
assert.match(form,/<section key=\{stage\.id\}[^>]*>[\s\S]*?<div className="v2-focus-scrim"/,
 "Body blur stays in the same stacking layer as the focused field");
assert.match(runtime,/\.v2-focus-scrim\{[^}]*backdrop-filter:blur\(44px\)[^}]*transition:opacity/s,
 "Blur strength stays fixed while its appearance fades smoothly");
assert.match(runtime,/\.v2-device\[data-field-focus="true"\] \.v2-body\{[^}]*z-index:2/s,
 "Focused field paints above the body scrim instead of disappearing below it");
assert.match(form,/--registration-visible-bottom[\s\S]*--registration-layout-height/,
 "Viewport height and editor dock must come from one visual viewport measurement");
assert.match(runtime,/\.city-focus-shell \.geo-results\{position:absolute[^}]*bottom:calc\(100% \+ 9px\)/,
 "City suggestions must open above the docked editor");
assert.match(steps,/className="about-input-shell"[\s\S]*className="char-count"/,
 "Biography count must sit inside its text field");
assert.match(geo,/className="scope-popover-anchor"/,
 "Search scope menu needs an upward in-flow anchor");
assert.match(app,/className="intro-subtitle">Реальные люди\. Настоящие эмоции/,
 "Welcome screen needs the cinematic supporting line");
assert.match(app,/webApp\?\.setBottomBarColor\?\.\(background\)/,
 "Android system navigation area must match the active registration background");
assert.doesNotMatch(runtime,/(?:^|\n)\s*(?:input|\.glass-control|\.scope-options)\s*\{/,
 "Do not override unrelated app global input styles");
console.log("Registration V2 Telegram-safe visual contracts: PASS ("+required.length+" selectors)");

const session=readFileSync("apps/web/src/auth/session-adapter.ts","utf8");
const localDraft=readFileSync("apps/web/src/registration/local-draft.ts","utf8");
const mediaClient=readFileSync("apps/web/src/registration/server-media.ts","utf8");
const mediaBackend=readFileSync("apps/api/src/rem05d-private.ts","utf8");
assert.match(session,/verifiedActorId=user.id/,"Registration scope must use verified server identity");
assert.match(localDraft,/return verifiedRegistrationScope\(\)/,
 "Live local photos must be isolated by the server-confirmed Telegram account");
assert.doesNotMatch(steps,/Очистить локальный черновик|Это согласие принимается один раз/,
 "Registration may not show debugging or redundant consent text");
assert.match(form,/RegistrationConsent data=\{draft\} patch=\{p.patch\}/,
 "Consent must appear once after birthday and gender");
assert.match(form,/className="v2-footer-review"/,
 "Review confirmation actions replace disabled footer navigation");
assert.match(mediaClient,/for\(const edge of \[800,384\]\)/,
 "A failed image upload retries with a compact PNG");
assert.match(mediaBackend,/existing.rows\[0\].asset_state!=="reserved"/,
 "Retry cannot change any already accepted or published upload");
