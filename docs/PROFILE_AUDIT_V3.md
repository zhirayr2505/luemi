# LUEMI — Profile motion architecture audit / v3

## User video reproduction (1000068556.mp4)
The 11-second Android capture shows compact profile text drifting under the LUEMI logo, a snapped photo expanding partly over content, sudden Y jumps and rapidly changing positions after releasing and reversing. The errors existed in both Light and Dark themes.

## Root causes fixed
1. **Competing Y owners:** `useProfilePhotoMorph` v2 wrote `scroller.scrollTop` every `requestAnimationFrame`, while native momentum scrolling continued. It simultaneously listened to `pointerup`, `scrollend` and debounced `scroll` (110ms), causing multiple snaps, reversals and flicker.
2. **Feedback Y compensation:** a full-size hero lived inside the scroller, and its `translateY=scrollTop` (plus compact panel translateY) fought natural scroll and GPU/compositor page motion. In a Telegram WebView, layout/visualViewport changes compounded this.
3. **Header repaint:** `LiquidLogo` moved optical glare on every `scroll` event (including the profile), causing extra layer repaints and the illusion of a bouncing glass island.
4. **Conflicting style history:** profile was changed through incremental `.content.profile-detail`, sticky, normal-flow, inverse-scroll overrides. The v3 single `profileMotion.css` replaces all profile geometry and namespaced selectors. Old `.profile-detail` rules are not used.
5. **X swipe double ownership:** a gallery had inline React transforms plus direct DOM transforms and captured pointers before direction selection. v3 keeps one imperative strip writer and captures only after horizontal intent.

## New architecture
- `.profile-detail-root` (stable flex child) contains sibling `.profile-detail-scroll` and `.profile-morph-overlay`. The overlay is **outside the only scrolling element**, anchored below the unchanged LUEMI header. It does not translate vertically; the compact panel never gets translated.
- `.profile-hero-spacer` is a 1:1 aspect-ratio normal-flow reservation, so the `О себе` card begins AFTER the expanded image. The photo uniformly shrinks into a 56px circle via compositor `scale`; thin Liquid Glass border compensates for scale.
- One passive scroll listener calls one queued requestAnimationFrame to set photo transform, border radius and opacity. The rAF **never changes scrollTop**.
- Native `scrollend` fires after finger momentum finishes and triggers a **single browser-native** `scrollTo({behavior:'smooth'})`. When snapping, a subsequent scrollend acknowledges completion without another snap. No JS scroll animation and no overlapping timer-driven snaps. An idle fallback runs only where `scrollend` is unsupported.
- Other app features (SlideDeck, onboarding, chats, live data, Supabase, payments) unchanged. Bliki remains documented only.

## Automated acceptance
- Unit tests assert 30% open / 70% return threshold, end size, rim thickness, monotonic/reversible scale, deep-scroll never snaps.
- GitHub Actions: Node22, TypeScript check, unit tests, Vite build, HTTP smoke.

## Device visual QA STILL REQUIRED
Galaxy A55 inside Telegram: open profile, slow drag 20%, 35%, 75%; reverse with and without releasing; open and close after multiple X photo swipes; scroll below three cards and back; dark theme; app viewport resize; no flicker/cross-over/bounce. Source code checks and browser screenshots do not prove 60 FPS on the physical device.