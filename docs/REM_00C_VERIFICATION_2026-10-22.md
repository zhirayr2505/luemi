# LUEMI 💜 — REM-00C · Actual behavioral / visual QA verification

**Date:** 22 October 2026 · **Scope:** REM-00C / LU-31 of the accepted `LUEMI_MASTER_REMEDIATION_TZ_2026-10-21.md`. **Status:** implementation and hosted CI VERIFIED; owner acceptance pending. **No REM-01 work authorized or performed.**

## 1. Isolation, ancestry and product invariants

- Repository: `zhirayr2505/luemi`; branch `remediation/rem-00c-behavioral-qa-20261022`.
- Accepted REM-00B parent: **`56cef7fd46be4d487a52f35a2b0b825a4d53002d`**. This also includes accepted REM-00A `fe33760ef426d75747f889cda8ec8f6e825df227`.
- Working changes: only `.github/workflows/stage03g3-visual.yml`, `package.json` (browser test command), `scripts/` and the **developer-only** `apps/web/src/profile-qa.tsx` fixture, plus this documentation. Tests do **not** alter any production application component, source in `apps/web/src/discovery/`, `apps/api/src/`, animations, styles, brand assets, deployment scripts, runtime gestures, product data, Render, Supabase or separate projects.
- Current production `main` remains `072bc425e4f487d15a5260f0ac978a2059b50e34`; `staging/telegram-miniapp-20261019` remains `62470ddd143a94a9f987c0aa1c7193656a29df15`. No merge or deploy has been requested or executed.

## 2. Exact implementation

1. **Stage03E source contract:** `scripts/stage03e-contract.test.mjs` now checks the current `Nearby` JSX signature (including its `active` prop), deferred Nearby mounting, and specific child-gesture ownership exclusions. The unchanged pure-function tests still validate city/country filtering, scoped results, sorting, language, and absence of synthetic distances. This remains explicitly a **source-marker/structural** contract, not a claim of behavioral verification. The newly mandatory browser suite performs the real swipe assertions.
2. **Current Android/standard DOM test:** `scripts/stage03g7-android-visual-qa.mjs` now delegates to `scripts/rem-00c-browser-behavior.mjs`. The old `getComputedStyle(null)` expectation for `.lh-logo-contrast`, `data-sheet-renderer="layout"` and `left:calc(-300%...)` have been replaced with observed current DOM and actual native `.pm-sheet-viewport.scrollTop` and `.pm-pages.scrollLeft`. Mandatory elements are asserted with descriptive missing-selector errors rather than arbitrary defaults.
3. **Behavioral profile scenarios:** one primary Android 393×852 Chromium touch profile scenario verifies owner expanded/collapsed endpoints, actual touch-hit target, three **recorded mid-gesture positions** (scrollTop 72/143/215 CSS px; blur opacity 0.165546/0.331092/0.496638 in cited runner), tab selection and ink, native per-tab scroll with pinned identity, three distinct photos/indicators, viewer next/close preserving tab, light/dark and 360×780 resize, Nearby child/parent gesture arbitration, world-filter person card behavior, visitor profile open/animated Escape close and source-tab restoration.
4. **Standard DOM and reduced-motion:** separate Chromium context 390×844 with iPhone-like UA and `prefers-reduced-motion: reduce`; verifies non-Android logo structure, native sheet collapse, tab scrollLeft and theme, and preservation of collapsed mode and chosen tab across navigation. **This is Chromium UA emulation, not physical iOS Safari.**
5. **Real App shell / safe Telegram mock:** the production `index.html` and `App` are loaded, not a fake component. Browser interception stubs the external Telegram SDK **only in this isolated test page**. A clearly labeled mock injects a placeholder `initData`, implements harmless Telegram bridge functions, and intercepts the local `/api/health/live` and `/api/auth/telegram` endpoints. Tests assert real bridge calls, ordered health→auth flow (allowing React StrictMode repeat effects), visible welcome CTA and arrival at registration step 1. No real Telegram signature is treated as valid, no users/services contacted and no credentials supplied.
6. **Negative fixture:** a deliberately absent required CSS selector must cause a rejection with `REQUIRED SELECTOR MISSING`, and the negative-control test must record that rejection. Required visual scenarios never catch assertion failures and announce PASS.
7. **Fonts, media, screenshots:** browser suite waits for `document.fonts.ready` and decodes required local QA images. Developer-only fixture uses three separate deterministic data-URL SVG images, not duplicate remote profile URLs. PNG screenshots are captured at stable endpoints with SHA-256, viewport and run timestamps in GitHub logs; intermediate native gesture samples include frame/performance timestamps.
8. **Legacy scripts:** Stage03G3/G4/G5/G6 scripts were **moved byte-for-byte** to `scripts/legacy/`; the active workflow and its manual scenario input invoke only the current `stage03g7` behavioral entry. These old scripts are preserved for audit and cannot accidentally be selected by branch-name. Their failures have never been counted as successful tests.
9. **GitHub Actions:** existing REM-00A/00B foundation and separate browser jobs remain independent, read-only, SHA-bound, exact `npm ci` and managed Playwright. The browser scenario runs automatically on push/PR main, staging, remediation branch families; upload on fail/success includes actual `qa-artifacts/rem-00c/**/*.png` and local Vite log. An assertion failure still yields a red workflow.

