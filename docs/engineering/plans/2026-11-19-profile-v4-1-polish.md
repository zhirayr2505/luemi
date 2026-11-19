# LUEMI Profile V4.1 — final motion and visual polish

## Goal
Restore the unified rounded overlapping bottom sheet, thin-underlined swipeable tabs, tighter hero identity and right photo pager; refine compact avatar/flag/glow; ensure one identity-bearing photo, bounded elastic pull and consistent interest colors across registration/feed/profile.

## Baseline
Main at cf5d93243b59770cb66438d77813832bf044f913 (2026-11-19); work branch `fix/profile-v4-1-polish`. Shared production component `OwnerPremiumProfile` serves owner and visitor, with `OwnerProfileGeometry`, `GestureArbiter`, `GeometryMotion`, existing `InterestChip`, `Flag`. The existing test `scripts/owner-premium-profile.test.mjs` and Playwright browser test define current contracts.

## Constraints
Keep original raster wordmark, Telegram native back behavior, registration/profile data contracts, actual publication and private media authorization. No added dependency or duplicate motion/gesture writer. Preserve photograph aspect ratio and mounted identity. Respect reduced motion, safe areas and Android WebView. Do not redesign About/Basics/Interests cards beyond theme consistency. Keep production migrations and secrets out of scope.

## Tasks
1. Add regression expectations for new 22px overlap and larger compact avatar; UI source contracts for flag, underlined swipe tabs and shared interest pigments.
2. Adjust `OwnerProfileGeometry.ts`, `OwnerPremiumProfile.tsx` and local CSS to render one full-bleed hero/overlapping rounded sheet, right-side pager and lowered label; use `Flag` only for valid country codes with textual fallback.
3. Preserve existing GestureArbiter ownership. Keep native vertical scroll and direct 1:1 photo drag; add bounded overpull and cancellation-safe short elastic settle in direct DOM painting. Preserve horizontal tab swipe and keyed pane identity.
4. Remove legacy indexed interest recoloring so `InterestChip` palette is sourced only from `InterestCatalog`.
5. Check focused source and geometry contracts, typecheck, relevant motion tests, browser test and root checks when runtime permits. Review final diff against baseline.

## Acceptance
Expanded sheet overlays hero with curved corners, indicator right, lower identity, tabs underline only (tap / horizontal swipe), no white edge flicker on slow morph, compact avatar enlarged + subtle image-driven glow, city + circle country flag, bounded elastic pull and soft release, identical interest color for an ID everywhere.

## Risk and verification
Changing CSS stacking can hide hero interactions, tabs or system buttons. Image blur can be expensive on Android. Test at 360, 393, 430 px and landscape, both owner and visitor, reduced-motion, gesture interruption, and physical Android/iOS Telegram separately. Static/CI/browser emulation are not physical-device acceptance.
