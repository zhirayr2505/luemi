---
name: luemi-telegram-webview-qa
description: Use when validating LUEMI in Telegram Mini App, Android WebView, iOS WKWebView, safe areas, keyboard behavior, navigation gestures, media, or device-specific rendering.
---

# LUEMI Telegram WebView QA

## Test layers

1. **Static/contracts:** source contracts and type checks.
2. **Browser automation:** existing Playwright/Node scripts and reproducible viewport/device emulation.
3. **Physical device:** Telegram app on Samsung Galaxy A55 (primary Android acceptance target) and iOS WKWebView where available.

Always label which layer was actually run. One layer does not imply another.

## Device acceptance checklist

- Telegram top chrome does not overlap close/menu controls or the original LUEMI wordmark.
- Fullscreen layout, safe-area insets, and bottom navigation remain correct.
- Scrolling is inertial and does not fight horizontal tabs or photo swipes.
- Profile expansion/collapse follows touch continuously without jumps.
- Keyboard appearance does not cause viewport jumps, hidden buttons, or broken input focus.
- No missing, split, duplicated, stale, or incorrectly cropped profile photos.
- Back navigation and edge-swipe behavior remain consistent.
- Reduced-motion and error/loading states remain usable.

## Evidence and safety

Record device model, OS/app context when known, test build/commit, exact steps, result, and video/screenshot references. If no physical device is available, report physical QA as NOT RUN. Never represent Playwright's mobile emulation as a real Telegram WebView test. Do not use real user accounts or production write actions without explicit approval.
