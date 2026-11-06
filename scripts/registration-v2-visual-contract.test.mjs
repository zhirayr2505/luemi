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
const language=readFileSync("apps/web/src/registration/LanguagePicker.tsx","utf8");
const focusDock=readFileSync("apps/web/src/registration/use-field-focus.ts","utf8");
const required=[
 ["V2 runtime tokens",/\.v2-runtime\s*\{[^}]*--ink:/s],
  ["Telegram clearance only on the shared header",/\.v2-runtime\[data-telegram-ui="true"\]\s*\{[^}]*--registration-header-top:max\(82px,[^}]*--tg-content-safe-area-inset-top[^}]*--tg-safe-area-inset-top[^}]*safe-area-inset-top/s],
 ["dark readable form inputs",/\.v2-runtime\s+\.glass-control,\.v2-runtime\s+\.v2-input\s*\{[^}]*background:rgba\(43,42,57,\.9\)/s],
 ["stable focused field dock",/\.v2-runtime\s+\.focus-field-shell\.is-focused\s*\{[^}]*position:fixed[^}]*--focused-dock-top/s],
 ["single confirm action",/\.v2-runtime\s+\.v2-next\.v2-next-confirm[^}]*display:grid/s],
 ["blurred borderless action fade",/\.v2-runtime\s+\.v2-footer\s*\{[^}]*position:absolute[^}]*border:0/s],
 ["geolocation and language search icon",/\.v2-runtime\s+\.geo-input-wrap>svg:first-child\s*\{/],
 ["search input text gutter",/\.v2-runtime\s+\.geo-input-wrap>\.glass-control\.geo-input/],
 ["opaque search scope list",/\.v2-runtime\s+\.scope-options\s*\{[^}]*background:#292336/s],
 ["scope list opens upward without covering the city field",/\.v2-runtime\s+\.scope-options\s*\{[^}]*position:relative;order:-1/s],
 ["shared Soft Plum canvas",/\.v2-runtime\s*\{[^}]*background:var\(--luemi-bg-deep,#1c1424\)/s]
];
for(const [description,pattern] of required)
 assert.match(runtime,pattern,description+" must stay visible on Android Telegram");
assert.match(form,/data-telegram-ui=\{window\.Telegram\?\.WebApp\?"true":"false"\}/,
 "Only actual Telegram surface should reserve native controls clearance");
assert.match(steps,/Я принимаю <a href="\/privacy"/,"Public policy acceptance must appear on the first identity step");
assert.match(draftClient,/policy!=="\/friends-test\.html"/,
 "Public remote drafts may not use beta-only privacy notices");
assert.match(form,/const stages:readonly VisualStage\[\]=visualStages/,"Every account follows the same eight visual steps");
assert.match(form,/Создать анкету/,"Single real signup confirmation creates published profile");
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
 "The same genuine LUEMI logo must be white on all eight registration screens");
assert.match(form,/stage\.id==="personality"&&<div className="v2-real-groups">[\s\S]*?<OptionalProfileDetails/,
 "Optional about details live inside the scrollable interests and biography step");
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
assert.match(focusDock,/pinnedTop=Math\.max\(headerBottom\+12,Math\.min\(pinnedTop,/,
 "The editor stays anchored while the Android viewport animates");
assert.match(focusDock,/shell\.animate\(\[[\s\S]*?slotTop-dockTop[\s\S]*?translate3d\(0,-5px,0\)/,
 "One FLIP animation moves each focused field and adds a soft 5px rise");
assert.doesNotMatch(focusDock,/shell\.getBoundingClientRect\(\)\.height/,
 "Editor placement never depends on the live suggestion pane height");
assert.match(focusDock,/flagsResize\?\.observe\(watchedFlags\)/,
 "Only selected-language flags are observed, so city suggestion animation stays isolated");
assert.match(form,/<div className="v2-backdrop"[^>]*\/>[\s\S]*?<div className="v2-focus-scrim"[\s\S]*?<header className="v2-header">/,
 "Focus blur is a direct child of the full device, never clipped by the body scroller");
assert.match(runtime,/\.v2-focus-scrim\{[^}]*backdrop-filter:blur\(40px\)[^}]*transition:opacity/s,
 "A single uniform fullscreen glass pane fades smoothly with static blur radius");
assert.match(runtime,/\.v2-device\[data-field-focus="true"\] \.v2-body\{\s*overflow:visible;z-index:auto;view-transition-name:none\}/,
 "The focused input escapes body stacking and paints over the full-device glass");
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
const headingAt=form.indexOf('className="v2-stage-heading"',headerEndAt);
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
assert.match(runtime,/\.v2-focus-scrim\{[^}]*background:rgba\(29,20,41,\.43\)[^}]*backdrop-filter:blur\(40px\)/s,
 "Smooth plum frost preserves faint background silhouettes without opaque blackout");
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
assert.match(baseStyles,/:root\{[^}]*background:#1c1424\}/,
 "Retired white root underlay cannot reappear after IME dismissal");
assert.match(form,/useLayoutEffect\(\(\)=>\{[\s\S]*?data-registration-shell[\s\S]*?viewport\?\.addEventListener\("resize",schedule\)/,
 "Stable layout starts before paint and follows coalesced viewport events");
assert.match(form,/measuredBottom>=fullHeight-18[\s\S]*?Math\.max\(fullHeight,window\.innerHeight,measuredBottom\)/,
 "Transient keyboard viewport decreases cannot shrink the full canvas");
assert.doesNotMatch(runtime,/\.v2-stage-heading::after\{/,
 "Old translucent rectangle over the heading is fully deleted");
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
for(const [label,code] of [["name, birthday and bio",steps],["city",geo],["language",language]]){
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
assert.match(runtime,/\.glass-choice,\.v2-runtime \.v2-choice,\.v2-runtime \.category-chip,[\s\S]*?\.language-option\{[^}]*-webkit-backdrop-filter:none;backdrop-filter:none/s,
 "The moving grid and choices must not cause dynamic backdrop repaint each frame");
assert.match(runtime,/\.glass-panel,\.v2-runtime \.age-range,\.v2-runtime \.radius-control,[\s\S]*?\.v2-note\{[^}]*-webkit-backdrop-filter:none;backdrop-filter:none/s,
 "Range and registration cards must use static glass gradients while scrolling");
assert.match(runtime,/\.v2-footer::before\{[^}]*background:linear-gradient\([^}]*\}/s,
 "Stationary footer has a static feathered tint instead of a live blur of the scrolling content");
const footerCss=runtime.match(/\.v2-footer::before\{([^}]+)\}/)?.[1]??"";
assert.doesNotMatch(footerCss,/backdrop-filter|mask-image/,
 "Footer mask and backdrop repaint path must be deleted, not overridden");
assert.doesNotMatch(form,/onTouchMove=|onTouchEnd=|onWheel=|scrollTop\s*\+=|scrollBy\(/,
 "Registration must preserve native fling inertia, not compete with a custom RAF scroller");


// Samsung A55: entire language rows, native browsing and live keyboard suggestions.
assert.doesNotMatch(runtime,/\.language-focus-shell\.is-focused \.language-results\{max-height:min\(155px,25dvh\)/,
 "155px keyboard clipping must be removed");
assert.doesNotMatch(runtime,/\.language-results\{[^}]*max-height:260px/,
 "Old 260px hard clip in the main list must be removed");
assert.match(runtime,/\.language-results\{\s*display:grid;[^}]*grid-auto-rows:44px;[^}]*max-height:none;overflow:visible;/s,
 "Unfocused 60 languages participate in native page scrolling");
assert.match(runtime,/\.language-focus-shell\.is-focused \.language-results\{\s*max-height:var\(--language-results-max-height,96px\);overflow-x:hidden;overflow-y:auto;[^}]*-webkit-overflow-scrolling:touch;touch-action:pan-y;/s,
 "Focused search results use keyboard-safe independent touch scrolling");
assert.match(focusDock,/footerTop-list\.getBoundingClientRect\(\)\.top-12/,
 "Language suggestions stop above the actual moving confirmation footer");
assert.match(focusDock,/Math\.floor\(\(remaining\+8\)\/52\)/,
 "Scroll viewport fits full 44px language rows plus 8px gaps");
assert.match(language,/resultsRef\.current\.scrollTop=0/,
 "Typing a new query resets search suggestions to the first match");
assert.match(language,/className="language-results-status" role="status" aria-live="polite"/,
 "Live results announce matching language count");
assert.match(focusDock,/flagsResize\?\.observe\(watchedFlags\)/,
 "Selecting languages keeps suggestions safely clear of the keyboard");


// 2026-11-06 Android user video: the next step's optional "Добавить о себе"
// control was seen at the bottom before the outgoing language step vanished.
// One animation owner must lock both navigation and taps, with a stable footer.
assert.match(form,/const \[changingStep,setChangingStep\]=useState\(false\)/,
 "All eight steps use a single pending-navigation state");
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
assert.match(form,/setDetailsOpen\(false\);setIndex\(next\)/,
 "Closing optional-profile dialogs and moving to the next step is atomic");
assert.match(form,/if\(entering\)entering\.scrollTop=0/,
 "Every new step starts at the top instead of inheriting language scroll");
assert.match(form,/className="v2-body" aria-labelledby="v2-title"/,
 "Step content has no stale fallback classes with a second animation");
assert.match(runtime,/data-step-moving="true"\] \.v2-body\{pointer-events:none\}/,
 "Leaving/entering content cannot receive taps");
assert.match(runtime,/\.v2-next-spinner\{[^}]*animation:luemi-step-spinner/s,
 "The loading spinner occupies the old arrow slot without shifting the footer");
assert.match(form,/aria-busy=\{p\.serverSaving\}/,
 "Final publication reuses the same loading affordance");
