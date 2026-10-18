# LUEMI · W12 restored UI / staged delivery

**Code SHA after W12:** 404b4c9c2daf3b666c527667b1e54e3033fd4c37.
**Design source:** Original LUEMI_SOURCE_2026-10-18.zip, the W12 approved handoff; cropped model portraits from the approved image were imported as transparent-free WebP **demo media**. No verified real user images are stored.

## Working in public web demo
- Floating Liquid Glass logo island with raster W06 silhouette (no font/wordmark reconstruction).
- Animated four-tab navigation, nested Feed/For You/Nearby and filters, like/skip/save/undo, demo match.
- 8-step registration, preview, avatar/media reorder, 18+ validation and local draft persistence.
- Chat list, full-screen demo chat, reactions, replies, message editing / local delete.
- Profile, pause mode, dark/light/system and reduced-motion preferences, Premium/LUME **informational previews only**.
- Telegram WebApp bridge: viewport, header/background colors, BackButton, vertical swipes.

## Not implemented as real production services yet
- Telegram bot setup, bot token and live authenticated session; server-side HMAC verifier is ready but not wired to sessions.
- Real matchmaking, other users, server stored photos and chats, moderation dashboard and notifications.
- Supabase schema exists and has deny-all client access; no exposed credentials or permissions.
- Stars, gift payments, LUME ledger and subscriptions; no paid actions enabled.

## Release gates
1. CI TypeScript/build/tests/smoke succeeds.
2. Render deploy becomes Live on new main SHA.
3. Compare UI on Samsung Galaxy A55 inside Telegram against approved 390×844 refs.
4. Add Telegram bot credentials in Render environment only; verify token/HMAC and secure sessions first.
5. Move to live profiles ONLY after explicit acceptance of privacy, photo review, age checks and admin safety.

**Other services VEYRA/blotX are unaffected.**
