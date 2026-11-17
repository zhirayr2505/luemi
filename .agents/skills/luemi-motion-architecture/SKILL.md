---
name: luemi-motion-architecture
description: Use whenever LUEMI profile morphing, feed cards, bottom sheets, drawers, photo carousels, tabs, swipe/drag behavior, scroll handoff, or animation lifecycle are changed or debugged.
---

# LUEMI motion and gesture architecture

## Required reconnaissance

Before changing motion, inspect and reuse:
- `apps/web/src/ui/motion-controller.ts`
- `apps/web/src/ui/gesture-arbiter.ts`
- The active component and its existing motion/geometry/gesture contracts.

The arbiter is the single owner of pointer/touch intent arbitration. The controller owns motion lifecycle and painting. Do not add a second writer for the same moving surface.

## Non-negotiable contracts

- Profile Morph V3 uses one progress value in [0, 1], 1:1 direct drag tracking, smooth settle, cancellable animation frames, no rebound, bounded overscroll, and no backdrop-filter work in the hot drag path.
- Preserve independent horizontal photo/tab gestures and vertical page scrolling.
- Handle pointer/touch cancellation, lost pointer capture, second-finger input, unmount, and viewport/geometry changes without stale animation frames or duplicate commits.
- Do not use CSS keyframes for an element that can be grabbed or interrupted by a gesture.
- No React state updates on every pointermove. Use the existing controller/RAF path.
- Keep Android Telegram WebView and iOS WKWebView behavior in scope.
- Respect reduced motion while preserving direct user-controlled tracking.

## Required checks

Run relevant narrow checks, then full project checks when feasible:
- `npm run test:gesture-contract`
- `npm run test:motion-contract`
- `npm run test:geometry-contract`
- `npm run test:motion-chaos`
- `npm run typecheck`
- `npm run build`

Do not claim physical-device acceptance from browser automation. Keep visual tokens and gesture directions unchanged unless the user explicitly approved a design/behavior change.
