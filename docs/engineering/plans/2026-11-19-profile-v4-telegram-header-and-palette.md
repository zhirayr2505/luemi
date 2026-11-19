# Profile V4 Telegram header, compact layers and LUEMI palette

## Goal

Make the premium profile use Telegram's system Back Button, align the LUEMI wordmark with Telegram's top controls, keep compact identity/content layers from overlapping, and restore the approved LUEMI rose/coral palette for profile tabs and interests.

## Current state

- `OwnerPremiumProfile.tsx` renders a redundant in-app circular back button.
- `App.tsx` owns Telegram `BackButton`, but only exposes it for registration and the demo Discovery route.
- `RealDiscoveryHome.tsx` owns the real profile route stack without reporting whether it can navigate back.
- `owner-premium-profile.css` places the scroll surface above the compact header and hard-codes the wordmark below Telegram chrome.
- Profile interests inherit the old global multi-hue chip gradients.

## Constraints

- Work only in `fix/profile-v4-final`; do not touch `main` or Render.
- Preserve the single native-scroll Morph geometry, gesture arbiter and photo lifecycle.
- Use existing LUEMI semantic tokens; do not add dependencies or a second navigation owner.
- Keep the wordmark below safe-area/camera insets and preserve 44px touch targets.

## Tasks

1. Remove the in-profile back control and route all profile exits through the existing registered back handler.
2. Let `RealDiscoveryHome` register its current back action only while an internal route is open; let `App` show/hide Telegram `BackButton` from that signal.
3. Move the profile wordmark to the Telegram header row using safe-area-aware CSS.
4. Correct compact stacking so blurred header, avatar, identity and sticky tabs cover scrolled cards in the intended order.
5. Restyle tabs and interest chips with the approved LUEMI rose/coral tokens.
6. Perform a static diff and source review.

## Tests

The owner explicitly requested that the application and tests are not run in this branch workflow. Verification is therefore limited to static TypeScript/CSS inspection and diff review. Physical Samsung Galaxy A55 and iOS Telegram checks remain manual.

## Risks

- Telegram clients decide the exact native Back Button drawing; the app can only show/hide it and provide the handler.
- Safe-area values vary by client, so the logo position keeps a minimum while deferring to the largest Telegram/CSS top inset.
- The compact header occlusion must not create a new stacking context that traps the sticky tabs below it.

## Acceptance

- No circular in-app back button is rendered.
- Opening owner/visitor profile shows Telegram's Back Button; pressing it returns to the prior LUEMI route.
- On the root Discovery feed Telegram returns to its normal Close control.
- Wordmark is centered on the Telegram control row without crossing the safe area.
- Compact avatar, name, city and tabs remain readable while cards scroll underneath.
- Tabs and interest chips use only approved LUEMI rose/coral/dark tokens.
