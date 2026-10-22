# LUEMI 💜 — REM-02C Technical Verification (LU-10 / LU-11)

**Date:** 22 October 2026  
**Authorized scope:** only §9.3 and §9.4 of `LUEMI_MASTER_REMEDIATION_TZ_2026-10-21.md`  
**Exact accepted REM-02B base:** `0f5d86495df1f4e71629ecb02836b9e94af478fd`  
**Isolated branch:** `remediation/rem-02c-interrupt-arbitration-20261022`  
**Status:** source implementation and synthetic CI review; **physical Samsung Galaxy A55/iOS NOT VERIFIED**. Draft-only, no merge/deploy. Actual final run IDs and SHA are in Draft PR.

## Root-cause findings (before REM-02C)

- **LU-10 / hero:** the next drag started from the logical integer `activePhoto`; CSS `transform` could still be between photos. Disabling transition then writing `-activePhoto*100%` caused a visual jump. Dot clicks during transition reused the stale integer start. An index-based photo selection could point to a different photo after reordering.
- **LU-10 / main pager:** the browse track and underline inherited independent CSS transitions and eased at different rates. A new drag reconstructed both from the committed integer `tabIndex`, cancelling neither stale in-flight transition nor its fallback token. The line and track could snap and diverge during the following gesture.
- **LU-11 / input:** route Pointer capture, hero Pointer handling, mouse/pen tab Pointer handling, the native Touch sheet/pages recognizer and browser-native scrolling had no shared ownership protocol. Before axis lock, touch events could reach multiple recognizers; in scrolled content a passive-start touch listener must not suddenly seize horizontal scrolling. Second-finger and capture-cancellation paths needed a terminal protocol.
- **LU-11 / visitor route eligibility:** a modal-blocking selector also matched the legitimate visitor profile itself (`.pm-shell[role=dialog]`), which could suppress its back swipe. Only *nested* overlays should be blocked.

## Architecture and implementation

### `apps/web/src/ui/gesture-arbiter.ts`

The common `GestureArbiter` wraps the **REM-02A MotionController**, rather than implementing another animation system. Every interaction obtains a monotonically increasing session number, begins in a candidate phase, and can claim **exactly one** owner: `route`, `hero`, `sheet`, `tabs`, `browse` or `native`. Pointer and native Touch candidates for one physical contact may join one logical session. After a claim all competitors are rejected. The native owner disables every custom x/y writer. `finish`, `cancel`, second-finger cancellation, `pointercancel`, `touchcancel`, `lostpointercapture` are idempotent; callbacks with stale generation cannot claim, paint or commit. Native scroll is not prevented before legal claim. Gesture resources are disposed on unmount and can recover after React StrictMode's provisional effect cleanup.

The same module supplies `computedTranslation` (single `DOMMatrixReadOnly` sample at capture boundary), `fractionalTrack` (sub-page offsets) and `preservePhotoId` (stable ID mapping). It is independent from the React render clock and does not dispatch every pointer move to React.

### Hero photos / `ProfileMaster.tsx`

On genuine horizontal axis claim, read the **currently painted transform** once, freeze transition and use fractional `g.index` plus drag delta. The existing endpoint clamp, `0.18` edge elastic, 290 ms transition and `cubic-bezier(.2,.76,.22,1)` stay unchanged. In-flight dot or gesture retargeting likewise freezes the matrix before re-enabling the original CSS transition. Old RAF completions are ignored by identity and arbiter generation, `clickBlocked` still suppresses accidental viewer opens after dragging, and dots/photos remain clickable on ordinary taps.

`activePhotoId` is the semantic identity; on changed photo arrays the actual photo ID is re-located and the transform rebased to its new position without guessing by old integer index. If a photo is removed, the adapter clamps to a valid remaining item instead of leaving a dangling slot. Viewer implementation and hero image crop are not changed.

### Main discovery pager / `DiscoveryApp.tsx`

One live compositor sample freezes **both** browse track and underline matrices before any `is-finger-tracking` CSS toggle. The fractional track value is retained independently from React's selected tab. One coalesced RAF of the REM-02A controller writes both CSS variables inside the existing REM-02A `PROFILE_MOTION_WRITER_TABLE.browse` authority. The established track/ink easing curves remain **different as approved**; the underline retains the exact `-shift/3` relation during active drag. A new tap or drag interrupts the old settle generation, uses frozen computed matrices and moves directly towards the new tab; stale `transitionend` or 380 ms timeout cannot double-commit. Pointer capture is released only at terminal events. The established .22 edge elastic, 18% distance / .55 velocity threshold and 3-page bounds remain intact.

The previous source smoke checks have been adjusted **to stronger assertions** for the actual new fractional/motion code paths; no tests have been deleted, suppressed, disabled or converted to unconditional passes.

### Native sheet/pages / visitor route

