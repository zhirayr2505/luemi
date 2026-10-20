# LUEMI · Stage 03D — For You (demo-only)

Status: implementation candidate; owner approved concept 2026-10-20.
Base: feat/stage03-feed-polish2 at 344c08ba. Branch feat/stage03-for-you.
No changes to accepted Feed transitions, layout, bottom navigation or Nearby placeholder.
No Render/Supabase actions, no live profiles, matches, online statuses or payments.

## Screen
- Expressive, responsive romantic Premium Liquid Glass hero and CTA to recommendations.
- Vertical scroll only within For You, preserving header and bottom navigation.
- Evidence-based best-recommendations carousel and eight approved topical directions.
- Every row offers vertical 4:5 portrait tiles and context-aware labels, or an honest empty state.
- Horizontal galleries stop pointer propagation to discovery's outer pager. Main discovery tabs retain native swipe navigation elsewhere.
- See all opens a two-column full collection; native Telegram BackButton unwinds profile, settings, and collection.
- Manage categories: hide/show, favorite, reorder; preferences stored locally with validation.
- Shared saved-person IDs with Feed and Saved sheet, and shared public DemoProfile.
- Photo thumbnails and SVG synthetic faces are only demo content. Existing Feed's six AI portrait references and transitions untouched.
- 10 additional distinct original SVG illustrated adult fictional users are used only by For You, with 2 consistent photos per person. Combined 16 people in recommendations.
- No fabricated percent compatibility; "online" and "new" collections show honest explanatory empty states.
- Other sections derive actual overlap from profile interests, stated goals, languages and selected city; no GPS coordinates or real activity inferred.
- Responsive light/dark design, reduced-motion preference, lazy media loads.

## Scope locks
- Scope/radius issue (W12 up to 1000km versus Stage02F up to 5000km) deliberately unresolved.
- Stage 03E Nearby is still untouched.
- The recommendation "24h refresh" will be implemented when the trustworthy backend pipeline, moderation and actual users are authorized. No artificial daily changes in the demo.
- Test and device QA needed before final visual sign-off. Do not claim beta/live readiness.

## Acceptance
Run npm run check and view on Galaxy A55 Telegram, both themes and reduced motion.
Validate horizontally scrollable portrait rows vs discover pager, return from profile to same scroll location, saved profiles from both sources, empty states, category management persistence, small screen readability, no mutations in Feed. 

## 2026-10-20 · Integration with current staging

The previously developed branch diverged from staging, which contains 22 newer feed and motion commits. This integration is based on staging HEAD `ef765d1`, preserving `FeedCard.tsx` and all 22 newer commits, and importing only isolated Stage 03D components and narrowly-scoped DiscoveryApp wiring. Full QA and staging visual acceptance remain separate gates. No real data, geolocation, payments, or Nearby features added.


## Stage 03D.1 — Smoothness & Gesture Polish · owner-approved 2026-10-20
- Top tabs and underline follow the finger without flashing; compositor variables updated once per animation frame, no React setState on pointermove; cancelled gestures do not commit a page change.
- Public full profile shows the unchanged original LUEMI centered wordmark, with demo badge on left and close action on right.
- Vertical scrolling must originate over For You portrait photos and coexist with horizontal carousel gestures and tap-to-open.
- Keep Premium Liquid Glass; use memoized For You and show at most six tiles per visible carousel, with full sets via See All.
- Feed Polish 2, its animation engine, radius, and Stage 03E Nearby unchanged. Shared-element photo-to-profile transition explicitly deferred.
- GitHub CI and Galaxy A55 in-Telegram visual acceptance required; avoid claiming verified FPS before measurement.
