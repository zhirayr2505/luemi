# LUEMI · Profile Tabs Stage · 2026-10-19

## Approved navigation, delivered in UI
Five tabs directly after the expanded profile hero:
1. **О себе** — biography, interest chips and relationship goal; languages moved to account facts.
2. **Блики** — designed honest empty state for manually saved 24-hour moments; **no publishing, timer, database, reactions or fabricated stories**.
3. **Фото** — real profile photos, responsive 2-column grid, fullscreen-on-tap enlarged preview with next/previous buttons.
4. **Аккаунт** — non-sensitive facts: verification badge, city/country, age, language; no birth date, contact details, user IDs or invented signup dates.
5. **Подарки** — designed honest empty collection state; no fake gifts, payment buttons or Telegram Stars purchases.

## Motion ownership
- Keeps **the same stable, single-image** profile photo and its native vertical scroll timeline unchanged.
- Tabs have their own **horizontal native overflow + CSS scroll-snap**, following a finger naturally. No JS pointer-driven physics, no touchmove interception and no second scrollTo snap animation.
- IntersectionObserver updates active tab state only after a panel becomes >60% visible.
- A horizontal button click is allowed to set horizontal `scrollLeft` once. It does not write vertical `scrollTop`, call `scrollTo`, or run motion in rAF.
- ResizeObserver adjusts viewport height **only** after active content layout changes; vertical profile remains one scroller.
- Tab bar sticks beneath the compact portrait header while scrolling. Soft Glass appearance uses static painted translucency, not animated backdrop-filter.
- Tabs remain accessible by button, Left/Right/Home/End keys. Reduced-motion disables smooth programmed horizontal movement.
- Previous native photo gallery still owns horizontal gestures **on the expanded hero image only**. Tabs own only gestures within panel body; no shared gesture handlers.

## Verification / limits
Gate: `npm run format:check`, `npm run check`, `npm test`, `npm run build`, `npm run smoke`; GitHub Actions and Render deploy verification after merge.
Visual motion target: Samsung Galaxy A55 Chrome and Telegram WebView; **CI cannot prove FPS, scroll chaining or exact optical finish**. Request device screen capture for acceptance.
Production notes: privacy, moderation and stored Bliki, Gifts/Stars, real user accounts and server data remain a separate implementation.

## Boundaries
No database or secret access required. Leave VEYRA, blotX, existing brand assets, and approved morph algorithm untouched.
