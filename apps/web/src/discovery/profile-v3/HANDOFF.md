# Profile Morph V3 handoff — foundation only

Baseline: `main` c8c3399ca278ca9772560a40537d53363f086c28. PR #87 was draft and excluded. Prototype is accessible only at `/profile-v3-preview.html`, a separate Vite document. No real route or data was changed.

## Integration order

1. Review prototype DOM and movement on actual Samsung Galaxy A55 in Telegram Android WebView. Compare compact and expanded screens to the supplied reference; the current synthetic rendering is only a composition check. Fix device artifacts before routing real profiles.
2. Implement a typed adapter from `projectProfile(data, mode)` to `ProfileSurfaceData` after checking photo publication rights. Preserve `visitor`, `owner`, `preview`, `local-self-preview`, draft handling, photo IDs and fallback. Obtain actual intrinsic photo dimensions. A missing or broken photo gets a stable placeholder.
3. Put the single V3 surface behind a temporary isolated profile entry; keep route Back and GlobalHeader owners outside the surface. Define the one owner of each animated property before wiring horizontal gestures. Do not leave A2 and V3 mounted together in the same profile.
4. Connect `PHOTO` to the existing gallery state, `TABS` to existing tab state with follow finger ink, `ROUTE_BACK` to `VisitorProfileRoute`, and native scroll to tab content. Preserve `PhotoViewer` and its permission, source morph, and return photo ID contracts. Test all handoffs.
5. Replace the active A2 entry only after real device approval. Remove obsolete A2 code and stale tests in the same integration PR. Verify registration, Discovery, lower nav, Bliki privacy, RU/AM, themes, sessions and RLS remain untouched.

## Existing file disposition at integration

| Existing file | Action later | Reason / consumers |
| --- | --- | --- |
| `ProfileMorphA2.tsx` | Replace | `DiscoveryApp.tsx`, `VisitorProfileRoute.tsx`; current JSX, A2 gesture writers and viewer bridge |
| `profile-morph-a2-motion.ts` | Delete after replacement | A2 engine and tests; V3 engine takes its role |
| `profile-morph-a2-geometry.ts` | Delete after replacement | A2 nonuniform geometry; V3 pure layout replaces it |
| `profile-morph-a2.css` | Adapt then delete A2 selectors | profile cards/sections still used by A2 JSX; preserve approved visual assets when integrating |
| `ProfileMorphBackground.tsx` | Replace or adapt | A2 two slot blurred backdrop; V3 static backdrop now, actual photo backdrop later only if measured |
| `profile-motion.ts` | Keep/adapt | route and browse consumers; remove only unused profile capabilities after ownership audit |
| `gesture-arbiter.ts`, `motion-controller.ts`, `motion-lifecycle.ts` | Keep/adapt | PhotoViewer, route and Discovery still use these contracts; do not globally delete |
| `VisitorProfileRoute.tsx`, `DiscoveryApp.tsx`, `GlobalHeader.tsx` | Adapt | replace entry import and add explicit gesture handoff; preserve header and route behavior |
| `PhotoViewer.tsx`, `ProfileModel.ts`, `modal-layer.ts` | Keep | rights, viewer source and modal/focus contracts |
| `discovery.css` | Adapt | route compositor styling and backing need A55 verification; no broad removal |
| `scripts/profile-morph-a2.test.mjs` and A2 visual tests | Replace once V3 integrated | tests currently guard A2 and should not validate V3 by proxy |

## Tests and open risks

Foundation test: `node scripts/profile-v3-foundation.test.mjs` covers seven viewports, a keyboard height approximation, aspect ratios at 0/17/36/58/82/100%, drag, release, rapid reversals, stale RAF, resize, pointer cancellation and dispose. Typecheck: build contracts first, then web typecheck. Browser smoke command: `node scripts/profile-v3-browser-smoke.mjs`; requires installed Playwright Chromium and a running Vite server. If unavailable, report it as not run. CI or Chromium can never substitute for A55 approval.

Open: actual A55 compositor and frame pacing; mask width/height paint cost; crop focus for arbitrary portraits; media decode/failed URL; other gesture owners are planned only; PhotoViewer integration; safe area/Telegram viewport event bridge; reduced motion on real host; visual comparison to reference. No claim of production readiness follows from foundation tests.

## Full next stage matrix

- Photos: 0/1/2/3/6, slow network, broken URL, slow decode, change/delete active, return from Viewer by photoId, deny visitor access to draft and pending.
- Sheet: taps, both drag directions, stops at 10/20/40/60/80/95%, rapid reversal, tab switch and route exit mid settle.
- Tabs: all five, follow finger indicator, native vertical and horizontal gestures, short/long content, both ends and index restoration.
- Lifecycle: Telegram open/close/background, rotation, safe area and `viewportChanged`, keyboard, theme, reduced motion, repeated mounts, React StrictMode, system Back.
- A55 acceptance: 10 slow and 30 fast expand/collapse, 20 photo swipes, 20 tab switches, interrupted scroll, repeated route entry/exit, screen recording, Discovery card behind route, zero visual artifacts. Measure p50/p95 RAF interval and dropped/long frames inside Telegram WebView when instrumentation is available.
