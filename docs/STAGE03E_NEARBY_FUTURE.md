# LUEMI · Nearby Discovery 2.0 — approved direction / deferred implementation

**Captured:** 2026-10-20 (owner feedback after Stage 03E visual approval).
**Status:** PRODUCT DIRECTION RECORDED; engineering details not yet approved.
**Code:** no changes in this documentation branch.
**Current accepted demo:** Stage 03E two-column photos, shared favorites, basic filters, no maps/radar, no fabricated distance.

## 1. Global nearest-first
When a person selects "Весь мир", the catalog should **prefer genuinely nearby eligible profiles first**, then progressively show more distant profiles as the user scrolls. The global search mode has no radius cut-off; the local mode retains the **current 1–5000 km radius unchanged**. This is a sorting preference, not permission to reveal coordinates. Eligibility, age boundaries, user blocks, moderation, mutual visibility/consent, and other mandatory filters execute *before ranking*.

Implementation gate: verified/reasonably derived and consented location data, server-side geospatial index / coarse regional coordinates, privacy-safe distance calculation, hidden-distance preference, and a fallback when the user's location is unknown. Never use the old demoDistanceKm hash or imply that declared city is verified location. Final ordering behavior for users who do not consent to location, and ties within the same city, need owner decision.

## 2. Full-featured shared filters
Future filter sheet should offer combinable toggles / controls including:
- **Only Premium**: real active server-side entitlement, not a fictional badge.
- **New this week**: verified server-created or approved profile timestamp within the last rolling seven days; do not infer from photo age or recent edits. Whether registration or profile approval time defines "new" needs a final decision.
- Only verified: genuine verification status, not invented.
- Only online: only accounts whose privacy choice permits visible online state.
- Existing age, audience, language, shared interests, goals, city/country/world and unchanged radius, including combinations.
- Clear chips for active filters, reset, no-results guidance, never silently relax mandatory filters.
- Additional advanced filters can be discussed at a dedicated product phase; do not include fake or nonfunctional switches in current demo.

## 3. Progressive server page fetching and smooth scroll
The existing demo batches eight *already available local fixtures* using IntersectionObserver; that is UI pagination, not true network pagination.
For production, add cursor-based server pagination with consistent stable ordering (distance or other permitted rank, tie-breaker by ID) and filtering done on the server. Fetch the next page **before** reaching the end (adaptive prefetch ~1–2 viewports), initially targeting ~8–12 profiles per page subject to profiling. Deduplicate across page boundaries, prevent duplicate concurrent requests, ignore stale responses after filter changes, preserve viewed list and scroll anchor while appending, use correctly sized lazy images and a bounded DOM/virtualization for long lists. Slow/offline state should keep visible results, show light inline skeleton/retry and never freeze or clear the whole catalog.

Performance acceptance includes real-device Galaxy A55 Telegram WebView profiling; do not claim stable 60fps without measuring. Free Render server RAM alone does not determine scroll animation FPS.

## 4. Release placement and locked scope
- **Stage 03E** remains visually approved, demo implementation complete; these features are not blockers for it.
- **Stage 03F**: technical stabilization, responsive QA, performance measurements, registry/project status and stage sign-off without redesigning accepted layouts.
- **Stage 04**: owner-approved full profile design (including separately deferred shared-element photo expansion). Do not conflate with real geo backend.
- **Future dedicated stage, suggested Stage 05/Backend Discovery** (stage number to be ratified): real geospatial privacy/consent, backend sorting and filtering, real accounts and reliable infinite scroll. Requires explicit owner sign-off, Supabase/backend architecture review, test data privacy work and full client/server QA before implementation.
- Do not modify original LUEMI logo, Feed Polish 2 / Deck Lift, For You, Stage 03E visual design, current radius 1–5000km, production main, VEYRA or blotX.

## 5. Questions to settle in the future, not now
- How to sort for users who deny geolocation (self-declared city or neutral order)?
- Is new a registration within seven days, an approved profile within seven days, or both?
- Premium tier entitlements and badge visibility semantics.
- Exact search location privacy buckets, refresh frequency, geospatial anti-scraping limits and radius semantics.
- Server cursor design, cap and retry strategy once realistic scale is measurable.
