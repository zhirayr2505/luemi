# LUEMI · Stage 03G.6 — Flicker / dead-code audit

Audit origin: staging SHA `1cef99b08eefc65576b48c01f9c5221415865748`.
Backup: `backup/pre-stage03g6-flicker-audit-20261020`.
Feature: `feat/stage03g6-flicker-audit`.

## Defects found by source inspection (not merely speculated)
1. **Two writers to each moving profile track.** `ProfileMaster.tsx` mutated horizontal photo/tab transforms imperatively on pointer motion AND supplied an independent React JSX `style.transform`. State commits could reset a track during its transition. Removed the inline transform writers; there is now one owner.
2. **Tab layout observer recreated whenever a tab was selected.** The `useLayoutEffect([active,tab])` re-measured widths and re-painted the underline during an in-flight transition. Replaced with stable observer attached only when active changes, and live selected-tab ref for resize.
3. **Scroll-blocking listener attached on the entire profile sheet for every gesture.** Permanent `touchmove: {passive:false}` forced Android to wait for JS even during ordinary native tab scrolling. Registration now occurs per gesture: passive when the touch starts within scrolled tab content, non-passive only at the sheet's edge or when sheet is expanded.
4. **Animated clipped layer hierarchy.** A large transformed sheet containing all five native scrollers plus rounded clipping used `backface-visibility:hidden` layer promotion. Replaced redundant backface hacks with explicit `contain:paint` on the moving sheet and `contain:layout paint` on each native scroll pane. No visual redesign.
5. **Browsing logo chrome painted on every scroll event.** `GlobalHeader` issued multiple DOM mutations per native scroll event. Coalesced to one rAF update, skip unchanged values, and cancel pending browse frames synchronously before profile mode activates.
6. **Verified dead code.** Removed unused `pm-pages-track.is-finger-tracking` CSS (no code ever toggled the class), a never-toggled Blik timer pause branch, and an empty reduced-motion media block.

## Whole-runtime code audit
Added `scripts/runtime-audit.mjs`, executed before UI contracts via `npm run test:ui`.
- Walks all web/api/contracts sources, resolves runtime relative imports including NodeNext `.js` imports targeting `.ts`.
- Reports potentially unreachable source modules.
- Reports CSS selectors without literal source references.
- Asserts no unresolved relative runtime imports.
- Does **not** delete anything on an uncertain heuristic: dynamic CSS classes, public assets, server files and historical regression tests must be preserved until confirmed.

## Regression coverage
- `scripts/stage03g-contract.test.mjs` checks transform ownership, stable tab measurements, passive native scroll and compositor style boundaries.
- `scripts/stage03g6-visual-qa.mjs` loads the real React application in mobile Chromium, captures expand/partial/collapse and visitor states, and asserts horizontal page/underline style mutations remain ZERO on a vertical scroll.
- Preserves existing Profile PhotoViewer / Blik Viewer and all Stage 03G.5 feature tests.

## Verification and deployment rules
1. The exact feature HEAD must pass `npm run check` and the mobile Chromium QA before declaring visual acceptance.
2. If GitHub Actions jobs fail before provisioning a runner (runner_id 0, no steps), that is **not** proof either way. Inspect GitHub Actions availability and do not claim a passing CI.
3. On user-requested staging preview only, a Render auto-deploy after merging can validate lint/UI contract/api tests/build. If it fails, fix on staging promptly, preserving the prior LIVE build and backup reference. Do not touch `main`.
4. Physical Telegram Android Galaxy A55 QA must confirm reduction of square flicker and natural fast swipes; CSS/Chromium tests alone cannot guarantee WebView compositor behavior.

## Out of scope / explicitly preserved
- Registration and onboarding, API auth and security, real Telegram payments.
- Approved W06 wordmark dimensions, full-bleed photo composition, 11% logo overlap, blur synchronization, circular 64px avatar, tabs and public/private projections.
- Old historical design docs and prior QA scripts are not runtime dead code; they remain as regression/reference resources.
