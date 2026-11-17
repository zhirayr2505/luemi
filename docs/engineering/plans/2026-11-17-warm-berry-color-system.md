# LUEMI Warm Berry color refresh

Date: 2026-11-17  
Base: main at 1c4246cc19eca93fac00af004d53a3fdc110bc88  
Branch: design/warm-berry-palette-20261117

## Goal
Make the entire LUEMI Telegram Mini App feel warmer, more colorful and more welcoming instead of gray-lilac, while retaining the established Badoo Purple direction and the dark premium shell.

## Current state
- The shared V5 palette already contains Badoo Purple, Blush, Coral Crush, Honeymoon Phase and other brand hues.
- Everyday secondary and muted text rely on pale gray-lilac values, and several surfaces/glass layers are too low-saturation.
- Chat, Discovery, registration and publication CSS contain local neutral-tinted overlays that dilute the shared palette.
- The index.html browser theme-color still publishes the old deep-purple.

## Constraints
- Keep the original raster wordmark, typography, component hierarchy, layout, Profile Morph V3 and all gestures/motion unchanged.
- No neon, acid colors, bright glow, or unrelated visual redesign.
- Use existing semantic tokens; do not add a UI/theme dependency.
- Preserve the single dark theme, safe areas, keyboard geometry, and Android WebView fallbacks.
- Maintain WCAG 2.2 AA text contrast: at least 4.5:1 for normal text and 3:1 for large text. Color must not be the only status indicator.
- No production data, auth, API, database, RLS, Telegram settings or Render configuration changes.

## Tasks
1. Add a contract for the new warm berry token values, the new Telegram browser theme color and contrast thresholds; verify it fails against the current palette.
2. Refresh the shared semantic tokens: deeper warm-plum backgrounds, richer plum surfaces, warmer light-lilac text, and more visible blush/lavender edges. Keep Badoo Purple and its coral/rose/peach accents recognizable.
3. Re-tune Liquid Glass tints and specular/chromatic accents toward plum, blush and violet; retain existing blur/safe-mode constraints.
4. Harmonize active Discovery, chat, registration, profile and publication surfaces with the shared palette; replace gray-lilac local text/edges with semantic warm tokens where appropriate.
5. Update the browser theme-color and relevant visual contracts.
6. Run focused UI contracts, full UI/source contracts, typecheck, lint and production build; inspect diff for accidental layout/motion changes.

## Tests and evidence
- RED: node --test scripts/moonstone-design-contract.test.mjs must fail on the old shared token values.
- GREEN: the same test must pass after the palette refresh.
- Run npm run test:ui, npm run typecheck, and npm run build in CI or a Node 22.16+ compatible environment.
- Review CSS diffs for unintended geometry, motion, keyboard, safe-area or Profile Morph changes.
- Physical Galaxy A55 Telegram WebView and iOS WKWebView visual acceptance remain manual and must not be inferred from browser CI.

## Acceptance
- Main text is warm white, supporting text is light lilac rather than silver-gray, and muted text is still readable on the darker glass/surface roles.
- App backgrounds and glass surfaces are visibly plum/violet rather than charcoal-gray.
- Badoo Purple remains the primary action hue; blush/rose/coral/peach provide controlled warmth.
- Contrast contracts pass, no neon is introduced, and no layout/motion/auth/backend behavior changes.
