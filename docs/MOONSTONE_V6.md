# LUEMI — Moonstone V6

The single approved visual system for LUEMI. Soft Plum V5 is retired as a
palette. Existing shared component class names such as `luemi-v5-glass`
are intentionally kept as API compatibility names so chat/profile modules
do not break. The palette and visual behavior behind them are V6.

## Source of truth

`apps/web/src/ui/luemi-v5.css` supplies semantic tokens:

| Role | Value |
| --- | --- |
| App background | `#1B2025` |
| Deep canvas | `#171B20` |
| Base card | `#2B3037` |
| Raised content | `#363D45` |
| Slate glass | `#3A4149` |
| Active muted slate-lavender | `#665F74` |
| Primary lavender | `#B6A4C8` |
| Silver-lilac | `#D5C8DD` |
| Primary text | `#F2F3F5` |
| Secondary text | `#B3B8C2` |

The production theme is dark. Do not reintroduce pink, neon, colored
backdrops, or inconsistent page-level design palettes. Reuse semantic
variables from the theme where possible.

## Layer hierarchy

1. **Content / photo / scroll layer:** solid or quietly translucent slate
   surfaces. Photo cards use the approved cinematic gradient and Profile
   Morph V3 gesture geometry; no moving pixel-by-pixel backdrop sampling.
2. **Floating interaction layer:** genuine browser backdrop sampling on
   persistent bottom/top navigation, chat header/composer, static category
   panels and modal sheets. The same surfaces have multi-stop translucent
   gradients, edge caustic highlights and depth shadows.
3. **Optical interaction:** `moonstone-optics.ts` delegates a single
   primary pointer, moves the specular hotspot through CSS variables, batches
   pressed-only updates via RAF, and cleans up all listeners.
4. **Reduced transparency / old Telegram WebView:** solid graphite
   gradients preserve readability when browser blurring is unavailable.

This is a high-fidelity cross-platform **web** approximation of the optical
behavior of Apple's native Liquid Glass; it does not claim to use proprietary
iOS UIKit shaders. CSS backdrop-filter works for live pixels behind the
glass. No external shader package is installed because the added frame
cost, version conflicts and inconsistent Android WebView behavior outweigh
the benefit.

## Unchanged by design

- Original wordmark at
  `apps/web/public/assets/brand/wordmark_original_raster_alpha_W06.webp`;
  never render a text replacement, recolor it or move its safe-area anchor.
- Profile Morph V3 drag/settle, Feed B photo-card drag, native scrolling,
  registration focus dock and the Android keyboard safe-area calculations.
- All production accounts / data / backend / paid Stars behavior.

## Checks

Run `npm run test:ui`, `npm run typecheck`, `npm run build` and
`npm run check`. The Moonstone contract checks every active CSS file for
forbidden V5 color literals, malformed alpha syntax, accessible contrast,
native Telegram theme-color parity, and static-only live backdrop sampling.
Existing browser suites cover Android/ iPhone viewport sizes.

On physical Samsung A55 Telegram WebView and iPhone WKWebView, additionally
verify keyboard open/close, fast photo swipe, long For You scroll, chat
composer and reduced-transparency settings before considering the UI
subjectively pixel-perfect.
