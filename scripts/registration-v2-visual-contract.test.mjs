/**
 * Visual regression contract for invited Registration V2. Static smoke checks
 * catch accidental loss of Telegram chrome clearance, inherited token bridge,
 * input visibility and geo/language icon/dropdown specificity. Browser A55 QA
 * is still required; these assertions are NOT pixel-diff screenshots.
 */
import {readFileSync} from "node:fs";
import {strict as assert} from "node:assert";
const runtime=readFileSync("apps/web/src/registration/v2/runtime.css","utf8");
const form=readFileSync("apps/web/src/registration/v2/RealRegistration.tsx","utf8");
const draftClient=readFileSync("apps/web/src/registration/server-draft.ts","utf8");
const app=readFileSync("apps/web/src/App.tsx","utf8");
const geo=readFileSync("apps/web/src/registration/GeoPicker.tsx","utf8");
const language=readFileSync("apps/web/src/registration/LanguagePicker.tsx","utf8");
const required=[
 ["V2 runtime tokens",/\.v2-runtime\s*\{[^}]*--ink:/s],
 ["Telegram native clearance",/\.v2-runtime\[data-telegram-ui="true"\]\s+\.v2-device\s*\{[^}]*padding-top:max\(64px,[^}]*--tg-content-safe-area-inset-top[^}]*--tg-safe-area-inset-top[^}]*safe-area-inset-top/s],
 ["opaque form inputs",/\.v2-runtime\s+\.glass-control\s*\{[^}]*background:#fffaff/s],
 ["visible names and DOB fields",/\.v2-runtime\s+\.dob-grid\s*\{/],
 ["geolocation and language search icon",/\.v2-runtime\s+\.geo-input-wrap>svg:first-child\s*\{/],
 ["search input text gutter",/\.v2-runtime\s+\.geo-input-wrap>\.glass-control\.geo-input/],
 ["opaque search scope list",/\.v2-runtime\s+\.scope-options\s*\{[^}]*background:#fffaff/s],
 ["dark theme opaque inputs",/\.v2-runtime\[data-theme="dark"\]\s+\.glass-control,/]
];
for(const [description,pattern] of required)
 assert.match(runtime,pattern,description+" must stay visible on Android Telegram");
assert.match(form,/data-telegram-ui=\{window\.Telegram\?\.WebApp\?"true":"false"\}/,
 "Only actual Telegram surface should reserve native controls clearance");
assert.match(form,/const noticeLabel=friendsTest\?/,"Registration notice distinguishes closed beta from public privacy policy");
assert.match(draftClient,/policy!=="\/friends-test\.html"/,
 "Public remote drafts may not use beta-only privacy notices");
assert.match(form,/p\.publicationEnabled\?/,"Registration must disclose publication separately from private saving");
assert.match(form,/Создать анкету 💜/,"Single real signup confirmation creates published profile");
assert.match(form,/<SimpleProfilePreview draft=\{draft\} photos=\{photos\}\/>/,
 "Signup review must be a SIMPLE photo/gallery summary, not an animated full profile");
const simplePreview=readFileSync("apps/web/src/registration/SimpleProfilePreview.tsx","utf8");
assert.match(simplePreview,/luemi-simple-preview-avatar/,"Circular main photo remains visible");
assert.match(simplePreview,/luemi-simple-preview-scroller/,"Photo carousel supports swipe");
assert.doesNotMatch(form,/mode="local-self-preview" active/,"No Profile Morph V3 inside signup review");
assert.match(form,/registrationV2Stages\.filter\(stage=>stage\.id!=="face-consent"&&stage\.id!=="liveness"\)/,
 "Private signup must skip unavailable biometric verification screens");
assert.match(form,/aria-valuemax=\{stages\.length\}/,
 "Progress count must reflect actual signup steps");
assert.match(app,/realOnly\|\|import\.meta\.env\.VITE_LUEMI_REGISTRATION_V2/,
 "Real-only private registration must use V2, even without the legacy V2 opt-in");
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
assert.doesNotMatch(runtime,/(?:^|\n)\s*(?:input|\.glass-control|\.scope-options)\s*\{/,
 "Do not override unrelated app global input styles");
console.log("Registration V2 Telegram-safe visual contracts: PASS ("+required.length+" selectors)");
