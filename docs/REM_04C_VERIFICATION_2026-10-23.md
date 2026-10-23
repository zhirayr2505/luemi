# LUEMI 💜 — REM-04C technical verification (LU-15, LU-21/LU-22 regression)

**Date:** 2026-10-23  
**Authorized scope:** Master Remediation TZ §11.5 / §11.8; continuation document `LUEMI_WORK_REM04C_START_2026-10-23.md`.  
**Repository:** `zhirayr2505/luemi`  
**Draft PR:** [#50](https://github.com/zhirayr2505/luemi/pull/50) — OPEN / DRAFT / UNMERGED, pending owner's technical acceptance.  
**Working branch:** `remediation/rem-04c-bounded-media-20261023`  
**Immutable accepted REM-04B base:** `a632833220f37b9ed03965d3308ade26c3dadbe5`.  
**Measured and fully successful pre-report source tip:** `338034970496b3012805025f0022f95295ee26d8`.  
**Subsequent code-only warm-budget instrumentation tip:** `f2c9e150e7a1494e582d9bdb778116b3827274bc`. The report adds its own documentation commit; refer to the actual PR HEAD and check-runs for exact final CI, not the historical measured SHA.  
**No merge, deployment, reset, force-push, main/staging update, PR #47/#48/#49 edit, production/DB/IndexedDB v2/user media mutation.**

## 1. Scope and basis

LU-15 is **confirmed by code** as DOM media retention; an actual GPU leak, out-of-memory, FPS regression, physical raster flicker or unlimited memory growth was **not established**. REM-04C therefore applies one measurable bounded-media policy to a verified duplicate-media case, rather than rewriting the inherited controllers or gratuitously hiding all offscreen screens.

The accepted code was inventoried across `DiscoveryApp`, `FeedCard`, `PhotoCarousel`, `ForYou`, `Nearby`, `ProfileMaster`, `ProfileBlurTrack`, `PhotoViewer`, `PhotoViewerSlide`, `PhotoReadiness`, `photo-preview`, `photo-header`, the app shell/mist and CSS. Source tip `f2c9e` changes runtime only in `apps/web/src/discovery/ForYou.tsx`; the other additions are isolated QA, documentation and GitHub Actions. No motion owner, CSS style, design tokens, gesture threshold, React storage schema or device-specific hack was changed.

### Resource owner / residency policy matrix

| Area | Owner and current resource policy | Teardown / accepted behavior | REM-04C action |
|---|---|---|---|
| Feed/Deck | React keeps the visible and one queued full card; `PhotoCarousel` uses lazy sibling media | Existing transition finalization replaces card once | Preserved. No evidence justifying more churn |
| ForYou standard rails | React keeps logically keyed tiles, preferences, main scroll DOM | Existing cards and saved scroll survive expansion/return | On *covered expanded* view, keep image nodes for person IDs in/near retained viewport; leave every tile wrapper/card/preferences intact |
| ForYou expanded | Selected collection's full visible grid; each tile has its approved first portrait | Unmount expanded overlay only on close | Visible collection remains fully imaged; never offload the live expanded grid |
| Nearby | Already prepares lazily; 8-card pages with IntersectionObserver and scoped `active` | Existing pagination state and scroll remain | Do not rework 16 synthetic fixtures without performance evidence |
| Owner / visitor profile | Clear hero pictures, 5 profile tab pages/grid, mini avatar; blur track owns at most 3 keyed synchronized image nodes | Blur peers removed, identity-invalidated and released on settle/unmount | Preserve accepted LU-13 / LU-14 and motion geometry |
| PhotoViewer | Three-slot display (current plus neighbors); `PhotoReadiness` keeps current and adjacent entries with load/decode tokens | Cancels obsolete generations; clears owned image references and sources on dispose | Preserve original three-slide, ID, morph, pinch/Back and decode ownership |
| App shell / mist | Background CSS animations and mounted browse state | Browser owns paint/cache/tile residency | No unmeasured pause/hack; resource cost and actual GPU raster remain unverified |
| Photo preview / URLs | REM-01C header preflight, abort guards, temporary ImageBitmap, ObjectURL and canvas ownership | Cleanup closes bitmap, revokes temporary URL, zeroes canvas; original File retained | Do not change 32 MP/2048 px limits; repeat existing and warm-session checks |
| Document listeners / RAF / timers | Existing MotionController/GestureArbiter and handlers; instrumentation tracks global window/document listeners and own pending RAF/timeouts | Existing disposal path remains authoritative | Test many cycles and explicit React teardown/remount without new event owner |

**Exact ForYou policy:** before showing expanded content, `openCollection` samples the current library scroller's bounding rect and retains portrait nodes for person IDs intersecting the scroller's vertical window expanded by half a viewport above/below. If it cannot measure a viable rect it **fails open**, preserving media. A React state set stores the permitted IDs; all tiles and layout keep their keys. While expanded, the covered library's other `<img>` portrait nodes are released. On close, media render is restored in the same mounted scroll skeleton; original scrollTop is preserved. This targets the duplicated media while avoiding a scroll-to-zero or blank visible collection. Identical people may appear across multiple rails, hence the DOM image count and retained person-ID count are different measures. Original `loading="lazy"` and `decoding="async"` remain.

## 2. Browser measurement method and objective results

**Real Chromium desktop**, headless Chrome channel, Android SM-A556E user-agent + touch emulation, **393×852** CSS viewport; deterministic bundled local SVG fixture; unrelated requests aborted. Exact accepted code served at port 5174; current optimized code served at 5173 on the **same runner**. `Performance.enable` + `Performance.getMetrics` + `HeapProfiler.collectGarbage` after identical idle delays; Playwright snapshots, screenshots, traces and DOM instrumentation. Test opens 50 different/repeating profiles from the same 16-person expanded grid, closes with the registered Back callback, then checks three browse tabs, saved main scroll, six-photo viewer, theme/viewport change, profile collapse/expand and teardown/remount.

The following primary measurements are from successful [push run 39915682904](https://github.com/zhirayr2505/luemi/actions/runs/39915682904), job [120288628776](https://github.com/zhirayr2505/luemi/actions/runs/39915682904/job/120288628776); matching [PR run 39915689391](https://github.com/zhirayr2505/luemi/actions/runs/39915689391). They compare accepted `a6328332...` to verified `33803497...`, **not** to an imaginary physical-device reading.

| Real Chrome checkpoint | Accepted REM-04B | REM-04C | Interpretation |
|---|---:|---:|---|
| Normal ForYou main library portrait IMG nodes | 32 | 32 | No cost/visual change in default view |
| Covered library IMG nodes with expanded open | 32 | 20 | **12 fewer duplicated photo elements** |
| Visible expanded IMG / logical tiles | 16 / 16 | 16 / 16 | All collection portraits preserved |
| Total document IMG nodes at expanded checkpoint | 120 | 108 | −12 |
| IMG DOM elements with `complete` and positive `naturalWidth` at 50 cycles | 102 | 94 | −8; **not** a GPU-memory measurement |
| Live DOM nodes at 50 cycles | 1202 | 1190 | Stable from cycle 1 to 50 for each variant |
| Chrome Performance `Nodes` at cycle 30 / 50 | 5885 / 5885 | 5859 / 5859 | Observed plateau, not proof of global GC |
| Global window/document listener count at 50 cycles | 19 | 19 | No accumulation in instrumented owner scope |
| Pending instrumented RAF, timers, ObjectURLs, decode calls at 50 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | Snapshot is not a peak/physical memory reading |
| Main library scroll opened → covered → returned | 360 → 360 → 360 px | 360 → 360 → 360 px | Zero scroll drift |
| JS heap before opening collection | 10,808,944 B | 10,820,788 B | Same procedure, ordinary variance |
| JS heap at 50 cycles after GC | 13,049,200 B | 13,250,896 B | **Current is ~202 KB higher, NOT a demonstrated heap saving** |

Checkpoints at cycles 1 / 10 / 30 / 50 were recorded. Browser `Performance.Nodes` reached a plateau between 30 and 50; JS heap did **not** establish a cross-platform memory gain and still rose modestly across the sampled session, for both variants. This is compatible with runtime/cache/lazy initialization but does **not** prove their precise causes. Browser-native cached images, GPU surfaces, compositor tiles and thermal effects are outside the measurement contract. **No claim of zero memory leak in all conditions is made.**

**Explicit React teardown in optimized fixture:** 0 app IMG nodes, 0 #root children; tracked own RAF/timer/ObjectURL/decode counts all 0. Tracked global listener count 18 at teardown and 19 after clean remount (19 at initial pre-teardown checkpoint). Browser CDP `Nodes` remained 5904 after teardown and reached 9262 after remount: **these counters are not app DOM live-node counts**, and must not be misrepresented as memory being freed or a proven leak. Listener tracking deliberately observes **window/document registrations** rather than retaining detached DOM nodes; it does not count all native browser owners.

The additional warm-session revision `f2c9e` tracks unfinished network requests and tests actual REM-01C `preparePhotoPreview` after the 50 cycles + PhotoViewer: PNG 2300×1700 → max side 2048, reject 9000×9000 header before full decode, and abort before work. This exercises accepted input logic with a hot browsing context; the isolated baseline browser suites remain unchanged. The exact-head CI outcome of this later addition must be verified separately, as recorded in the PR's live checks.

## 3. QA and regression gates

**Successful, source-measured tip `338034970496b3012805025f0022f95295ee26d8`:**

| Workflow | Push run | pull_request run | Verified successful jobs per run |
|---|---|---|---:|
| Foundation / immutable lockfile, lint, type, API, build, smoke, source contracts | [39915682895](https://github.com/zhirayr2505/luemi/actions/runs/39915682895) | [39915689502](https://github.com/zhirayr2505/luemi/actions/runs/39915689502) | 7/7 |
| Full Behavioral (REM-00C workflow, including previous browser regressions) | [39915682949](https://github.com/zhirayr2505/luemi/actions/runs/39915682949) | [39915689408](https://github.com/zhirayr2505/luemi/actions/runs/39915689408) | 2/2 |
| REM-04C focused (A/B 50 cycles; LU-21/22; accepted viewer/blur regressions) | [39915682904](https://github.com/zhirayr2505/luemi/actions/runs/39915682904) | [39915689391](https://github.com/zhirayr2505/luemi/actions/runs/39915689391) | 3/3 |

All **24/24 check-runs** at this measured tip were `completed/success`, including actual job steps, not inferred from a workflow badge.

Focused preserved tests explicitly executed `rem-03a-browser-media`, `rem-03c-browser-pinch`, `rem-02d-browser-lifecycle`, `rem-03d-browser-morph` and `rem-04b-browser-six`. The six-photo browser trace reports **0 visible mismatched/missing blur slots, max clear/blur matrix drift 0 CSS px, peak 3 blur IMG nodes**, with direct/nonadjacent, reverse interruption, resize, dark mode, broken and delayed media. DOM/browser evidence here is not proof of compositor tile residency.

LU-21 and LU-22 isolated recheck includes preflight/header limits, abort/cleanup, touchscreen sorter, keyboard, Telegram fullscreen/VisualViewport model and safe-area handling; no accepted limits or policies changed.

Actual evidence artifacts:

- [REM-04C 50-cycle comparison, two Chromium traces, screenshots and JSON metrics (push)](https://github.com/zhirayr2505/luemi/actions/runs/39915682904/artifacts/12484314752)
- [Same 50-cycle evidence (PR)](https://github.com/zhirayr2505/luemi/actions/runs/39915689391/artifacts/12485016633)
- [Motion/PhotoViewer/6-image preservation regression artifacts (push)](https://github.com/zhirayr2505/luemi/actions/runs/39915682904/artifacts/12485185696)
- [Behavioral QA complete screenshot and trace artifact (PR)](https://github.com/zhirayr2505/luemi/actions/runs/39915689408/artifacts/12484454553)

Earlier in development **failed experimental runs were not hidden**: incorrect Playwright auto-scroll (affected baseline scroll measurement), `Array.map` index treated as a boolean, counting nested country-flag `img` as portrait nodes, missing pinned Playwright Chromium in a new CI job and a listener counter that retained detached element references were diagnosed and fixed **in the dedicated REM-04C work branch**. Historical failures remain available in Actions. All previously accepted suites are retained.

Non-blocking runner warnings include Node 20 deprecation in third-party Actions, `url.parse` deprecation, an existing React hook dependency warning, and Vite bundle-size advisory. No check was silently skipped or converted to soft-fail.

## 4. Changes made / changes deliberately not made

Modified runtime: **ForYou.tsx only**, to keep a bounded hidden library-media window while expanded content covers it.

QA support: `apps/web/src/profile-qa.tsx` exposes a developer-only React unmount/remount hook; `scripts/rem-04c-long-session.mjs` runs comparable 50-cycle traces and cleanup checks; `.github/workflows/rem04c-focused.yml` adds focused accepted-baseline and regression jobs. This report is documentation only.

Preserved: Feed deck lift, main tab/pager gesture thresholds, route slide and Back, owner/visitor sheet gestures, 290 ms hero transition, blur(11px), 3-peer blur-window, PhotoViewer 3-slide identity, pinch/pan/source morph, safe-area and keyboard logic, Liquid Glass, themes, original logo, registration and 32 MP input budget. No competing motion controller or new cache was introduced.

Other potential optimizations — hidden owner full hero/grid raster, ambient mist pause, across-tab decoded GPU residency, aggressive Nearby eviction, shared ObjectURL reference counting — were **not** introduced without measured benefit and a safe visible/reveal policy. Browser `loading=lazy` does not guarantee decoded texture eviction. Future physical profiling may justify a separate owner-authorized narrow change, but it cannot be smuggled into this acceptance.

## 5. Outstanding conditions / limitations

**NOT VERIFIED (must not be represented as PASS):**

- Physical Samsung Galaxy A55 in Telegram Android WebView with actual app, OS back, thermal state, paint/composite and network cold-reveal.
- iOS Safari / Telegram WKWebView, keyboard/safe-area under actual OS.
- Device/GPU/decoded texture/RAM peak or deltas; no measured MB threshold or physical steady 60 FPS claim.
- Long-background compositor tile eviction and guaranteed absence of black frames on a real phone.
- Large production photos, real user uploads, server load and production traffic; local deterministic fixtures are not equivalent.

**Final decision status:** code and measured Chrome regressions documented; **OWNER TECHNICAL ACCEPTANCE PENDING** until latest PR HEAD's exact push/pull_request checks have been inspected. Device acceptance and release remain separate decisions. No REM-04D authorization is implied.

## 6. Safe rollback / stage boundary

Keep PR [#50](https://github.com/zhirayr2505/luemi/pull/50) **Draft/unmerged**. The immutable accepted base remains `a632833220f37b9ed03965d3308ade26c3dadbe5`. No reset, rebase, force-push, merge or deployment is necessary to roll back: simply refrain from merging this isolated branch. All PR #47/#48/#49 and main/staging are outside scope. **Stop at REM-04C and request independent technical acceptance; do not begin REM-04D.**
