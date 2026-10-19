# LUEMI · Stage 02A open gates

1. **Real registration forbidden** until server-stored drafts associated with verified Telegram user, privacy controls, 18+ backend validation, documented consent, and data deletion flows exist.
2. Final photo moderation before publication, private storage, image compression and cleaning, duplicate/unsafe content detection, and max 3–6 approved pictures.
3. Verified canonical W04 original raster and APPROVED registration screenshot binary import; W06 derivative used unchanged in staging.
4. Real geocoding: country/city suggestions and voluntary location permission. Current test UI has honest disabled geo button.
5. Approved interest library and optional-field wording, gender option values, exact age slider behavior, localization RU/EN.
6. Real user preview must match shared Stage 03 profile, no duplicate decorative fake.
7. Galaxy A55 device QA for footer above keyboard, focus transitions, photo ordering, BackButton, dark theme, Reduced Motion and 60fps.
8. A full signed server-side session, abuse protections, RBAC/moderation admin, and back-up/restore workflow before Beta.
9. Rotate accidentally exposed staging Telegram webhook secret when convenient (do not share secrets in chat).

## Stage 02E remaining approval gates
- Configure dedicated LUEMI `GEOAPIFY_API_KEY` privately in Render staging only after owner checks provider's free tier, privacy/terms and costs. Until then full worldwide city lookup is **unavailable**; labeled demo local results only.
- Check real Android pointer 275ms hold, swipe inertia, context menu suppression, Telegram BackButton, keyboard/safe-area behavior and theme framerate on Galaxy A55. Test iOS separately before production.
- Final product profile/feed screens need to reuse Stage 02E shared carousel/preview components; still only local-preview implementations.
- Real draft persistence, consent/legal, moderation, private image upload and API-side city-ID verification are NOT built. A user-provided fake ID must never be accepted by a future publishing endpoint.
- Full multilingual localization and accessibility audit, official canonical W04 binary import still open.

## Stage 02F pending follow-ups
- Actual full-world city service needs server-side GEOAPIFY_API_KEY (only after service/free-tier/privacy confirmation). Built-in sample cities are explicitly DEMO; cannot claim comprehensive global data.
- Full registration persistence, consent/legal, secure photos and moderation remain separate open tasks. Real user accounts unavailable until server workflow approved.
- Needs real Samsung Galaxy A55 motion/keyboard testing and separate iOS verification; do not infer smooth 60FPS from CI alone.
- Real locale switching, expanded world flag set beyond locally vendored 66 and exhaustive accessibility audit remain follow-ups.
