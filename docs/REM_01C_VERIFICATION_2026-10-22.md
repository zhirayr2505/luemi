# LUEMI 💜 — REM-01C / LU-21 and LU-23
Verification / technical decisions / rollback — 2026-10-22

## Identity and immovable scope

- Accepted base: `766e3c645324af66ee0a3788374d33c0e98877f6` (REM-01B; inherits REM-00A/B/C and REM-01A).
- Branch: `remediation/rem-01c-photo-safety-sorter-20261022`.
- Allowed: registration preview decode guard; PhotoSorter gesture ownership; related QA/documentation and exact one-line `touch-action` change.
- Not allowed and **not changed**: REM-01B IndexedDB persistence, envelope/manifest structure, schema version, user data, original photos, API, discovery/profile motion, appearance, Render/Supabase, main/staging, merge, deploy or REM-01D.

## LU-21: pre-decode image limits and resource lifetime

Paths: `apps/web/src/registration/photo-header.ts` (new); `photo-preview.ts` (updated). Existing `App.tsx` serialized preview queue remains unchanged.

- The original 12 MiB input limit, accepted JPEG/PNG/WebP MIME types, preview longest side 2048 px, output JPEG quality 0.92, PNG for PNG and original File blob identity remain unchanged.
- Read at most **256 KiB** of the file header before invoking any full decoder. A bounded parser extracts dimensions from baseline/progressive JPEG SOF segments, PNG IHDR, WebP VP8, VP8L and VP8X. JPEG EXIF orientation is parsed for diagnostics; the browser's orientation-aware decode still owns rotation. Truncated, badly typed, oversized and malformed headers fail closed before decode.
- **Provisional working safety cap:** **32 million source pixels**; theoretical one RGBA image at this cap is 128,000,000 bytes (122.1 MiB), plus a maximum ~16.8 MB 2048x2048 canvas and implementation-specific decode copies. THIS IS AN ESTIMATE, NOT a measured memory peak or proof of safety for physical A55/iOS. The original 12 MiB compressed size guard was not sufficient to bound decoded memory. Photos above the cap are marked error/unsupported (not falsely previewed); their original uploaded File is never destroyed or batch rewritten.
- Final quality decision on 32MP ceiling requires real A55/iOS peak-memory and practical high-res camera tests. On failure, report and stop rather than silently increasing the budget; high-resolution 50MP source images are a potential user-facing limitation, pending explicit owner/device approval. Decoder thumbnail resize is not assumed to avoid full decode; the implementation does not promise an absolute heap bound.
- Both large and small images must successfully decode before being marked ready. `createImageBitmap` is closed in finally, fallback `Image` handlers and object URL are cleared/revoked, canvas size reset to 0, no failed `toBlob` result is labeled successful. Abort before/during decode and during encoding has a terminal rejection. Existing App cleanup of its ready-preview `objectURL` on delete/unmount remains intact.
- REM-01B v2 original `File` objects and previously stored preview Blobs are preserved verbatim. The revised decode is applied only when generating a new/missing preview, and it never modifies `draft-schema.ts` or `local-draft.ts`. Failure on recovery retains the original File in a recoverable photo error state.

## LU-23: touch ownership and scroll

Paths: `PhotoSorter.tsx`, `styles.css`.

- Keep **275 ms** long press, the existing ghost, 230 ms FLIP animation, mosaic geometry, visual styling and Alt+arrow accessibility.
- Replace `touch-action:none` on photo slots with `pan-y` BEFORE contact begins. A vertical swipe starting on a photo therefore remains normal native scrolling until a stationary long-press claims sorting. A native non-passive `touchmove` listener only prevents default while **dragging**, not during the initial hold. Native `pointercancel` is a terminal cancellation, not a drop.
- Track the primary pointer and every contact. A second pointer cancels pending/dragging and cannot steal the owner. Losing capture, cancellation, deletion during pending, unmount and successful drop disarm the timeout/RAF, release capture and never commit twice.
- Edge scrolling is continuously driven by **one requestAnimationFrame loop** while the held pointer is near the top/bottom 47 px of the registration scroll region, proportional to distance and frame elapsed time, maximum ~330 px/s. It keeps moving even if there are no further pointermove events. Target hit testing is refreshed after scroll in **client-coordinate space**, and RAF is canceled as soon as contact leaves edge or terminates.
- Touch behavior still needs physical WebView validation; `pan-y` and pointer capture may be implemented differently on WKWebView. If simultaneous native pan and 275 ms hold fails on a supported device, do **not** silently change the visual drag handle; return for explicit owner UX decision.

## Executable QA (no assertion removal)

- Added `scripts/rem-01c-photo-header.test.mjs` to required **source-contracts** gate. It tests PNG/JPEG progressive/EXIF-6 and WebP VP8/VP8L/VP8X metadata plus crafted oversized headers, corrupt/truncated data, mismatched format and fixed constants. `npm run test:photo-headers` is available.
- Added real Playwright/Chromium test `scripts/rem-01c-browser-regression.mjs`, using genuine isolated `PhotoSorter` and image code, after REM-00C/01A/01B browser tests. Test-only fixture `rem-01c-sorter-qa.html` never appears in production entrypoint.
- Exercises real JPEG/PNG canvas decode/resize, no decode before big-pixel rejection, decoded image fallback and URL reclamation, AbortError + bitmap close on late decoder result, encoder failure, native Android-UA touch swipe on a photo, real touch long-press, mouse drag/drop exactly once, stationary continuous edge-scroll and shutdown, second pointer cancellation, lost capture, deletion while holding, keyboard reorder. React page errors fail the test.
- The old REM-00C / REM-01A / REM-01B behavior and 7 foundation jobs remain mandatory; no blanket skips, silent assertions, `continue-on-error` or suppression. Removed only the **resolved** historical PhotoSorter hook diagnostic from `qa/react-hooks-baseline.json`; all remaining hook debt fingerprints retain strict enforcement.

## Device and release gates — MUST NOT BE MISREPRESENTED

- Physical **Samsung Galaxy A55** Telegram Android WebView: **NOT VERIFIED**.
- Physical **iOS Safari / WKWebView / Telegram**: **NOT VERIFIED**.
- Camera originals with EXIF orientation, pano/high-res, selecting 6 photos, WebView memory peaks, long-press vs native scroll and keyboard/viewport interaction on physical devices: **NOT VERIFIED**.
- Chromium emulates UA/touch but is **not** a substitute for actual Android System WebView or WKWebView. No real production user was tested or migrated. Any release depending on device behavior remains blocked.

## Rollback and preservation of photos

1. Nothing has been deployed. Close the new unmerged Draft PR and remain at accepted REM-01B `766e3c6`; no real user data or databases need changes.
2. Selective rollback: revert only REM-01C commits on a review branch; restore the previous PhotoSorter/CSS and previous preview logic only in that review copy. Do **not** reset `main` or `staging`, drop IDB, delete/overwrite original File blobs or force-push another owner's branches.
3. **Known REM-01B limitation:** v2-only photos remain stored but the pre-REM-01B application cannot display them. A future *deployment* rollback requires v2-compatible reader/data rescue rather than simply switching back to legacy UI. Do not activate any production changes until this is addressed.
4. Trigger rollback if the preview marks broken resources ready, loses original File, leaks its own URL/bitmap resources, native scrolling freezes, drop double-commits, old behavior/regression tests fail or device test reveals broken native gesture ownership.

## Checkpoint

Scope complete only after all final SHA CI jobs have completed successfully. Keep this as a draft review artifact; no merge/deploy and no REM-01D without a new explicit owner authorization.
