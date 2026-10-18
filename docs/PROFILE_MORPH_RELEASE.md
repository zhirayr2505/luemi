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
## Video QA correction · 2026-10-19
- User-provided 10s Galaxy A55 video revealed doubled vertical offset: +112px scroll-container padding and +112px sticky offset. The expanded photograph began too low, while the avatar persisted near the middle of the screen.
- Fixed scroll-container top padding to **0px**, stage sticky inset to **48px**. Result targets an almost identical top Y for open photo and compact avatar immediately below the unchanged LUEMI logo island, without ever animating top/height.
- Eliminated redundant location teaser above «О себе»; the first info card now follows the hero.
- Rebuilt name/city capsule with matching LUEMI Liquid Glass optical layers (rim, backdrop refraction, light glare, themed transparency) without creating a second scroll or timing driver.
- QA acceptance: at scrollTop=0 hero starts under logo, at scrollTop >= travel avatar and glass nameplate stay under logo; no overlay with back or '...' buttons, and no content obscuring UI at end of document.

## Frame inspection follow-up · 2026-10-19
- User supplied expanded and collapsed Galaxy A55 screenshots. In expanded mode, the sticky image's visual top was 48px beneath its layout origin because the scrollport had `padding-top:0`, which made «О себе» sit visually behind the photo. In collapsed mode the Liquid Glass name capsule touched the brand island.
- Set **one shared token** `--profile-header-inset:64px` for **both** the native scroll container's `padding-top` and the sticky stage's `top`. The image and content now occupy the same initial coordinates in normal flow. Photo begins below brand island, with a visible gap. Capsule remains just underneath the header after scroll collapse.
- Keep `profileMorph.ts`, `useProfilePhotoMorph.ts`, single RAF and Liquid Glass capsule unchanged. Slightly rebalance section spacing (8px internal lead, 10px first card margin) to reveal a comfortable gap before «О себе».
- QA: open at scroll 0 (no card/image overlap), scroll slowly up and down (no jitter), inspect fully collapsed capsule/brand vertical separation, test narrow/safe area and dark theme; ask for screenshots if geometry still deviates.