The sheet Touch recognizer does not stop existing settling while the finger is only a candidate. After meaningful axis classification one owner claims, and only that owner may write sheet or tabs. Scrolled content whose touchmove listener began passive is **native** for the full gesture; no mid-stream custom x takeover or automatic page correction on native touchend. On resize the accepted REM-02B pointer anchors and revision guards continue to work. Multi-touch cancels the active single-finger claim and allows a following fresh interaction.

The visitor route's Pointer recognizer shares the exact arbiter with the underlying `ProfileMaster`. It attaches capture-phase non-passive touch suppression **only after** the route itself legitimately claims a back gesture; before then browser native scroll and nested gesture candidates are untouched. Route eligibility checks the physical fractional photo track at its first item, the first page, and the native tab strip scroll boundary, rather than stale integer-only state. The legitimate visitor `.pm-shell[role=dialog]` is not treated as a blocking nested modal; fullscreen viewer, menus and other nested overlays remain excluded. Route entrance/exit easing and durations are unchanged.

**REM-02D intentionally untouched:** interrupted route rollback/resume/visibility lifecycle and browser background reconciliation (LU-08/LU-12) are not declared finished.

## Verification plan and measurable acceptance

**Existing checks:** all original Foundation CI, source/React hooks strict diagnostics, REM-00C and REM-01A/B/C/D/E and REM-02A/B behavioral Chromium suites remain on the same workflow.

**REM-02C mandatory unit/adapter tests** (`scripts/rem-02c-gesture-contract.test.mjs`):
1. Actual transpiled MotionController + arbiter: pointer/touch candidates yield one owner and exactly one terminal.
2. Native scroll vetoes competing custom writes; second finger cancels; tap is not captured; cancel and duplicate capture termination are idempotent.
3. React StrictMode cleanup followed by a new gesture; stale generation denied.
4. Stable photo IDs after reordering/deleting, and fractional `DOMMatrixReadOnly` freeze (including signed-zero behavior).
5. Original profile/hero/browse easing, edge elastic, CSS durations, ownership matrix, and absence of page-level `touch-action:none` confirmed.

**REM-02C real Chromium Android-like QA** (`scripts/rem-02c-browser-interruption.mjs`):
1. Real mouse pointer capture of hero at **50/150/250 ms** during CSS settle; exact before/first-frame matrix and **≤1 CSS px** continuity (with approved 0.18 edge elastic).
2. Interrupt hero via dot during settling; photo first/last edges (no wrap, no unintended viewer open); theme-induced React rerender.
3. Real browse/ink matrices at **50/150/250 ms**, checking each coordinate **≤1 CSS px** at next first painted frame, even though easing differs; tap-to-retarget and exactly one selected tab.
4. Vertical-dominant diagonal, first/last browse bounds, slow below/above-threshold swipes and pointercancel terminal while preserving native scroll.
5. Native CDP `Input.dispatchTouchEvent` on **genuinely scrolled** content: no custom tab write; two simultaneous real touch points cancel active sheet drag, restore a consistent physical endpoint **≤1 CSS px**.
6. Visitor route real horizontal back on a profile with `role=dialog`: only legitimately allowed route captures and closes; no global/modal blanket block.

This synthetic Chromium test is **not a physical Telegram WebView run**. A source-level array reorder test is not evidence of a full backend photo reordering transaction.

## Open gates and safety

| Gate | Result |
|---|---|
| Galaxy A55 real Telegram Android WebView, rapid repeated touch and nested native scroll | **NOT VERIFIED** |
| iOS Telegram WKWebView, touch/pointer ordering, native momentum, capture loss | **NOT VERIFIED** |
| Runtime p95/p99 FPS and measured visual comparison on physical devices | **NOT VERIFIED** |
| 50 MP photos / decoded memory; temporary 32 MP cap | **OPEN — 32 MP UNCHANGED** |
| IndexedDB v2 photo storage compatibility when downgrading prior to REM-01B | **OPEN — NEVER DELETE USER RECORDS** |
| REM-02D LU-08 route rollback, LU-12 visibility lifecycle | **NOT AUTHORIZED / NOT STARTED** |

## Rollback and change control

Accepted rollback target is **exactly** `0f5d86495df1f4e71629ecb02836b9e94af478fd`. Close the REM-02C Draft PR and discard only branch `remediation/rem-02c-interrupt-arbitration-20261022`; no cherry-pick, merge or deploy. Reusing the accepted REM-02B keeps all REM-00A/B/C, REM-01A/B/C/D/E and REM-02A/B fixes unchanged. No database migration or user data update occurred in this branch; do **not** clear IndexedDB, change its v2 photo format, or lower the temporary photo limits as part of rollback. A future deployment rollback to a pre-v2 reader must first provide explicit reader compatibility.

Neither `main`, `staging`, Render, Supabase, real users nor other projects are modified. REM-02C stops at owner approval; **no REM-02D without a separate explicit authorization**.
