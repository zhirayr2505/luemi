# LUEMI — Motion, Gesture and Dead-Code Audit (2026-10-25)

> Status: architectural cleanup in **Draft PR #62**. This document is not a claim of device-level acceptance or release readiness.

## Baseline and protections

- Repository: `zhirayr2505/luemi`; source baseline: **Telegram staging** `5391ffe20db6c137c1171d36de019452615923d0`.
- The old GitHub `main` was still `a9d31876b27f0472ec3ca568b4a14926b9fdbdee` at the beginning of this audit. Do **not** audit that obsolete main as though it were the version users saw.
- Inventory: **340 tracked files**, including **183 under apps**, **64 under scripts**, **22 GitHub Actions workflows**, plus shared packages, SQL migrations and documentation.
- This review reads the active frontend entrypoints and render/motion/gesture classes, verifies the relevant backend import surface, and uses CI for broader code/QA coverage. It does **not** assert line-by-line semantic certification of every Markdown document, fixture or test.

## Existing responsibilities and where the duplication arose

| Component | Intended owner | Current audit finding |
|---|---|---|
| `App`, `RegistrationBoundary` | Onboarding, session, preview routing | Keep; not a sheet writer |
| `DiscoveryApp` | Browse tabs, feed card transitions | Owns browse `MotionController` and pointer input |
| `VisitorProfileRoute` | Horizontal profile opening/closing | Owns route `MotionController`, captures parent pointer events |
| `ProfileMaster` | Vertical sheet, hero/photo carousel, inner tabs | Owns geometry RAFs, native Touch input, nested media |
| `PhotoViewer` | Fullscreen media and pinch/pan/morph | Owns a separate media session and motion; do not conflate with sheet |
| `GestureArbiter` | Which input consumer may claim a physical gesture | **Previously built its own MotionController as well as managing sessions. Removed this redundant rendering state.** |
| `MotionPropertyAuthority` | Runtime validation of the *actual* properties each component writes | Retained; removed unused `route-reveal` property |
| `GeometryMotion` | Geometry-aware interpolated transitions | Retained and used; old parallel `animateValue` helper removed |

A race existed because `pointerup` in a parent could terminate an entire shared candidate session before a child's `touchend` / `touchmove` completed. The arbiter now supports **candidate-specific release**, tracks pointer and touch identifiers separately and rejects a second same-kind finger. The route and browse release only their own candidates. This is covered by regression tests.

## Deleted or simplified with direct evidence

1. `VisitorProfileRoute`'s `data-route-revealing` write paths were dead: no current CSS file contains a consuming selector. Removed the write path and obsolete property authority member; updated browser diagnostics to stop toggling a no-op flag.
2. `cancelProfileGesture` was stored by the parent and registered by `ProfileMaster`, but never invoked. Deleted both sides of the unused callback/effect.
3. `GestureArbiter` no longer allocates a `MotionController` merely to mirror its own candidate/claim state.
4. Deleted the unused `animateValue` parallel RAF helper; `GeometryMotion` continues to use `easeAt`.
5. Deleted the dormant `createProfileMotionControllers` factory (not used by any runtime path).
6. Removed the duplicate `.deck-queued .photo-progress` CSS declaration.
7. Removed four **archived, obsolete** Stage03G3–G6 browser QA scripts and their README. Their original bytes remain available in Git history; active REM-00C browser QA remains present.

