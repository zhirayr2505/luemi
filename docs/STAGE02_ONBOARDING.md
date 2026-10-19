# LUEMI · Stage 02A · 2026-10-19

Source of truth: W12 Brand Master, approved round 15B §25.11.

## Implemented in preview code
- Replaces Stage 01 technical card with the approved separate soft-mist welcome.
- Uses existing unaltered W06 raster derivative for the LUEMI wordmark (not fake font). Exact W04 canonical PNG still to import.
- Eight distinct React registration steps: editable Telegram name + staging notice; age 18+ date validation and gender; manual geography and radius; partner preferences and age range; a clearly provisional catalogue with 15-selection ceiling; short bio/languages; local photo mosaic 1+5 with browser-only previews and photo ordering controls; read-only preview.
- Thin registration progress bar, two round arrows, Telegram native BackButton, safe areas, light/dark/system UI, reduced-motion fallbacks.
- Client tests for calendar and age checks. Auth continues to use verified Telegram initData on server.

## Safety boundary
This is NOT real registration: entered text and photo object URLs are held in React memory ONLY for the open Mini App session. No storage of birthdate or photos in public/private Supabase is performed. Nothing is published or uploaded. Refresh/close will discard it. No misleading fake moderation status. The final button is disabled until server-side registration, 18+ enforcement, moderation, binding to verified user ID, authenticated drafts and terms/privacy documents are ready.

Country autocomplete, reverse geocoding, and location button require a future approved provider; currently manual input only. The interest catalogue, gender option wording, exact text limit and age slider implementation are provisional, NOT founder-approved finalized variants. Mobile drag-and-drop needs device QA; accessible reorder controls work as fallback. Preview shares draft components, but final published Stage03 profile is not yet available so "exact real profile" remains outstanding.

## Release approach
Commit on feat/stage02-onboarding-v1, GitHub CI. Only fast-forward staging branch after CI success; no main/production or Supabase changes. Owner must review on Galaxy A55 inside @LuemiAppBot.
