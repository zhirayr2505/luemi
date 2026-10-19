# LUEMI Changelog

## 2026-10-19 · Stage 02A registration interface (PREVIEW)
- Separate W12-inspired soft-mist welcome, non-blocking mobile user flow.
- Replaced test screen with eight explicit interactive registration steps.
- Added date-of-birth calendar and age 18+ validation, simple profile field checks, 15-interest ceiling.
- Added manual geography and radius selection, partner preferences/age range, bio/languages.
- Added local browser-only photo mosaic 1+5 with mobile reorder controls and drag/drop desktop fallback.
- Added preliminary profile review shared with draft data, disabled publication action.
- Added Telegram BackButton handling; preserved signed Telegram bootstrap.
- Added unit tests for age/date and interest limits; GitHub CI passed for feature head d365dd32.
- **Not yet implemented:** saving drafts to backend, photo moderation, publish, true shared Stage 03 profile, actual compliant consents/geocoding.

## 2026-10-19 · Stage 02E premium UI replacement (PREVIEW)
- Recreated glass design tokens and registration primitives, replaced old stylesheet.
- Sequential brand→headline→CTA, native Telegram shell safe-area layout, low-cost circle theme pulse.
- Accessible gradient checkbox, Lucide SVG icons, 21 gradient interest chips grouped by colored icon categories.
- Worldwide flag relocated to geo step, validated location IDs and optional Geoapify search/reverse proxy.
- Unified range preference, typed 750-character bio, name normalization and validation.
- Pointer long-press photo order + main badge, swipe-follow carousel and two-mode preview.
- No production data touched. Further mobile acceptance required.
