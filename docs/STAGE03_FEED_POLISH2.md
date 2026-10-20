# LUEMI Stage 03 · Feed Polish 2 — implementation and image credits

Owner approved 2026-10-20. Source branch `staging/telegram-miniapp-20261019` at `8c80955c38b379a2fb6432c637f45df316112d49`; snapshot `backup/pre-stage03-polish2-20261020`.

## Implemented

- System Telegram BackButton retained. Wordmark ~10% smaller and moved close to native Telegram chrome without adding an overlapping custom back action.
- Three icon-only Liquid Glass actions (filters, theme, saved), separated from wordmark.
- Active-tab indicator correct inverse finger direction, page follows gesture, independent photo-carousel swipes.
- One-screen Feed; shared card photo-progress retains full width; current profile leaves with a 255ms Deck Lift / next rises from below, without live likes.
- First/next demo card preview only on suitable height; **no story bars on preview** until active.
- Top-left Demo tag, top-right fillable bookmark. Save removed from bottom action row; remaining separate buttons are Undo, Pass, Special, Like with Like largest.
- Name without arrow, small yellow crown for test Premium, goal right of name, suppress undecided goal in Feed and public profile.
- Three interests + N; color variables match the existing registration catalogue. N opens a native-style glass bottom sheet instead of the profile.
- Public profile: right swipe outside photo closes to Feed; on photo swipe continues to advance images.
- Bottom nav is pill-shaped standalone Liquid Glass matching card width, with only active icon+label color. No active-box background.
- Six **fully fictional adult women** for demo; no real membership, matches, chat, Stars or notifications.
- Old action array, styles, gesture paths and stale UI contracts replaced in place; no duplicated CSS overlays.

## AI-generated reference portraits (Staging only)

The six photorealistic stock portraits below are identified by their creators as **AI-generated** and are used only for local demo display, not as photographs of real LUEMI members. Temporary testing source URLs and fallback illustrations are declared in `apps/web/src/discovery/demo-people.ts`. Every fixture has two visual crops of the same reference image to exercise the photo carousel while preserving identity consistency.

Source pages (Pixabay Content License; check restrictions before any production distribution):

1. https://pixabay.com/illustrations/ai-generated-woman-portrait-9246846/ — ArtfulColorWorks
2. https://pixabay.com/illustrations/ai-generated-woman-portrait-9541651/ — tshagoryt
3. https://pixabay.com/photos/ai-generated-woman-portrait-asian-10046459/ — artisanbatik
4. https://pixabay.com/photos/ultra-realistic-portrait-10109677/ — Atal07
5. https://pixabay.com/photos/ai-generated-woman-model-face-8439990/ — Sinousxl
6. https://pixabay.com/photos/ai-generated-woman-beauty-face-8331057/ — DigitalArtWorkHRO

License overview: https://pixabay.com/service/license-summary/

**Caveat:** these images load from Pixabay CDN at runtime. They are subject to external network accessibility, and the local SVG fallback will appear if loading fails. They are NOT ready for permanent production use. Obtain explicit reuse review or self-host approved synthetic originals for launch.

## Manual acceptance

CI proves code/build contracts only. Galaxy A55 / Telegram QA remains necessary:
1. Wordmark between native Telegram header controls without overlap.
2. Header buttons visibly separated yet compact; dark/light contrast and safe-area.
3. Card, slightly overlapping glass action buttons and navigation island fit one viewport without vertical scrolling.
4. Next-card slice exists only with space and contains no photograph progress indicators.
5. Card action Deck Lift and undo: no double click or white flash.
6. Interest colors from registration; sheet opens/closes from +N; undecided goal hidden.
7. Top-tab indicator always moves toward target as page follows finger.
8. Rightward swipe outside profile photos navigates back; swipe on photos changes only photos.
9. Synthetic portraits load across 4G and when offline fallback SVG is used.
10. Demo flags/settings remain isolated from real users and private data.

No Supabase or real user server actions were introduced. `main`, VEYRA and blotX untouched.

## 2026-10-20 · Galaxy A55 video corrections / Motion v2

Approval: user explicitly approved correcting all observed motion and navigation defects, with an extra constraint: next-card actions **start appearing together with the next profile during its lift**, never after the card arrives.

Working branch: `fix/stage03-motion-v2-20261020`, recovery `backup/pre-stage03-motion-v2-20261020` at `a3bf178d594984fe8b6e2d41eb16bed1532d7de2`.

Corrections:
- Replaced old short rectangular `.discovery-card-overlay` gradient with a single full-height `.discovery-card::after` scrim. Image to bottom stays continuous; dark text area and action area merge without a hard horizontal edge.
- Queued card shows only a shallow photo peek: photo story bars, save icon, info overlay and all four action buttons are hidden. During `.deck-entering` those elements start the **same ~290 ms animation** as the incoming photo and reach final opacity together. Old standalone buttons/overlays were not reintroduced.
- Enlarged Glass action buttons around 10% for normal-height screens; trimmed overly expensive blur/saturation to reduce Telegram WebView compositing load without removing Liquid Glass.
- Deck state commit now listens to actual **outgoing animationend**; a 440ms fallback only covers throttled/reduced-motion execution. No fixed 290ms DOM swap before CSS finishes. Existing full keyed FeedCard remains single source of photo, text and actions.
- Profile right-back swipe now moves only `.discovery-profile-swipe-surface` with finger, while the outer modal layout remains fixed and its inner scroll remains native. Photocarousel gestures are excluded. Below threshold returns smoothly; above threshold slides away.
- Global-tab panels became absolute within a stable constrained stage. This prevents Feed's flex height from changing on Chats/Discover and reduces logo/viewport hopping.
- Shared PhotoCarousel memoized so unchanged images do not rerender/repaint on unrelated navigation or theme state.
- No production `main`, Supabase, VEYRA or blotX edits, no real user interactions.
- **Device signoff still pending**. Review deck exit/entry under rapid tapping, long captions, dark/light contrast, hidden next card controls, profile right-swipe tracking, vertical scroll and image swipes, Chat→Discover 10 repeats, image load over 4G.
