# LUEMI · Profile motion V4 · root-cause cleanup

Scope: `apps/web/src`; VEYRA, blotX, database migrations and «Блики» unchanged.

## What was deleted
- `settle`, `snapTarget`, `snapping`, `lastClosed`, `velocity`, `scheduleFallback`, fallback timers, `scrollend`/`pointerup` scroll controller and all `scrollTo` calls from the profile hook.
- Per-frame `borderRadius`, `--profile-rim`, `box-shadow` and per-scroll gallery/collapse `dataset` updates.
- Heavy `mask-image`, `mix-blend-mode`, SVG `feMorphology`, pointer/scroll glare listeners and `backdrop-filter` from the brand island. Original W06 silhouette remains, with the approved shape preserved in the static derived raster.
- Unused `style.css` legacy stylesheet, old logo CSS rules and old tests asserting snapTarget.
- The `lastProfile` hidden mounted copy from `App.tsx`: profile unmounts when it is no longer visible.

## What was added
- Native `scroll-snap-type: y mandatory` with two explicit profile snap anchors, `scroll-snap-align: start`, `scroll-snap-stop: always`. Other content sections also have snap points to prevent trapping deeper content.
- CSS named scroll timeline with **pure transform/opacity** keyframes. Legacy browsers get a single passive-scroll RAF that writes **transform and opacity only**, never scrollTop. Geometry computed in ResizeObserver, not in scroll or RAF.
- Separate large fixed-rounding photo and small fixed-rounding 56px avatar with a light static rim. No photo pixel/face zoom.
- A separately layered static-translucent name/city island and a static baked W06 wordmark rim.
- One snap-travel spacer plus trailing scroll range, so the last snap point is reachable even for short profiles.
- Stable Telegram BackButton handler via ref, two effects: a single subscription and a visibility-only toggle.
- Profile-only `SlideDeck` opacity transition (no outer transform on the active scroll animation scope).
- Architecture regression tests for single scroller, native snapping, no competing JS, separate animation owners, cleanup and logo raster.

## Important acceptance nuance
**CSS scroll snap does not expose a programmable 30% gesture threshold.** Native browser snap heuristics decide which point wins, so the 30% target requested previously is not enforceable *exactly* while also forbidding JS scroll writers. Native scroll-snap was explicitly prioritized in the latest TЗ. Test actual behavior on Android Chrome and Telegram WebView.

**No physical FPS claim:** GitHub CI checks TypeScript/build/unit/smoke, not visual motion on the Galaxy A55. Record Chrome DevTools Performance trace using USB remote debugging and test Telegram WebView on device. Target 55–60 FPS and no repeated snap loops or long tasks. No device trace is attached automatically.

## Adjacent review
- Discovery's `ProfileCard` legitimately uses `.profile-card` and cannot be deleted as unused; it owns only image paging, not vertical profile scrolling.
- Chats and onboarding use existing local scroll and gesture handlers. No shared script writes to the profile's scroller.
- `SlideDeck` remains one owner of tab transitions, with opacity-only transitions to/from profiles.
- Telegram viewport adjustments ignore browser toolbar microresizes; BackButton events stay subscribed once.