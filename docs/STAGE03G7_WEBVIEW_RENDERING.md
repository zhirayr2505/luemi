# LUEMI Stage 03G.7 · Android WebView compositing hotfix

## Direct evidence (Galaxy A55 recording 2026-10-20)
Input: user-provided 33.8s video `1000068688.mp4` of deployed Stage 03G.6.

Frame review:
- 0.85s: white panel's cards visibly rasterize as translucent separate rectangles *above portrait* while white background is detached.
- 10.9–11.5s: moving panel intermittently loses visible content and shows blank lower sheet.
- 13.5–16.3s: whole rounded panel partially disappears, briefly leaving a narrow vertical section showing profile name at x≈0–1/3 width. The underlying photo remains stable.
- 8–9s: horizontal tab track exposes neighboring panes. During horizontal swipes a portion of another page may be expected, but stale blank tiles are not.

**Hypothesis, not claimed proof**: Android WebView GPU surface invalidation between a moving rounded `translate3d` containing a 5-wide horizontally transformed rail with nested native vertical scrollers and per-page `contain:paint`.

## Scoped intervention
- Keep Stage 03G.6 behavior, owner/visitor safety and all functionality unchanged.
- On Android user agents, mark profile root `data-sheet-renderer=layout`.
- Position moving white panel using `top:var(--pm-sheet-y)` instead of the ancestor `transform:translate3d(...)`. The container retains its height, rounded upper corners, and safe-area endpoint.
- Position the 5-page scrolling rail through relative `left:calc(-n*100% + delta)` rather than a second translated GPU surface. Preserve horizontal gestures and selected tab indicator.
- Remove nested paint containment for these Android-only panes to avoid GPU tile boundaries within the clipping sheet.
- Keep compositor `translate3d` approach on all other platforms, so the hotfix does not silently degrade iOS or desktop.
- Consciously trade possible additional layout/paint work on Android for eliminating full-screen rectangular corruption. Measure actual device responsiveness before describing it as smooth or bug-free.

## Verification
1. `npm run check` and other contract tests on exact code SHA.
2. Android-UA mobile Chromium: `scripts/stage03g7-android-visual-qa.mjs` checks sheet and pager computed `transform:none`, pager `left` position and photo/Bliki/scroll/gesture behaviors.
3. Owner's physical Telegram Android Galaxy A55 must verify sheet 0↔100% motion, horizontal 5-tab swipes, and native vertical tab scroller over repeated cycles.
4. Do **not** claim photo/GPU flicker eliminated solely from green build or a headless desktop simulator.
5. Preserve prior backup `backup/pre-stage03g7-webview-flicker-20261020`. Merge into staging for controlled preview only, not production main.

The main release architecture remains from `docs/STAGE03G6_FLICKER_AUDIT.md`.
