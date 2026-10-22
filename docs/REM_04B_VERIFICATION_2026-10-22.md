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
