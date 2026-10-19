# Stage 02C — Launch / Telegram fullscreen / pinned brand (19.10.2026)

## Video evidence
Reviewed the complete 66.87-second Android screen recording (`1000068614.mp4`). Key checkpoints:
- 0.00–2.00s shows Telegram native four-square preloader; from ~2.25s local LUEMI intro until ~2.75s. Branded intro is too short.
- Registration step header logo and gradient progress strip scroll off-screen on long content (e.g. ~46–50s, ~60–65s).
- Full Telegram white top bar remains. At ~10–24s/46–50s the fixed footer overlaps editable content when keyboard visible.
- Photo picker at ~55–57.5s has four selected by 57s, while the subsequent mosaic and step-8 preview show no selected images. **Investigate** (do not assert import failed until actual picker completion gesture verified).
- Flat control surfaces need more translucent/inner-reflection layering, subject to performance/contrast checks.

## Decision on loader spec conflict
W12 §10.1 forbids artificially extending actual resource loading. The owner's new request is for a visually present 1.5–2s launch.
Solution: call Telegram ready on first shell paint (don't extend the white Telegram native preloader), keep a **minimum 1.8s brand introduction** (not a pretend load), and show an indeterminate progress stripe only while real image/fonts/Telegram auth are incomplete. No invented percentages, no fake work.

## Changes
- Stage 01 server/HMAC preserved.
- Soft branded introduction min 1.8s, no artificial API/network waiting; welcome-to-registration transition 280ms (skipped under reduced-motion).
- Best-effort Telegram WebApp.requestFullscreen for API >=8.0; expand fallback; app theme colors set.
- Account for Telegram system/content safe area variables; ensure launch content stays away from top controls.
- Sticky, actual glass-coated brand header containing existing raster wordmark and existing gradient stripe; separate scrolling step heading/body.
- Subtle liquid reflections on existing controls; positions/dimensions of the bottom circular arrows unchanged.
- No Supabase mutations / payments / public profiles.
- Known next task: keyboard viewport/footer overlap and photo picker import investigation; do not claim fixed yet.

## QA gates
Run GitHub CI, type checks, unit tests, smoke. Render staging only after CI passes. Confirm bot connectivity.
Manual Galaxy A55 QA still needed for fullscreen availability, safe-area insets, scroll-to-end sticky header, keyboard gestures, load duration, and glass rendering; no unverified 60fps claims.
