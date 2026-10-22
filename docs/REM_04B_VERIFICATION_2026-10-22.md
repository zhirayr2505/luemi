# LUEMI 💜 · REM-04B TECHNICAL VERIFICATION

**Scope:** §11.3 LU-13 and §11.4 LU-14 of `LUEMI_MASTER_REMEDIATION_TZ_2026-10-21.md` ONLY  
**Date:** 22 October 2026  
**Accepted immutable REM-04A:** `561145925efe04199235070e4d0c56be295ef2a4`  
**Isolated branch:** `remediation/rem-04b-hero-blur-underlay-20261022`  
**Review:** [Draft PR #48](https://github.com/zhirayr2505/luemi/pull/48), base = accepted REM-04A branch, NOT main  
**Release gate:** REM-04C/D NOT AUTHORIZED; NO merge/deploy.

## 1. Baseline BEFORE application changes

The FIRST two commits on this isolated branch added only the read-only `scripts/rem-04b-browser-baseline.mjs` and `.github/workflows/rem04b-baseline.yml`. They ran the accepted REM-04A **unchanged application code** with viewport 393×852, Chromium-based Chrome on GitHub Ubuntu, Android SM-A556E UA, light theme, three deterministic local data-SVG photos, followed by a visitor ForYou demo fixture. No production correction preceded baseline measurements.

**Source evidence:**
- [Read-only baseline Actions run 39829542081](https://github.com/zhirayr2505/luemi/actions/runs/39829542081) — SUCCESS; 14 individually logged DOM states, 0 JS errors.
- [Baseline screenshots, measurement JSON and Playwright performance trace](https://github.com/zhirayr2505/luemi/actions/runs/39829542081/artifacts/12447719721) — reproducible artifact with expanded, midpoint, collapsed, visitor covered, deck override, reveal, return and viewport states.

### LU-13 measured root cause — CONFIRMED

Old DOM: `.pm-photo-motion` transformed the clear `.pm-photo-track` (parallax y/scale), while sibling `.pm-photo-blur` had separate static filtered image and no fractional horizontal matrix.

| Real 393×852 sample | Clear photo matrix/rect | Old blur image |
|---|---|---|
| Expanded | parent scale 1, y 0; image width 393px | own scale 1.07; width 420.51px (intended filter bleed) |
| Midpoint at ~125ms | parent scale **1.0216**, y **−8.64px**; visible width **401.49px** | parent remained 1.0, y 0; image width **420.51px** |
| Collapsed | clear parent scale **1.025**, y **−10px**; visible width **402.82px** | unchanged stationary parent; own 1.07 image still 420.51px |

The intentional 1.07 blur bleed and 11px filter were **not defects**; the defect was the different content coordinate system and stationary blur during clear parallax/gallery movement. The old blur immediately switched to the committed `activePhoto` while the clear track could remain at a fractional offset, a code-confirmed source of asynchronous photo identities. Visible physical flicker on Samsung was never proven by these synthetic frames.

### LU-14 measured root cause — CONFIRMED CSS visibility escape; cold raster remains UNPROVEN

At a real covered ForYou visitor profile, `.discovery-browse-panel` remained mounted with `display:flex` and computed `visibility:hidden`. Forcing its existing `.deck-entering` state (without inventing new UI) yielded a descendant `.photo-progress` with **computed `visibility:visible`** under that hidden ancestor. Its opacity was 0 at the sampled instant and part of it was off viewport, so we do **not** assert that a user actually saw the leak. The CSS inheritance bypass itself is confirmed.

Underlay route already owned two real phases: `data-profile-overlay` and `data-route-revealing`. It restored background visibility before route close/back and preserved mounted tabs. No first-reveal decode stall, GPU eviction, unacceptable paint duration or permanent scroll reset was proven by baseline. Do not infer raster readiness from `visibility:hidden` or two requestAnimationFrame callbacks.

## 2. Minimal changes made AFTER measured baseline

**LU-13 · ProfileMaster.tsx + profile-master.css**
- Place the existing blur layer **inside the existing `.pm-photo-motion` parallax parent**. No new motion controller, RAF loop or custom timing.
- Introduce `.pm-photo-blur-track` whose CSS transform is painted by the **same existing `setTransform` writer** as the clear `.pm-photo-track`. Both transitions change phase/duration together. The single existing `GeometryMotion`/gesture pipeline remains unchanged.
- Each keyed blurred slot refers to the same original photo model and media URL as its aligned clear slide. The number of blur image elements is **bounded to at most 3** (current, outgoing when appropriate, and one adjacent). The rest are empty lightweight slots; no unbounded decoded blur copies or blanket preloads.
- Keep exact `filter:blur(11px)`, `transform:scale(1.07)` (intentional bleed), progress opacity ≤0.9, object-fit/object-position, parallax, Liquid Glass and original 290ms gallery easing. The hero clips the same viewport as before.

**LU-14 · discovery.css**
- While Android visitor route is fully covering browse, apply `visibility:hidden!important` to **the browse surface and its descendants**, narrowly scoped to the existing attribute owner. This defeats `.deck-entering .photo-progress{visibility:visible}` leaking through CSS inheritance, without unmounting or hiding the active route.
- When the existing route switches `data-route-revealing`, the scoped rule ceases in the same logical route phase; Feed, ForYou and Nearby persist in DOM and keep scroll/card state. No input handoff, motion easing or route controller was rewritten.
- No unverified raster preloading, extra paint delay, forced GPU layer/will-change flag, snapshot bitmap, loss of blur, or visual placeholder was added. The existing covered→route-revealing→visible / rollback behavior already implements a safe semantic lifecycle; a separate speculative replacement was unwarranted.

## 3. Browser measurements AFTER changes

Evidence:
- [Focused after Chromium run 39831068820](https://github.com/zhirayr2505/luemi/actions/runs/39831068820): SUCCESS.
- [After screenshots and Playwright trace](https://github.com/zhirayr2505/luemi/actions/runs/39831068820/artifacts/12449385327).
- [A/B against exact accepted REM-04A, 3 runs each, same Chrome/fixture](https://github.com/zhirayr2505/luemi/actions/runs/39831722073): 2/2 SUCCESS.
- [Comparison screenshots, Chrome Performance metrics JSON and both traces](https://github.com/zhirayr2505/luemi/actions/runs/39831722073/artifacts/12449252372).

Measured `DOMMatrixReadOnly(getComputedStyle(track).transform)`:
- During hero settle: **clear X = −278.845 px**, **blur X = −278.845 px**; mismatch **0 px**.
- During a theme change while returning: **clear X = −22.6073 px**, **blur X = −22.6073 px**; mismatch **0 px**.
- At endpoints: clear and blur are 0 or −393 px together. Their intentional individual 1.07 image blur bleed remains; no new crop or display distortion of the *clear* hero.
- Blur media source identity matches clear on every populated matching slot, even during settle; max **3 actual blurred images** during transition. At rest on first photo, **2** are ready. Blur intensity 11px and opacity at midpoint ~0.785 / collapsed 0.9 remain unchanged.
- The same `.deck-entering .photo-progress` descendant while route-covered now computes `visibility:hidden`, rather than baseline `visible`. The underlay remains `display:flex`; the exact browse DOM element survives ForYou route return. During reveal it computes `visible` again.

### Performance A/B (controlled desktop Chrome; not real-device FPS)

6 repeat measurements alternated accepted/current to limit warm-cache bias; viewport 393×852, local SVGs, light theme, collapsed profile, original 290ms navigation, no external/demo CDN requests.

| Metric (median of 3 per revision) | Accepted REM-04A | REM-04B |
|---|---:|---:|
| LayoutCount delta | 12 | 13 |
| RecalcStyleCount delta | 20 | 21 |
| LayoutDuration (s) | 0.0017 | 0.0019 |
| RecalcStyleDuration (s) | 0.0015 | 0.0019 |
| ScriptDuration (s) | 0.0181 | 0.0198 |
| TaskDuration (s) | 0.0463 | 0.0483 |
| p95 rAF frame interval (ms) | 16.7–16.8 | 16.7–16.8 |
| Maximum clear/blur track offset difference (px) | not synchronized | 0 |

**Interpretation:** fractional geometry is corrected with no observed worsening of browser *frame cadence* in this small controlled trace. The additional peer blur image and small CPU/layout deltas are genuine overhead; do not misrepresent them as zero. These metrics **cannot** establish paint cache residency, filtered GPU texture cost, compositor frame availability, or Android Telegram behavior. No unbounded resource strategy was justified. Any physical performance regression remains a release blocker for device acceptance, not a reason to remove brand blur without approval.

## 4. Full regression / boundary and tests

- `scripts/rem-04b-browser-visual.mjs`: actual computed matrices, hero expanded/midpoint/collapsed, fractional photo settle, theme mid-settle, media identity/max count, nested PhotoViewer return, cover/reveal from Feed/ForYou/Nearby, deck descendant visibility, same DOM/scroll, and simulated background/landscape. It saves screenshots and Playwright trace.
- `scripts/rem-04b-browser-cost.mjs`: same-run A/B of immutable accepted REM-04A and REM-04B; 3 repetitions per variant, Chrome Performance domain, actual rAF frame intervals and paint/DOM observations. Both versions run separately, same asset/network/viewport policy.
- `.github/workflows/rem04b-focused.yml`: additive focused Chromium visual QA and independently checked accepted-vs-current performance job.
- `.github/workflows/stage03g3-visual.yml`: adds new visual QA **after** every accepted REM-00 through REM-04A browser script; no former assertion removed, skipped or weakened.
- Existing React Hooks, API, source contracts, test/build and all accepted UI behavior must remain green on the **final exact SHA**; fill the final run URLs in [Draft PR #48](https://github.com/zhirayr2505/luemi/pull/48) only after final checks complete.

## 5. Still unverified and safe rollback

**NOT VERIFIED:** physical Samsung Galaxy A55 inside Telegram Android WebView; iOS Telegram WKWebView; compositor/GPU paint-eviction and re-raster after long background; real cold-cache viewport reveal, 60FPS, device memory use and absence of black frames. Chromium-only visual parity is not physical acceptance. No full-screen screenshot was used as a runtime surface.

The exact rollback/acceptance anchor remains **`561145925efe04199235070e4d0c56be295ef2a4`**. Keep Draft PR #48 unmerged (close only on owner's instruction); revert by using the immutable accepted REM-04A tree **without resetting main/staging or force-pushing**. No IndexedDB v2 migration, change to original photos or temporary 32MP cap, Render/Supabase write, user-data mutation, merge, deploy or change to any other project was permitted or performed.

**STOP for REM-04B owner acceptance; REM-04C and REM-04D are NOT AUTHORIZED.**

---

## 6. Independent six-photo investigation and verified REM-04B closure

**Scope:** This addendum is ONLY the finishing LU-13/LU-14 boundary investigation; no REM-04C/D, rework of REM-03C/D, or changes to the inherited brand and gestures. Source investigation began on the previously all-green exact commit `b02841ca6726a2aacb3936eec8ec45ed79229937` in the existing branch and same Draft PR #48. The accepted rollback is still immutable REM-04A `561145925efe04199235070e4d0c56be295ef2a4`. The intermediate complete implementation SHA before this **documentation-only** update is `8ad62abb3c72fbf987c87664380a5c0c0b94f597`. For final-HEAD GitHub run IDs see the PR #48 closure update after this documentation change.

### Six distinct local photos · BEFORE, real Chromium

An additive `scripts/rem-04b-browser-six.mjs` runs a **real** `/rem-01e-qa.html?mode=local&kind=six` (the actual `ProfileMaster` owns six `photo-0…photo-5` sources; `mode=local` uses the `.pm-dialog` class). It collects a JSON record every rAF with computed DOMMatrix x on BOTH tracks, fraction, hero viewport intersection per clear and blur slide, `photoId`, image `complete/naturalWidth` readiness, filtered media existence, effective blur opacity and number of active blur images. Playwright traces and pre/post screenshots are archived via GitHub Actions.

Source-root cause: `choosePhoto(index)` directly selects any dot; the accepted CSS clear and blur tracks both travel 290ms at `cubic-bezier(.2,.76,.22,1)`. The old `blurIndices` chose selected photo, `blurFrom` outgoing photo, and one neighbor. In 0→5, the real blur set was `{0,4,5}`; intermediate visible phases at indices 1, 2 and 3 were empty. **Measured** old rAF outcome (collapsed, blur opacity 0.9): 0→5 **8 affected sampled frames**, 5→0 **8**, 0→3 **3**, 1→4 **3**, rapid 0→5→1 retarget **16**, viewport resize mid-animation **2**. Example at actual fractional index **2.135**: two clear slides 2/3 overlapped the viewport but neither had decoded blur media. X DOMMatrix drift was **zero pixels**, proving synchronized geometry alone was insufficient. A missing DOM element that did not intersect the viewport was NOT counted as a defect.

Original failing six-photo Chromium run and archived original visual evidence: [39848445772](https://github.com/zhirayr2505/luemi/actions/runs/39848445772) (the new strict assertion deliberately failed on the previous implementation).

### Bounded phase-following strategy (production)

Keep exactly the **same hero motion authority** for both CSS transforms, the same duration, same profile parallax and opacity; no new `GeometryMotion`, fake opaque overlay, or full six-image preload. Instead the bounded blur window contains the actually visible left/right fractional slots and one slot ahead in the physical direction, **at most THREE true blur images**. The original six structural div slots remain for identity and layout; only the 0–3 current window images are mounted.

An rAF sampler reads the **actual CSS fraction**, not the semantic destination, prepositions the next optical window at boundary changes, and only commits a media change when indices must change. The photo selection still commits the originally intended photo ID. A monotonically increasing session generation rejects stale rAF callbacks, supports rapid retargets and pointer interruption; the real finger direction replaces the old dot target when pointer gesture takes over. React unmount and photo source reordering/removal cancel stale sampling and invalidate old media indices.

The optical media window is rendered inside a **memoized `ProfileBlurTrack` child**, so media updates do not re-render the parent sheet, tab scrollers or full ProfileMaster; it shares the existing ref to the blur DOM track. On terminal settle, phase sampling finishes and previous `blurFrom` is replaced with the final index; transient images are released. The original `filter:blur(11px)`, `transform:scale(1.07)`, `object-fit:cover`, `object-position:center 20%`, progress opacity maximum 0.9, parallax, 290ms easing, color brand and Liquid Glass are not changed. The approved horizontal swipe thresholds and motion physics are intact.

**Resource caveat:** Image DOM existence, `complete` and positive `naturalWidth` are directly tested; that is not a hardware GPU residency measurement. Broken image resources do **not** impersonate a successfully decoded photo or display the wrong photoId, and release when no longer in the bounded window. A delayed local image ultimately decodes with ID intact. The extra decode/CPU cost is captured, not claimed to be zero.

### Real after-fix optical evidence

[Focused run 39852342853](https://github.com/zhirayr2505/luemi/actions/runs/39852342853) demonstrates (on code SHA `8ad62abb3c72fbf987c87664380a5c0c0b94f597`) **0 optical gaps, 0 px clear/blur DOMMatrix drift, peak 3 blur media** for all of 0→5, 5→0, 0→3, 3→1, 1→4, 4→2, 2→5, direct rapid retargeting, viewport resizing, theme change, midpoint/expanded/collapsed sheet, and actual mouse interruption with reverse motion. Chromium captured separate screenshots near fractional indices ~2.134, ~2.957 and ~3.546, together with full 23-rAF-frame sequences per case.

Terminal assertions confirm removal of outgoing blur peers, the correct photo ID when PhotoViewer opens mid-transition and after return, actual profile counts **1, 2, 3, 4 and 6**, no false extra commits, **broken source** safety and **165ms delayed local media decode** with eventual cleanup. All previously existing `scripts/rem-04b-browser-visual.mjs` LU-13/LU-14 underlay checks still run and PASS, including Feed/ForYou/Nearby, preserving underlay DOM and scroll, hidden descendants, background, reveal and theme. The full Browser QA appends the six-photo test **after** REM-00–04B tests; none are disabled, skipped, shortened or weakened.

### Chromium A/B cost, independent accepted REM-04A → corrected REM-04B

From [A/B and six-photo cost run 39852342853](https://github.com/zhirayr2505/luemi/actions/runs/39852342853): same GitHub Ubuntu Chrome, 393×852, same six SVGs, same light theme, same 0→5→0 sequences, three alternating trials per variant, Chrome Performance domain and rAF timestamps. Below are **medians of totals across both far jumps**, in seconds for duration rows:

| Measurement | Immutable REM-04A | Corrected REM-04B |
|---|---:|---:|
| LayoutCount | 25 | 35 |
| RecalcStyleCount | 41 | 46 |
| LayoutDuration (s) | 0.00444 | 0.00456 |
| RecalcStyleDuration (s) | 0.00435 | 0.00379 |
| ScriptDuration (s) | 0.03549 | 0.07028 |
| TaskDuration (s) | 0.09350 | 0.12501 |
| p95 sampled rAF gap (ms) | 16.7 | 16.7 |
| Peak real blur image nodes | 0 | 3 |
| Sampled visible missing blur slots | 219 | 0 |
| Maximum clear/blur matrix drift (px) | 1965 | 0 |

Before optimization, the naïve parent-state implementation had ~0.148s ScriptDuration per two far jumps, reduced by memoized optical rendering to ~0.053–0.070s in subsequent independent 3× runs (~53–64% less JS than the naïve variant). **The increased CPU/layout counts compared with REM-04A are real**: REM-04A did not render a phase-matched blur layer, so this is not equivalent optical work. There is no demonstrated drop of p95 rAF interval in this synthetic run. We do **not** infer GPU texture load, physical FPS, RAM use or black-frame elimination on a physical Android/iOS device.

The earlier 3-photo accepted-vs-current cost suite remains separate, unchanged and passing, as do the accepted REM-04A read-only baseline and all REM-00–04B behavior tests. Screenshots, snapshots, trace ZIP and JSON metrics are stored in the Actions artifacts from focused runs. No actual photo file or production storage was changed.

### GitHub exact-HEAD acceptance gate and rollback

**IMPORTANT:** this report update is a documentation-only commit; the **new final SHA** and exact push/pull_request run IDs for Foundation (7/7), Behavioral (2/2), Focused REM-04B (2 jobs), and REM-04A read-only baseline (1 job) must be verified on that same final SHA, then recorded in [Draft PR #48](https://github.com/zhirayr2505/luemi/pull/48). Do not reuse older green check-runs as if they covered the report HEAD. No merge/deploy.

**Remaining NOT VERIFIED:** Samsung Galaxy A55 inside real Telegram Android WebView, iOS WKWebView, real GPU/raster pressure and media cache eviction, black-frame elimination, device FPS/memory and prolonged background/foreground. If REM-04B is not accepted, keep the Draft unmerged and return via a **new isolated branch anchored at immutable accepted REM-04A `561145925efe04199235070e4d0c56be295ef2a4`**, with no reset/force push to main/staging and no loss of real user data.

**STOP for owner technical acceptance. REM-04C NOT AUTHORIZED.**

---

## 7. REM-04B LU-13 performance optimization — final measured review (October 23, 2026)

**Trigger and controlled experiment.** Prior six-photo A/B showed ScriptDuration 28.79ms (accepted REM-04A) vs 65.57ms (REM-04B), TaskDuration 75.26ms vs 123.24ms and LayoutCount 25 vs 35, with desktop p95 rAF ~16.7ms. These metrics measured **two far transitions**. The new A/B/C study is a different, **four-transition** workload, so values across studies are not directly comparable.

A new supplemental profiling job in the existing REM-04B focused workflow checks out the accepted immutable REM-04A (A: 561145925efe04199235070e4d0c56be295ef2a4), the exact pre-optimization REM-04B (B: 95be2d18f7a94dc5deb897e02cb5d1b9c106a5d0), and the optimized branch (C). All run in the **same Chrome process**, 393×852 viewport, identical six eagerly warmed local SVG sources, and three alternated trials per variant for 0→5→0 and 0→1→0. Browser Performance domain measures ScriptDuration, TaskDuration, Layout and style counters; Chrome CPU sampling, a React DevTools commit hook, a DOM media MutationObserver and computed track matrices identify the source of work. Full samples and CPU profiles are archived in Actions artifacts.

### Confirmed root cause

The prior REM-04B followBlurPosition loop reads the actual CSS fraction each rAF, calculates blurWindowAt, and changes the <=3-member media window only at real slot boundaries. However **showBlurWindow used flushSync + React child state** for each true media-window update, reconciling the six slot wrappers and image membership. The controlled B trace recorded **12 media-window changes, 18 DOM media mutations and 17 React commits** across four transitions, compared with only 4 React commits in accepted REM-04A. Chrome CPU samples show the added React JSX creation and mutation traversal together with some ProfileMaster rAF ticks. The extra work is attributable to **reconciliation/DOM churn from necessary slot updates**, not proven to result solely from the intrinsic overhead of flushSync. Reads of fractional DOMMatrix and hero width remain necessary to preserve the single authoritative physical track phase; the trace does not justify inventing a second animation clock.

A first intermediate experiment memoized unchanged blurred child slides. It was rejected as ineffective: a same-run median ScriptDuration B 104.23ms vs C 105.31ms, **17 React commits in both**, while exact blur coverage was preserved.

### Safely optimized media-window lifecycle

The final optimized ProfileBlurTrack retains all six **React-keyed structural blur slots**. A single bounded media-window writer attached to that existing child synchronously inserts/removes **only necessary image elements**, with **zero per-boundary React state commits**. This writer never touches CSS transforms, sheet state, animation timing, motion controllers, opacity, parallax or the clear track; the accepted Motion Authority still paints the same CSS transform for clear and blur. Unchanged image DOM nodes and already decoded resources are preserved. Outgoing images are detached **before** new inserts so at most three actual blur images exist even mid-update. Each is linked to stable photoId plus source/version and optional fallback; reorder, failure, delayed decode, unmount and StrictMode lifecycle cleanup are supported by existing tests.

An intermediate writer initially staged a stale outgoing peer during terminal blurFrom reconciliation, causing **14 instead of 12 media changes** and LayoutCount 64 instead of 60. This was corrected without modifying the visual effect by staging the final target-and-neighbors window immediately, before the deferred parent blurFrom update. The final window count again equals B's necessary 12; no visible blur gaps are reintroduced.

### Identical A/B/C Chrome metrics after final code optimization

**Source:** [same-run final optimized A/B/C measurements, run 39869396629](https://github.com/zhirayr2505/luemi/actions/runs/39869396629), code revision 391d502a3768c7dfcf2aa07ee83cdd77b1bc31f9. Following this code revision, only an unused benchmark-local declaration and documentation were changed; the optimized ProfileMaster algorithm is unchanged.

| Measurement · 4 transitions; median of 3 trials | A: accepted REM-04A | B: old REM-04B | C: optimized REM-04B |
|---|---:|---:|---:|
| ScriptDuration (ms) | 37.79 | 82.27 | **74.91** |
| TaskDuration (ms) | 97.47 | 147.96 | **135.49** |
| LayoutCount | 48 | 61 | **60** |
| RecalcStyleCount | 80 | 87 | **86** |
| LayoutDuration (ms) | 5.05 | 5.98 | **5.72** |
| RecalcStyleDuration (ms) | 5.08 | 5.81 | **5.74** |
| React root commits | 4 | 17 | **8** |
| Actual DOM blur-media window changes | 0 | 12 | **12** |
| DOM blur-media mutation records | 0 | 18 | **18** |
| p95 rAF interval (ms) | 16.7 | 16.7 | **16.7** |
| Peak active blur images | 0 (no synchronized track) | 3 | **3** |
| Peak ready/decoded blur images | 0 (no synchronized track) | 3 | **3** |
| Sampled visible missing blur slots, all trials | 443 | 0 | **0** |
| Maximum clear-vs-blur track matrix drift (px) | not comparable | 0 | **0** |

**Same-run B→C improvement:** ScriptDuration −7.36ms (**−8.95%**), TaskDuration −12.47ms (**−8.43%**), React commits −9 (**−52.9%**), LayoutCount −1, RecalcStyleCount −1. The remaining B→C media-window change count remains 12: real 0→5→0 coverage with only three live blur images inherently requires resource turnover. Chrome timing is noisy: absolute medians vary between independent identical setup runs. No arbitrary CPU/FPS threshold is claimed, and unchanged desktop p95 frame interval cannot imply acceptable on-device CPU/GPU load.

**Measured residual overhead vs A:** optimized C still has +37.12ms ScriptDuration, +38.02ms TaskDuration and +12 LayoutCount in this four-transition scenario because accepted A does **not** render the same full optical coverage. It would be misleading to report full equality or hide this tradeoff; eliminating all media transitions would reintroduce missing optical blur slots or exceed the resource budget. The optimization is a modest *measured* improvement with a substantial reduction in React reconciliation, not proof of universal optimum.

### Regression and final exact-head gate

- Preserve original 290ms hero transition, cubic-bezier(.2,.76,.22,1), blur(11px), scale(1.07), opacity 0–0.9, parallax, object-fit/object-position, Liquid Glass and the original Motion Authority.
- Retain original six-photo real-Chromium coverage tests: 0→5/5→0 and all nonadjacent/rapid reversals, viewport/theme/partial collapse, correct viewer photoId, 1/2/3/4/6 photos, broken media, 165ms delayed decode, and <=3 active blur images. No original test removed or weakened.
- On the **final report HEAD**, verify real job logs for **Foundation 7/7**, **full Behavioral 2/2**, **focused REM-04B 3/3** (original visual/six-photo + original accepted A/B cost + new A/B/C profiling), **read-only REM-04A baseline 1/1**, as well as distinct push and pull_request runs when emitted. Record the actual run URLs and final SHA in Draft PR #48 after all jobs report SUCCESS; success of predecessor commits is not a substitute.
- **NOT VERIFIED** on physical Samsung Galaxy A55 in Telegram Android WebView or iOS/WKWebView: GPU/raster memory pressure, filtered blur compositing, actual FPS, background/foreground cache eviction and disappearance of black frames.
- **Rollback:** retain immutable accepted REM-04A 561145925efe04199235070e4d0c56be295ef2a4, leave Draft PR #48 unmerged and do not reset or force-push main/staging. No Render, Supabase, IndexedDB v2, photos, 32MP guard, user data or deployment changes. Stop for owner acceptance; REM-04C not started.
