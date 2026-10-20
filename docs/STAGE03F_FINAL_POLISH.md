# LUEMI · Stage 03F — Discovery Final Polish

**Owner approval:** 2026-10-20. **Baseline:** staging/telegram-miniapp-20261019 @ 878a66b. **Feature:** feat/stage03f-discovery-polish.

## Acceptance and scope
- Priority: native scrolling and horizontal gesture smoothness on Galaxy A55 Telegram.
- Preserve same approved Premium Glass visual appearance when stationary, use optional motion-time simplification on repeated tiny blur overlays.
- No modifications to FeedCard, Deck Lift animations, current Discovery tab underline, For You or Nearby geometry, original logo, full profile, app radius (1–5000 km) or backend.
- Do not touch production main, VEYRA, blotX, Supabase or paid Render plans.

## Findings from source review (hypotheses pending device profiling)
- All three discovery pages were mounted at initial feed entry, including the Nearby 2-column grid and the dense For You library. This could cause unused image decode/memory and rasterization before the first visit.
- For You recomputed the same portrait rendering for several sections on unrelated preferences/saved-state updates despite a memoized parent.
- The navigation pointermove read clientWidth repeatedly during gesture; React setDragX already removed in Stage 03D.1.
- Multiple small frosted badges and floating bookmark buttons use backdrop-filter, which may increase overdraw during moving catalog content. One fixed global header/nav layer remains unchanged.
- Server RAM size alone does not measure on-device rendering FPS, so no numeric FPS improvement can be claimed without profiling.

## Implemented optimizations
1. Preserve always-mounted Feed and For You for a seamless first swipe. Mount Nearby only once user selects For You or Nearby; remain mounted thereafter so scroll state persists on return.
2. Cache pager width once on pointerdown; pure rAF transform updates continue following the finger, preserving thresholds and the exact 03D.1 easing.
3. React.memo For You PersonTile, preserving content and saved states; duplicate portraits in thematic rails avoid needless rerenders.
4. Passive capture-phase observer for native For You/Nearby scroll containers with no React state updates. Limit CSS override to repeated small overlays while actively scrolling or dragging; preserve full Premium Glass at rest and leave main header/nav, photos and full profile untouched.
5. Regression tests lock radius, gesture and Deck Lift invariants; no changes to component source for FeedCard.

## Validation gates
- npm run check including ESLint, Stage 03 UI/discovery regression suite, TS typecheck and front/backend builds.
- After CI SUCCESS only, fast-forward staging from its checked original head and allow only its Render service to redeploy; save backup first.
- Verify target commit appears LIVE and @LuemiAppBot configured.
- Galaxy A55 in-Telegram visual confirmation: very fast tabs (both directions), canceled finger drags, scroll on center of photo, image swipes in Feed, bookmark syncing in For You/Nearby, profile open/close, reduced motion and themes. Monitor perceived glass shimmer, restore unchanged moving blur if visible pop; no guaranteed FPS until device measurement.
- Stage 04 Profile Master follows AFTER owner visual acceptance; portrait-to-profile shared-element expansion intentionally deferred.

## Deferred Nearby 2.0
Real global nearest-first, Premium/new/verified filters and real cursor pagination all remain future backend work requiring verified consented location, entitlements and timestamps. No fake distances or fake online status.
