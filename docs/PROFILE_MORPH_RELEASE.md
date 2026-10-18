# LUEMI · Profile photo morph / release acceptance

Scope of this release: animated **expanded ↔ collapsed profile**, approved W12 Soft Glass styling unchanged elsewhere. «Блики» are documented but **not implemented**.

## Implementation contracts
- A **single physical portrait node** morphs into a 56px circular avatar. There is no swapped duplicate image, so no square flash during threshold crossing.
- `.profile-detail` is the sole native vertical scroller; no additional scroll wrappers or scroll locks. A `position:sticky` stage keeps the portrait anchored to the same upper coordinate while content moves below.
- One passive `scroll` listener, one pending `requestAnimationFrame` per visible frame, one `ResizeObserver`; all removed on component disposal. Scroll event never invokes React `setState`.
- Pure `morphFrame(scrollY, width)` is deterministic and reversible at each offset: dragging down reopens the exact same trajectory. Scroll-linked easing is not an elapsed-time animation.
- Only compositor `transform` on photo/image and `opacity` on text during scroll; `border-radius` changes are paint-only, not geometry/layout. No CSS height/width top/left modifications during frame. No layout read per scroll frame.
- Reduced-motion setting and OS preference switch directly between endpoints. No transition applied to the morph image, caption, or compact text.
- The Telegram header island and BackButton remain separate and untouched. Original registration preview uses its existing approved static layout.

## QA gates for Samsung Galaxy A55 inside Telegram
- Open both own profile preview and another person's profile; expanded image contains no overlap with LUEMI logo/header.
- Finger scroll up slowly, rapidly, stop mid-motion and reverse direction repeatedly; **no jerk, stutter, blank/square flash or overlap**. Check at 30%, 35%, 50%, 95% and 100% of collapse range.
- At collapse: circular avatar 56px with preserved center crop, legible name and city. Continue scrolling «О себе», interests, languages with normal native scroll.
- Pull down: the same photo expands; no reset/jump and no new images flashing into view.
- Switch tabs away/back, use Telegram Back, reopen same/different profile. Check dark theme, safe-area insets, narrow screens, Android software nav, landscape rotation, and reduced motion.
- Accessibility: profile name remains accessible, text contrast and button hit targets at least 44px, no phantom focus on offscreen pane.

Automated tests verify progress bounds and reversibility. **Physical 60fps and screenshot pixel parity cannot be claimed without on-device QA.**