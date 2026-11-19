# Premium Profile V4 motion architecture

## Active runtime

`OwnerPremiumProfile.tsx` is the single premium surface for owner and visitor routes. `ProfileMasterV3.tsx` supplies the same projected public data and the existing `PhotoViewer`; owner-only edit, preview and settings actions stay gated by `view.mode === "owner"`.

The older `profile-v3/rendering/IntegratedProfileV3.tsx` remains only for the explicitly separate `local-self-preview` route. It is not a second owner/visitor runtime.

## Geometry and progress

`OwnerProfileGeometry.ts` is the only profile-geometry source.

- Expanded hero: `x = 0`, `y = 0`, `width = viewport width`, `height = viewport width`.
- Compact avatar: safe-area-aware, centered square clipped to a circle.
- `p = clamp(scrollTop / morphDistance, 0, 1)` drives the mask, radius, both identity opacities, compact backdrop, pager and card compensation.
- Phase A keeps the full square unchanged while content lifts.
- Phase B shrinks and rounds the same mask.
- Phase C moves the already circular mask to its final center.
- `ownerMorphEndpoint()` chooses only `0` or `morphDistance` from position and release velocity. Intermediate progress is never a semantic resting state.

The sticky tab travel can be shorter than the visual morph. `contentOffset` is derived from the same layout and progress so the first card remains below the one sticky tab panel without a second copy or `scrollHeight` correction.

## Writers

| Surface | Properties | Owner |
| --- | --- | --- |
| Profile scroller | native `scrollTop`; programmatic endpoint settle only inside morph range | `GeometryMotion("sheet")`, backed by `MotionController` |
| Photo mask | rect, radius | profile imperative painter |
| Identity/backdrop/pager | transform and opacity | same profile painter and same `p` |
| Profile flow | compositor `translateY(contentOffset)` | same profile painter and same `p` |
| Photo carousel | three prepared visual slots translated with the finger | `hero` gesture claim |
| Tab content swipe | semantic tab selection after horizontal claim | `tabs` gesture claim |
| Visitor route | route `translateX` | route `MotionController` |

There is no CSS keyframe or CSS smooth-scroll writer for the morph. A new gesture cancels the current `GeometryMotion` generation and continues from the sampled `scrollTop`. Resize and Telegram viewport changes rebase the active settle to the new geometry.

## Gesture arbitration

The visitor route passes its `GestureArbiter` into `ProfileMasterV3` and `OwnerPremiumProfile`. Owner mode creates one local arbiter only when there is no parent route.

- Photo horizontal → `hero`.
- Photo vertical → `sheet` and direct 1:1 scroll tracking.
- Content horizontal → `tabs`.
- Content vertical → `native`.
- Visitor back → `route`, restricted to the left edge when the gesture starts on the Premium Profile photo.

Pointer cancellation, second-finger input, lost capture, background suspension, unmount and geometry changes terminate or rebase the active owner. Native content scrolling beyond `morphDistance` is never snapped back to the profile header.

## Media

The foreground photo remains one semantic `<img>` with `object-fit: cover` and the saved focal point inside every square/circular profile mask. Adjacent decoded photos provide the horizontal slide without replacing the current source under the finger.

Tapping or keyboard-activating the profile photo opens the existing portal `PhotoViewer`. The viewer retains `object-fit: contain`, original aspect ratio, swipe, zoom and source-morph behavior; Profile V4 does not duplicate or replace it.

## Performance and QA boundary

- No React state updates on scroll/pointer frames.
- Scroll paint is coalesced to one RAF; settle animation is cancellable.
- No moving `backdrop-filter` surface.
- `prefers-reduced-motion` keeps direct tracking and shortens the release settle to its endpoint.
- Browser contracts cannot prove Samsung Galaxy A55 Telegram WebView or iOS WKWebView acceptance; both remain manual next-stage checks.
