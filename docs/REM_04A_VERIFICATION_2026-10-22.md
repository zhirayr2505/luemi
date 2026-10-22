# LUEMI 💜 · REM-04A — LU-16 and LU-36 verified technical report

**Date:** 22 October 2026  
**Authorization:** master specification §§11.1–11.2 only  
**Immutable accepted REM-03D:** `94d8c10d0049b80861f837dd1c5327bc9d0347c8`  
**Isolated branch:** `remediation/rem-04a-react-startup-20261022`  
**Draft PR:** https://github.com/zhirayr2505/luemi/pull/46

## 1. Confirmed baseline and causes

### LU-16 (projection instability)

Baseline code constructed `fromDemoPerson(selectedPerson)` in the `DiscoveryApp` JSX tree and an inline `onExit` at **every** parent render. `fromDemoPerson` creates a new `ProfileMasterData`, cloned interest/language arrays and newly projected photographs. This defeated normal shallow memoization on the visitor route and cascaded into `ProfileMaster` and `PhotoViewer`, despite no change in selected identity or photos.

The developer-only `QaProfiler` (React's real `Profiler` callback) wraps four boundaries. Identical Chromium 393×852 fixtures simulate an already open visitor PhotoViewer and invoke unrelated parent updates and a real theme change. No module-level or unbounded Map cache was introduced. `PersonTile` already uses standard `memo` and stable `person` objects from static fixtures; `FeedCard` has real inline handlers and pending gesture state, so no speculative comparator was added.

**React Profiler before/after (single reproducible trace; actualDuration is a profiler sample, NOT device FPS):**

| Same action | Metric | Accepted baseline | Optimized |
|---|---|---:|---:|
| Unrelated parent state update | Profiler committed render events (4 boundaries) | **4** | **2** |
| Unrelated parent update | ProfileMaster commits | **1** | **0** |
| Unrelated parent update | PhotoViewer commits | **1** | **0** |
| Unrelated parent update | Sum of React Profiler actualDuration | **57.3 ms** | **11.8 ms** |
| Second unchanged parent update | Profiler events | **4** | **2** |
| Second unchanged parent update | Profiler actualDuration | **61.3 ms** | **10.9 ms** |
| Genuine theme update | Profiler events | **4** | **4** |
| Genuine theme update | Profiler actualDuration | **45.6 ms** | **54.7 ms** |
| Unrelated parent update | New Image preload assignments | **0** | **0** |

The `VisitorProfileRoute` *Profiler boundary* still reports a parent commit in optimized runs; a boundary callback is not proof that memoized descendants rendered. The real `ProfileMaster` and `PhotoViewer` Profiler commit counts are **zero**. Theme changes correctly propagate and are not artificially filtered out. One trace on shared CI is **not** a statistical CPU speedup claim; the concrete reduction in React committed work is the acceptance signal.

Measured source: [baseline developer-only Profiler Chrome run 39816741023](https://github.com/zhirayr2505/luemi/actions/runs/39816741023), [after run 39819322997](https://github.com/zhirayr2505/luemi/actions/runs/39819322997). Exact benchmark fixture: `scripts/rem-04a-browser-measure.mjs`.

**Media readiness:** At baseline, the REM-03A `PhotoReadiness.updateWindow` is already keyed by `resourceIdentity(photoId,src,version)` and retains entries if the new photo-array reference contains the same resource keys. The measured new-media request count was **0 → 0**. Consequently neither the accepted cache nor PhotoViewer is changed merely to satisfy an optimization checklist. Earlier REM-03A regressions continue asserting real photo/source/permission changes and stale callback rejection.

**Actual change:** `selectedProfile=useMemo(()=>selectedPerson?fromDemoPerson(selectedPerson):null,[selectedPerson])`, stable `onExit`, normal `memo(VisitorProfileRoute)` using React's built-in shallow equal. A *new person object* or a *new selected identity* produces a new projection; theme and callback props continue to update when changed. No custom comparator ignores theme, photos, permissions, status or version.

### LU-36 (noncritical startup can hang critical authorization)

Accepted `App.tsx` awaited `Promise.all([Promise.all([prepareBrandImage(signal),document.fonts.ready]),identityReady])`. Aborting the network fetch at the original 15s deadline did not settle a deliberately never-resolving `document.fonts.ready`.

The **initial** mock-based startup measurement inadvertently allowed the external Telegram SDK to overwrite the browser's `Telegram` fixture, producing `outside-telegram`. That initial startup measurement is **excluded from causal comparison** (the React Profiler measurement remains valid). The corrected baseline was rerun against the **unchanged accepted REM-03D source**, checked out read-only into a separate temporary GitHub Actions runner directory, with the SDK isolated, mock Telegram auth returning actual HTTP 200, and `fonts.ready` pending forever. Results:

| Same authorized-font-hang scenario | Accepted REM-03D | REM-04A |
|---|---|---|
| Telegram auth requests | **1 (HTTP 200)** | **1 (HTTP 200)** |
| Correct Telegram identity fixture | Yes | Yes |
| `document.fonts.ready` | Never resolves | Never resolves |
| Authorized entry CTA | **Absent after 15,900 ms virtual clock** | **Visible by 3,160 ms observed wall time** |
| Recoverable error | No (indefinite waiting) | Not needed (auth succeeded) |
| Critical deadline | Existing 15,000 ms abort failed to settle Promise.all | **15,000 ms fail-closed and independent of optional resources** |

Source: [REM-04A focused+read-only accepted baseline 39819322997](https://github.com/zhirayr2505/luemi/actions/runs/39819322997); actual old-app evidence `REM04A_BASELINE_STARTUP_MEASURE`, optimized `REM04A_STARTUP_MEASURE`. The 15,900ms baseline is a **virtual clock**; the optimized 3,160ms is observed wall time under Chrome CI. They establish stalled vs completed state, not a comparable real-time speedup percentage.

**Actual startup change:** new `startup-coordinator.ts` isolates critical Telegram health+auth from optional original LUEMI wordmark+fonts. Auth has the *same* 15,000ms deadline with an explicit fail-closed terminal result, even if a transport ignores AbortSignal. Optional resources get a 650ms budget; their completion/failure/timeout permits the existing original logo and system-font fallback, never replaces the approved brand asset, and never manufactures authentication success. The original 1,950ms intro duration remains untouched and optional completion no longer retriggers it. On retry, an incremented generation and an owned disposable controller prevent older callbacks altering the new login. The error button retries safely without an unnecessary reload.

**Browser startup evidence (Chrome fixture, one CI run):**
- stuck font + valid Telegram auth → authorized CTA at 3,278ms;
- brand resource HTTP 404 + valid auth → authorized CTA at 2,674ms with original logo `src` unchanged;
- HTTP 401 while fonts hang → error at 368ms, **no CTA**;
- offline health → error at 372ms, **no CTA**;
- auth 503 → `needs-bot`, **no CTA**;
- HTTP 401 → retry → valid auth → CTA at 2,729ms with 2 real auth requests;
- unresolved health fetch → virtual 15,000ms critical deadline → recoverable error, never success.

The particular elapsed times are single Chrome CI fixture observations, not predicted network times or guaranteed physical device metrics.

## 2. QA, completeness and preserved contracts

- Added `scripts/rem-04a-startup.test.mjs` to existing Foundation source-contract chain (fonts never resolve, logo failure, HTTP401, network down, abort/deadline, disposed/unmounted late result, retry generations).
- Added developer-only React Profiler fixture and `scripts/rem-04a-browser-measure.mjs`, `scripts/rem-04a-browser-startup.mjs`.
- Added supplemental focused QA with **read-only checkout of exact accepted REM-03D** for a truly comparable startup baseline; the acceptance workflow's previously approved tests remain enabled unchanged.
- New scripts are appended **after all accepted REM-00–03D Chromium suites** in the unchanged full Behavioral QA. The entire previous motion, gesture, registration and photo readiness regression remains mandatory.
- No full-width animation texture, CSS containment, will-change changes, render raster tweaks, media DB migrations, changed video/image assets or motion architecture.

**Final exact-head Foundation/Behavioral/Focused CI:** to be recorded in Draft PR #46 after the final report commit; do not cite older-SHA runs as final-HEAD acceptance.

## 2A. CI discrepancy investigation · accepted REM-03D baseline

During final verification of the existing REM-04A PR, its **same-head** focused startup baseline had contradictory results:

- [PR focused run 39819906734](https://github.com/zhirayr2505/luemi/actions/runs/39819906734), `Accepted REM-03D startup baseline (read-only)`: PASS, `REM04A_BASELINE_STARTUP_MEASURE.error=0`.
- [Push focused run 39819951319](https://github.com/zhirayr2505/luemi/actions/runs/39819951319), same accepted baseline and the *same* REM-04A commit `6ba08726ab402e021870593f98acb8fb6fbaee9a`: FAIL, `error=1` (all other focused jobs successful). Both runs authenticated with an actual 200 response; the old app was in the intro, with `cta=0`.

**Exact root cause:** The old read-only `App.tsx` has `Promise.all([prepareBrandImage(signal), document.fonts.ready])`, whose rejection/settlement depends on whether the native logo `Image.decode()` already succeeded when the original 15,000ms `AbortController` fires. The former baseline test installed a fake clock and immediately advanced it beyond the deadline without first confirming the independent original brand preload had finished decoding. If the logo load/decode was already successful, abort did not reject that promise and the accepted App remained pending on deliberately never-resolving `fonts.ready` (`error=0`). If still in flight, abort rejected `prepareBrandImage`, which makes `Promise.all` reject immediately and the accepted App correctly shows an error (`error=1`). **The observed discrepancy is a real source/test race, not evidence that the new REM-04A coordinator failed.** It also means the old startup may exhibit different failure surfaces depending on media timing: the report must not claim that *all* old startup attempts necessarily hang after 15 seconds.

**Targeted CI fixture correction** in `scripts/rem-04a-browser-startup-baseline.mjs` only:
1. Instrument genuine native `HTMLImageElement.decode()` only for the unchanged LUEMI logo, without modifying its return value or substituting fake pixels.
2. Require a successful native preload decode, a real DOM logo with positive natural width, and confirmed successful Telegram auth HTTP 200 **before** fast-forwarding the virtual 15,000ms watchdog.
3. Assert **both** `cta=0` and `error=0` at 14,900ms (plus proper auth/Telegram identity), then **retain both original strict `cta=0` and `error=0` assertions** at 15,900ms. Do not remove/skip the baseline, relax its assertions, or modify read-only REM-03D.
4. Continue running all existing Foundation, REM-00–03D Behavioral, REM-04A focused optimizations and startup cases on the new exact final head. PR and push focused baseline must independently pass.

This setup isolates the **font-only hang** being measured rather than racing an unrelated brand-download abort. The authenticated bootstrap and real brand decode remain actual browser operations. No production `PhotoViewer`, `App.tsx`, controller, asset, or storage code is changed by the corrective commit.

## 3. Known limitations

- Physical **Samsung Galaxy A55 inside Telegram Android WebView** — **NOT VERIFIED**.
- **iOS Telegram WKWebView** — **NOT VERIFIED**.
- CPU, memory pressure, frame-rate and complete elimination of black frames on real phones remain **unverified**. React Profiler durations are sensitive to CI runner load.
- Single-run React Profiler events are legitimate evidence of avoidable committed subtree work in the tested fixtures; they do **not** imply every theme transition is cheaper.
- Optional 650ms brand/font preparation fallback can reveal the reserved original-logo geometry before the asset finishes downloading on a slow network. No logo replacement or font-family change; verify visually on real devices before release.

## 4. Safe rollback and strict boundary

Retain the immutable accepted REM-03D `94d8c10d0049b80861f837dd1c5327bc9d0347c8`. If rejected, leave Draft PR #46 unmerged and close it only at the owner's instruction; never reset main or staging or force-push. No deploy, Render/Supabase activity, new real-user data mutation, IndexedDB v2 change, original-media deletion, registration change, or 32MP cap modification. All REM-00–03 mechanisms remain intact.

**Stop for owner acceptance after fully green exact-HEAD REM-04A CI. No REM-04B without separate authorization.**
