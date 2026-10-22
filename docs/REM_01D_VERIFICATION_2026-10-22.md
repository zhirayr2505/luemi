# LUEMI 💜 — REM-01D · LU-22 Viewport / Fullscreen / Keyboard

**Date:** 2026-10-22  
**Status:** Code review / automated QA. Physical device checks are a mandatory separate gate.  
**Accepted immutable base:** `b9d03852f10a8b4244425f32af64c61ee1433550` (REM-01C)  
**Isolated branch:** `remediation/rem-01d-viewport-keyboard-20261022`

## 1. Scope and provenance

Implemented exclusively LU-22 as specified in `LUEMI_MASTER_REMEDIATION_TZ_2026-10-21.md` §8.8. Only the App viewport effect, common viewport-sizing CSS, its previous contradictory smoke assertion, new independent viewport model/controller, and REM-01D tests/docs/workflow are modified.

Existing REM-00A/B/C + REM-01A/B/C remain inherited with **no modifications** to registration draft/persistence, photo files/preflight/sorter, Supabase/API, profile/discovery motion, animation durations, branded assets or production configurations. `main`, `staging`, Render, user data and deployment targets are NOT touched.

## 2. Root cause and policy

**Before REM-01D**, the App kept `stableHeight` monotonically growing for same-width windows, treated any visual-height drop >145 CSS px as keyboard (without consulting focus or stable Telegram event), assigned an artificial `--keyboard-overlay` bottom margin to the form scroll area and hid the form footer with `[data-keyboard=open] .onboard-footer{display:none}`. A legitimate exit from Telegram fullscreen could keep the shell taller than the available frame, placing buttons offscreen. No orientation-specific stability contract existed.

**After REM-01D**, `apps/web/src/viewport/viewport-model.ts` owns a pure revisioned snapshot:

`{layoutWidth,layoutHeight,visualWidth,visualHeight,visualOffsetTop,visualOffsetLeft,stableHeight,stableWidth,visibleHeight,shellHeight,shellTop,keyboardState,keyboardOverlap,safeInsets,contentInsets,orientation,focusedEditable,revision,acceptedStableHeight}`.

- Telegram `viewportChanged({isStateStable:true})` **accepts a smaller stableHeight with exactly the same width**. No monotonic max is retained. A `window.resize` without an editable focus rebases to the new window height; width/orientation changes invalidate stale portrait/landscape stable values.
- The visible shell is bounded by the current **VisualViewport**, layout-height remaining after `offsetTop`, and any *accepted* stable Telegram frame; it is not pinned to the original fullscreen height. For browsers without Telegram, window/visual dimensions provide an explicit bounded fallback.
- Software keyboard state: `open` only when an editable control is focused and the visual deficit is sufficiently large relative to its accepted stable baseline; `uncertain` for ambiguous shrink and for a brief blur-while-keyboard-still-visible sequence; `closed` when visibility restores. Focus alone, or a legitimate stable fullscreen exit, is **never proof of an open keyboard**.
- A single RAF controller coalesces window resize/orientation, visualViewport resize/scroll, Telegram viewport/fullscreen/safe-area events and focusin/focusout. A stable Telegram callback takes precedence over generic visual resize in the same frame. `luemi:viewport-revision` is emitted as an **unconsumed, passive contract** for later REM-02 motion-controller integration; no motion-controller changes are part of this stage.
- `--app-height` now describes the available shell, `--viewport-offset-top` aligns an offset visual viewport, and `data-viewport-compact` adjusts only vertical spacing when the visible shell is less than 520 CSS px. Normal-size design, motion/gestures and structural positions are retained. `onboard-footer` stays rendered throughout keyboard open and close; only the form's internal `.onboard-body` scrolls and the focused editable is revealed within that body, without `document.scrollIntoView` or forced whole-page scrolling.
- Safe-area and content-safe-area measurements are **separate snapshot fields** and combined via `max`, not sum, along with CSS `env(safe-area-inset-*)` and existing Telegram inset variables. Bottom safe area is reserved **once** in the onboarding layout/footer, not in two nested bottom paddings. Keyboard overlap is never deducted a second time as an internal scroll margin.
- Controller owns and releases all listeners and pending RAF on unmount. No persistent mutable viewport singleton.

