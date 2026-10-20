# LUEMI · Stage 03E — Nearby · Implementation Spec v1.0

**Owner-approved:** 2026-10-20. **Source baseline:** staging/telegram-miniapp-20261019 at 1eb930b.
**Branch:** feat/stage03e-nearby. **Mode:** DEMO only; not real geolocation or a production dating release.

## Approved screen
- Two equal 4:5 portrait tiles per row; image-first Premium Liquid Glass.
- Compact geographic glass header opening the existing shared filters; no new radius slider.
- Image overlays: name, age, city, country flag and demo marker. Below image: exactly one verified shared interest if there is one; omit it otherwise.
- Only extra action: a small glass bookmark linked to existing Feed and For You saved IDs. Tap photo to open existing public DemoProfile.
- Native fluid vertical scrolling from anywhere including image surface. Outside pager ignores Nested Nearby gestures. Full-screen header/underline/lower nav remain untouched.
- Visible items loaded in batches of 8 via IntersectionObserver with manual Show More fallback; image loading lazy/asynchronous.
- Both themes, reduced-motion, robust empty state and no selected city/region state; return preserves list position.

## Honest scope and geographic semantics
- Respect all existing age/gender/goal/language/common-interest filter constraints through filterDemoPeople, but explicitly neutralize fixture's fabricated distance filter before selecting Nearby candidates.
- radius mode: only *declared exact city + country code* matches; the configured 1–5000 km slider is not touched or used to infer demo-person distance.
- country mode: only declared matching country code, if known.
- world mode: all otherwise eligible fictional people, clearly labeled as worldwide rather than nearby.
- Never invent measured kilometre distance, GPS proximity, presence, verification, percentage compatibility, or active users.
- Setting a manually selected location is not proof of physical presence. With no city for radius mode or no country for country mode, prompt user to edit registration.
- Real geo verification / consent / moderation / server-side visibility and filters require a later independently approved backend stage.

## Locked project decisions
- Approved Stage 03 Feed Polish 2 Deck Lift and FeedCard preserved.
- Stage 03D.1 For You, gesture/underline logic, shared public profile/logo, full bottom navigation unchanged.
- Existing radius controls and bounds 1–5000 km unchanged.
- No maps, radar, database changes, real interactions, payments, or shared-element portrait/profile expansion.
- No changes to VEYRA or blotX.

## Validation
- npm run check (UI/discovery contracts, lint, types, builds, API tests).
- In-device Telegram Galaxy A55: portrait-start vertical scroll, bookmarks, opening/closing with exact scroll retention, world/country/city/empty states, tabs and dark theme.
- Render deployment explicitly forbidden before green CI. Production main must remain untouched; manual on-device visual acceptance separate.
