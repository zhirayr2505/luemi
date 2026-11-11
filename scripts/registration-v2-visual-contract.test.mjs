/**
 * Visual contract for the public cinematic registration. Static checks
 * catch accidental loss of Telegram chrome clearance, inherited token bridge,
 * input visibility and geo/language icon/dropdown specificity. Browser A55 QA
 * is still required; these assertions are NOT pixel-diff screenshots.
 */
import {readFileSync} from "node:fs";
import {strict as assert} from "node:assert";
const runtime=readFileSync("apps/web/src/registration/v2/runtime.css","utf8");
const preview=readFileSync("apps/web/src/registration/v2/preview.css","utf8");
const form=readFileSync("apps/web/src/registration/v2/RealRegistration.tsx","utf8");
const steps=readFileSync("apps/web/src/registration/Steps.tsx","utf8");
const draftClient=readFileSync("apps/web/src/registration/server-draft.ts","utf8");
const app=readFileSync("apps/web/src/App.tsx","utf8");
const geo=readFileSync("apps/web/src/registration/GeoPicker.tsx","utf8");
const glass=readFileSync("apps/web/src/ui/Glass.tsx","utf8");
const focusDock=readFileSync("apps/web/src/registration/use-field-focus.ts","utf8");
const required=[
 ["V2 runtime tokens",/\.v2-runtime\s*\{[^}]*--ink:/s],
  ["Telegram clearance only on the shared header",/\.v2-runtime\[data-telegram-ui="true"\]\s*\{[^}]*--registration-header-top:max\(82px,[^}]*--tg-content-safe-area-inset-top[^}]*--tg-safe-area-inset-top[^}]*safe-area-inset-top/s],
 ["dark readable form inputs",/\.v2-runtime\s+\.glass-control,\.v2-runtime\s+\.v2-input\s*\{[^}]*background:rgba\(43,42,57,\.9\)/s],
 ["stable focused field dock",/\.v2-runtime\s+\.focus-field-shell\.is-focused\s*\{[^}]*position:fixed[^}]*--focused-dock-top/s],
 ["single confirm action",/\.v2-runtime\s+\.v2-next\.v2-next-confirm[^}]*display:grid/s],
 ["blurred borderless action fade",/\.v2-runtime\s+\.v2-footer\s*\{[^}]*position:absolute[^}]*border:0/s],
  ["city search icon retains its text gutter",/\.v2-runtime\s+\.geo-input-wrap>svg:first-child\s*\{/],
 ["search input text gutter",/\.v2-runtime\s+\.geo-input-wrap>\.glass-control\.geo-input/],
  ["compact city suggestions open above input",/\.v2-runtime \.city-focus-shell \.geo-results\{[^}]*position:absolute;z-index:43;[^}]*top:auto;bottom:calc\(100% \+ 8px\)/s],
  ["city suggestion press feedback uses Moonstone",/\.v2-runtime \.geo-results button:active\{background:var\(--luemi-surface-raised\)/],
 ["shared Moonstone canvas",/\.v2-runtime\s*\{[^}]*background:var\(--luemi-bg-deep,#171B20\)/s]
];
for(const [description,pattern] of required)
 assert.match(runtime,pattern,description+" must stay visible on Android Telegram");
assert.match(geo,/className="geo-liquid-mode-panel"/,
 "Location switches all search modes inside the same fixed-size panel");
assert.match(runtime,/\.geo-liquid-mode-panel\{[\s\S]*?min-height:60px;height:60px/,
 "Switching city, world or radius must stay inside a compact 60px panel without jumping");
assert.match(runtime,/\.geo-liquid-mode-content\{[\s\S]*?animation:luemi-geo-mode-in/,
 "Mode changes crossfade just their contents, not the whole page");
assert.doesNotMatch(runtime,/\.geo-liquid-scope-description\{/,
 "Delete obsolete standalone search-mode description cards");
assert.doesNotMatch(runtime,/min-height:100px;[\s\S]{0,150}border:1px solid rgba\(216,182,238/,
 "Delete legacy 100px registration goal overrides");
assert.match(steps,/className=\{"v2-goal-choice"\+\(selected\?" is-selected":""\)\}/,
 "Goals use dedicated horizontal options rather than tall stacked generic cards");
assert.match(runtime,/\.preferences-step \.v2-goal-choice\{[\s\S]*?min-height:54px/,
 "Goal options must fit a 54px touch row while remaining legible");
assert.doesNotMatch(runtime,/\.preferences-step \.goals-section \.glass-choice\{/,
 "Remove conflicting legacy goal GlassChoice styles");
assert.match(runtime,/\.geo-liquid-city\{[\s\S]*?min-height:56px/,
 "The city card must match its content rather than empty padding");
assert.match(runtime,/\.age-range \.double-age-range\{height:44px/,
 "Age slider panel is compact but keeps 36px touch inputs");
assert.doesNotMatch(steps,/<p className="age-caption">/,
 "Remove redundant age explanatory line that makes the panel unnecessarily tall");
assert.match(steps,/className="age-range glass-panel" role="group"/,
 "Age card stays accessible even after removing the redundant description");
assert.match(runtime,/\.dob-step>\.choice-section \.glass-choice\{[\s\S]*?min-height:46px/,
 "Birth-date step gender choices are compact and share one scoped rule");
assert.match(runtime,/\.age-range \.double-range-track\{[\s\S]*?top:16px;left:10px;right:10px;height:4px/,
 "Age rail centre must align with its 36px native thumb hit box");
assert.match(runtime,/\.age-range \.double-age-range input::-webkit-slider-thumb\{[\s\S]*?margin-top:-8px/,
 "Native age thumbs must be centred on the 4px rail instead of sitting below it");
assert.match(geo,/data.searchScope==="radius"\?"Ближайшие сначала"/,
 "Nearby mode explains automatic nearest-first city ranking");
assert.doesNotMatch(geo,/radiusAt|positionAt|Радиус поиска, километры|type="range"/,
 "Retired distance slider and its value mapping must no longer render");
assert.doesNotMatch(runtime,/\.geo-liquid-radius|\.radius-control/,
 "Delete all retired distance slider rules rather than hiding the controls");
assert.match(geo,/className="geo-liquid-mode-panel" role="status" aria-live="polite"/,
 "Screen readers should hear mode descriptions when the scope changes");
assert.match(runtime,/\.geo-liquid-mode-copy small\{[^}]*-webkit-line-clamp:2/,
 "Descriptions stay inside the compact panel even on narrow devices");
assert.match(runtime,/\.dob-step>\.choice-section \.glass-choice\{[\s\S]*?min-height:46px/,
 "Gender cards must use a compact horizontal icon-label arrangement");
assert.match(form,/data-telegram-ui=\{window\.Telegram\?\.WebApp\?"true":"false"\}/,
 "Only actual Telegram surface should reserve native controls clearance");
assert.match(steps,/Я принимаю <a href="\/privacy"/,"Public policy acceptance must appear on the first identity step");
assert.match(draftClient,/policy!=="\/friends-test\.html"/,
 "Public remote drafts may not use beta-only privacy notices");
assert.match(form,/const stages:readonly VisualStage\[\]=visualStages/,"Every account follows seven steps including review");
assert.match(form,/Создать анкету/,"Single real signup confirmation creates published profile");
assert.doesNotMatch(form,/id:"languages"|id:"personality"|personalityPart/,
 "Removed language/personality subflow cannot return in live registration");
assert.match(form,/id:"about"/,
 "About text and interests return before the photo step");
assert.match(form,/id:"review"/,
 "Photo step leads to the private profile preview");
assert.match(form,/stage.id==="about"&&<div className="v2-real-groups v2-about-groups">/,
 "About and interests share a single scrollable screen");
assert.match(form,/stage.id==="review"&&<RegistrationReview data=\{draft\} photos=\{photos\}/,
 "Review uses the local read-only profile projection");
assert.match(form,/Редактировать/,
 "Review can return to the photos without publishing");
assert.match(form,/Посмотреть анкету/,
 "Photos must never submit directly to the publication pipeline");
assert.doesNotMatch(form,/mode="local-self-preview" active/,
 "Interactive morph must never interrupt a registration review");
assert.match(form,/stage.id==="photos"&&<div className="v2-real-groups">/,
 "Photo selection and reordering stay on their dedicated step");
assert.doesNotMatch(form,/id:"main-photo"|stage.id==="main-photo"/,
 "The first uploaded photo is already the main photo; do not add a duplicate step");
assert.match(form,/className=\{"v2-stage-heading"\+\(stage\.id==="about"\?" v2-stage-heading--about":""\)\}/,
 "Scrollable steps keep their heading in a dedicated sticky layer");
assert.match(runtime,/\.v2-stage-heading\{position:sticky;/,
 "Step headings must stay visible while the form scrolls");
assert.match(form,/v2-stage-heading--about/,"About attaches its selected interests to the existing sticky heading");
assert.match(form,/v2-sticky-interest-strip/,"Selected interests live in a single horizontally swipeable ribbon");
assert.match(form,/draft.interests.length>0\?" is-visible":""/,"Empty interest ribbon stays hidden until the first selection");
assert.match(form,/v2-selected-interest-close/,"Selected interests use explicit X remove affordances");
assert.doesNotMatch(form,/v2-sticky-interest-empty/,"No empty selected-interest card placeholder");
assert.match(runtime,/\.v2-sticky-interests\{[\s\S]*?grid-template-rows:0fr/,"Empty sticky ribbon collapses to zero height");
assert.match(runtime,/\.v2-sticky-interests\.is-visible\{[\s\S]*?grid-template-rows:1fr/,"Interest ribbon expands with a continuous height transition");
assert.doesNotMatch(steps,/interest-selected-group/,"Retired in-flow selected-interest grid must be removed");
assert.match(runtime,/\.v2-sticky-interest-strip\{[\s\S]*?overflow-x:auto;overflow-y:hidden/,"The selected-interest ribbon scrolls horizontally without creating a second vertical scroller");
assert.match(runtime,/\.v2-sticky-interest-strip\{[\s\S]*?touch-action:pan-x/,"Horizontal gestures must be explicitly owned by the ribbon");
assert.doesNotMatch(form,/photoServerCount|photoSyncBusy|onRetryPhotoSync|setServerConsent/,
 "No duplicate photo consent or network upload progress before final confirmation");
assert.match(app,/setJourney\("publishing"\)/,
 "Publication curtain must begin before saving photos on server");
assert.doesNotMatch(form,/id:"face-consent"|id:"liveness"|stage\.id==="main-photo"/,
 "No intermediate biometric or duplicate main-photo screens interrupt signup");
assert.match(form,/wordmark_original_raster_alpha_W06\.webp/,
 "The header uses the actual LUEMI mark, not a text approximation");
assert.match(runtime,/\.v2-header-logo\{[^}]*filter:brightness\(0\) invert\(1\)/s,
 "The same genuine LUEMI logo must be white on all seven registration screens");
assert.doesNotMatch(form,/<OptionalProfileDetails|stage\.id==="personality"/,
 "Optional data are edited after registration");
assert.doesNotMatch(form,/v2-footer-optional|v2-stage-transition/,
 "The footer must not cover optional details, and step content must not animate twice");
assert.doesNotMatch(form,/nativeTransition|ViewTransitionDocument|fallbackMotion|startViewTransition/,
 "No native snapshot crossfade or fallback animation can compete with the shared stage motion");
assert.doesNotMatch(runtime,/luemi-fallback-forward|luemi-fallback-back|::view-transition-old\(luemi-step\)|::view-transition-new\(luemi-step\)|data-luemi-transition/,
 "Delete legacy step animations rather than hiding them behind new CSS");
assert.match(form,/leaving\.animate\(\[/,
 "All outgoing steps use one controlled animation, never document snapshots");
assert.match(form,/await exit\.finished;[\s\S]*?flushSync\(\(\)=>\{[\s\S]*?setIndex\(next\)/,
 "The next step is committed strictly after the previous one finishes exiting");
assert.match(form,/entering\.animate\(\[/,
 "Every next step enters through the same smooth composited animation");
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
assert.match(app,/<RealDiscoveryHome (?:onFirstScreenReady=\{signalBootReady\} )?draft=\{draft\}/,
 "The full discovery and profile route is available after one-tap creation");
assert.match(app,/setWarmFeed\(warmed.page\)/,
 "The accepted home is hydrated from authenticated server feed warmup");
assert.match(app,/if\(!local\.ok\)\{/,
 "Private signup must refuse entry when photo persistence fails");
assert.doesNotMatch(form,/<a[^>]*>\s*условия закрытого теста<\/a>/,
 "Public registration cannot hardcode closed-beta consent links");
assert.match(geo,/<Search size=\{19\}/,"The new city search preserves its search icon");
assert.match(geo,/<LocateFixed size=\{17\}/,"One-tap geolocation retains an explicit icon");
assert.match(geo,/className="geo-liquid-city"/,"The selected city is a single tappable glass card");
assert.match(geo,/className="geo-liquid-scopes"/,"City, radius and world are segmented, never nested dropdowns");
assert.match(focusDock,/viewport\?\.addEventListener\("resize",refresh\)/,
 "Android viewport animation now changes only suggestions, not the fixed editor anchor");
assert.match(focusDock,/const refresh=\(\)=>\{if\(!frame\)frame=window\.requestAnimationFrame\(updateResults\);\}/,
 "Search suggestions coalesce viewport changes into one animation-frame writer");
assert.match(form,/--registration-visible-bottom[\s\S]*--registration-layout-height/,
 "The focused editor must use one visual viewport bottom coordinate without double keyboard compensation");
assert.match(focusDock,/const ideal=origin\+stableHeight\*\(isCity\?\.44:\.23\);/,
 "The city editor gets extra stable room for above-input suggestions; other fields keep original anchors");
assert.match(focusDock,/pinnedTop=Math\.round\(Math\.max\(minimum,Math\.min\(ideal,safeUpper\)\)\)/,
 "The dock stays below safe Telegram chrome and anticipates IME room");
assert.doesNotMatch(focusDock,/pinnedTop=Math\.max\(headerBottom\+12,Math\.min\(pinnedTop,footerTop/,
 "The focused editor may not chase the moving keyboard or footer");
assert.match(focusDock,/shell\.animate\(\[[\s\S]*?slotTop-dockTop[\s\S]*?translate3d\(0,-5px,0\)/,
 "One FLIP animation moves each focused field and adds a soft 5px rise");
assert.doesNotMatch(focusDock,/shell\.getBoundingClientRect\(\)\.height/,
 "Editor placement never depends on the live suggestion pane height");
assert.doesNotMatch(focusDock,/flagsResize|flagsMutation|MutationObserver/,
 "Only active city and text inputs retain keyboard geometry observers");
assert.match(form,/<div className="v2-backdrop"[^>]*\/>[\s\S]*?<div className="v2-focus-scrim"[\s\S]*?<header className="v2-header">/,
 "Focus blur is a direct child of the full device, never clipped by the body scroller");
assert.match(runtime,/\.v2-focus-scrim\{[^}]*backdrop-filter:blur\(40px\)[^}]*transition:opacity/s,
 "A single uniform fullscreen glass pane fades smoothly with static blur radius");
assert.match(runtime,/\.v2-device\[data-field-focus="true"\] \.v2-body\{\s*overflow:visible;z-index:auto;view-transition-name:none\}/,
 "The focused input escapes body stacking and paints over the full-device glass");
assert.match(form,/--registration-visible-bottom[\s\S]*--registration-layout-height/,
 "Viewport height and editor dock must come from one visual viewport measurement");
assert.match(runtime,/\.city-focus-shell \.geo-results\{[\s\S]*?top:auto;bottom:calc\(100% \+ 8px\)/,
 "City suggestions must open above the input within header-safe room");
assert.match(geo,/className="geo-results geo-city-suggestions"/,
 "City suggestions keep separate city and country labels, and accessible region metadata");
assert.doesNotMatch(runtime,/\.city-focus-shell \.geo-results\{[^}]*top:calc\(100%/,
 "The old below-input dropdown cannot return");
assert.doesNotMatch(runtime,/\.interest-chip\.selected::after\{/,
 "Selected interests use pastel highlight only, without a generated checkmark");
assert.match(runtime,/\.geo-liquid-mode-panel\{[\s\S]*?min-height:60px;height:60px/,
 "All location modes retain one smaller, stable-height glass panel");
assert.match(steps,/className="about-input-shell"[\s\S]*className="char-count"/,
 "Biography count must sit inside its text field");
assert.match(geo,/className="geo-liquid-scopes"/,
 "Search scope is a keyboard-safe segmented control instead of a dropdown");
assert.doesNotMatch(geo,/scopeOpen|setScopeOpen|scope-popover-anchor/,
 "The retired scope dropdown and its state must not be mounted");
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



// Registration polish contract: one-line city suggestions, selectable cards,
// understated optical sticky header and unconstrained vertical review swipes.
assert.match(geo, /\{!editing&&<span className="field-label">Твой город<\/span>\}/,
 "The city headline is not repeated inside the focused editor");
assert.match(geo, /className="geo-suggestion-country"/,
 "Each compact result displays city and country on the same line");
assert.match(geo, /<Flag code=\{place.countryCode\} size=\{19\}/,
 "The city result uses a small country flag");
assert.match(runtime, /\.geo-city-suggestions button\{[^}]*min-height:38px;height:38px/s,
 "Several city choices fit above the editor without a nested tall row");
assert.match(runtime, /\.geo-suggestion-copy\{[^}]*flex-direction:row/s,
 "City and country labels must not stack vertically");
assert.match(runtime, /\.city-focus-shell \.geo-results\{[^}]*max-height:var\(--field-suggestions-max-height/s,
 "The above-input list obeys the safe-space budget");
assert.match(geo, /className="geo-scope-check"/,
 "Active nearby, city and world modes show a circular corner check");
assert.match(steps, /<GlassChoice showCheck chosen=/,
 "Gender and audience cards share the same selected badge");
assert.match(runtime, /\.glass-choice-corner-check,\s*\.v2-runtime \.geo-scope-check,\s*\.v2-runtime \.preferences-step \.v2-goal-check\{[^}]*top:-7px;right:-7px/s,
  "Gender, audience, scope and goal badges overlap the rounded border, not card content");
assert.match(runtime, /\.v2-goal-check\{[^}]*width:21px;height:21px/s,
  "All choice corner badges share the compact 21px visual indicator");
assert.doesNotMatch(runtime, /\.v2-goal-check\{[^}]*top:5px;right:5px/s,
  "Retired inset badges must not reappear on selected cards");
assert.match(runtime,/\.v2-stage-heading::before\{[^}]*inset:0 0 -44px;[^}]*rgba\(23,27,32,0\) 100%/s,
 "All headings feather their matte below the text into fully transparent Moonstone");
assert.doesNotMatch(runtime,/\.v2-stage-heading--about\{[^}]*background:/s,
 "About does not replace the shared heading with a hard-edged background");
assert.match(glass,/showCheck&&<span className="glass-choice-corner-check"/,
 "Gender/audience check badges stay mounted during choice transitions");
assert.match(steps,/<span className="v2-goal-check" aria-hidden="true">/,
 "Goal check badges stay mounted during choice transitions");
assert.match(geo,/<span className="geo-scope-check" aria-hidden="true">/,
 "Scope check badges stay mounted during choice transitions");
assert.match(runtime,/\.v2-goal-check\{[^}]*opacity:0;transform:scale\(\.84\);[^}]*transition:opacity 180ms/s,
 "Inactive badges remain at their fixed corner anchor and smoothly appear");
assert.match(runtime,/\.glass-choice\.selected \.glass-choice-corner-check,[^}]*opacity:1;transform:scale\(1\)/s,
 "Selected badges transition opacity and scale only, not the layout position");
assert.match(runtime, /\.interest-chip\.selected\{[^}]*color:#242932/s,
 "Selected pastel interests use legible dark foreground");
assert.match(runtime, /\.v2-stage-heading::after\{[^}]*backdrop-filter:blur\(12px\) saturate\(114%\)/s,
 "All registration headlines use a thin, glassy Moonstone refraction");
assert.match(runtime, /\.v2-showcase-track\{[^}]*touch-action:pan-x pan-y/s,
 "Review photos allow vertical page scroll as well as horizontal carousel swipes");

// Header layout regression: a fixed 80px mobile header with duplicated top
// Telegram insets allowed the progress line to cover the title.
assert.match(runtime,/\.v2-header\{flex:none;z-index:3;height:auto;min-height:0;/,
 "The shared registration header must grow with the white logo and progress");
assert.match(runtime,/\.v2-header\{[^}]*flex-direction:column;align-items:stretch;gap:11px/s,
 "The white logo is followed by the progress line, never a side-by-side row");
assert.match(runtime,/\.v2-progress\{position:relative;display:block;flex:none;/,
 "The progress line stays in the natural flow of the common header");
assert.doesNotMatch(runtime,/\.v2-header\{height:80px|\.v2-device\{padding-top:max\(62px/,
 "Remove old fixed height and double Telegram device clearance");
assert.match(preview,/\.v2-canvas:not\(\.v2-runtime\) \.v2-header\{/,
 "Old preview-only header styles are excluded from the real registration");
assert.match(preview,/\.v2-canvas:not\(\.v2-runtime\) \.v2-progress\{/,
 "Old preview-only progress styles are excluded from the real registration");
const logoAt=form.indexOf('className="v2-header-logo"');
const progressAt=form.indexOf('className="v2-progress"');
const headerEndAt=form.indexOf('</header>',progressAt);
const headingAt=form.indexOf('className={"v2-stage-heading"+',headerEndAt);
assert.ok(logoAt>0&&progressAt>logoAt&&headerEndAt>progressAt&&headingAt>headerEndAt,
 "Every step shares the white logo, gradient progress, then the step title");


// LUEMI Liquid Glass validation bubbles: no more flat, opaque red rectangles.
const baseStyles=readFileSync("apps/web/src/styles.css","utf8");
assert.match(runtime,/\.field-inline-hint,\.v2-runtime \.field-warning,\.v2-runtime \.v2-feedback\{/,
 "All real registration hints and errors share one Liquid Glass treatment");
assert.match(runtime,/border-radius:21px 23px 21px 24px;/,
 "Hints use a rounded, softly asymmetric glass capsule");
assert.match(runtime,/background:[\s\S]*?radial-gradient\([\s\S]*?\) padding-box,[\s\S]*?linear-gradient\([\s\S]*?\) border-box;/,
 "Hints use tinted glass with a separate reflective edge");
assert.match(runtime,/-webkit-backdrop-filter:blur\(18px\) saturate\(145%\);[\s\S]*?backdrop-filter:blur\(18px\) saturate\(145%\)/,
 "Small hint surfaces apply actual background refraction in Android WebView");
assert.match(runtime,/\.field-inline-hint::before,[\s\S]*?\.v2-feedback::before\{/,
 "The glass capsule has a subtle specular reflection");
assert.match(runtime,/prefers-reduced-transparency:reduce/,
 "Reduced-transparency preferences keep hint text readable");
assert.doesNotMatch(baseStyles,/\.name-input-hint\s*\{/,
 "Retired global hint appearance cannot override the registration Liquid Glass");
assert.doesNotMatch(runtime,/background:#412b41|background:#38253a/,
 "No original solid red registration hint blocks remain");


// Stronger optical focus and gentle glass bubbles remain a single motion path.
assert.match(runtime,/\.v2-focus-scrim\{[^}]*background:rgba\(28,32,39,\.43\)[^}]*backdrop-filter:blur\(40px\)/s,
 "Smooth Moonstone frost preserves faint background silhouettes without opaque blackout");
assert.doesNotMatch(runtime,/\.v2-focus-scrim::before\{/,
 "Delete the old top partial-area glass mask entirely");
assert.doesNotMatch(runtime,/\.v2-focus-scrim::after\{/,
 "Delete the old bottom partial-area glass mask entirely");
assert.doesNotMatch(runtime,/\.v2-device\[data-field-focus="true"\] \.v2-header\{\s*filter:/,
 "No independent header blur or box separate from the uniform screen frost");
assert.doesNotMatch(runtime,/\.v2-device\[data-field-focus="true"\] \.v2-stage-heading\{\s*filter:/,
 "No independent heading blur or boxed mask remains");
assert.match(runtime,/\.name-input-hint\.is-visible\{[^}]*opacity:1;visibility:visible;transform:translate3d\(0,0,0\) scale\(1\)/s,
 "The name hint glides smoothly into view");
assert.match(runtime,/@keyframes luemi-glass-tip-enter[\s\S]*?\.field-inline-hint:not\(\.name-input-hint\)/,
 "Other field errors use one subtle glass entrance");
assert.match(steps,/const showNameGuidance=nameHint\|\|fieldError\?\.field==="name"/,
 "One stable state owns the name hint");
assert.match(steps,/className=\{"field-inline-hint name-input-hint"\+\(showNameGuidance\?" is-visible":""\)\}/,
 "The hint stays mounted to animate back out instead of disappearing");
assert.match(focusDock,/\{duration:480,easing:"cubic-bezier\(\.16,\.84,\.2,1\)"\}/,
 "One smoother field docking transition");
assert.match(focusDock,/\{duration:440,easing:"cubic-bezier\(\.17,\.79,\.22,1\)"\}/,
 "One smoother field undocking transition");
assert.match(runtime,/@media\(prefers-reduced-motion:reduce\)[\s\S]*?\.v2-focus-scrim\{transition:none\}/,
 "Reduced-motion setting disables full-screen blur fading");


// Regression from Samsung Galaxy A55 keyboard-dismissal video (2026-11-06).
// Changing the whole canvas with the live IME height exposed a white surface
// and made the heading/footer jump as the native keyboard collapsed.
assert.doesNotMatch(runtime,/height:var\(--registration-visible-height/,
 "Keyboard viewport must not resize the registration shell or device");
assert.match(runtime,/\.v2-runtime \.v2-device\{[^}]*height:var\(--registration-layout-height,100dvh\)/,
 "Registration device keeps a stable full-height dark canvas");
assert.match(runtime,/\.v2-footer\{[^}]*bottom:clamp\(0px,calc\(var\(--registration-layout-height,100dvh\) - var\(--registration-visible-bottom,100dvh\)\),100vh\)/s,
 "Only footer position follows visual keyboard inset");
assert.match(baseStyles,/\.luemi-shell\[data-registration-shell="true"\]\{[^}]*height:var\(--registration-layout-height,100dvh\)/,
 "Shared root shell stays painted while keyboard enters and exits");
assert.match(baseStyles,/:root\{[^}]*background:var\(--luemi-bg-deep\)\}/,
 "Retired white root underlay cannot reappear after IME dismissal");
assert.match(form,/useLayoutEffect\(\(\)=>\{[\s\S]*?data-registration-shell[\s\S]*?viewport\?\.addEventListener\("resize",schedule\)/,
 "Stable layout starts before paint and follows coalesced viewport events");
assert.match(form,/measuredBottom>=fullHeight-18[\s\S]*?Math\.max\(fullHeight,window\.innerHeight,measuredBottom\)/,
 "Transient keyboard viewport decreases cannot shrink the full canvas");
assert.match(runtime,/\.v2-stage-heading::after\{[^}]*bottom:-31px;height:70px;[^}]*-webkit-mask-image:linear-gradient/s,
 "The title's refractive edge extends past the heading without a straight dark seam");
assert.match(runtime,/\.v2-focus-scrim\{\s*position:absolute;inset:0;z-index:90;[^}]*blur\(40px\)/s,
 "One unfenced blur covers the logo, progress, heading and all background controls");
assert.match(runtime,/@media\(prefers-reduced-motion:reduce\)[\s\S]*?\.v2-focus-scrim\{transition:none\}/,
 "Reduced motion handles focus layer consistently");


// Preserve a layered translucent background, never a dark blank state.
assert.doesNotMatch(runtime,/blur\(84px\)|rgba\(11,8,20,\.97\)|\.v2-focus-scrim::(?:before|after)\{/,
 "The blackout and all masked partial glass areas are removed");
assert.match(runtime,/\.focus-field-shell\.is-focused\{\s*position:fixed;z-index:92;/,
 "Active field and its title stay sharp above every frosted-glass region");


// One source of blur and keyboard animation for every real input.
assert.doesNotMatch(runtime,/\.field-focus-overlay\{/,
 "Remove old empty local click blockers, not override them");
assert.doesNotMatch(runtime,/\.v2-focus-scrim::(?:before|after)\{|mask-image:radial-gradient\(ellipse at/,
 "No clipped, rectangular or masked subregions anywhere in the focus layer");
assert.match(runtime,/\.v2-focus-scrim\{\s*position:absolute;inset:0;z-index:90;/,
 "Device-wide focus glass covers the full stable-height screen");
assert.match(runtime,/\.focus-field-shell\.is-focused\{\s*position:fixed;z-index:92;/,
 "Focused field label and text remain on top of glass without blur");
assert.match(focusDock,/export const FOCUS_RELEASE_DELAY_MS=160;/,
 "One keyboard release delay across all text inputs");
for(const [label,code] of [["name, birthday and bio",steps],["city",geo]]){
 assert.match(code,/useFieldFocusDock/,label+" shares a single input animation hook");
 assert.match(code,/FOCUS_RELEASE_DELAY_MS/,label+" shares a single keyboard release timing");
 assert.doesNotMatch(code,/field-focus-overlay/,label+" does not mount legacy click-blocker layers");
}
assert.match(focusDock,/translate3d\(0,-5px,0\) scale\(1\.012\)/,
 "The gentle 5px lift-and-settle is identical in all focused fields");
assert.match(focusDock,/translate3d\(0,-2px,0\) scale\(1\.006\)/,
 "The field returns smoothly without any abrupt settle");


// Android Telegram native kinetic scrolling: preserve the rubbery sticky title
// and remove costly live backdrop filters under moving intent/preferences cards.
assert.match(runtime,/\.v2-body\{[^}]*overflow-x:hidden;overflow-y:auto;[^}]*overscroll-behavior-y:contain;[^}]*scroll-behavior:auto;[^}]*-webkit-overflow-scrolling:touch;touch-action:pan-y/s,
 "Registration should use the browser's kinetic touch scroller, never a JavaScript scrolling substitute");
assert.match(runtime,/\.v2-stage-heading\{position:sticky;top:-20px;/,
 "Approved rubbery/sticky header must stay unchanged when scrolling improves");
assert.match(runtime,/\.glass-choice,\.v2-runtime \.v2-choice,\.v2-runtime \.category-chip\{[^}]*-webkit-backdrop-filter:none;backdrop-filter:none/s,
 "The moving grid and choices must not cause dynamic backdrop repaint each frame");
assert.match(runtime,/\.glass-panel,\.v2-runtime \.age-range,[\s\S]*?\.v2-note\{[^}]*-webkit-backdrop-filter:none;backdrop-filter:none/s,
 "Range and registration cards must use static glass gradients while scrolling");
assert.match(runtime,/\.v2-footer::before\{[^}]*background:linear-gradient\([^}]*\}/s,
 "Stationary footer has a static feathered tint instead of a live blur of the scrolling content");
const footerCss=runtime.match(/\.v2-footer::before\{([^}]+)\}/)?.[1]??"";
assert.doesNotMatch(footerCss,/backdrop-filter|mask-image/,
 "Footer mask and backdrop repaint path must be deleted, not overridden");
assert.doesNotMatch(form,/onTouchMove=|onTouchEnd=|onWheel=|scrollTop\s*\+=|scrollBy\(/,
 "Registration must preserve native fling inertia, not compete with a custom RAF scroller");


// The old language-selection editor is physically removed from registration.
assert.doesNotMatch(steps,/LanguagePicker|personalityPart|languages-step/,
 "Legacy language UI must not return via dormant conditional branches");
assert.doesNotMatch(runtime,/\\.language-(?:results|option|focus-shell|selected)/,
 "The old 60-language browser must not ship as dead CSS");
assert.doesNotMatch(focusDock,/language-focus-shell|language-results-max-height/,
 "Focus geometry no longer carries obsolete language-specific observers");

// 2026-11-06 Android user video: the next step's optional "Добавить о себе"
// control was seen at the bottom before the outgoing language step vanished.
// One animation owner must lock both navigation and taps, with a stable footer.
assert.match(form,/const \[changingStep,setChangingStep\]=useState\(false\)/,
 "All seven steps use a single pending-navigation state");
assert.match(form,/if\(next===index\|\|transitioning\.current\)return/,
 "A repeated tap cannot queue a second transition");
assert.match(form,/if\(transitioning\.current\|\|photoChecking\|\|changingStep\)return/,
 "A double-tap cannot resubmit Continue while the previous step is moving");
assert.match(form,/disabled=\{photoChecking\|\|changingStep\}/,
 "Continue is disabled while any stage is leaving or entering");
assert.match(form,/photoChecking\|\|changingStep\?<LoaderCircle/,
 "Continue displays a spinner rather than a stale arrow while switching");
assert.match(form,/if\(animateStep&&leaving\?\.animate\)/,
 "Real motion is only applied to an existing outgoing scroll body");
assert.match(form,/setIndex\(next\)/,
 "The next required step commits atomically");
assert.match(form,/if\(entering\)entering\.scrollTop=0/,
 "Every new step starts at the top without inheriting a retired editor scroll position");
assert.match(form,/className="v2-body" aria-labelledby="v2-title"/,
 "Step content has no stale fallback classes with a second animation");
assert.match(runtime,/data-step-moving="true"\] \.v2-body\{pointer-events:none\}/,
 "Leaving/entering content cannot receive taps");
assert.match(runtime,/\.v2-next-spinner\{[^}]*animation:luemi-step-spinner/s,
 "The loading spinner occupies the old arrow slot without shifting the footer");
assert.match(form,/aria-busy=\{photoChecking\}/,
 "Photo preview checks for duplicates without publication");
assert.match(form,/aria-busy=\{p\.serverSaving\}/,
 "Only final confirmation shows server publication loading");


// Responsive IME contract: one anchor per focus, changed only for real width /
// orientation changes. Releasing focus waits for keyboard recovery and quiet.
assert.match(focusDock,/const keyboardInitiallyOpen=keyboardGap\(\)>Math\.max\(90,stableHeight\*\.16\)/,
 "OS keyboard detection uses relative stable device metrics, not a phone-specific number");
assert.match(focusDock,/keyboardInitiallyOpen&&recovered&&now-lastChange>=110/,
 "The editor does not start its return while the keyboard is still collapsing");
assert.match(focusDock,/Math\.abs\(window\.innerWidth-measuredWidth\)>2/,
 "Only real width or orientation changes can recompute a focus dock");
assert.doesNotMatch(focusDock,/viewport\?\.addEventListener\("resize",calculateAnchor\)/,
 "Opening or closing the IME must never reposition the dock");
assert.match(steps,/releaseAfterKeyboardSettles\(\(\)=>\{/,
 "Name, birthday and bio hold the focused editor until IME closing finishes");
assert.match(geo,/releaseAfterKeyboardSettles\(\(\)=>\{/,
 "City search uses the same IME-release policy");
assert.match(steps,/if\(birthDateValid\(day,month,year\)\)\{[\s\S]*?dobInput\.current\?\.blur\(\)/,
 "A complete valid DOB automatically hides the keyboard without advancing the form");
assert.match(steps,/else setDateInputError\("Проверь дату рождения\. Регистрация доступна с 18 лет\."\)/,
 "Invalid or underage dates keep their keyboard open and show a useful hint");
assert.doesNotMatch(form,/handleFieldFocus\(null\);[\s\S]{0,35}return;[\s\S]{0,50}advance\(\)/,
 "The confirmation button must not prematurely tear down glass before IME release");
