# LUEMI 💜 — REM-02A / §9.1 Common Motion Ownership & Lifecycle

**Date:** 2026-10-22  
**Accepted base:** `b8d70fadbb09628d726b06afc416c328d32e6b74` (REM-01E)  
**Review branch:** `remediation/rem-02a-motion-ownership-20261022`  
**Change authority:** REM-02A ONLY, §9.1 of `LUEMI_MASTER_REMEDIATION_TZ_2026-10-21.md`  
**Status:** source/CI acceptance only; physical A55/iOS and production motion under actual native event interleavings NOT VERIFIED.

## Scope and safety contract

This is a **foundation stage**, not a wholesale reimplementation of gesture and animation mechanics. No existing easeAt/animateValue formula, numerical easing, transition duration, swipe thresholds, elastic/parallax formula, blur interpolation, sheet endpoints, scroll anchoring, profile geometry, CSS styling, Liquid Glass effect, initial photo crop, animation entrance/exit, Android route physics or existing data flow has been changed.

Earlier accepted REM-00A/B/C and REM-01A/B/C/D/E are inherited unchanged in source and behavior; no changes to registration steps, IndexedDB v2, photos, sorter, viewport reducer/controller, API or auth.

### Pure motion lifecycle: `apps/web/src/ui/motion-controller.ts`

The contract defines **idle → candidate → dragging → settling / closing**, with explicit **suspended** for interruptions and geometry revisions. Each snapshot includes:

`{owner,phase,current,target,lastSettled,velocity,geometryRevision,generation,committedGeneration,cancelReason,disposed}`.

All transitions are deterministic, side-effect-free functions `reduceMotion(snapshot,command)`; invalid and stale operations return the original snapshot. Supported actions/methods:

- `begin(value,revision?)` starts a new generation, invalidates the old animator;
- `claim(token)` establishes the gesture owner only from candidate;
- `paint(token,value,writer,velocity?)` updates current/velocity and paints only in dragging;
- `schedulePaint(token,...)` keeps **one** pending RAF, coalesces values, and guards delayed callbacks with generation + geometry;
- `settle(token,target)` and `close(token,target)` set mutually exclusive completion phases while cancelling prior pending work;
- `interrupt(token,reason)` and `suspend(token,reason)` suspend with a **new generation** and cancel all registered resources;
- `resume(newToken,phase,target?)` continues with another generation, old callbacks still rejected;
- `rebase(newRevision,newCurrent?,newTarget?)` rejects old/same revisions, retains current visible sample, invalidates stale callbacks and **suspends** active motion until a caller supplies correct new coordinates and explicit resume. No automatic endpoint snapping;
- `cancel(token,reason)` and `dispose()` invalidate current token, reject repeated calls and cancel pending RAF + registered external resources;
- `finish(token,{paint,onCommit})` writes terminal pixels **before** semantic callback, only once, and only for matching settling/closing tokens.

The controller accepts an injectable scheduler for deterministic tests and does not require React or global state. Callbacks from previous generations, geometry or after unmount cannot commit. The controller tracks cancellation callbacks for CSS transition fallback timers or `animateValue` when these writers are migrated.

### Single-writer matrix and minimal live adapters

The authoritative owner matrix is enforced by `MotionPropertyAuthority` in `apps/web/src/discovery/profile-motion.ts`:

| Property | Owner | Existing live paint seam wrapped |
|---|---|---|
| `sheet-scroll`, `elastic-sheet` | sheet | `ProfileMaster.paintSheet` |
| `parallax`, `blur`, `avatar`, `grab` | sheet | **Same** `paintSheet` frame |
| `tab-scroll`, `tab-ink` | tabs | `ProfileMaster.paintTabs` |
| `hero-track` | hero | `ProfileMaster.setTransform` |
| `browse-track`, `browse-underline` | browse | `DiscoveryApp.paintDrag`/`settleDrag` |
| `route-transform`, `route-reveal` | route | `VisitorProfileRoute.setX`/`revealUnderlay` |

A write with the wrong owner fails closed before any pixels are written. All existing live writers still execute the **same mathematical expressions in the same call sites** and with existing CSS transition ownership, and new ownership checks do not enqueue additional animation frames. Owner registry lifetime is one mounted React component; no global React store and no new styling rule. This is deliberately incremental: active legacy CSS transitions and animateValue invocations are **not yet driven by the new MotionController**. Full token adoption, frozen matrix continuation and revised animation destinations are scoped to explicitly authorized REM-02B and later, not claimed as accomplished here.

