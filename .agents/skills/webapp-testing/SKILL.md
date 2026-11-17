---
name: webapp-testing
description: Use when validating LUEMI's React/Vite UI, Telegram Mini App flows, visual states, responsive layouts, browser errors, or user journeys with Playwright. Apply for UI regressions and before visual-facing PRs.
---

# LUEMI web app testing

Use the project's existing Node.js Playwright setup. Do not add Python Playwright, Selenium, Cypress, or another browser framework unless a concrete gap is documented and approved.

## Reconnaissance before interaction

1. Read the relevant route/component and existing contract tests.
2. Start from existing browser test scripts and npm scripts in the root `package.json`.
3. Inspect the rendered app and DOM before choosing selectors. Prefer accessible roles, labels, and stable test IDs over brittle CSS selectors.
4. Capture console errors, page errors, failed requests, screenshots, and exact viewport.
5. Exercise the real user path; don't replace real app behavior with mocked UI when the requirement is end-to-end.

## LUEMI commands and boundaries

- Run `npm run test:ui` for UI contract coverage when relevant.
- Run `npm run test:browser:behavior` only when its environment and fixtures are available.
- Run `npm run typecheck` and `npm run build` after source changes.
- Use isolated synthetic fixtures. Never sign in as a real user, publish a profile, send a message, trigger a paid action, or mutate live user data without explicit authorization.
- CI/browser automation is not a physical-device test. Do not claim Samsung Galaxy A55 Telegram WebView or iOS WKWebView acceptance without an actual device run and recorded evidence.

## Mobile acceptance matrix

For gestures and profile surfaces, verify:
- 390px-class mobile viewport and actual supported device dimensions.
- Safe-area and Telegram chrome: close/menu controls remain reachable and original LUEMI wordmark is not covered.
- Scrolling is inertial and does not fight horizontal tabs or photo swipes.
- Expanded profile sheet tracks a finger 1:1 and can be interrupted mid-settle.
- Keyboard appearance does not cause viewport jumps, hidden buttons, or broken input focus.
- No duplicate photo surfaces, missing faces, blank tiles, flicker, or stale images.
- Reduced-motion behavior is respected.

## Reporting

For every browser check, record the command, viewport/device emulation, test count, failures, console/page errors, screenshots/artifacts, and whether the check was browser-only or physical-device QA. Mark unrun checks explicitly as NOT RUN.
