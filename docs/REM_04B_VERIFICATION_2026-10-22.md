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
