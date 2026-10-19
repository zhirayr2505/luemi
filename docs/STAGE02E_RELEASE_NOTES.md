# Stage 02E release facts and boundaries

**Source of truth:** owner-approved Stage 02E master specification (2026-10-19), W12 Passport sections 25.11–25.17.

## Scope delivered in feature branch
- One intro only, in-place title and CTA with reserved logo size and verified raster loading; auth remains HMAC-protected on server.
- Entire legacy registration component and stylesheet replaced with modular components, no additional CSS override heap.
- Header/footer fixed by flex shell; scrolling restricted to content; VisualViewport adjustment for keyboard.
- Light/dark theme with small radial accent rather than an expensive View Transition snapshot; reduced-motion.
- Glass choices/text inputs/checkboxes and accessible SVG arrows/icons.
- Strict name filtering, birthday 18+ check, age range slider, 15-interest cap, 750-codepoint bio.
- Geography results are chosen IDs, not loose text; country flag and city icons; toggle worldwide on step 3. Geoapify optional private server API key. Geo lookup fallback: **seven sample verified cities only**, no worldwide coverage claim.
- Photo sorter using pointer hold (275ms), numbering and first photo primary label; no HTML5 draggable on photo slots. A true swipe-follow/snap carousel shared by both profile and feed-card previews.
- Explicit local-only draft and no real publishing.

## Deployment boundaries
- Approved: feature branch, automation checks, staging deployment to dedicated `luemi-stage01` on Render Free.
- Not approved: production `main` switch, destructive migration, payment service, production users.
- Source backup ref `backup/pre-stage02e-20261019` points to pre-change staging.
- Acceptance only after owner tests Android Galaxy A55 inside Telegram, plus independent iOS/AA/security checks before production.

## Known remaining work
Actual globally exhaustive geocoder requires confirmed key/provider policies; real draft persistence and moderation; true feed/profile production views (preview currently rendered from shared local components); server-side verification of all submitted profile and location data; keyboard/capture gesture QA on device.
