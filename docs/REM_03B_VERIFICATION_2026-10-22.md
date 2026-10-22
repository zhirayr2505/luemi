# LUEMI 💜 — REM-03B / LU-01 + LU-03 Verification

**Date:** 22 October 2026  
**Approved exact REM-03A ancestor:** `aef12d2b9805b1a7efc97914e6c12bcc21eb6116`  
**Branch:** `remediation/rem-03b-continuous-viewer-20261022`  
**Draft PR:** https://github.com/zhirayr2505/luemi/pull/43  
**Permitted sections:** 10.4 and 10.5 of the approved master remediation specification.

## Boundaries

No REM-03C or REM-03D implementation, no crop-morph redesign, no pinch geometry redesign, no new easing or visual brand treatment. All accepted REM-00A/B/C, REM-01A/B/C/D/E, REM-02A/B/C/D and REM-03A mechanisms remain in scope for regression. This isolated branch has no permissions to merge, deploy, rewrite main/staging, access Render/Supabase user data, alter IndexedDB v2 or originals, or change 32 MP limits.

## Architecture

- **Three keyed viewport-width slots** (`previous/current/next`): `photo-viewer-geometry.ts` yields the window by stable photo ID. `PhotoViewerSlide.tsx` keeps actual per-resource DOM identity and independently decodes each displayed `img`. React keys are `resourceIdentity(photoId,src,version)`. An arriving neighboring image remains the same actual DOM node after a successful settle/recenter. The same REM-03A `PhotoReadiness` cache preloads at most previous/current/next. Cold/error slots never reveal stale neighbor pixels.
- **Track owner**: existing `GeometryMotion` explicitly supports the `hero` MotionController owner. The track transform is `translate3d(calc(-100% + x px),0,0)`. During an interior x drag, `x=frozenX+pointerDelta` with **no coefficient**. Only over boundaries does a monotone bounded resistance apply. At drag release use the original 17%-of-width or 0.52 px/ms threshold, sampling recent (80ms) pointer velocity; JS easing baseline is 240ms with existing `[.2,.8,.2,1]`. Cancel/re-touch freezes the current interpolated GeometryMotion sample before painting a new finger delta.
- **Atomic commit**: old window moves to ±viewportWidth first. MotionController finishes exactly once. The committed ID then updates in React; a `useLayoutEffect` recenter writes x=0 before paint, with the keyed incoming `PhotoViewerSlide` reused rather than recreated. The committed date, menu, ID and permissions always agree. External reorder/removal and viewport resize invalidate stale motion and preserve canonical photo IDs.
- **Input arbitration**: the existing `GestureArbiter` arbitrates pointer candidates; pinch keeps existing 1–3.2 scaling, and vertical dismiss preserves baseline distance/velocity/screen responses (full geometry updates explicitly deferred to REM-03C).
- **Motion partition**: track owns horizontal x, media IMG owns pinch and pan, outer surface owns opening/closing/y transform, and the stage owns opacity. Opening/closing uses a separate existing `MotionController` generation, with scoped transform/opacity `transitionend` plus safety timeout feeding a *single* guarded finish. Lifecycle notifications use existing `bindMotionLifecycle`. StrictMode cleanup creates fresh disposed drivers instead of reviving stale RAF state.
- **Compatibility:** screen buttons and keyboard preserve previously approved immediate navigation; actual finger swipes use the 240ms uninterrupted/interruptible track settle. No retroactive change to tab/route/registration animations or styling. Existing viewer chrome/menu/dates remain.

## Verification matrix

The new pure unit script `scripts/rem-03b-track.test.mjs` exercises 0/1/2/6 photos, windows/IDs, 1:1 positions, edge-only resistance, recent direction/velocity, original thresholds, recenter and resize math; it is appended to the existing Foundation source-contract suite.

The real Chromium DOM test `scripts/rem-03b-browser-track.mjs` checks live 0/1/2/6 resources, real CSS transform matrix, neighboring slot entering during drag, keyed identity through recenter, short rollback, long commit, mid-settle re-touch/reversal, viewport width, twenty swipes, cold and broken media, opening/closing, reduced motion and exactly-once terminal finish. It is **appended** after the existing REM-00C–REM-03A browser regressions in the full behavioral workflow. A focused REM-03B workflow is additive, never a substitute.

All final exact-HEAD CI references (full 7-job Foundation; 2-job Behavioral; 1-job focused track) must be logged in Draft PR #43 after success. No test disabled or expectation weakened. Physical Samsung Galaxy A55 Telegram WebView and iOS/WKWebView remain **NOT VERIFIED**. Browser Chromium proves deterministic behavior only, not actual mobile black-frame elimination under low memory or physical touch hardware.

## Safe rollback

Keep approved REM-03A immutable: `aef12d2b9805b1a7efc97914e6c12bcc21eb6116`. If REM-03B fails owner acceptance, leave the draft unmerged or close by owner instruction and continue from this commit; do not reset main/staging or force-push. No real photo, Render, Supabase, storage or user-data operation was authorized or performed.

**Stop after REM-03B. REM-03C requires a separate explicit owner authorization.**
