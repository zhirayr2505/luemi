# LUEMI Premium Profile V4 Final

## Goal

Replace the current partially independent owner-profile scroll, photo and tab motion with one shared owner/visitor profile implementation whose expanded photo is always square, whose Telegram-style morph always settles at an endpoint, and whose tabs remain stable across content and viewport changes.

## Current state

- `OwnerPremiumProfile.tsx` is already shared by owner and visitor modes, but it hand-rolls photo and tab gestures instead of participating in the shared `GestureArbiter`.
- Native `scrollTop` is mapped directly to morph progress, but there is no release settle. Any intermediate scroll position is therefore a stable visual state.
- `OwnerProfileGeometry.ts` deliberately creates a portrait hero below a fixed top offset and an intermediate centered square. That explains the grey top strip, non-1:1 expanded crop and detached intermediate rectangle visible in `1000070412.png` and `1000070411.mp4`.
- The logo is hard-positioned at the left and retains the source raster colour. The approved feed treatment is a centered white rendering of the original raster.
- Tab-content height changes are repaired after render by forcing `scrollTop`; the repair is coupled to changing `scrollHeight`, so a short tab can reopen the compact avatar.
- `PhotoViewer.tsx` already renders the full original with `object-fit: contain`; it must remain the viewer authority.

## Constraints

- Preserve real profile data, APIs, owner permissions, visitor restrictions and the existing `PhotoViewer`.
- Reuse the original LUEMI wordmark and existing LUEMI tokens; no new design system or dependency.
- One normalized morph progress and one sheet motion owner. No React state on pointer/scroll frames and no `backdrop-filter` on the moving photo.
- Keep native vertical content scrolling after the compact endpoint and keep photo/tab/route gestures mutually exclusive through `GestureArbiter`.
- Do not merge, deploy, start the app, run Render, CI, tests, typecheck or build in this task. The owner explicitly reserved all execution and final verification for the next stage.

## Tasks

1. Add behavior contracts for square geometry, phase ordering, velocity-aware endpoint selection and stable compact layout independent of tab content height.
2. Rework `OwnerProfileGeometry.ts` so the expanded mask is `width × width` at the top content edge, compact geometry is safe-area-aware, and every intermediate mask remains square.
3. Rework `OwnerPremiumProfile.tsx` around one `MotionController("sheet")`, one imperative painter and the shared `GestureArbiter`; add interruptible endpoint settling and lifecycle cancellation.
4. Keep one foreground image identity, focal-point `cover` crop and existing adjacent-photo preload/track; make photo and page gestures claim `hero`/`tabs` through the arbiter.
5. Replace the profile CSS geometry with full-bleed square photo, centered white wordmark, feed-style photo capsules and one sticky tab panel.
6. Pass the existing visitor-route arbiter through `ProfileMasterV3`; owner mode creates one local arbiter only when no parent arbiter exists.
7. Remove the `scrollHeight`-dependent compact pin workaround and document the new V4 writer/gesture ownership.
8. Perform a read-only self-review of the diff and commit only the scoped source, contract and documentation changes to `fix/profile-v4-final`.

## Tests

Tests are written first in `scripts/owner-premium-profile.test.mjs` and the existing motion/gesture source contracts are updated for the new architecture. Intended next-stage commands:

```sh
npm run test:profile-owner
npm run test:gesture-contract
npm run test:motion-contract
npm run test:geometry-contract
npm run test:motion-chaos
npm run typecheck
npm run build
```

Expected result: all commands exit 0. They are intentionally not executed in this task.

## Risks

- Native Android scroll cancellation order differs from desktop pointer order; `scrollend` requires a timer fallback.
- Telegram viewport resize can arrive mid-settle; geometry rebase must preserve the semantic endpoint without reading tab content height.
- A full-bleed square reduces the natural tab travel distance. The sticky stop and morph endpoint must stay derived from the same geometry.
- Physical smoothness and native chrome colour cannot be accepted without the Samsung Galaxy A55 and an iOS Telegram test.

## Acceptance

- Expanded photo is full-bleed 1:1 and uses focal-point `cover`; the viewer remains full-format `contain`.
- Original wordmark is centered, white and safe-area-aware.
- Phase A keeps the photo square; Phase B rounds/shrinks it; Phase C moves the circle to the compact center.
- Releasing anywhere in the morph settles to expanded or compact using position and velocity; a new gesture interrupts the settle.
- Tabs are one element, become sticky below compact identity, and changing tabs never changes avatar progress.
- Owner and visitor use the same component; owner-only actions remain owner-only.
- `main` and production remain untouched.