## 3. Test plan and evidence

**Required Foundation gate** additionally executes `scripts/rem-01d-viewport-model.test.mjs` using actual transpiled reducer code. Fixtures cover same-width height decrease, stable Telegram fullscreen exit, keyboard open/dismissal, focus blur while IME remains open, orientation reset, no-Telegram fallback, VisualViewport offset, safe/content insets and ambiguous editable focus.

**Required Browser gate** executes `scripts/rem-01d-browser-regression.mjs` after existing REM-00C, REM-01A, REM-01B and REM-01C browser regressions in the same GitHub Actions run. It loads isolated `rem-01d-viewport-qa.html` using the **production** viewport controller and **production** registration CSS, drives Chromium window sizes and Telegram/VisualViewport callbacks, and asserts browser `getBoundingClientRect` shell/footer/input bounds. Scenarios: initial shell, same-frame RAF coalescing, same-width Telegram stable fullscreen exit, focus + virtual IME resize with visible navigation buttons, editable internal scroll reveal, blur before IME hides, keyboard dismissal, real browser window height reduction, real browser orientation dimensions, iOS-like visual offset and Telegram safe areas, fully unsubscribed callbacks on disposal.

**Historical smoke assertion:** Existing `scripts/ui-contract-smoke.mjs` expected `onboard-footer{display:none}` while typing, a historical behavior that explicitly contradicts newly authorized LU-22. Replaced **only that one** expectation with a stronger positive assertion: same App viewport controller, retained actual form scroll, visible footer, and no doubled keyboard overlay. All other legacy assertions and all previous browser suites are unchanged.

Automated QA from Chromium + synthetic Telegram callbacks **does not** demonstrate real Telegram WebView/WKWebView behavior, native keyboard panning, actual OS cutout measurements or real device p95/p99 frame timing. Do not report those as PASS.

## 4. Gates deliberately left open

| Validation | Status |
|---|---|
| Samsung Galaxy A55 / Telegram Android WebView: keyboard, fullscreen exit, native viewport events, bottom arrows | **NOT VERIFIED** |
| iOS Safari / Telegram WKWebView: offsetTop, keyboard transition, safe area, orientation | **NOT VERIFIED** |
| 10+ iterations open/focus/close/rotate and screenshots in both themes on actual devices | **NOT VERIFIED** |
| Discovery/Profile motion endpoints reacting to viewport revision | **Deferred to approved REM-02**, no new integration in LU-22 |
| Physical high-resolution 50 MP originals and peak decoder memory | **NOT VERIFIED; blocked release decision, still open from REM-01C** |

The provisional **32 MP source-image guard is NOT a permanent product approval**. No budget increase or original File deletion was made. Some 50 MP photos may remain unsupported for preview until a separate measured device-performance decision. Server/media storage and REM-01B v2 format are unaffected by this stage.

## 5. Rollback and compatibility plan

**At the current review-only stage**, no deployment or production data writes occurred. The safest rollback is to close the REM-01D Draft PR, discard the isolated branch, and continue from precisely accepted REM-01C `b9d03852...`. No database or browser storage clearing is permitted or necessary.

If later selectively reverting on a review branch, revert only the REM-01D-only files/App viewport effect/CSS/QA assertion while keeping REM-00A/B/C, REM-01A/B/C and all their tests intact. Before any future production rollback, preserve existing REM-01B v2 IndexedDB drafts: **v2-only photos cannot be viewed by the older pre-REM-01B client without a compatible reader**. Never drop IndexedDB or delete originals.

Stop the release if physical fullscreen changes leave a shell taller than the viewport, a keyboard covers the next/back controls, focus moves the entire page, safe padding doubles, a tab/profile gesture endpoint jumps, 50 MP source handling threatens data or the previous CI suite regresses. Report physical measurements before any further geometry or image budget changes.

## 6. Authorization boundary

No merge, no deployment, no real user migration, no changes to `main`/`staging`/Render/Supabase or other projects; **REM-01E strictly prohibited without new explicit owner authorization**. Await owner acceptance after green CI.