## 3. Verified GitHub Actions results (before this documentation-only commit)

**Head:** `8aa14482623ef2589837aa0d82808a675b8972dd` in isolated REM-00C branch.

- [Foundation CI run 39685377933](https://github.com/zhirayr2505/luemi/actions/runs/39685377933): **SUCCESS**. All 7 distinct jobs: `source-marker-contracts`, `api-isolated`, `ci-infrastructure`, `build`, `lint-hooks`, `local-smoke`, `type-contracts` — each completed successfully on a hosted runner.
- [Visual + behavior run 39685377952](https://github.com/zhirayr2505/luemi/actions/runs/39685377952): **SUCCESS**. `Foundation checks` and `Browser profile QA (REM-00C behavioral)` both completed successfully.
- [Behavior screenshots and diagnostics, artifact 12385344915](https://github.com/zhirayr2505/luemi/actions/runs/39685377952/artifacts/12385344915): published by `actions/upload-artifact`; **1,647,350 compressed bytes**. Eleven deterministic endpoint PNG images and test server diagnostics are held in artifact.
- Logged pass signals: `REM00C_PROFILE_BEHAVIOR_PASS`, `REM00C_STANDARD_DOM_REDUCED_MOTION_PASS`, `REM00C_APP_BOOTSTRAP_MOCK_PASS`, `REM00C_NEGATIVE_SELECTOR_FAIL_CLOSED_PASS`. No remaining observed uncaught JS errors in those Chromium contexts.
- Three sample stable hashes for inspection (exact SHA-256 of PNG as logged):
  - `01-owner-expanded` (393×852): `e911d94e1025449499806cf6d916c9c1baf76f0da2d6a24f58921442d32bc12f`.
  - `02-owner-collapsed` (393×852): `f1aff7dc7de55e019556038ee17e87a1dcfa24090d251ad4a013d8f8469d0a11`.
  - `11-standard-reduced-dark-bliki` (390×844): `91ddb61e22d0b720a9a131b9544889604f5482fb4a338fec70e15571f8e6c415`.
- Independent earlier baseline [run 39685196007](https://github.com/zhirayr2505/luemi/actions/runs/39685196007) was also green before stronger Nearby/card/indicator assertions were added. Latest passing runner is the stronger `8aa1448` scenario above.
- `npm ci`, lint, type checks, isolated API, unit/source tests, build and loopback smoke remained operational from REM-00B. The known 5 fingerprinted hooks warnings remain explicitly tracked by `qa/react-hooks-baseline.json`, not silently disabled.

## 4. What is and isn't verified

| Required property | Status | Exact boundary |
|---|---|---|
| Old Stage03E assertion does not fail on current JSX prop order | VERIFIED | Current structural contract, successful foundation CI |
| Real horizontal Nearby pager swipe and child card isolation | VERIFIED IN CHROMIUM | Touch dispatch against real React DOM; no assertion bypass |
| Android-UA owner/visitor sheet / tabs / viewer / route | VERIFIED IN CHROMIUM | 393×852 and 360×780 emulated mobile Chromium, not Android Telegram WebView |
| Standard DOM, light/dark, reduced motion | VERIFIED IN CHROMIUM | 390×844 iPhone-like UA but still Chromium, not real iOS Safari |
| Missing required element fails the browser scenario | VERIFIED | Explicit negative selector fixture passes by detecting thrown error |
| App-level bootstrap/viewport and mock identity | VERIFIED WITH MOCK | Real App loaded; mocked SDK and mock local API, no valid Telegram initData |
| Fonts, local images, endpoint screenshot hashes and diagnostics | VERIFIED | Loaded and recorded in runner and downloadable Actions artifact |
| Exact behavior on **Samsung Galaxy A55 inside Telegram** | **NOT VERIFIED** | Requires owner-operated physical device recording/interaction gate |
| Native **iOS Safari/Telegram WebView** | **NOT VERIFIED** | Chromium iPhone UA does not run WebKit |
| New full-screen gallery/media changes from REM-03 | **OUT OF SCOPE** | Not implemented or represented as passed |
| Release readiness of future real user server / billing | **NOT VERIFIED / OUT OF SCOPE** | No credential, Supabase, Render, deployment, or production mutations |

**No broad test skip, fake screenshot success, `continue-on-error` masking mandatory tests or application behavior change.** CI-green is an accurate statement **for the named bounded automated coverage**, not a general assurance of perfect 60 FPS on real hardware. Missing external device QA is called out rather than silently waived.

## 5. Rollback / owner checkpoint

1. REM-00C isolated branch is based on the exact accepted REM-00B `56cef7fd46be4d487a52f35a2b0b825a4d53002d`; REM-00A is an ancestor. The branch history is linear; no `main` or staging force update.
2. Draft PR is targeted at the **REM-00B branch**, not `main`. To reject REM-00C, close its Draft PR without merge. Accepted REM-00A/B remain intact and reusable.
3. For a partial rollback of tests only, revert the scoped REM-00C commits on a new review branch instead of resetting shared refs. Never delete or reset user data.
4. On approval, accept this REM-00 checkpoint and separately authorize REM-01; no later remediation begins automatically.
5. GitHub repository was made public by its owner before this work; its historical-secret audit is NOT VERIFIED, and this remediation does not grant security clearance for continued public visibility.