8. Removed the unmounted legacy `BlikViewer.tsx` (independent React/RAF media timer). Its unused avatar `.has-blik` styling was deleted. The separate, pure `bliki-media-lifecycle.ts` REM-05F future-state module is retained intentionally; the stale audit exemption for the deleted viewer was removed.
9. Deleted unreferenced registration preview CSS classes from the old onboarding generation. Computed feed-button classes like `discovery-${kind}` remain intentionally: a literal selector search falsely labels these as unused.
10. Deleted the unused `gestureCapabilities` API that measured `scrollHeight` and `scrollTop` synchronously during a visitor-profile pointerdown. The route now checks only nested modal blocking; actual pointer movement decides x/y gesture ownership. This prevents a stationary, scrolled profile from losing all horizontal back-swipe candidates.
11. Updated both unit and browser regressions to use the new modal-only gate. No old gesture API is left merely to satisfy legacy tests.
12. A second proposed reachability implementation was reverted: the **existing TypeScript AST-based strict architecture audit** remains the only source-of-truth gate, avoiding duplicate scanners.
13. Deleted `createGuardedCompletion`, a wrapper exported from production `profile-motion.ts` but used only by the adapter unit test. The test now exercises `MotionController.finish` directly with captured tokens and the same double-commit/stale-generation assertions.
14. Pruned old ForYou, Nearby and filter selectors from `isGestureModalBlocked`. That gate runs only inside `VisitorProfileRoute`; browse nodes are outside its DOM. Added a negative regression so such selectors cannot silently block unrelated gestures.
15. Extended the strict architecture audit to reject reintroduced retired helper identifiers (`animateValue`, `createGuardedCompletion`, `createProfileMotionControllers`, `gestureCapabilities`) and the no-op `route-reveal` flag in frontend/API sources. Left protected runtime modules, CI and data/security migrations intact.



**Intentionally retained:** REM-05B–05F security/session/storage modules, migrations, current CI/browser suites, the accepted UI/brand assets, and feature-reserved Bliki modules. “Not called during staging” is not enough evidence to delete a secured future feature.

## Second-pass independent cleanup

- **Removed the orphan modal selector** `pm-blik-viewer` after verifying its original `BlikViewer.tsx` component had already been deleted and neither the active `PhotoViewer` nor other profile components render it. The real `pm-preview-toolbar` is intentionally retained: the local profile preview still renders it.
- **Removed double modal gating** in `VisitorProfileRoute`. The shared `isGestureModalBlocked` remains the single source of route/modal hit exclusion.
- **Removed unused arbiter state** `blockedNative` and the dormant `blocksNative()` / `serial()` accessors. The accepted `claimed` state is the one source of gesture ownership.
- **Consolidated duplicate `.goal-badge` CSS** without changing computed styles; earlier `font-size:13px` was overwritten by `14px` immediately.
- **Validated reuse of `.age-range`**: while not directly referenced by the filter view, `DoubleAgeRange` imported from registration creates it. Do not delete merely because a direct selector grep does not see it.
- Extended AST audit with a production import-cycle report and strict enforcement. First verified run reported **zero production dependency cycles**, **zero unreachable modules**, and **zero retired identifiers**.
- Source-level import reachability does **not** prove no unused exported symbols, no CSS dead declarations, or device-level gesture correctness. Those require separate measured inspection rather than mass deletion.

## Ongoing guardrails

- `scripts/architecture-audit.mjs --strict` now builds an AST import graph from the real web and API entrypoints, includes separately declared QA entrypoints, and fails for unreferenced modules unless an explicit, documented exception exists.
- `npm run test:source-contracts` invokes this gate. New dead modules can no longer be silently added without review.
- `scripts/rem-02c-gesture-contract.test.mjs` covers pointer/touch ordering, independent candidate release, stale sessions, and second-finger cancellation.
- Existing Android matrices, theme, sheet, registration, PhotoViewer and API CI must also remain green.

## Outstanding architecture work before any “finished” claim

- The three large components (`ProfileMaster`, `PhotoViewer`, `DiscoveryApp`) still own complex interaction logic. A safe extraction into separately testable state machines requires further measured changes. This PR does not pretend they have been fully rewritten.
- Browser test PASS cannot prove actual Samsung Galaxy A55 / Telegram Android WebView frame pacing, GPU tile lifetime, or iOS Safari rendering. Physical device instrumentation remains a release condition.
- Recorded black photo-viewer frames and occasional deck ghosts should be reproduced independently before altering their caching/paint logic; speculative CSS patches risk restoring regressions.
- Do not automatically merge this draft PR into `main` or auto-deploy to Telegram until the refactor test suite and physical checks are accepted.


