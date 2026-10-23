# LUEMI 💜 — REM-04D technical verification (LU-33 / LU-34)

**Date:** 2026-10-23  
**Authorized scope:** Master Remediation TZ §11.6–11.7, §11.8 and `LUEMI_WORK_REM04D_START_2026-10-23.md`.  
**Repo:** `zhirayr2505/luemi`.  
**Owner-accepted immutable REM-04C base:** `5ea0a1f851e2518f6f23b17e7287ae536bb06395`.  
**Isolated development branch:** `remediation/rem-04d-scroll-modal-focus-20261023`.  
**PR:** [#51](https://github.com/zhirayr2505/luemi/pull/51) — OPEN / DRAFT / UNMERGED pending independent owner technical acceptance.  
**Measured source-only QA tip:** `b2322f9ec9f6b3936b5755f5338b24ce60702e19`.  
**Final report commit/head:** this report is a further documentation-only commit; use the final PR HEAD and exact-head CI to validate the report addition. Do not conflate source-tip and final-tip statuses.

## 1. Explicit evidence and previous defects

The master audit identified two real code-level deficiencies, NOT unverified physical-device bugs:

- **LU-33 (P3):** ForYou library and expanded collection originally reported scroll events into a single `savedScroll["for-you"]` slot; header state was not restored on collection context change, and the `common` collection was rendered first regardless of editable persisted order.
- **LU-34 (P2):** `role="dialog"/aria-modal` by themselves did not trap or restore keyboard focus; offscreen mounted tabs remained focusable, portal nesting was not isolated, and hero photo div lacked keyboard semantics. Full WCAG/screen-reader compliance was NOT established.

The [before/after Chromium witness on the same 393×852 fixture](https://github.com/zhirayr2505/luemi/actions/runs/39923793514) confirmed:

| Measured condition | Accepted REM-04C | REM-04D source `b2322f9` |
|---|---|---|
| Main library scroll (px) | 360 | 360 |
| Header progress when expanded collection opens with offset=0 | 1 (incorrectly inherited) | **0** |
| Header after closing expanded collection to library scroll=360 | 1 | **1**, correct |
| `Много общего` position in section headings *after moving down* | 1 (unchanged) | **3** (obeys configuration) |
| Filter modal leaves underlying browse `inert` | false | **true** |
| Inert non-selected mounted profile pages | 0/4 | **4/4** |
| Browser JS errors in witness | 0 | **0** |

No ungrounded visual/FPS or physical keyboard claims are inferred from these DOM values.

## 2. LU-33 implementation and checks

- ForYou keeps the mounted original library and the expanded panel logically intact; library offset lives in its own ref and expanded offsets use a finite collection-id `Partial<Record<CollectionId|"best",number>>` map.
- `reportForYouScroll(top,context)` distinguishes active library from selected expanded collection; a stale background/covered view cannot drive the global header.
- `useLayoutEffect` restores the expanded DOM offset and header per context and returns library/header on close, rather than waiting for a second touch. Opening a profile out of an expanded collection and going Back returns to the current collection and offset.
- User-selected collection order is rendered from the same `shown` sequence as saved preferences, removing the hard-coded `common` first position. Favorites/reorder remain persisted through the pre-existing localStorage key and schema; no schema migration.
- Covered ForYou library becomes non-focusable while the expanded collection is visible; it is not unmounted and its previously accepted bounded-media policy remains unchanged.
- Focus is restored to the connected visible collection opener without scrolling to an unexpected position.

The focused browser scenario verifies independent scroll for two collection IDs, opening/closing/restoring the first, saved ordering across reload, profile→Back returning to expanded collection, header at current offset immediately, inactive tab and modal keyboard behavior. The source QA records its values and screenshots/traces, rather than relying on source text searches. Scroll restoration is checked against the **actual measured offset at profile open**: Playwright `.click()` may legitimately scroll a tile into view before opening. Measuring the pre-click position as a post-click invariant produced a false historical test failure; the revised test preserves the substantive geometry assertion without skipping it.

## 3. LU-34 implementation and checks

- `apps/web/src/ui/modal-layer.ts` is one bounded, active-only shared modal stack. It supplies initial focus, Tab/Shift+Tab containment, capture-phase Escape to the top layer, connected/visible trigger restoration or safe fallback, body overflow lock by stack depth, and strict cleanup.
- Background siblings are marked `inert`/ `aria-hidden` along the **actual DOM ancestor path**, so the PhotoViewer body portal itself remains operable above the parent visitor profile. Previous per-element values are restored on release; listener and lock owners disappear when depth reaches zero.
- Wired modal owners: visitor profile route; PhotoViewer portal plus nested photo menu; owner/visitor preview; filters; saved profiles; interest sheet; ForYou settings. Existing Telegram Back, Escape/X, route animation, PhotoViewer media/identity and gesture owners remain responsible for their own semantic close.
- Profile has all five logical pages mounted; exactly the four nonselected pages are `inert` and `aria-hidden`. A roving `tabIndex` and ArrowLeft/ArrowRight/Home/End keyboard navigation preserve the native page offset/selected tab while focusing only the visible tab.
- Hero image has a keyboard-accessible `role="button"`, Enter/Space action, distinct accessible label and focus outline; the physical photo swipe, blur and layout remain.
- ForYou expanded focus enters its Back control; on returning, focus goes to the original still-connected opener when visible, without scroll-induced shift.

Focused QA verifies menu → viewer → profile close hierarchy by successive Escape, PhotoViewer initial focus, Tab and Shift+Tab menu containment, focus return from viewer/profile, filter/saved dialog restore, owner preview, a removed original focus trigger fallback (visible connected node), and React StrictMode unmount/remount with no persistent body lock. The focused browser trace and screenshot are artifacts of the workflow, not claims of physical A55/iOS or screen-reader validation.

## 4. Preserved REM-04C resource policy and broad regression

The **same-runner, same-media, 393×852 headless Chromium Android-UA fixture** compared accepted `5ea0a1f` and REM-04D over **50 visitor profile open/Back/close cycles per version**:

| Media/resource observation | Accepted REM-04C | REM-04D |
|---|---:|---:|
| Library IMG nodes in ordinary main ForYou | 32 | 32 |
| Covered library IMG nodes with expanded open | **20** | **20** |
| Visible expanded collection IMG / tiles | 16 / 16 | **16 / 16** |
| Total document IMG at expanded checkpoint | 108 | **108** |
| Saved library scroll after session | 360 px | **360 px** |
| Measured global window/document listeners at expanded checkpoint | 19 | **19** |
| Tracked RAF/timer/ObjectURL/decode pending at expanded checkpoint | 0/0/0/0 | **0/0/0/0** |

The resource run also verifies hot LU-21 PNG preview 2300×1700 → 2048×1514, header rejection at 9000×9000 (32 MP source guard unchanged), cancellation, warm LU-22 IME viewport 852→390→852, browser background/foreground and registration-related preservation, 6-photo viewer, tab/theme/viewport changes and explicit React unmount/remount. Browser-native caches, compositor tiles and decoded GPU textures are NOT app DOM counters and this does not prove a physical memory reduction or global absence of leaks.

Preservation job independently reruns earlier real-browser PhotoViewer identity/pinch, route lifecycle, source morph, 1–6 photo blur and keyboard/VisualViewport regressions. No older test was disabled, skipped, turned into xfail or replaced by a grep.

## 5. CI evidence and QA state

The successful **source-tip** `b2322f9` focused work was recorded in [workflow run 39923793514](https://github.com/zhirayr2505/luemi/actions/runs/39923793514), with three dedicated jobs:

- Same-browser accepted vs changed scroll/focus and [REM-04D focused behavior](https://github.com/zhirayr2505/luemi/actions/runs/39923793514): PASS, logs `REM04D_BASELINE_WITNESS` and `REM04D_FOCUSED_PASS`.
- Accepted REM-04C against REM-04D 50-cycle long session: PASS, log `REM04D_COMPARE` reports base=20, after=20, visibleGrid=16, cycles=50, scrollDrift=0.
- PhotoViewer/blur/gesture/morph/viewport preservation: PASS, detailed per-scenario logs.

**IMPORTANT: an earlier historical focused run** [39922701987](https://github.com/zhirayr2505/luemi/actions/runs/39922701987) failed. Failures were investigated, not hidden: one click-test compared scroll before Playwright auto-scrolled to a profile source, and another mistakenly demanded lower hidden library IMG than already-optimized accepted REM-04C. Both assertions were replaced with correct, nonweakened source-consistent invariants; the final dedicated resource job again requires equality/preservation of the accepted bound and checks live media counts. The earlier full behavioral regression also caught a hero accessible-name collision with the grid photo selector; the labels were separated and its original selector/test preserved.

**Final-head gate:** after this documentation commit, separately inspect **exact PR head_sha** for six push/pull-request runs of Foundation CI (7 jobs per event), Full Behavioral (2 per event) and Focused REM-04D (3 per event), totaling **24/24** completed/success, with no run/job contradictions. Historical/source-tip success MUST NOT be represented as final-head success until actually checked.

## 6. NOT VERIFIED / remaining limitations

- Physical **Samsung Galaxy A55** in Telegram Android WebView: touch/scroll repaint, OS Back, thermal, FPS, compositor tile eviction and memory peaks.
- Physical **iOS Telegram WKWebView / Safari**, visual viewport/keyboard/safe-area focus jumps.
- VoiceOver/TalkBack and full WCAG accessibility assessment. DOM roles/keyboard assertions only cover named flows.
- Real production data, photos, network conditions, app telemetry, CPU/GPU/RAM/memory peak and production deployment.
- An actual physical long-running app session, system-interrupted gestures and cross-app Telegram routing.

These are **NOT VERIFIED**, not PASS; no unsupported zero-leak, absolute 60 FPS, WCAG compliance or release-readiness claim.

## 7. Isolation / rollback / acceptance boundary

Keep [Draft PR #51](https://github.com/zhirayr2505/luemi/pull/51) **OPEN/DRAFT/UNMERGED**. Base is exactly owner-accepted REM-04C `5ea0a1f851e2518f6f23b17e7287ae536bb06395`; main/staging/PR #47/48/49/50 were not edited. No merge, deploy, Render/Supabase operation, payment, real user media or IndexedDB v2 mutation. Do not reset/rebase/force-push old branches: safe rollback is to leave PR #51 unmerged and retain the accepted REM-04C tip. **Stop for independent owner technical acceptance. REM-05 must not start without separate authorization.**
