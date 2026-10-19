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

## 2026-10-19 · Stage 02F · Premium registration revision
- Sequential glass wordmark shimmering and compact header theme control, no duplicate Telegram system back button.
- New keyboard scroll bounds, hidden (not elevated) footer during text entry and inset input focus.
- Geo-first location picker, alternative verified manual search, radius/country/world mode, nonlinear 5000km range.
- Six illustrated goals, 10 rich interest categories + pinned selected panel, searchable 60-language catalogue with 66 MIT circular SVG flags.
- Rewrote photo drag with client-viewport portal, animated FLIP rearrangement, auto-scroll, accessible movement; replaced old tabbed preview with one complete profile and single edit button.
- Removed obsolete CSS selectors, old gesture implementation and previous goals/worldwide fields; staging only.

## 2026-10-19 · Stage 02F.1 feedback polish
- Removed bright repeated raster-mask logo glow; compact bare theme icon and raised wordmark.
- Thinner inner focus rings, helper annotation on filtered name chars, transparent WebKit tap highlight.
- Non-scrolling interest category bar, high-contrast selected interests; compact geo/audience screens.
- Bio textarea shortened, languages displayed as three-across search results with flags-only chosen row; profile languages flags only and goal badge stronger.
- Removed photo reorder arrow overlays, replaced with keyboard Alt-arrow fallback, real local FileReader progress and transient completion check.
- New device-local registration restoration across Mini App opens, including IndexedDB-backed photo File objects and explicit reset control.

## 2026-10-20 · LUEMI Stage 03 Feed Polish
- Approved visually: full-height single-screen demo discovery interface (not scrolling), compact icon-only filter/theme/bookmarks, elevated central logo, full-width photo-progress bars, expanded photo and overlaid bio/info/goal/Premium/chips and five independent Liquid Glass action buttons with largest heart.
- Tab content and indicator now track horizontal finger movement. Photo gesture remains isolated, not like/pass. Dedicated Saved overlay.
- Removed obsolete discovery scroll region, location/filter row, below-card facts and detached actions, replaced old CSS in-place rather than layering. Original Stage 02 registration untouched.
