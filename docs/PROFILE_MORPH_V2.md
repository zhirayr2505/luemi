# LUEMI · Profile Motion 2.0 · 2026-10-19

Approved user specification: **30% snap threshold**, swipe photos **only while expanded**, **delicate Liquid Glass** frame, image proportions preserved, segment indicators for 1–6 photos. No «Блики» release.

## Geometry and visual behavior

- Photo starts about 14 CSS px beneath LUEMI floating logo header (within the scroll container). Use **normal document flow** for the square hero, not a second sticky square or an overlapping synthetic gap. The first «О себе» card starts after the full hero; the card must never start behind the expanded photo.
- The **same physical `.profile-morph-photo`** is a composited square-to-circle transform, 56 CSS px at the end; the moving child has no extra zoom, so all image content scales uniformly, without moving onto one eye. This is a clipped, framed gallery, not a new avatar bitmap.
- The photo and name/city capsule counteract the scroll position using a single RAF so they remain immediately below the unchanged logo after collapsing. As the reader scrolls farther, the normal-flow details move beneath the compact header.
- A 1.45 CSS px visual rim is maintained by inverse-scaled inner stroke width (`--profile-rim = 1.45 / scale`), plus a subtle refractive interior highlight. No strong neon ring or extra image zoom.
- Native vertical scrolling is the only Y driver. Photo-gallery pointer gestures handle X direction only, with `touch-action: pan-y`, pointer capture, visual following of the finger, resistance at either end and natural snap to the adjacent image. 3 image segments show the sample portrait collection; up to 6 are supported.

## Snap acceptance

- Starting **open**: release at less than 30% -> fully reopen; at 30% or more -> smoothly close.
- Starting **closed**: reverse drag of less than 30% -> stay closed; reverse drag of 30% or more -> reopen. A decisive fast vertical flick also follows direction. Deep scrolling through the About/Interests/Languages panels is not forcibly snapped back to the header.
- One scroll RAF + one cancellable snap animation, no `React.setState` per scroll frame. Snap aborts immediately on the next touch/wheel. `scrollend` with an idle fallback handles inertial scrolling; reduced motion skips the animation.
- Profile changes and unmount release RAF, listeners, timeouts, observer and temporary CSS properties.

## Manual QA required before acceptance

On Samsung Galaxy A55 inside Telegram and in Chrome, test **dark/light**, 360/393px, Android safe areas, fast and slow swipe, reversals at 15%, 30%, 50%, 70%, 100%, tap segment bars, horizontal drag (with photo following finger), vertical scroll on photo and on «О себе», multi-photo first/last edge resistance, photo quality inside the final avatar, 24fps/60fps recordings, profile reopen, OS reduced motion.

**Do not claim production-quality 60 FPS solely from CI and HTTP 200.** Browser/device visual QA remains necessary. No Telegram Stars, real accounts, Supabase, gift, story or «Блики» changes in this commit. VEYRA and blotX untouched.