# Premium Profile V4 handoff

Profile V4 is implemented on `fix/profile-v4-final`. It is intentionally not merged, deployed, built or executed in this stage.

## Active paths

| Path | Role |
| --- | --- |
| `owner-profile/OwnerPremiumProfile.tsx` | One owner/visitor profile surface, one normalized scroll progress, endpoint settle and photo/tab gestures |
| `owner-profile/OwnerProfileGeometry.ts` | Square expanded hero, compact circle, phase geometry and endpoint selection |
| `owner-profile/owner-premium-profile.css` | Approved LUEMI composition, centered original wordmark, pager, sticky tabs and cards |
| `ProfileMasterV3.tsx` | Real projected data, permissions and the existing `PhotoViewer` portal |
| `VisitorProfileRoute.tsx` | Visitor route/back motion |

## Next-stage verification

Run the commands reserved in `docs/engineering/plans/2026-11-19-profile-v4-final.md`, then validate Samsung Galaxy A55 Telegram WebView and iOS WKWebView before merge.

- 0, 1, 3 and 6 photos; portrait, landscape and square sources; saved focal points.
- Slow/fast expand and collapse, release throughout the morph, reversal during settle and second-finger cancellation.
- Switch every tab while compact with short and long content; the avatar and sticky header must not move.
- Horizontal photo swipe, horizontal page swipe, vertical content scroll and left-edge visitor back.
- Telegram fullscreen changes, `viewportChanged`, safe-area changes, background/restore and reduced motion.
- Open/close `PhotoViewer`; confirm its `contain` rendering and source return ID.

No browser emulation or static contract replaces physical-device acceptance.