## Third-pass independent verification (same Draft PR)

- **AST graph:** 86 TS/TSX/CSS modules; last fully verified run: zero unreachable, zero stale exceptions, zero production import cycles, zero retired identifiers or flags. This does NOT certify every function or animation as necessary.
- **Export diagnostics:** source and test/secure-test consumers are now scanned. Suspected unused exports are reported for human review, not removed automatically. Internal-only exports readViewerInsets, applyViewerInsets, ViewerInsets, clampPosition, and extraDemoPeople were made private while their runtime implementations stay intact.
- **CSS:** reviewed all six web stylesheets. Repeated identical 'to' keyframe bodies belonged to different animations, so they were not blindly deleted. Runtime-generated class selectors must not be removed by grep.
- **DOM writes:** inspected VisitorProfileRoute (5 direct transform/transition writes), ProfileMaster (18), PhotoViewer (37). These are candidates for deeper ownership testing, NOT proof that the writes conflict. PhotoViewer has a legitimate separate media motion surface.
- **Chaos stress:** retained the existing test harness rather than adding a duplicate. Existing 100,000 gesture and 50,000 motion operations, plus 7,000 focused hostile-RAF / reentrant completion races checking stale-frame rejection, paint-before-commit and exactly-once semantic completion.
- **Safety:** no main, Telegram staging, Render, Supabase, existing secret or user-data changes. CI and physical device QA remain separate release gates.

### Remaining limitations

Suspected-unused exports can include public contracts, internal-only types and synthetic secure-test fixtures. They require specific proof before deletion. AST import reachability cannot guarantee smooth Android WebView frame pacing, iOS Safari behaviour, or the absence of PhotoViewer GPU artifacts.


## Fourth-pass independent cleanup and adversarial coverage

- Re-checked six production CSS stylesheets for byte-identical duplicate selector declarations. None of the main style rules was safely deletable on that basis. Identical inner `to` keyframes serve separate animations; leave intact.
- Re-checked ownership boundaries in the main browse, visitor route, profile sheet, and fullscreen viewer. Maintain separately scoped motion controllers for separately moving surfaces. Do not replace them with one global animation writer: exclusive *gesture claims*, not one global transform, are the relevant invariant.
- Private file-local helpers have narrower export surfaces: `isMotionToken`, `MIN_SCALE`, `MAX_SCALE`, and `MAX_HEADER_BYTES` retain their internal implementation, but are not re-exported as public APIs. This is API cleanup, not removal of their runtime logic.
- **Important test-discovered correction:** `nameValid` and `birthDateValid` were initially misclassified as local-only. `apps/api/test/registration-model.test.ts` directly imports both. Their exports were immediately restored; this is evidence why a grep-only dead-code deletion would be unsafe. The AST audit's consumer set now includes `.ts` and `.tsx` files under API tests and secure-tests, not just `.js` scripts.
- Added an exhaustive permutation test for eight hostile input actions (40,320 event orderings, 322,560 operation slots), covering parent pointer versus child touch claims, candidate releases, native scroll claims, cancelled sessions, second fingers, and stale-generation callbacks. It supplements existing 100,000 randomized gesture actions, 50,000 motion actions, and 7,000 hostile RAF/reentrant completion races. Test PASS is a state-machine invariant, **not** proof of Android/iPhone GPU frame pacing.
- Preserved public exports required by tests/security contracts and retained real Bliki readiness, API RLS/session/auth, SQL migrations, and PhotoViewer geometry. Those are not 'dead' merely because UI-only staging does not call them.
- Remaining high-risk work is **instrumented physical Android WebView and iOS Safari evaluation** of scroll-to-sheet handoff, image blackout during morph/pan, and the occasional translucent deck frame from the supplied video. No claim that all visual defects are cured without device evidence.

