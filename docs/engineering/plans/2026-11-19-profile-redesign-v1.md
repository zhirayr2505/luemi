# LUEMI Profile Redesign V1

## Goal

Replace the signed-in user's current shared V3 profile renderer with a premium photo-first owner profile based on the supplied reference. The owner profile opens expanded, morphs its single main-photo surface into a centered circular avatar from native vertical scroll progress, retains real editing/viewing/photo/settings actions, and keeps visitor profiles, registration, APIs, and user data unchanged.

## Current state

- Base: `main` at `86dbd441`.
- Production route: `RealDiscoveryHome.tsx` renders `ProfileV3Gateway` for both owner and visitor profiles.
- Shared profile shell: `ProfileMasterV3.tsx` owns projection, photo identity, `PhotoViewer`, and nested public preview.
- Shared visitor/owner surface: `profile-v3/rendering/IntegratedProfileV3.tsx` uses a draggable sheet and five tabs; it opens compact by default.
- Existing motion and gesture ownership lives in `ui/motion-controller.ts`, `ui/gesture-arbiter.ts`, and the V3 motion modules.
- The retired A2 implementation is not imported by production routes, but source-contract and QA files still reference it.
- Owner editing is already routed through the real registration editor; account settings are exposed by `RealDiscoveryHome`'s existing account sheet.

## Constraints

- Use the existing Vivid Matte tokens from `ui/luemi-v5.css`; do not introduce another palette.
- No new runtime dependency, database, profile API, media endpoint, or registration change.
- Keep visitor profile behavior and public/private profile projection intact.
- The owner morph has one normalized progress `p` derived from native scroll position. Scroll remains the only vertical gesture owner.
- One foreground photo element remains mounted across expanded and compact states; no duplicate hero/avatar swap.
- Hot-path writes are RAF-coalesced and restricted to the isolated photo mask and related opacity/transform properties. No fullscreen backdrop filter.
- Preserve safe areas, Telegram Back handling, reduced motion, photo aspect ratio, and state of the discovery feed.
- Browser automation is evidence for browser behavior only; physical Galaxy A55 and iPhone Telegram acceptance must be reported separately.

## Tasks

1. Add behavior-first tests for owner morph geometry: expanded and compact endpoints, centered circular compact mask, monotonic reversible scroll progress, safe-area bounds, and preserved photo aspect ratio.
2. Add an owner-only `OwnerPremiumProfile` surface with:
   - one stable photo mask and native scroll container;
   - scroll-linked RAF painter;
   - safe-area back/edit controls;
   - real edit, public preview, photo management, and settings actions;
   - real profile facts and three accessible tabs: Photo / About / Interests;
   - `PhotoViewer` integration through the existing `ProfileMasterV3` owner.
3. Route only `mode="owner"` to the new surface. Keep visitor/preview modes on Integrated V3.
4. Wire direct edit and settings separately from `RealDiscoveryHome`; hide the global wordmark header while the owner profile owns its own top chrome; preserve Telegram/system Back behavior.
5. Add owner-profile CSS using Vivid Matte tokens, limited stationary glass, responsive/safe-area layout, reduced transparency/motion fallbacks, and coarse-pointer target sizes.
6. Update source/UI/motion contracts to exercise the new owner surface and add browser coverage for open-expanded, Expanded → Compact → Expanded, tab controls, photo viewer, and fast repeated scrolls.
7. Remove retired A2 production files and stale selectors only after references are migrated; retain visitor V3 and all shared viewer/projection modules.
8. Run focused tests, typecheck, lint, source/UI/motion/gesture/geometry suites, browser behavior tests, production build, and root `npm run check` where the environment permits.
9. Perform a read-only self-review against this plan and `AGENTS.md`, fix Critical/High issues, then repeat fresh verification.
10. Commit and push the feature branch, create/review the PR, merge to `main`, then verify Render's actual auto-deploy or trigger it only if auto-deploy is disabled. Confirm Live from the service/deploy response.

## Tests

- Red first: `node scripts/owner-premium-profile.test.mjs` must fail because the owner morph geometry module does not exist.
- Focused green: `node scripts/owner-premium-profile.test.mjs`.
- Profile contracts: `npm run test:profile-owner`, `node scripts/stage03g-contract.test.mjs`, `npm run test:profile-parity`.
- Motion/gesture: `npm run test:motion-contract`, `npm run test:gesture-contract`, `npm run test:geometry-contract`, `npm run test:motion-chaos`.
- UI/source: `npm run test:ui`, `npm run test:source-contracts`.
- Static/build: `npm run lint`, `npm run typecheck`, `npm run build`.
- Browser: adapted Playwright owner-profile journey at 393×852 plus existing visitor-profile behavior.
- Final: `npm run check`.

## Risks

- Existing browser scripts assume the owner uses `.v3-int-*`; they must be deliberately migrated while visitor assertions remain on V3.
- Fixed photo chrome can obscure focused content; the owner scroller needs compact-header spacing and `scroll-padding-top`.
- Android WebView may rerasterize a dimension-changing mask; keep it to one isolated layer, avoid moving blur, and inspect frame artifacts in browser recording. Physical-device acceptance remains manual.
- Owner status currently exposes no live online status, languages, verification, or country name; do not invent them.
- The existing editor is a route-level flow. Returning must preserve/refetch owner data through the current application lifecycle, not a new client store.

## Acceptance

- Owner profile opens with the main photo expanded and no intermediate blank/compact state.
- Native downward scroll continuously maps to `p ∈ [0,1]`; at `p=1` the same photo is a centered circle and reverses without a jump.
- All visible actions execute existing real functionality.
- Photo, About, and Interests tabs are keyboard/touch operable and present real projected data only.
- No duplicate photo layer, fullscreen hot-path blur, owner-only data leak, or regression in visitor profile/feed/navigation.
- Automated evidence is recorded at the final commit; physical-device checks are clearly marked RUN or NOT RUN.
