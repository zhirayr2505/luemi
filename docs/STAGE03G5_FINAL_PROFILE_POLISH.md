# LUEMI · Stage 03G.5 — Final Profile Polish

**Release state: feature branch only.** Current production main and staging remain untouched until verification completes.

## Approved visual behavior
- W06 wordmark floats over the portrait, with no background capsule.
- White panel stops overlapping the bottom 11% of the *rendered wordmark image*, respecting Telegram chrome, never scrolling name under native controls.
- 34px upper corner radius remains constant during movement and after collapse.
- Upper exposed portrait gently blurs via **one already blurred active-photo copy with animated opacity**. Image framing matches the hero photo; the original photo never disappears.
- The logo gets a precisely aligned shadow/contrast copy. Contrast tracks the sheet's **same progress**, with no delayed timer, moving wordmark, or double label.
- Compact theme switch is attached to the logo row beside letter i.
- Circular avatar is 64 CSS px, with the existing tap-to-expand / authentic active-Blik routing.
- Old photo bars are replaced by tiny centered dots beneath the logo; one highlighted elongated dot.
- Profile tabs align icon + text horizontally, without filled active cards. Color and 3px underline carry active state; native horizontal rail scrolls when widths exceed viewport.
- Title, location, avatar, owner actions and tabs stay fixed while only active tab content scrolls.
- After returning tab content to scrollTop=0, one distinct subsequent downward gesture reopens the photo. Large photo still opens PhotoViewer.

## Architectural cleanup
- Consolidated old overlapping CSS for the hero, tab bar, profile sheet and photo pager into single authoritative rules.
- No border-radius animation on a large scrolling/translated panel; only translate3d drives sheet movement.
- One shared progress controller drives sheet, blur, and logo contrast via CSS variables and direct refs, no React renders per scroll frame.
- Removed redundant horizontal pager resets on vertical touch releases (a concrete cause of flicker).
- Cached tab geometry in ResizeObserver; dragging no longer reads offsetLeft/offsetWidth or changes ink width each frame.
- Photo blur is clipped to hero, with a constant 11px filter applied to only the active image; transition only opacity.
- Persistent massive will-change is removed from the five-page strip; horizontal track gets it only during active finger tracking where needed.

## QA / release gates
- Run npm run check on **exact** feature head.
- Run scripts/stage03g5-visual-qa.mjs using actual Vite/React page at 393x852, also test 360x780.
- Capture expanded, 25/50/75%-held swipe, collapsed, tab-scrolled, reopened, dark 360px, visitor, dots.
- Verify shared progress math, safe icon/name separation, 64px avatar, unfilled horizontal tabs, unique photo capsule, PhotoViewer close, tab scroll pinning.
- Inspect JPEG artifacts directly for rectangular GPU glitches or offscreen content.
- Inspect on Galaxy A55 inside Telegram; renderer QA is not a substitute for physical device QA.
- Only after clean CI and visual checks, merge feature into `staging/telegram-miniapp-20261019`; verify Render auto-deploy is Live. Do **not** touch `main`.

## Runner availability caveat (2026-10-20)
Recent GitHub-hosted Actions jobs at the feature head currently fail **before runner allocation** (`runner_id: 0`, `steps: []`, no executable logs). This does **not** validate or invalidate application code. Do not merge under a falsely green label; confirm Actions spending/billing limits or GitHub runner availability, then rerun both workflows without paying or changing account settings without user approval.

## Backup
`backup/pre-stage03g5-profile-polish-20261020` points to staging SHA `1add2a7ecd5048b2d155e2b181041901592e846d`.
