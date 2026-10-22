# LUEMI 💜 REM-02B — LU-09 Geometry and settle continuity

**Date:** 2026-10-22  
**Base accepted REM-02A:** `1172548040f5232e0ba080bbc9a37747f13a5938`  
**Isolation:** `remediation/rem-02b-geometry-settle-20261022`  
**Source specification:** `LUEMI_MASTER_REMEDIATION_TZ_2026-10-21.md`, §9.2.  
**Release status:** DO NOT MERGE / DO NOT DEPLOY. Physical A55 and iOS NOT VERIFIED.

## Root causes

1. Before 02B the ProfileMaster sheet `ResizeObserver` cancelled the active `animateValue`, cancelled the active touch gesture and painted a height-normalized percentage. An active settle therefore froze at a nonendpoint; an active finger lost ownership. On resize with viewport top shift, normalized percentage could move the sheet away from the finger.
2. The tabs observer cancelled in-flight motion, cleared the pointer session and unconditionally repainted the selected integer tab. A partial page position was lost when metrics, font or width changed.
3. Existing state `collapsedRef` was set when a **target** was requested, not at the physically painted endpoint; background route can only trust actual completed dataset state.
4. Browser scrollLeft can be internally adjusted after layout width changes. Reading the new scrollLeft with the **old** width after reflow is insufficient to recover the pre-reflow fractional tab position.
5. Zero-sized hidden roots can issue ResizeObserver callbacks; their geometry must be deferred rather than used as a new endpoint.

## 02B changes

### Shared geometry-motion adapter

`apps/web/src/discovery/geometry-motion.ts` uses **REM-02A MotionController** and geometry revision/generation tokens. It advances the exact existing `easeAt` bezier curve. It snapshots the actual interpolated sample at the event timestamp (not the most recent outdated RAF), active target, last position, remaining duration, easing progress and revision; on `rebase` it cancels the old frame and continues through the unused interval of that same curve to the **new** endpoint. For a rebase 25%, 50% or 90% through a 335ms/295ms animation, the remaining time is kept rather than restarting the full duration. A hidden node uses `suspend` and pauses elapsed time, then `reveal` resumes with the remaining budget. Completion writes terminal pixels and commits React state once, with token checks and cleanup inherited from 02A.

`apps/web/src/discovery/profile-geometry.ts` contains pure screen-space remap and touch/pointer anchor math. Unavoidable clamp when a previously visible absolute pixel lies outside the new physically permissible interval is detectable and is not silently interpreted as successful continuity.

### Sheet

`ProfileMaster.tsx` measures root/hero/header rects before mutations; old rootTop and last actual moving value translate to the new local coordinates. The existing 34px rounded stationary white sheet, scrollTop, elastic=28/48, parallax=-10 and scale=.025, blur=.9, avatar and grab math remain untouched. Active `settling` changes its target to the newly measured endpoint and resumes with remaining time. Active native touch gestures retain their original pointer identity, reanchor their origin to the last physical finger point, update geometry revision and discard old queued RAF callbacks. React `collapsed` and `collapsedRef` update **only after** the physically painted endpoint; requesting a collapse never marks the sheet already collapsed. Hidden 0×0 measurements suspend/skip, rather than invoking a 0-width/height transform.

### Tabs

Tab geometry measurement snapshots the **last painted fractional position** before updating DOM geometry. The tabs driver rebase and continue the remaining interval of 295ms existing `[.22,.77,.23,1]` easing; the old unconditional `paintTabs(selectedIndex)` has been removed. Pointer and native touch gestures are reanchored to the last clientX sample and new tab width; queued touch frames with an older geometry revision cannot write after rebase. Tab ink and native scrollLeft stay paired in the existing `paintTabs` function, and all five tab headings, labels, interest blocks, and swipe thresholds are unchanged.

### Preservation boundaries

- No changes to viewport reducer/controller from REM-01D; uses its `luemi:viewport-revision` event bridge.
- No changes to REM-02A MotionController itself, other than using it in the new sheet/tab adapter.
- No rewrites of `PhotoCarousel`, hero photo swiping, browse pager, visitor route's 260/230ms animated slide, gesture thresholds or drag physics (these have their own later scope).
- No CSS stylesheet edits, visual design, Liquid Glass, durations, easing curves, opacity paths, parallax parameters, asset crop, native scrolling or safe-area policy changes.
- No changes to registration, storage, photo sorter, IDs, user data, Render, Supabase or other projects.

## Verification

Mandatory new **Foundation** test `scripts/rem-02b-geometry.test.mjs` executes actual TS MotionController, geometry motion driver and pure adapter with a deterministic clock: 25/50/90% settle interruption, exact remaining 335ms/295ms budgets, double geometry rebase, hidden→visible, route-independent cancellation, rapid reversal, stale RAF rejection and local/root coordinate remapping, native pointer anchoring, impossible physical clamp reporting and preserved motion constants. Existing REM-02A unit and all accepted source contracts remain mandatory (updated assertions **strengthen** endpoint and fractional preservation semantics instead of depending on obsolete source shapes).

Mandatory new **Browser** `scripts/rem-02b-browser-regression.mjs` runs in a real Chromium with Android user-agent after all REM-00C—REM-02A suites. It measures actual `scrollTop` / computed sheet coordinate, mode and fractional pages: 25/50/90% in-flight height changes, fixed-width height reduction during expansion, intermediate page fraction during tab width change, tab rapid reversal, active pointer drag width change, native CDP touch swipe through resize, hidden→visible, landscape rotation and changed top-safe padding; endpoint tolerance is **≤1 CSS px**, with a failing assertion if greater.

Any skipped, failing or flaky browser assertion is NOT counted as a pass; all runs must finish green on the final exact commit before code acceptance.

## Known limitations and physical gates

Physical Samsung Galaxy A55 Telegram Android WebView **NOT VERIFIED**. Physical iOS/WKWebView **NOT VERIFIED**. Actual framebuffer p95/p99, overlay matrix continuity during IME transitions and page gesture/nested scroll in those browsers are **NOT VERIFIED**. Chromium emulation is not a replacement.

A bounded physical clamp can move an impossible old pixel to the nearest valid new endpoint; this is an explicit visible-geometry limitation, not disguised as a ≤1px continuity success for an impossible position. The 1px acceptance applies to physically reachable positions and final endpoint coordinates.

**REM-01C 32MP cap remains provisional**, 50MP camera fixtures unresolved. **REM-01B IDB v2 photo downgrade compatibility unresolved**: do not delete user images or downgrade to an incompatible reader during rollback.

## Safe rollback / authority

**No merge/deploy.** Close Draft PR for 02B and discard only this branch; the accepted REM-02A exact commit `1172548040f5232e0ba080bbc9a37747f13a5938` restores previous motion without changing local IndexedDB v2 records, photos or user state. No database migration or cleanup must occur. Do not touch main, staging, Render, Supabase, real users or unrelated projects. STOP before REM-02C; it needs separate explicit permission.
