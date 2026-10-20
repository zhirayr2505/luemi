# LUEMI Stage 03G.4 — Adaptive Profile Sheet

## User-approved behavior
- The W06 LUEMI logo floats over a full-bleed portrait; it has no capsule.
- The white, rounded profile sheet starts over the bottom of the image.
- A vertical upward swipe moves **the whole sheet** into the top of the viewport.
- The sheet then fixes name, age, location, goal, owner actions and profile tabs.
- Only the selected tab's content gets its own native vertical scroll container.
- After scrolling a tab back to scrollTop=0, **a separate downward gesture** lowers the sheet to reveal the portrait again.
- At the upper right of the fixed identity block, a circular thumbnail fades in; tapping it reveals the portrait again.
- No liquid photo-to-logo effect and no extra rectangle with duplicated name/city near the logo.
- Tapping the big photo opens the existing fullscreen image viewer with pinch, swipe, next/previous and close.
- The avatar gets a violet ring and opens a full-screen Blik only when a **published, unexpired HTTPS story** is provided by the server. Demo/local drafts must not fabricate active stories.

## Technical mechanism
- Two sheet states: `expanded` and `collapsed`.
- The entire sheet moves with a single translate3d compositor transform `--pm-sheet-y`.
- The main portrait remains mounted and never fades to a blank gradient.
- Touch events are registered on the sheet with a nonpassive touchmove handler. A gesture started with tab scrollTop>0 cannot expand the sheet, even if the gesture reaches the top.
- When collapsed, each tab page has independent native overflow scrolling and preserved scrollTop. Tabs and identity never participate in vertical page scrolling.
- The fullscreen viewer is a modal portal and is not affected by the sheet transform.
- Photo selection and horizontal profile-photo/tab swipes remain isolated.
- Existing private/public projections are enforced. A Blik must originate from a server record and be unexpired. Full Bliki publishing, replies, multi-story sequence and moderation belong to the dedicated Bliki stage.

## Acceptance gates
1. Chromium 393x852: expanded and collapsed shots, active tab content swipe without moving identity/tabs, second swipe to reopen.
2. Tap mini-avatar to expand, tap portrait to open fullscreen viewer, exit cleanly.
3. Owner and visitor share exact single-logo screen coordinate and full-bleed portrait.
4. Test 360px width, dark theme, empty photo and reduced motion.
5. Physical Telegram Android Galaxy A55: check native scrolling, flicks, safe-area and back; **do not claim production-grade smoothness until this passes on device**.

## Release safety
Work on a feature branch from staging, perform GitHub Actions and Chromium QA, merge to staging only. Production `main` remains untouched. Restore from the pre-03G4 staging SHA if visual behavior fails acceptance.
