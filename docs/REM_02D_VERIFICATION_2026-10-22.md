# LUEMI 💜 — REM-02D Technical Verification (LU-08 / LU-12)

**Date:** 22 October 2026  
**Authorized scope:** `LUEMI_MASTER_REMEDIATION_TZ_2026-10-21.md` §§9.5–9.6 only  
**Accepted immutable parent:** `2b6d3a936b2e2eae31ede70f993d5d49d69b1c2f` (REM-02C)  
**Branch:** `remediation/rem-02d-route-lifecycle-20261022`  
**Review:** [Draft PR #41](https://github.com/zhirayr2505/luemi/pull/41) (no merge, no deploy)

## What failed before REM-02D

### LU-08 · cancelled visitor navigation

The previously accepted route implementation called `cancelProfileGesture()` at route claim. That invalidated ongoing sheet/tabs RAF paths without recording (1) their real fractional current pixels, (2) their last semantic destination, or (3) the remaining duration of an interrupted settle. A subthreshold back gesture returned the route to x=0 but had no child resume callback; React's eventual collapsed/tab state could disagree with the frozen DOM. Closing during the initial route entrance also required protection from already scheduled opening callbacks.

### LU-12 · loss of input and app lifecycle

Native `pointercancel`, `touchcancel`, capture loss, Telegram `deactivated/activated`, browser `visibilitychange`, `pagehide/pageshow`, and React StrictMode lifecycle paths were not one coherent terminal protocol. A route candidate could remain active after vertical-native rejection; capture could remain after backgrounding; a CSS timer/RAF might finish after a hidden interval without a geometry rebase.

## Implementation and exact invariants

### Child handoff: `ProfileMaster.tsx`

- Introduced a scoped `ProfileRouteMotionHandle` with operations `suspendForRoute`, `rollbackRoute`, `commitRouteClose`, `suspendForBackground`, `resumeFromBackground`. No parallel animation system.
- Before child cancellation, sample `GeometryMotion.sample()` for the sheet and tabs, record their **physical fractional positions**, their semantic destinations (`sheetIntent` or last committed sheet state, selected tab), and whether they were settling.
- Freeze the original REM-02B `GeometryMotion` drivers via `suspend()` and synchronously paint sampled values. Dispose stale drag RAF and explicitly release captured pointers.
- After route return, remeasure sheet/tab geometry **before** reopening suspended motion; use `reveal(revision,current,target)` for the previously started settle with its remaining easing interval. A gesture without prior destination settles to the stored semantic endpoint rather than a stale index.
- During route ownership, resize/revision measurements cannot independently resume a suspended child. This prevents competing RAF writers.
- Successful close commits a terminal child state: dispose runners, cancel touch and pointer owners, ignore stale callbacks. No late `setCollapsed` / `setTab` after unmount.
- `GeometryMotion.isDisposed()` permits reconstruction after React StrictMode's provisional cleanup without retaining a disposed RAF controller.

### Route animation: `VisitorProfileRoute.tsx`

- Preserves the exact approved `260ms` open, `230ms` exit, original min duration and `cubic-bezier(.2,.82,.24,1)` curve.
- On route claim, read the current **computed CSS matrix** before disabling transition, then hand off to the child snapshot API.
- Reuses REM-02A `MotionController("route")` generations: stale timer/transitionend cannot finish the current token, and terminal pixel write precedes exactly one `onExit`.
- A rejected/aborted right swipe returns route to physical `x=0`, then restores child `GeometryMotion`. Closing route permanently stops old child updates.
- Back during opening captures the actual visible CSS matrix and moves right from there, not from a guessed semantic endpoint.
- Route still excludes nested viewer/modal and defers to photo/page/strip gestures. A vertical native gesture releases its route candidate. A second pointer cancels the single-finger route and initiates rollback.
- Touch suppression remains attached **only after** actual exclusive route claim; it is removed at terminal, suspension and unmount.

### Browser/Telegram lifecycle: `ui/motion-lifecycle.ts`

- A reusable, idempotent event binder responds to document `visibilitychange`, browser `pagehide/pageshow`, and optional Telegram WebApp `deactivated/activated`.
- Duplicate platform events issue exactly one suspend/resume. No resume while the document is still hidden; every listener unsubscribes on cleanup.
- Suspend cancels ownership generations, route timer, entrance RAF, temporary touch suppression and pointer capture. It preserves semantic motion intent and freezes physical matrix.
- Resume reads current viewport geometry, then chooses the applicable original route close/open/rollback path. Child geometry is reconciled prior to the child animation continuation. Stale callbacks cannot revive a closed component.
- Existing `GestureArbiter` from REM-02C and geometry/RAF from REM-02B are reused rather than replaced.

## Executable acceptance tests

**Unit/adapter:** `scripts/rem-02d-lifecycle.test.mjs` verifies browser/Telegram event de-duplication, symmetric listener cleanup, route-child handoff, preserved original motion tokens and absent global `touch-action:none`. It is appended to `test:source-contracts` without skipping existing tests.

**Behavioral Chromium:** `scripts/rem-02d-browser-lifecycle.mjs` runs in the same mandatory behavioral workflow as REM-00C–REM-02C. It verifies real DOM transitions for:

1. Sheet settling → route claim → subthreshold rollback → exact child endpoint.
2. Tabs settling → route claim → rollback → selected tab + physical scroll within **1 CSS px**.
3. Vertical native candidate followed by a new right-swipe; pointercancel and lostpointercapture.
4. Background during route drag; viewport height change during suspension; resume/rollback.
5. Background during sheet settle and tabs settle, preserving semantic destinations.
6. Successful route close, cleanup, immediate reopening without an old callback.
7. Actual `DiscoveryApp` registered Back handler (the callback used by Telegram BackButton), including back during entrance; exit moves right.
8. Closing background → foreground at revised viewport; no timer double-commit.
9. Entrance background → foreground, ending at the visible x=0 endpoint.
10. React theme rerender / StrictMode QA fixture / unmount while transitions or timers are possible.

`apps/web/src/profile-qa.tsx` exposes the **registered** callback only in the developer QA entry point; production App and Telegram wiring are not modified. Mouse/pointer + CDP touch in Chromium is not physical device verification. QA deliberately detects stale exit after >700ms, not just the first frame.

Existing approved Foundation, browser, source/React hooks, build, smoke and API gates remain mandatory and are not disabled. The hook diagnostic allowance for `VisitorProfileRoute.tsx` was **removed** after fixing the old missing dependency, tightening the baseline (4 historical allowances → 3). No warnings were newly permitted.

**Final exact-head GitHub Actions evidence:** see current, immutable SHA and links in [PR #41](https://github.com/zhirayr2505/luemi/pull/41). The PR must not be marked accepted unless *both* Foundation (7/7) and Behavioral (2/2), including every REM-02D case, have concluded SUCCESS **on the exact final SHA**.

## Root cause verified during REM-02D regression and resolved

The first complete Chromium scenario exposed a trusted browser `pointercancel` during a fast **mouse** drag on an identity text `SPAN` (`isTrusted: true`, before pointerup), with only the first 25–26 pixels reaching the route. This is not a stale MotionController callback. React's route abort correctly cancelled the session, and therefore simply suppressing `pointercancel` would have violated LU-12.

The repair is strictly scoped to the existing identity section in `profile-master.css`:

- `.pm-identity { touch-action: pan-y; user-select: none; -webkit-user-select: none; }` prevents the browser's horizontal text-selection/drag takeover **only** for the route-eligible identity content. Its vertical native pan remains supported.
- Tab-strip native `touch-action: pan-x` and page native `touch-action: pan-y` are unchanged; no global `touch-action:none` is introduced.
- The route listens to `lostpointercapture` only when `event.target === event.currentTarget`; child capture losses still use their own arbiter owners.
- The route's terminal `pointercancel` is **not** disabled and continues to rollback with a single commit when a genuine cancellation occurs.

Exact-head earlier checkpoint `c40bb405ef3d593bb31f35c40225055a790a5531` passed the full [Foundation 7/7](https://github.com/zhirayr2505/luemi/actions/runs/39765423654), [Behavioral 2/2](https://github.com/zhirayr2505/luemi/actions/runs/39765423456), and [Focused REM-02D 1/1](https://github.com/zhirayr2505/luemi/actions/runs/39765423811) workflows. The Chromium trace reached a real `pointerup` at 180 CSS px, with a single authorized close and immediate reopen. **These are evidence for that exact checkpoint only.** Subsequent cleanup removes temporary DOM/console diagnostic writes, with unchanged assertions and no changes to physics; final release of this branch requires a fresh green run on its exact final head (record links in Draft PR #41).

## Open gates (NOT VERIFIED)

- Physical Galaxy A55 **inside Telegram Android WebView**: TOUCH/Pointer interleaving, gesture contention, dropped capture, FPS/p95/p99, app background and Telegram Back Button.
- iOS Telegram WKWebView: genuine deactivation, native momentum, safe-area/keyboard, pointercancel and pointer capture semantics.
- Real Telegram lifecycle and BackButton are **not** simulated hardware confirmation; QA fixture invokes the actual registered app Back callback.
- Existing 32 MP temporary image limit / large-image memory gate remains open and **unchanged**.
- IndexedDB v2 format and real stored photo data are **unchanged**; downgrade to pre-v2 reader requires a separate compatibility plan.
- REM-03 (including new viewer lifecycle) is **not authorized** and is not started.

## Rollback and release control

- Safe immutable rollback point: accepted REM-02C `2b6d3a936b2e2eae31ede70f993d5d49d69b1c2f`.
- If owner rejects REM-02D, close Draft PR #41 and stop using only `remediation/rem-02d-route-lifecycle-20261022`; leave accepted REM-02C and every previous stage intact. **Do not reset/force-push** main or staging.
- No migrations, database edits, backend permissions, production users, Render deployments or Supabase writes are performed. No need to clear IndexedDB. Never deploy an incompatible pre-v2 reader over v2 records.
- No merge or deploy authorized. Physical A55/iOS stay NOT VERIFIED until independent physical acceptance. Stop at owner checkpoint; do **not** begin REM-03.
