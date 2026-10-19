# LUEMI · Profile v5

## Implemented

- The circular photo rim is part of the single persistent hero image. CSS scroll-timeline fades it in as the image shrinks; the separate fixed 56px rim layer and its fallback opacity writer are gone.
- The five profile tabs use equal-width labels, an opaque Soft Glass rail, and one scroll-timeline-driven glass indicator. Native horizontal scroll snap and IntersectionObserver remain the motion owners. Panel height is shared by stretch instead of active-panel resize writes.
- The shared `PhotoViewer` is a fullscreen native `<dialog>` for both gallery tiles and taps on the expanded hero photo. It supports native photo snapping, a live counter, keyboard navigation, direct-transform zoom/pan gestures, vertical dismissal, an accessible action sheet, sharing/copying, and existing report/block dialogs.
- The About tab now uses real profile facts, the viewing user's interests, and real photos. It includes an optional common-interest card/message, photo mosaic, and link to the Photos tab. Empty Bliki and Gifts cards have three decorative empty placeholders and retain their approved copy.
- The existing profile CTA now lives in a safe-area-aware bottom action bar outside the vertical scroller. The scroller has matching bottom room so the last card remains reachable.

## Mobile browser measurements

At 393×852 in mobile/touch-emulated Chromium, the closed marker was 307px from the open marker. The tab-root snap area was aligned to that same closed position while retaining `scroll-snap-align: start`. Requests at `travel + 50`, `travel + 300`, and the scroll end settled at 307px; the compact avatar and rail stayed in their closed positions in both themes.

For each of the five owner tabs, the scroller reported `scrollHeight = 1502`, `clientHeight = 829`, and `scrollHeight - clientHeight = 673px`. The shared value comes from the stretched panels and trailing closed-state range. The headless screenshots showed no visible content through the rail or gap between it and the compact plate. This probe checks Chromium layout and snap results, not real-device finger motion.

For Alina's action-bar profile, all five tabs reported `scrollHeight = 2095`, `clientHeight = 829`, and a 1266px difference. At the bottom the native snap settled at 793px; the final gallery card ended at 762px above the bottom CTA. The action-bar profile adds matching trailing padding to the existing tab-root snap area, preserving that anchor while making its end position reachable.

## Removed or replaced

- Removed `.profile-morph-circle-rim`, its dark-theme style, `luemi-reveal-rim`, and the `circleRimOpacity` fallback model/query/write.
- Removed tab rail horizontal autoscrolling and its ref/effect, active-panel `ResizeObserver` height assignment, and `scroll-snap-stop: always` from tab panels.
- Removed the tab-local `Modal` photo preview, previous/next state handlers, and `.profile-photo-preview*` styles in favor of the shared fullscreen viewer.
- Removed the fixed minimum height from collection empty states. Their layout now follows the real copy and decorative empty silhouettes.
- Removed the CTA's vertical snap alignment by moving it out of `<main>`.

## Limits

- The viewer and tab source tests validate architecture and required affordances. The repository does not yet have automated gesture physics assertions.
- Headless Chromium can validate the required route, tabs, image dialog, close control, and layout measurements, but cannot certify physical touch feel, 60 FPS, or the final Galaxy A55 / Telegram WebView finish.
- No publication backend, gift collection, payments, server reports, or block-policy changes are included.
- Browser QA in this work passed on a 393×852 mobile/touch-emulated Chromium page. The API smoke check could not start in this container because Fastify's address logger calls `os.networkInterfaces()`, which fails with `uv_interface_addresses returned Unknown system error 1` in the sandbox; the same failure reproduced under Node 22 and Node 24.
