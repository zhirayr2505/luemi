# LUEMI Stage 03G.2 — Unified Liquid Header

Status: feature branch, validation on CI; Android Telegram visual acceptance pending.

## Architecture
- One persistent `GlobalHeader` lives in `DiscoveryApp` above `discovery-main-panels`.
- The original approved LUEMI W06 raster wordmark is never duplicated in the public/profile panel.
- Fixed visual logo Y anchor uses the existing `--top-safe` token shared by Telegram WebView; header height may vary by profile/browse mode, but the wordmark anchor never changes.
- Browsing modes have Filters/Theme/Saved tools. All three visually merge toward the island under native scrolling. Tapping the island reopens controls at any scroll offset until the user scrolls again.
- Profile mode replaces the toolbar with the one compact theme control beside the logo, a back control for public profiles, and compact identity/location to the left when collapsed.
- Scroll position is owned by native `.fy-scroll`, `.nb-scroll` and `.pm-scroll` elements; top chrome receives scalar motion only.
- `GlobalHeader` owns the photo-to-island overlay. It interpolates the source hero geometry, progressively ovalises into a small droplet, fades into the island, and adds a light, bounded glass pulse. `ProfileMaster` no longer contains a second photo morph/header.
- Scroll updates mutate transform/opacity CSS variables via ref without a React re-render per animation frame. On each morph update geometry is read before animated writes.
- Legacy DemoProfile component and its CSS removed; registration/onboarding W12 flow untouched.
- Reduced-motion fallback removes the droplet effect, retaining functional scroll and layout.

## Regression guardrails
1. W06 wordmark stays at a single exact screen coordinate when switching Discover, Likes, Chats, Owner Profile, and Visitor Profile.
2. In browsing scrollable tabs, scroll down smoothly merges three controls; scroll back up reverses continuously; clicking island opens the tools when collapsed.
3. Revisit the For You/Nearby tab at a deep scroll position: header remains collapsed.
4. On profile, verify hero-photo -> curved droplet -> centered island, and inverse, without clipping at Telegram safe area or a rectangular avatar flash.
5. Profile compact name/age/location appear left of logo; theme icon stays immediately to the right; no duplicate branding.
6. Native carousel, For You nested horizontal rails, profile's five-tab drag, Nearby native vertical scroll, and Viewer pinch all remain independent.
7. Check 360–430 CSS-px widths, long names, local-draft without photo, light/dark, reduced-motion.
8. Verify Galaxy A55 inside Telegram, especially fast flings and toolbar response; target 60 FPS is not a substitute for measured device data.

## Deployment policy
Do not merge into `main`. Merge to `staging/telegram-miniapp-20261019` only when feature CI passes. Render staging service `luemi-stage01` auto-deploys staging commits; never manually re-trigger an already automatic deploy.

## Deferred (requires device/video observation)
Real device rendering/smoothness acceptance; hardware-specific glass/refraction tuning; detailed fullscreen viewer top controls. Do not claim these passed on the basis of code-only checks.