### Viewport bridge

The optional `bindMotionViewport` adapter listens to the existing **REM-01D** `luemi:viewport-revision` contract, delivers only strictly increasing revision values, and unsubscribes during cleanup. This stage does not attach it to the existing live gesture physics: doing so without simultaneous hand-anchor/remaining-duration migration could *create* jumps. The pure controller `rebase` deliberately suspends the active phase; REM-02B must integrate it with measured geometry, animation continuation, and route/tab/sheet cursor ownership.

## Tests and proof

**Mandatory foundation:** `scripts/rem-02a-motion-contract.test.mjs`, chained into existing `test:source-contracts`, runs actual transpiled TypeScript classes and reducer with deterministic scheduler, testing:
- begin→claim→paint, one RAF despite many updates, last velocity and current sample;
- settle→endpoint pixels→exactly one semantic commit, second completion rejected;
- settle→interrupt→resume; late completion from earlier generation rejected;
- revision rebase while in motion, cancelled RAF/registered timer, older geometry rejected, new target finish;
- repeated cancel, double close/finish, invalid operations and after-dispose callbacks;
- property-to-owner uniqueness and DOM adapter test, unauthorized property write fails;
- REM-01D viewport revision event monotonicity and unsubscribe;
- explicit regression assertions for existing sheet 335 ms / 240 ms, tabs 295 ms, hero transition 290 ms, route 260/230 ms and easing tokens, browse 380 ms fallback, sheet border-radius and original animateValue.

**Mandatory behavioral browser:** `scripts/rem-02a-browser-adapter.mjs`, appended **after all** accepted REM-00C/REM-01A/B/C/D/E browser suites. Runs the actual TS modules inside Chromium Android UA alongside the current profile QA fixture; checks native computed CSS transforms, guard rejection, one paint frame, endpoint write before exactly-once commit, geometry invalidation and stale RAF cleanup, revision listener cleanup, unmount and existing ProfileMaster mount. It is not a simulated video of real A55 hardware.

**Prior React hooks baseline:** a single pre-existing warning `VisitorProfileRoute.tsx` moved from line **112 → 118** because of wrapper/import insertions. Same file, rule, column and message remain in the strict baseline; baseline still contains exactly four pre-existing warnings, and no lint rule was disabled or warning suppressed. No source or test exclusions were added.

The existing behavioral CI continues to execute each earlier accepted suite with its original assertions; no test was disabled or lowered.

## Gate limitations

**REM-02A explicitly does not claim:** all legacy animations have been migrated to tokenized controller state; geometry-rebased in-flight animations now reach their destination; interrupted cross-layer gestures have been fully solved. These require real gesture orchestration/physics and device testing in REM-02B/C and must not be silently performed during this scope. The practical guarantee in 02A is the **new contract**, tested DOM authority at legacy paint seams, and a checked migration path without visual changes.

| Physical gate | Status |
|---|---|
| Galaxy A55 Android Telegram WebView: spring, route, tab swipe, hero, sheet, rapid interruption | **NOT VERIFIED** |
| iOS Telegram WKWebView/Safari: touch/pointer ordering, native inertial scroll, interruption | **NOT VERIFIED** |
| Frame-time p95/p99, real visual before/after screenshot comparison on devices | **NOT VERIFIED** |
| 50 MP originals + peak decoded memory; REM-01C 32 MP cap is provisional | **OPEN / NOT VERIFIED** |
| Downgrade-reader compatibility for REM-01B IndexedDB v2-only photo records | **OPEN / NOT VERIFIED** |

## Rollback

No merge or deployment occurred, and no production data migrations/writes were performed. For immediate rollback, close the REM-02A **Draft PR**, discard only `remediation/rem-02a-motion-ownership-20261022`, and continue from accepted REM-01E exact commit `b8d70fadbb09628d726b06afc416c328d32e6b74`. This restores precisely the old motion-writer implementation and preserves accepted photo/registration/viewport behavior. There is no database rollback and **no IndexedDB clearing**.

If a future deployed rollback is contemplated, preserve v2 original photo objects; the old pre-REM-01B reader cannot necessarily show v2-only photos, so provide a reader-compatible fallback first. Do not change the provisional 32 MP cap without measured physical-device review.

## Authorization

Changes to `main`, `staging`, Render, Supabase, live users and other projects: **NONE**. **No merge, no deploy, no REM-02B without separate authorization.** REM-02A stops after verified CI and owner review.
