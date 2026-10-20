# LUEMI · User video review / passport addendum · 2026-10-20

**Status: feedback captured; implementation options PENDING OWNER APPROVAL.**
**Reference:** Galaxy A55 Telegram screen recording uploaded to ChatGPT: \`1000068647.mp4\` (29.46 s, 1080 × 2340).
**Baseline:** \`staging/telegram-miniapp-20261019\` commit \`1ae4d9f\` (Stage 03D LIVE).
**Scope guard:** preserve approved Stage 03 Feed Polish 2, existing FeedCard/Deck Lift timings, logo raster, navigation architecture, registration and Stage 03E radius. Do not modify VEYRA, blotX or payments.

## Owner observations, in their priority order
1. **Top discovery tabs blink on tab changes**, noticeable around 00:01–00:02 and 00:15–00:18. Must remove the flicker and prevent transient text/underline misalignment or repaint, retaining smooth follow-finger transition.
2. **Public demo profile hides LUEMI original logo**, visible around 00:11–00:12 and 00:26–00:28. Preserve the original centered wordmark in the expanded profile view without duplicating Telegram's native system BackButton. Profile close remains accessible.
3. **Future independent profile transition**: when a person card is tapped in For You, the *same* portrait smoothly expands from its card rectangle into the full-size profile image. Reverse/return preferably mirrors the opening, maintains image identity, respects reduced motion, restores source scroll context. User explicitly proposed deferring it to a later profile-animation stage. This is a **candidate, not approved implementation scope**; add to the passport backlog. No implementation until separate owner decision.
4. **App jank and lag**, particularly dense For You lists, scrolling and tab transitions. Investigate unnecessary React renders, heavy backdrop blur, compositing, repeated tiles/images, pointer movement handlers and stale duplicated code. Optimize surgically without degrading Premium Liquid Glass or the accepted Feed and its animations.
5. **Vertical scroll does not begin if touch starts on a portrait tile**. At present, \`.fy-rail\` declares \`touch-action:pan-x\`, inhibiting vertical panning from the carousel hit area. Restore vertical swipe-to-scroll from anywhere on a tile while retaining horizontal drag in the carousel and one-tap profile opening.

## Preliminary code review (hypotheses, not proven device profiling)
- \`DiscoveryApp.tsx\`: each main-page \`onPointerMove\` calls React \`setDragX\`, potentially re-rendering a large interactive tree on every pointer sample; top tab active typography and indicator position change on different frames.
- \`discovery.css\`: \`.discovery-tab-underline\` uses \`will-change:transform\` and the page track uses \`translate3d\`; active tab font-weight jumps 570 → 770, potentially producing a momentary visual jump on tab change. Do not assert that this alone causes all visible blinking.
- \`ForYou.tsx\` / \`for-you.css\`: multiple themed rails and repeated \`PersonTile\` instances mount at once; \`.fy-rail{touch-action:pan-x}\` blocks the requested vertical-scroll path. \`backdrop-filter\` applies to multiple glass chips; focus optimization only on measurable bottlenecks.
- \`DemoProfile.tsx\`: \`.discovery-profile-overlay\` covers the discovery header. Profile's own header renders 'Демо-профиль' and X but no original LUEMI wordmark.
- Recording proves the symptoms, not exact engine-level frame rate. No device-performance claim before post-fix video/manual test.

## Candidate implementation boundaries (not yet authorized)
A. Stable top tab transitions with no blink, minimal React work on pointer move; keep the underline/track synchronized and typography from shifting. Prefer transform-only movement, avoiding extra re-layout and duplicate event ownership.
B. Correct nested \`touch-action\` / gesture isolation so vertical scroll originates over photo cards and horizontal galleries remain touchable.
C. Profile top header with original logo in a safe-zone, clean exit controls, no layout jump.
D. Performance audit: identify dead styles/code by exact references before deletion; reduce redundant visual work, keep motion and photo quality. Include light/dark and reduced-motion fallback.
E. Shared-element portrait-to-profile growth **separate deferred scope**, only after owner's further confirmation.

## Acceptance & regression guard
- Video: no flashing/shimmer across multiple fast tab switches, including canceled swipe and rapid touch input.
- Start vertical scroll over the middle of a portrait; horizontal rail also works; tap opens correct person. No accidental tab switch while scrolling or launching a profile.
- Profile shows original wordmark, fits Telegram safe-area and still closes by X/native BackButton and existing swipe.
- Visual polish identical in both themes, no regression of Feed Deck Lift, lower nav, profile data and saved bookmarks.
- Prefer FPS trace and paint/React profiling on Telegram Galaxy A55; no guaranteed 60fps without measurements.
- \`npm run check\` and post-deploy device video are separate mandatory gates.

## Documentation authority
This addendum records the feedback alongside W12 and the Stage 03D implementation notes, **without rewriting approved Brand Master/W12 design decisions**. Owner choices must be transcribed into a concise final TЗ before implementation. Existing W12 radius discrepancy (1000/5000 km) remains unresolved.
