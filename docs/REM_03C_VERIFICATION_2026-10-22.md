# LUEMI 💜 — REM-03C verification (LU-04)

**Date:** 22 October 2026  
**Immutable accepted REM-03B:** `c3628d70a3ba79646fad7a679762e12e1281f505`  
**Isolated branch:** `remediation/rem-03c-pinch-pan-20261022`  
**Draft PR:** https://github.com/zhirayr2505/luemi/pull/44  
**Authorized scope:** §10.6 only of `LUEMI_MASTER_REMEDIATION_TZ_2026-10-21.md`.

## Root cause

The previous PhotoViewer calculated zoom from relative pointer distance, but pan from the delta of the pointer midpoint without solving for the content-local focal point. Its pan limits were `(scale-1)*innerWidth/2`, etc., not limits derived from the intrinsic image's actual `object-fit:contain` geometry. It reset zoom when the first of two pointers was released, and it could misclassify a remaining pointer as navigation or vertical dismiss. A third contact changed the iterated pointer pair.

## LU-04 geometry contract

`photo-viewer-zoom.ts` provides deterministic, side-effect-free CSS viewport geometry: natural-size contain rect, viewport-local client mapping from measured transformed surface bounding rect, transform snapshot from real `DOMMatrixReadOnly`, focal anchor q, scale clamp, pan bounds, and one-finger pan math.

For two active contacts with midpoint f, viewport center C and media transform (t,s):

`q = (f - C - t) / s`

`s' = clamp(s0 * distance(current) / distance(start), 1, 3.2)`

`t' = f' - C - q * s'`

Then clamp t to the actually rendered, zoom-scaled `object-fit:contain` image extents. For each axis: if scaled contain content is smaller than viewport, t=0; otherwise `|t| <= (scaledContent - viewport)/2`. Focal preservation is exact before a physical clamp. Zoom and pan are verified from the actual browser DOMMatrix, not from a React state claim. The approved 1–3.2 zoom range and 230ms media reset curve remain unchanged.

## Pointer and ownership transitions

- `PhotoViewer` keeps the REM-03B 3-slide track and uses the existing `GestureArbiter` for initial one-pointer gesture arbitration, `GeometryMotion("hero")` for the unchanged horizontal track, and `MotionController` for opening/closing.
- **Exclusive media property owner:** the current `img` writes only its own scale + pan matrix; neither viewport root nor track writes that property. On a new contact during a CSS media-reset transition the live computed DOMMatrix is sampled and frozen before movement; no stale animation frame wins.
- The first two active pointer IDs form an immutable pair. A third (or more) touch is ignored for pinch calculations until an active pair member leaves. After 2→1 the survivor pans from a frozen current matrix. After 1→2 a new focal q is anchored without resetting scale; repeated transitions do not produce a leap. Either pointer can be removed first.
- A pinch/pan session has exclusive ownership until the **last** pointer leaves; horizontal navigation and vertical dismissal cannot be mistaken for pinch translation. Native pointercancel, touchcancel, lostpointercapture, Telegram background and visibility transitions terminate stale pointer ownership without a semantic photo commit.
- After final release, the accepted behavior returns the same image to 1×/0 via the same 230ms easing. New contacts interrupt this actual computed matrix instead of snapping.
- Portrait, landscape and panoramic media derive pan limits from actual intrinsic image dimensions and the measured viewport, including ResizeObserver rebase and synthetic visibility changes.

## Vertical dismiss

Keep the approved bi-directional vertical dismiss semantics. Thresholds remain **110 CSS px** or **0.8 px/ms**. Vertical surface y transform and stage opacity are written together during pointer tracking and returned together on cancel. No vertical dismiss when zoom>1 or a pinch session is active. Terminal close uses the pre-existing REM-03B MotionController single-token exactly-once completion; no competing animator is introduced.

## Automated checks and evidence

- Additive pure math unit: `scripts/rem-03c-pinch.test.mjs` appended to `npm run test:source-contracts`. Covers focal q across 4 image aspects × 4 off-center points, landscape/portrait axis-fit centering, clamp limits, scale boundaries, local coordinate mapping and pan rebase.
- Real Chromium CDP multitouch: `scripts/rem-03c-browser-pinch.mjs`. Uses native Chrome CDP `Input.dispatchTouchEvent` for simultaneous 2/3-pointer sequences. Asserts actual DOMMatrix focal conservation before clamping, pan of surviving finger, 1→2→1→2 sequences, first/second finger release order, stable third pointer policy, portrait/landscape/panorama, content bounds, zoom-based navigation and dismiss exclusion, viewport resize midpinch, native touchCancel/pointercancel/lostpointercapture, visibility/background, vertical cancel and upward terminal dismiss, StrictMode/reopen/keyboard regression, no duplicate close commit.
- The full Behavioral workflow appends the new Chromium test **after** all unchanged REM-00–03B scripts. New focused REM-03C workflow is additive only. No assertion or previous test may be weakened, skipped or removed.
- **Final exact-SHA CI:** PENDING until all required Foundation, full Behavioral PR and Push, and focused REM-03C runs complete SUCCESS. Do not substitute older-SHA evidence.

## Restricted operations / physical device gate

No code, data, or deployments outside REM-03C; do not implement REM-03D crop morph, retune horizontal physics, ease, menu styling, profile/route/registration, IndexedDB v2, original photographs or temporary 32 MP limit. Keep accepted REM-00–03B behavior.

**NOT VERIFIED:** physical Samsung Galaxy A55 inside Telegram Android WebView and iOS/WKWebView. Real hardware black-frame elimination, frame pacing, GPU memory and OS-native pinch behavior are **not** proven by synthetic Chrome CDP.

## Safe rollback

Do not merge Draft PR #44. If the owner rejects this stage, retain immutable accepted REM-03B `c3628d70a3ba79646fad7a679762e12e1281f505` as the baseline, close the Draft only on instruction and start a new isolated branch from that SHA. No reset, force-push, delete of user media, deployment, Render/Supabase writes or main/staging changes are permitted.

**STOP after REM-03C for technical acceptance; REM-03D requires new explicit authorization.**
