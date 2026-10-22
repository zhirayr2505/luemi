# LUEMI 💜 — REM-03D TECHNICAL VERIFICATION (LU-06 / LU-07)
**Date:** 22 October 2026  
**Immutable accepted REM-03C baseline:** `57cde9848e241032c215044f419110a9ae410079`  
**Branch:** `remediation/rem-03d-morph-modal-20261022`  
**Draft review:** https://github.com/zhirayr2505/luemi/pull/49  
**Scope:** §§10.7–10.8 only of `LUEMI_MASTER_REMEDIATION_TZ_2026-10-21.md`. No REM-04A.

## Prerequisite: PR Foundation stale-build reconciliation

The accepted REM-03C PR Foundation [run 39802242416](https://github.com/zhirayr2505/luemi/actions/runs/39802242416), exactly at `57cde9848e241032c215044f419110a9ae410079`, is `completed/success` with **all seven jobs completed/success**, including build job `119905822968`. The previous `in_progress/null` was a stale intermediate GitHub job-summary value; on a new direct job API read it is definitively `completed/success`. All build steps had completed/success and no error in logs. Recorded the fresh state in REM-03C Draft PR #44 *body only*, without changing code or rerunning a successful workflow.

## LU-06: source morph and pixel geometry

The old morph independently scaled the entire fullscreen surface with `scale(sx,sy)`; if source and viewport aspect ratios differed, pixels and faces stretched. It also ignored actual `object-fit:cover` crop, `object-position:center 20%`, ancestor clipping and replacement src/version.

New modules:
- `photo-viewer-morph.ts`: pure, deterministic intrinsic-media cover/contain dimensions, percentage- or pixel-based object positioning, source visible crop intersection and viewport clipping, fullscreen contain destination and **a single uniform pixel scale**. Clip-path animates independently from the media's uniformly scaled transform. There is no anisotropic matrix on photograph pixels.
- `photo-viewer-source.ts`: consult the accepted REM-03A `sourceMatches` (photoId/profileContext/resourceKey) *at the moment of closing*, require a connected, visible, successfully loaded `HTMLImageElement` with nonzero intrinsic dimensions, intersect ancestor scrollers and viewport, and refuse unrelated foreground occlusion. An unavailable, removed, occluded or offscreen old thumbnail yields a short opacity fade; the profile is never scrolled to find it.
- `PhotoViewer.tsx`: one detached clipped image layer and the existing MotionController token coordinate opening/closing. The arriving fullscreen track is invisible while the overlay owns pixels. The original thumbnail is temporarily hidden with its prior inline opacity saved. Every terminal finish, cancellation, background, unmount and StrictMode cleanup restores the exact original opacity and returns track visibility. Source morph on close is rejected if displayed pixels have not passed the REM-03A decoding barrier or if their identity changed; no stale pixels are borrowed from a thumbnail.
- `ProfileMaster.tsx`: before resolving a source element, freeze already-accepted REM-02 sheet/tab motion owners and the actual computed hero-track transform. No new animation driver is introduced and no background scroll is issued.

Existing REM-03A photo identity/readiness, REM-03B keyed three-slot horizontal track/1:1 finger following and REM-03C zoom/pan/vertical-dismiss geometry are untouched. Original transitions retain 240ms and `cubic-bezier(.2,.8,.2,1)`; full visual design and Liquid Glass retained.

## LU-07: viewport, safe areas, modal lifecycle, Back

`photo-viewer-viewport.ts` reads the accepted REM-01D `VIEWPORT_REVISION_EVENT` snapshot plus the same Telegram safe/content inset contract and browser CSS env fallback. It normalizes each edge using **max**, never sums overlapping content and device insets. The fixed `document.body` portal explicitly receives `--pm-viewer-safe-{top,bottom,left,right}` custom properties, so it cannot accidentally depend on CSS inheritance from `.luemi-shell`. Viewport/Telegram/orientation updates revise CSS in place without remounting the Viewer or restarting the opening transition. An actual size change mid-morph invalidates only stale crop geometry, changing to a safe fade. The historical **63px top offset is preserved**.

Modal dialog has a real focus target and `aria-modal`, restores the previous focus on cleanup, traps Tab among visible enabled buttons and restores exact preexisting `body.style.overflow`. The accepted ProfileMaster Back registration is preserved: menu Back closes menu; next registered Back closes Viewer; only after Viewer closes can the profile handle the next Back. X, Escape and non-editable Backspace use the same `requestClose` priority and existing once-only MotionController commit; screen arrows remain available.

**Real Android system Back is NOT VERIFIED** by synthetic key/popstate callbacks. Background `inert` and full accessibility audit remain explicitly assigned to REM-04D.

## Test additions and retained regressions

- **Unit:** `scripts/rem-03d-morph.test.mjs` confirms hero cover 20%, grid 3:4, portrait/landscape/panorama/tall cases in contain and cover, exact uniform pixel matrix, independent crop, matching photo/context/src/version, offscreen source rejection, Telegram/browser safe-area MAX normalization, viewport-revision idempotence. Appended to existing Foundation `test:source-contracts` chain.
- **Real DOM Chromium:** `scripts/rem-03d-browser-morph.mjs` exercises connected hero/grid/contain source with actual CSS properties, opening/closing image matrix and clip, original opacity restoration, stale photo switch, offscreen/hidden sources, image replacement under same ID, landscape and extreme panorama, viewport/orientation change mid-morph, background/foreground, registered menu/Back, X/Escape, focus/overflow and safe-area/theme changes.
- **Full regression:** All prior browser scripts REM-00C, REM-01A–E, REM-02A–D, REM-03A–C retained and unchanged in `.github/workflows/stage03g3-visual.yml`. New REM-03D test is **appended last**; additive `.github/workflows/rem03d-focused.yml` supplements but does not replace full pinned-Chromium QA.
- **Exact final commit CI:** Check [Draft PR #49](https://github.com/zhirayr2505/luemi/pull/49) for the exact HEAD and results of complete Foundation (7/7), full Behavioral (2/2), and focused REM-03D Chromium (1/1). No preceding-SHA run alone establishes final acceptance.

## Safe rollback and remaining physical gates

Keep accepted REM-03C `57cde9848e241032c215044f419110a9ae410079` immutable; leave this isolated Draft PR unmerged if rejected, close it only after owner instruction. No main/staging changes, Render/Supabase writes, user data/photos, migrations, IndexedDB v2, temporary 32 MP limit, reset or force-push.

**NOT VERIFIED:** real Samsung Galaxy A55 in Telegram Android WebView (system Back, safe-area physical chrome, GPU frames, overlay resize/rotation); iOS Telegram WKWebView (native safe insets, back, object-fit motion, memory pressure). Browser tests are synthetic and cannot certify elimination of all black frames or GPU stutter.

**Hard stop after REM-03D owner technical acceptance. REM-04A must not start without separate authorization.**
