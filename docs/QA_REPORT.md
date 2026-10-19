# LUEMI · Stage 02A QA (2026-10-19)

## Verified
- GitHub Actions feature commit `d365dd32d240992ab4ba53ebf31180c78d441995` run 39268775360: SUCCESS (npm install, ESLint, TS, Node tests, Vite/TypeScript builds, local same-origin smoke).
- Unit tests: 18th birthday boundary, leap calendar dates, invalid dates, missing test confirmation, basic limits.
- Existing Stage 01 Telegram auth screenshot from owner inside Galaxy A55: launch and verified name succeeded, BEFORE Stage 02A UI.
- Previous Render Staging service was LIVE and pairing succeeded; Stage 02A runtime still requires acceptance.

## NOT TESTED
- New Stage 02 UI rendered in actual Telegram WebView / Galaxy A55 until owner tests new deploy.
- Keyboard safe area, native BackButton and photo gestures on Android/iOS.
- Security of real database persistence and photo moderation (not implemented).
- Full accessibility WCAG 2.2 AA, localization, legal consent/privacy, dark theme visual comparison.
- True published profile equivalence (Stage 03 not built).
- No paid features.

## Stage 02B animated welcome pending release checks
- Review criterion: no invented loading percentages or minimum loader delay; show useful error and retry if network/logo fails.
- Verify signed Telegram identity still works; overlay mask uses same W06 alpha raster and no redrawn logo; reduced motion disables decorative animation.
- Real Android motion smoothness / battery / contrast and final comparison to W04 remain NOT TESTED until device QA.

## Stage 02D1 — One-screen intro acceptance
- Single welcome scene only: ensure old tagline, larger duplicate logo, obsolete welcome screen, and the extra preview disclaimer are absent from runtime.
- First splash arrangement stays centered. The CTA appears on SAME splash after both auth/brand readiness and 1.8 s minimum; no hard-coded fake progress percentage.
- Verify CTA leads directly to registration, with reduced-motion fallback; header/progress and circular arrows unchanged.
- Actual Galaxy A55 in-Telegram review: NOT TESTED before owner checks new staging release.

## Stage 02D video QA & regression gates
- Source evidence: full 68.0-second 1080×2340 Android Telegram video; inspected contact frames at 4s and high-density 1s checks of range/interests/photos.
- Observed: old single-purpose loading stripe briefly flashes before approved intro; theme control collides with Telegram chrome; gradient age inputs are two independent sliders; selection in Android system photo picker leaves mosaic empty; interest chips lack icons and color variety; back/forward navigation too flat; slider keyboard appears after radius interaction.
- Code changes implemented, not yet physically verified: remove stripe markup and dead CSS; icon-only light/dark with radial theme reveal, lower control; remove logo island; glass buttons; gradient single/double ranges; blur text field on range pointer; 21 interest gradients and icon glyphs; immediate FileList snapshot and preview swiping; animated block entry.
- Added `scripts/ui-contract-smoke.mjs`, driven by `npm run test:ui`. Render root `prebuild` runs lint, UI regression assertions and API tests before build. No claim of motion FPS or confirmed Android picker fix until new capture.
- Pending post-merge verification: GitHub Actions full check, Render Live with verified bot, screenshots/videos of long scroll, slider drag, theme reveal and selecting 2–6 photos and swiping. WCAG AA full audit not done.

## Stage 02D independent Render gate (2026-10-19)
- Deployment `dep-dbb40c142hec738466m0` / `d3283f4d` — LIVE.
- Render build logs: all 12 `scripts/ui-contract-smoke.mjs` assertions PASS; Node API suite 16 pass, 0 fail; ESLint no error; TypeScript/Vite production build success; Fastify startup and Telegram bot pairing successful.
- GitHub Actions queue remained delayed. **Real-device effect rendering, touch thumbs, picker and swipe still not attested**, requires founder's new Galaxy A55 screen recording.

## Stage 02E automated acceptance
- Approved specification Stage 02E source architecture and codes updated in feature branch; older CSS and HTML5 mobile drag removed in source, not overlaid.
- 2026-10-19: GitHub Actions `39290830771` on `387b5795a1a1b86633b987f0f993bb141ceac74f`: SUCCESS; lint, Stage 02E UI contract smoke, TypeScript, Node tests, API build and Vite web build, local same-origin smoke.
- TESTED by code/CI: age validator, city-ID requirement, input name filter, 15 interest cap, 750 bio, photo picker snapshots, local geocoding fallback and parser, auth regressions, build.
- NOT YET VERIFIED: real Telegram in-app fullscreen typography/keyboard gesture (Galaxy A55 and iPhone), drag on Android context menu, gesture-driven carousel, animation FPS and blur performance, real geography provider, server-side registration, durable drafts, photo uploads/moderation, legal agreements.
- No external paid service configured, and live migrations remain forbidden.

## Stage 02F · QA and acceptance gate
- Restore point `backup/pre-stage02f-20261019` created before modifying files. Feature branch and one active visual system.
- Automated checks: GitHub Actions workflow `npm run check` covers ESLint, Stage02F structural regression smoke including 10 category cardinalities and 60 language count, API tests, web/API typechecks/build and same-origin smoke. Capture run SHA at release; never call this mobile QA.
- Imported 66 valid, local circle-flags SVG assets under MIT license with original license preserved. No remote flag requests required.
- Manual on Galaxy A55 Telegram STILL NEEDED: WebApp system header safe area, compact theme button, contrast on dark, keyboard stable footer and caret focus, 5000km log slider, custom location failure, 10 category selected bar, 60-language search, long-press/FLIP drag and snap carousel, reduced motion, swipe/scroll conflict and one preview.
- Untested: device FPS, iPhone behavior, real provider API, offline/reconnect restoration, persisted draft/server-side validation for future publication, photo moderation. Preserve original app as backup until mobile acceptance.

## Stage 02F.1 / 02G follow-up QA
- Source: uploaded `1000068622.mp4`, 190.8 seconds / 1080 × 2340. Reviewed actual frame contact sheet at 6-second intervals and detail around intro, date, geo, interests, languages, photos and profile. Observed original dated issues as described by owner.
- Tests now additionally assert: no old brand-liquid selector; input focus narrow glass effect; local IndexedDB photo persistence; truthful FileReader progress + completion check; no visible photo arrows; tap highlights disabled; pinned interests categories; selected language flags only; three columns, named input hint. Existing Stage 02F structural regression checks remain.
- GitHub Actions check completed SUCCESS on code commit `85099c711f90b64e30c967373923e7fb6af6fe7f`, run `39307669207`.
- Real-device QA still needed: photo FileReader progress/check timing, complete reopen/recovery with 3 photos, font/keyboard positioning, dark/light theme tap flash, interest subscroll, Geopicker compactness. Do not claim production UI approval until new Galaxy A55 capture.
