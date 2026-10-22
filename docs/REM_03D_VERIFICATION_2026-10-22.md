# LUEMI 💜 — REM-03D · LU-06/LU-07 technical report

**Approved immutable REM-03C base:** `57cde9848e241032c215044f419110a9ae410079`  
**Isolated branch:** `remediation/rem-03d-source-morph-modal-20261022`  
**Draft PR:** https://github.com/zhirayr2505/luemi/pull/45  
**Authority:** Sections 10.7–10.8 of the approved master remediation specification, **no REM-04A**.

## Preliminary mandatory REM-03C Foundation CI reconciliation

On accepted REM-03C SHA `57cde9848e241032c215044f419110a9ae410079`:
- GitHub [PR Foundation workflow 39802242416](https://github.com/zhirayr2505/luemi/actions/runs/39802242416) ended `completed/success`, but API job summary `build` (job `119905822968`) continues to report `in_progress/null`.
- The **job steps API** explicitly confirms all nine steps including `Run isolated quality gate` and `Complete job` are `completed/success`. Actual downloaded build logs reach finished GitHub cleanup without a nonzero exit or failed build, matching the parent workflow's success result.
- The GitHub combined legacy commit status endpoint exposes no contrary failure (empty statuses); it does not provide modern check-run entries. The observed inconsistency is therefore a **stale job-summary value**, not evidence of a running build or incomplete test. [REM-03C full Behavioral](https://github.com/zhirayr2505/luemi/actions/runs/39802242438) and [focused](https://github.com/zhirayr2505/luemi/actions/runs/39802242504) independently passed on the exact accepted SHA. The REM-03C PR #44 already records this reconciliation; accepted code is left untouched.

## LU-06 — geometry and source lifecycle

Previous root defect: PhotoViewer calculated independent `scale(widthRatio,heightRatio)` transforms of an entire viewport surface, which can deform portrait pixels and cannot model `object-fit:cover` crop or noncentral object-position correctly.

`photo-viewer-morph.ts` provides deterministic, separately testable geometry:
- actual intrinsic width and height of the opening HTMLImageElement;
- the thumbnail's measured viewport CSS bounding rect, object-fit and object-position;
- intersection with the viewport and clipping overflow ancestors, plus hit-test excluding the viewer portal;
- the source-image *painted* rectangle in cover/contain mode, the source's visible clip/crop, and the destination photo's true contain rectangle;
- a **single uniform scalar** relating source pixel size and destination pixel size; separate clip-path bounds animate cropping independently of the pixel transform.

`PhotoViewer` uses a dedicated transient clipped image layer, **not the accepted three-slide track or the pinch/pan image transform owner**, to interpolate the crop and uniform pixel scale. The existing surface MotionController token owns animation completion (transitionend and timeout race exactly once), and the original 240ms motion curves remain unchanged. During morph, the currently decoded main image is hidden so differently scaled images are not simultaneously visible; source DOM visibility is restored with an idempotent cleanup after completion, background, navigation, error or unmount. If identity/context/version changes, source image disconnects, becomes covered/offscreen, rect moves on layout/resize, or the fallback resource is incompatible, the viewer fades without morph; background is **never auto-scrolled** to find a source. The original source rect from opening is checked again before closing.

## LU-07 — portal safe areas and modals

REM-01D `viewport-controller` owns authoritative `ViewportSnapshot` (`luemi:viewport-revision`) with separate Telegram safe/content insets, accepted stable viewport and visual offset. `photo-viewer-safe-area.ts` consumes that event and current shell CSS values, **max(safe,content,existing)** for each edge rather than summing overlapping regions. The viewer is a body portal, so it explicitly receives copied CSS properties and live theme, regardless of the `.luemi-shell` ancestor.

Viewer chrome reserves the existing **63 CSS px** top control offset; safe area and visual offset are additional **independent nonoverlapping** frame reservations. Bottom buttons, date and menu respect bottom safe area. Resizes, fullscreen/safe-area events and theme changes only update the portal's CSS props; they do **not remount PhotoViewer, restart opening or rebase the horizontal track**. No Telegram SDK gives the CSS env + browser viewport fallback.

Modal Back priority: first dismiss the photo action menu; next close Viewer; only thereafter may the profile Back handler run. X, Escape/Backspace (outside editing) and the already-registered Telegram Back callback share `requestClose`. Initial focus is placed on viewer X, a small Tab wrap stays within visible viewer buttons, and the previous connected focus owner is restored with `preventScroll` after removal. Existing body overflow locking is restored via cleanup, including StrictMode replay.

## Test and acceptance gates

New additive unit gate `scripts/rem-03d-morph-contract.test.mjs` covers five aspect+crop fixtures, hero `22% 70%`, grid 3:4, panorama, uniform X/Y scale, unsupported object-position fade, offscreen/covered clipping and max-insets. New Chromium DOM scenario `scripts/rem-03d-browser-morph.mjs` verifies actual DOMMatrix, visible source, both directions of morph, stable image identity on navigation, disconnected/offscreen source fade, viewport/safe-area updates, theme, Back hierarchy, focus+overflow restore, StrictMode/reopen, backgrounds and error-free cleanup.

Both are **additive**, not substitutes for any existing REM-00–03C unit/behavior/browser gate. The full Behavioral workflow keeps pinned Playwright Chromium and executes the new scenario **after** the entire unchanged accepted browser suite; an additional REM-03D focused Chromium-based Chrome workflow gives earlier feedback. No tests are disabled, skipped or relaxed.

**Final exact-HEAD Foundation / full Behavioral / focused CI results:** only mark PASS after all actions complete and their actual logs are verified. Record exact final commit and run URLs in Draft PR #45 without altering code after acceptance.

## Physical and rollback boundaries

Samsung Galaxy A55 **in Telegram Android WebView — NOT VERIFIED**. iOS Telegram WKWebView, real Android system Back, native safe-area compositor, performance and full black-frame elimination — **NOT VERIFIED**. Chromium emulation cannot establish these physical properties.

Safe rollback to the immutable accepted REM-03C `57cde9848e241032c215044f419110a9ae410079`; leave Draft PR #45 unmerged or close at owner instruction. No main/staging, Render, Supabase, migrations, originals, 32 MP changes, real user data edits, reset/force-push, merge or deployment. **Stop after REM-03D for the owner's acceptance; REM-04A is not authorized.**
