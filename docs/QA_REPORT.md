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
