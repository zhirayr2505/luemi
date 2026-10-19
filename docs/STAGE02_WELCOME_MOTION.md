# LUEMI · Stage 02B · Welcome & startup motion · 2026-10-19

## What changed
- Genuine startup preparation waits for the **decoded existing W06 LUEMI raster wordmark**, browser font readiness, and **server-verified Telegram initData** before opening the welcome screen.
- Startup progress is **honestly indeterminate**, not a fabricated 0–100% animation; network/image preparation has a 15-second abort and a retry screen if unavailable.
- The intro uses slow, soft lavender and blush **CSS light fields** drifting independently in 22/27-second cycles. The static base remains even when motion is disabled. The W08 BG-01 approved SVG is a *reference board containing labels*, not an unmodified production wallpaper; it is not placed under working UI.
- The brand wordmark **is not re-typeset or vectorized**. A low-opacity 12-second inner shimmer is masked to the **same exported W06 alpha raster silhouette** in supporting browsers, with static fallback.
- Logo and text enter with a brief subtle fade/rise; in `prefers-reduced-motion` and `prefers-reduced-data` the continuous effects stop.
- On registration screens all approved positions for **header logo, progress strip and bottom arrows remain identical** to Stage 02A. Animated light fields are paused on forms for comfort and battery savings.

## Safety
- Feature work is isolated from `main`. No database migrations, no payments, no photo uploads or publication.
- The current onboarding remains a local-only preview, not released registration.
- Stage 01 bot identity validation and secured webhook are unchanged.
- No unverified image or animation assets introduced; only runtime CSS and the existing wordmark file are used.

## Acceptance required
- CI: lint, TS, tests and Vite build.
- Confirm Render Staging deploy and bot startup.
- Manual in-Telegram Android check of the actual motion, real load transitions, dark mode, reduced motion, text contrast and keyboard after start.
- Exact original W04 raster/approved background-derived production assets and pixel comparison remain open, do not call this final visual master.
