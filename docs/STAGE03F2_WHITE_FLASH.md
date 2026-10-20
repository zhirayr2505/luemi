# LUEMI · Stage 03F.2 · White flash & smoothness

**Baseline:** staging/telegram-miniapp-20261019 @ 8b21c272b822411ca905f490bb8244487f408b8b
**Branch:** feat/stage03f2-white-flash-smoothness
**Video:** owner supplied 1000068655.mp4 (23.54 s, 1080×2340, Android screen recording).
**Scope:** Discovery visual fidelity unchanged; main/VEYRA/blotX/Supabase never touched.

## Video evidence

Frames 6.6 s and 8.4 s show large white rectangular regions where full portrait tile rows normally appear under "Для тебя"; frame ~19.9 s shows a corresponding white region in "Рядом". LUEMI header and bottom nav are still visible. Frames before/after show the original images. This rules out *only a small glass badge flicker*, but **does not uniquely identify** GPU compositor raster invalidation versus image decode/delayed content. A Chrome Remote Debugging / WebView trace from the Galaxy A55 was not available in this execution environment. No FPS measurement or A55 reproduction is claimed.

## Static source investigation

1. Confirmed Stage 03F CSS layer topology toggle: `DiscoveryApp.tsx` adds/removes `is-discovery-scrolling` for all scrolling rails and `discovery.css` temporarily disables both backdrop-filter variants on each mini badge. Risk is costly, repeated layer allocations/invalidations during motion and momentum. Solved by removing the entire class toggle, observer and CSS rule, preserving full original glass at all times. **Hypothesis causality remains unconfirmed until A55 video.**
2. Confirmed pager lifetime mismatch: on pointerup previous `settleDrag` restored `--luemi-drag:0` and removed finger tracking before `setDiscoveryTab`, allowing a transient old-index target. New endpoint is applied to track and underline before React commit; GPU compositor hint remains while CSS completes (transitionend with 380ms fallback). Same 300ms cubic bezier, direction and threshold.
3. Confirmed synchronous work on initial "Для тебя": selecting index 1 previously also mounted Nearby. Now first For You transition does not mount Nearby in the critical React update; Nearby prewarms after 450ms via requestIdleCallback when available. Direct Nearby selection immediately mounts, and stays mounted for scroll state.
4. Confirmed callback churn: onSave depended on feed.saved and therefore changed identity every bookmark update, waking all memoized For You tiles. Stable savedRef callback retains exact action and haptic feedback.
5. Confirmed PhotoCarousel pointermove ran React setDx each event; now renderOffset is written once per rAF on DOM transform. Separate pointercancel path reverts index instead of possibly advancing. For You rails still use native overflow scroll and scroll-snap; unchanged.
6. Existing memoized For You tiles and lazy image loads remain. No blanket will-change/translateZ(0), content-visibility, mass eager loading, design reduction or removal of CSS blur. Repeated external portraits, possible image decode issues and animated `.milky-mist` remain **unproven contributors**, deferred until WebView paint/decode traces and follow-up device recording.

## Test and release gates
- GitHub Actions `npm run check` (lint, UI contract, discovery contracts, TS, API tests, web/API builds, smoke).
- CI green before **staging only**, prior staging SHA is backed up at `backup/pre-stage03f2-20261020`.
- Must visually verify on Samsung Galaxy A55 Telegram: 20 For You flings, 30 sec idle, rapid and canceled top swipes, vertical scroll starting on portrait, first/repeat Nearby, photo navigation, Deck Lift/Undo, favorites/profiles, both themes/reduced motion, cold/warm start.
- If white blocks remain, stop. Collect WebView Performance trace (Screenshots, Paint, Raster, Image Decode, Layers) and Network logs. Do not guess root cause or declare final P0 resolution without on-device proof.
- On regressions, reset **staging only** to `backup/pre-stage03f2-20261020` via approved rollback; main unchanged.

## Deferred / unchanged
- Real geo/nearest-first Premium/new profiles, backend cursor pagination, profile expansion Stage 04.
- Full design, logo, Feed Polish 2 Deck Lift, animation timing, For You carousels, Nearby 2×4:5 layout, radius 1–5000 km, Telegram BackButton and themes.
