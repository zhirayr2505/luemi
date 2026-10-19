# LUEMI Stage 03 — implementation handoff (03A–03C)

**Date:** 2026-10-19  
**Master approval:** owner explicitly approved Stage 03 Master.  
**Reference:** W12 Passport, W03 approved feed PNG `LUEMI_Feed_Light_v01_APPROVED.png` (SHA-256 `5c4667e85c2432ab555b1d3dec6e887c14587359e9afe259d70e3fb6c9088ecd`).
**Baseline:** `70d0ff71ccdda26699838a36df25a8335e9dbfcb`; recovery branch `backup/pre-stage03-20261019`.  
**Feature branch:** `feat/stage03-discovery-feed`.

## Shipped source (not a mobile visual sign-off)

- App shell: only native Telegram system BackButton; one owner at App, child Discovery reports current back action. No new top back arrow.
- Four global bottom destinations: Discover/Likes/Chats/Profile. Likes and Chats are clearly labeled future features, **not fabricated matches or chats**.
- Three discover tabs: Feed implemented, For You and Nearby labeled future feature until packets 03D/03E.
- Feed card: brand raster centered, city/filter row, 8 genuinely invented illustrated avatars, each explicitly `Демо`. Photos are source-built vector illustrations, NOT images of existing people or real user profiles.
- `PhotoCarousel` reused from registration; horizontal gestures over the picture affect pictures only. Likes and skips only through dedicated buttons. Opening public demo details via name/information.
- Five actions: saved toggle, skip, illustrated special, like, reversible last action. Entirely local React state: **no real likes, records, notifications, payments, Premium or Stars**. Fake unapproved undo quotas are not displayed.
- Basic public demo profile uses existing Flag, InterestChip and photo carousel; returns to the original card and position. Stage 04 remains full profile.
- Glass filter bottom sheet using registered age slider, goal definitions, languages and radius mapping; country/radius/world and common interest modes. Approximate demo distance computed deterministically; never claim it is real measured proximity.
- Adaptive small peek of next card only for tall viewports; hidden when screen constrained.
- Entry from step 8 through explicitly worded `Открыть демо-Ленту`. Real publication remains disabled, and local registration drafts/photos remain intact.
- No backend schema/database changes, no real profile publishing, no secret/external provider added.

## Product guardrails

- Stage 03 first release is strictly a **sandbox demonstration**. Demos never migrate automatically into real events.
- No public account or claimed online presence, fake matches, unread badges, percentages or geolocation inference.
- Preserve native Telegram navigation and reduced motion.
- All Stage 02G UI regression contracts remain in automated CI.

## QA gate before declaring visual acceptance

1. In `@LuemiAppBot` on Galaxy A55, open Registration preview → Demo Feed; reopen, confirm registration draft persists.
2. Check nav in Telegram fullscreen, header centering, bottom safe-area, light and dark theme.
3. In Feed, swipe photo horizontally; must never trigger a like, skip, top-tab change or Telegram close.
4. Like, save, skip, special then Undo; observe transitions and no imaginary real notifications.
5. Filters: age, goals, country/world/radius and language. Empty result and reset.
6. Open demo person via name, return with Telegram system Back and verify card/photo context.
7. Small screen, enlarged font, landscape, reduced motion, offline error states, dark mode.
8. Check precise fit against original W03 PNG; **not yet confirmed**. Visual differences from original reference require user review, especially stylized illustrative temporary demo photos.
9. Repeat on iOS before any production launch.

## Subsequent stages

- Stage 03D: personalized `Для тебя` collections using same components (first demo, then trusted backend).
- Stage 03E: `Рядом` as proximity **feed**, no map/radar, geo-privacy first.
- Stage 03F: full cleanup, mobile visual acceptance, final documentation.
- Actual user registration, moderation, safe photos, interactions, matches and chats require independent backend approvals.
