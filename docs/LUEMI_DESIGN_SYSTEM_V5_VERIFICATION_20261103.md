# LUEMI Design System V5 — implementation and verification

Date: 2026-11-04
Branch: `feat/luemi-design-system-v5`  
Base: `main` at `c93d61d3`
Current remote head: `395ca5728bd8cdbb326d8334fae08c00db7cc389`

## Implemented

- Added a single semantic Soft Plum token layer for application backgrounds, surfaces, glass, text, borders, state colors, focus, radii, shadows and motion.
- Added shared V5 primitives for glass panels, icon buttons, avatars, segmented tabs, empty states, reduced-motion loading skeletons and the four-item bottom navigation.
- Kept the approved original raster wordmark `wordmark_original_raster_alpha_W06.webp`; no generated or text replacement logo is used.
- Reworked the discovery card information order to name/location/goal, About, Interests and actions. Compact mode exposes two interests plus `+N`; expanded mode exposes all interests.
- Reworked the discovery glass, tabs, buttons, header clearance and bottom navigation to the approved muted plum/rose language without neon.
- Reworked the real chat list with dark glass rows, search, real unread counts, real last-message data, avatars, empty/error states and server-honest category availability.
- Reworked the open thread with dark incoming and muted rose outgoing bubbles, media blocks, delivery/read state, stable history anchoring, composer safe-area behavior and hidden global navigation.
- Connected the thread to Telegram BackButton and the application's existing back routing without creating a second viewport controller.
- Applied V5 surfaces to registration, account/settings, Profile Morph V3 accents, post-publication feed/report dialogs and the publication journey.
- Unified loading, error and empty states across discovery, collections, likes and the unpublished-profile route; removed legacy placeholders and decorative emoji from production controls/statuses.
- Removed decorative infinite motion and bright glow from the active V5 shell/publication path. Loading spinners remain state-driven.
- Preserved existing authentication, profile, photo, match, chat, message, deletion, report, RLS and private-media contracts. No database migration or production data mutation was made.

## Shared UI roles

- `LuemiGlassPanel`
- `LuemiIconButton`
- `LuemiAvatar`
- `LuemiSegmentedTabs`
- `LuemiEmptyState`
- `LuemiSkeleton`
- `LuemiBottomNavigation`
- Existing `FeedCard`, `PhotoCarousel`, Profile Morph and chat transport/domain components were retained and restyled instead of duplicated.

## Changed source areas

- `apps/web/src/ui/LuemiV5.tsx`, `apps/web/src/ui/luemi-v5.css`
- `apps/web/src/discovery/FeedCard.tsx`, `GlobalHeader.tsx`, `RealDiscoveryHome.tsx`
- `apps/web/src/discovery/feed-glass-v1.css`, `global-header.css`, `real-discovery.css`
- `apps/web/src/discovery/profile-morph-a2.css`, `profile-v3/rendering/IntegratedProfileV3.css`
- `apps/web/src/chats/RealChats.tsx`, `apps/web/src/chats/chats.css`
- `apps/web/src/registration/v2/runtime.css`, `real-home.css`, `real-live-feed.css`, `publication-journey.css`
- `apps/web/src/App.tsx`, `apps/web/src/main.tsx`
- UI contract scripts and `package.json`

## Server-honest limitations

- Chat categories “Блики” and “Архив” are visibly disabled with explanatory hints because the current server contract does not provide those collections. No fake behavior was added.
- Online state, active Blik state, distance, reactions, calls and video calls are not fabricated when the backend does not provide them.
- No schema or RLS change was required.

## Verification results

Passed:

- ESLint.
- TypeScript for contracts, API and web.
- V5 UI contracts, registration visual contracts, private-account contracts and real-discovery contracts.
- Discovery, geo, photo-header, viewport, Profile Morph parity, motion, geometry, gesture, lifecycle, photo-viewer and startup contracts.
- Deterministic gesture/motion chaos test: 100,000 gesture operations and 50,000 motion operations.
- Chat domain/media/gate and identity/RLS contracts.
- API suite: 186/186 passed in the first complete run.
- Production web build and the dedicated `VITE_LUEMI_REAL_ONLY=1` build; the normal Vite build transformed 1,700 modules and the real-only build transformed 1,694 modules successfully.
- `git diff --check`.

Observed infrastructure constraints:

- `npm run check` stops at the strict architecture audit because the existing API import cycle `config.ts -> matches-api.ts -> telegram-webhook.ts` is already present in the untouched backend. V5 does not add an import cycle.
- Root staging smoke cannot start Fastify in this workspace's Node 24 runtime because `uv_interface_addresses` is denied by the container. The repository declares Node 22, but Node 22 is not installed in this workspace.
- One repeated API suite run transiently failed `rem05e-audit` with zero HTTP probes; the same test immediately passed in isolation 5/5. The earlier complete API run passed 186/186.

## Visual and device acceptance

No screenshot is presented as accepted evidence in this change. The local production bundle could be served, but both available browser paths were blocked by the execution environment: the cloud browser cannot reach the local server and system Chromium cannot create its process-singleton socket. An authenticated Telegram session with real profiles and chats is also unavailable in this workspace.

Therefore the required real screenshots at 360/390/412 CSS px, keyboard-open thread capture, direct reference comparison, physical Samsung Galaxy A55 test and iPhone Telegram WKWebView test remain outstanding. No emulator result is described as a physical-device result.

## Production readiness

**Not approved for production deploy yet.** The code is ready for review and a Telegram staging/device visual acceptance pass, but must not be merged or deployed until the required real screenshots and physical-device checks are completed and reviewed.
