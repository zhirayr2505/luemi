# LUEMI 💜 · Stage 03G — Profile Master

**Implementation date:** 2026-10-20  
**Base:** `staging/telegram-miniapp-20261019` at `c0dd00a597a53ae5af4c028aede59d8355439236`  
**Feature:** `feat/stage03g-profile-master`  
**Backup:** `backup/pre-stage03g-profile-master-20261020`  
**Owner-approved visual reference:** `1000068661.png` from the supplied handoff ZIP. Composition only: not a shippable portrait/brand/OS asset.

## Current architecture and screen ownership

- `ProfileModel.ts`: typed, explicit allow-listed projection of `ProfileMasterData` into `ProfileView`, with `owner` / `visitor` / `preview` permissions. The view-model drops hidden, rejected, draft, and pending photographs for nonowners. Local fixtures and local draft never receive fabricated Premium / verified / joined / photo timestamps / stable account identifiers.
- `ProfileMaster.tsx`: one React tree for visitor overlay and owner main nav, reused recursively in private public-preview mode. Keeps hero, collapse, current photograph and all five content pages mounted across tab changes.
- `PhotoViewer.tsx`: portal-owned full-screen photo, source rect animation + fade fallback, keyboard / native Back integration, 1×-reset two-finger pinch/pan, single-finger left/right and vertical dismiss. Real server-dependent actions provide explicit unavailable explanations instead of false success.
- `profile-master.css`: scoped premium shell, light/dark inherited from LUEMI variables, 3-column photos, gifts-demo treatment, reduced-motion.
- `DiscoveryApp.tsx`: replaces the minimal owner stub with the ProfileMaster; opens the SAME component for 16 fictional visitor cards across Feed / For You / Nearby / saved. Existing Deck, filters, cards, radius and virtualized Nearby/For You components stay unchanged.
- `App.tsx`: passes only locally decoded photos to the *owner* draft projection; never publishes them.
- `scripts/stage03g-contract.test.mjs`: pure projection/privacy, source-level gesture/navigation/safety contracts, included in `npm run test:discovery` and CI.

## UX specifics

1. **Hero**: original fixture / local-draft photo and separate text overlay, top photo progress bars, horizontal photo following finger. Real Premium and verification would require a trusted server value, currently false.
2. **Collapse**: screenshot is not used as a photo. A background layer with the SAME photo URL transforms from the source hero's *layout* origin to 54px round avatar at left; stable range defined from hero geometry. A short snap around 33% of that fixed range; no screen-wide animation state updates on scroll.
3. **Tabs**: `О себе`, `Блики`, `Фото`, `Подарки`, `О профиле`. Sticky strip, icon+label, horizontal swipes follow finger on compositor, active underline follows, all pages remain mounted, page height cannot abruptly drop beneath the bar.
4. **About**: renders filled allowed fields only (goal omitted when undecided, bio, interests, languages). Blank optional data is not invented.
5. **Блики**: intentional visually complete *empty state* only; full product mechanic is open and isolated in `docs/STAGE03G_BLIKI_FUTURE.md`.
6. **Photos**: 3-column grid of visible photos only, no arbitrary general post-registration six-photo limit in the view model. Viewer opens at tapped photo, shows exact date only when supplied, otherwise “Дата добавления недоступна”. Owner main photo change is guarded and currently unavailable for a local unpublished draft.
7. **Gifts**: an explicitly tagged demonstration of pinned teddy + three gift examples, **not** balances, transactions, entitlements or real gifts.
8. **Profile meta**: dates, IDs and verified status only from trusted model; demo data says values not available. Visitor cannot edit, see hidden photos or alter photo order.
9. **Owner**: edit goes back to the existing local registration draft (not an invented server editor). “Глазами других” opens the same renderer with public-only filtration; returning should leave owner scroll state intact.
10. **Nested navigation**: photo actions/menu → viewer → preview/public profile → Discovery, retaining Telegram native BackButton. Dedicated photo handler closes menu first.

## Engineering guardrails / non-goals

- No Supabase schema, server registration, moderation mutation, permanent user data, gifts, Premium, LUME, payment, verified status, deep link generation or deployed production code was introduced.
- No external photos copied from the 12-panel reference. LUEMI original raster remains unchanged.
- Existing `PhotoCarousel.tsx`, `FeedCard`, `ForYou`, `Nearby`, Deck Lift and radius 1–5000 km remain unchanged.
- Source-level and CI checks do **not** prove 60fps, Android GPU compositor correctness, accessibility certification, or faithful visual geometry in every Telegram WebView. Stage 03G requires a separate Galaxy A55 manual acceptance video.
- `DemoProfile.tsx` (legacy) and its CSS rules were kept for old regression-contract compatibility but are not used for the active visitor route. Remove only in a later audited cleanup after updating historical regression contracts.

## Validation / manual sign-off checklist

Automated: GitHub Actions runs `npm run check`, including UI contracts, Stage 03 discovery tests, 03G model tests, eslint, API/WEB TypeScript, tests, builds and smoke. Treat the **last feature commit's** CI as authoritative, not an earlier green run.

On Galaxy A55 Telegram Android WebView, manually verify: 360–412 logical px, light/dark, narrow/small height, hero swipe vs vertical profile scroll, 30–35% collapse/reopen and circular avatar without square ghost, tab flick with each of 5 labels visible/readable, switching long/short panels at collapsed state, grid → fullscreen → back to exact tile, pinch/pan → 1×, dismissal up/down, own preview protection, back stack, reduced motion, saved location after back, modal-safe-area and no white flash while flinging. Capture a short recording before approving merge/deploy.

## Release gate

1. Fix ALL feature CI failures. 2. Only after green feature CI inspect diff and optionally promote via reviewed staging PR / merge. 3. Deploy staging Render, then obtain owner video for final profile-animation acceptance. 4. Production `main` remains untouched.
