# LUEMI 💜 — Automatic Photo Verification V1
**2026-10-28 · Implementation foundation (NOT live).**

## Goal
Remove routine owner approvals for ordinary adult profiles while ensuring that **nothing is auto-published without trusted server-side evidence**. The user selects **3–6** photos and completes a fresh live-selfie capture. Each gallery photo must appear to contain exactly one person and one face, match the live selfie, have no suspected minors or disallowed sexual content, and meet quality and low-spoof-risk requirements. Even with a successful AI result, **100% certainty is impossible**: estimates can miss an obscured child, fail to recognize different photos of the same adult, or incorrectly accept generated/edited content. Do not advertise a guarantee of authenticity, adult age, or identity.

## Confirmed current code paths
- `apps/web/src/registration/Steps.tsx`, `App.tsx`: registration; three-to-six photo selection.
- `apps/web/src/registration/server-media.ts`: locally strips photo metadata and uploads normalized PNG through protected server endpoint.
- `apps/api/src/rem05d-private.ts`: private media proxy; objects are held in `luemi-profile-private`; assets enter `pending_review`.
- `apps/api/src/human-moderation.ts`: existing operator-only manual decisions.
- `apps/api/src/real-publication.ts`: publication requires 3–6 `approved` photos and an authorized session; never remove this invariant.
- `apps/api/src/automatic-photo-review.ts`: NEW **pure, fail-closed evidence contract**; does NOT fetch images, contact AWS, write an `approved` decision, or publish. Unit tests verify no shortcut through missing evidence.

**The friend beta currently has `REM06_MEDIA_ENABLED=0` and `REM06_PUBLICATION_ENABLED=0`. This document is not approval to flip them.**

## Proposed on-device UX
1. User completes regular profile and selects 3–6 JPEG/WebP/PNG photos in gallery. Every photo is checked and sanitized on server; never send AI results or Supabase credentials from browser.
2. Explicit, purpose-specific **biometric consent** appears *before* face processing. If declined, do not process biometrics and offer a privacy-respecting alternative review path. A general registration checkbox alone isn't enough for face embeddings.
3. One-time **live selfie** captures liveness (SDK camera in Telegram Android WebView must pass real A55 device testing; allow camera permission failure/retry). Do not use gallery input as liveness evidence. Do not automatically store selfie video, audit frames or face vectors indefinitely.
4. The private photo-review screen shows clear per-photo errors: "Другой человек в кадре", "Фото размыто", "Снимок не совпадает с селфи", "Замени фотографию", or "Дополнительная проверка" rather than publishing unverifiable content.
5. When all photo checks and liveness pass, *privileged worker only* records cryptographically/account-bound evidence and atomically transitions the **exact generation** of each matching asset to `approved`. Client then requests publication through existing `/api/v3/profile/publish`, which checks all 3–6 approved photos again.

## Server architecture
**Recommended managed image provider to prototype:** AWS Rekognition.
- `DetectFaces`: 1 face per image, pose/quality checks.
- `DetectLabels` or a calibrated person detector: exactly 1 person per image; face count alone misses a hidden second person.
- `DetectModerationLabels`: explicit nudity, sexual content and other prohibited image content. Confidence is not proof of safety.
- `CompareFaces`: compare each gallery face to the same live-selfie reference; never naively compare only the largest faces while ignoring multiple people.
- `Face Liveness`: fresh live selfie and reference frame through AWS Amplify SDK; the feature returns a *probabilistic* score and does not establish legal identity.
- Additional calibrated age-risk and manipulated-image screening: a face's **estimated age range is NOT legal proof of being 18+**; uncertainty must not yield an automatic pass. Consider stricter third-party age assurance if needed for onboarding.
- Keep capture, provider calls, prompts, images, model versions, timing and per-account spending on backend-controlled endpoints/workers. Require quota, replay protection, deduplication, idempotency and per-invitation rate limits.
- Provider failures, missing fields, multiple persons, mismatched faces, suspected minors, unclear results and failed liveness must remain **not approved**. Allow retakes or accessible appeal. Do not make the owner a mandatory step for normal high-confidence passes; escalations may still need a trained reviewer for safety.

### Trust boundary and database
- Existing RLS/grants are strict. A new automatic verifier must be a dedicated **least-privileged** SQL worker, not the user’s request role, not a general Supabase `service_role`, and not an in-browser SDK.
- Introduce a dedicated table/records for `owner_id`, `asset_id`, `generation`, `model_version`, `policy_version`, `calibration_id`, `completed_at`, non-biometric reason/status, and linkage to the verified liveness session. No raw face embeddings in public or SQL logs.
- Ensure re-upload, account deletion, user block/suspension, consent withdrawal or model/policy change invalidates old verdicts. `approved` may only be written for the exact current asset generation after re-reading evidence in a transaction; never accept a client's `approved=true`.
- If liveness/reference result is older than its session TTL or belongs to a different actor, fail closed. Capture provider receipt and ensure verification was not replayed.
- Handle `unknown` and provider errors as `retry`/`needs_review`, never as safe. Keep manual moderation available solely for disputes and child safety, not routine registration.

## Costs and provider constraints
Rekognition charges per **API call for image analysis**, and liveness per check. The official AWS US East example lists **$0.015 per Face Liveness check** for the first tier; regional pricing and other image calls cost extra. It is not a free, infinite service. Do not turn on billing, provision an account or store access credentials in GitHub without operator approval.

Official docs:
- https://docs.aws.amazon.com/rekognition/latest/dg/how-it-works-types.html
- https://docs.aws.amazon.com/rekognition/latest/dg/face-liveness.html
- https://docs.aws.amazon.com/rekognition/latest/APIReference/API_CompareFaces.html
- https://aws.amazon.com/rekognition/pricing/
- https://www.moj.am/en/article/3887

## Legal / biometric processing — blocker distinct from company registration
The chosen legal jurisdiction is Armenia. **The Armenian Personal Data Protection Agency says Article 23 notification is obligatory *before* processing biometric personal data**, and Article 13 requires biometric-processing consent unless a legal exception applies. Facial similarity against a live selfie is biometric processing, even in a small private beta. This is separate from incorporating a company; do not claim a closed alpha eliminates these requirements. Review international transfer and data-retention obligations before sending face images to foreign AI vendors. A practical alternative for now is continuing non-biometric private registration without photo auto-publish.

## Acceptance gates for a *real* autonomous rollout
- [ ] Provider account and budget/alerts connected privately (not in public GitHub), per-call cap tested.
- [ ] Biometric consent and age-appropriate screening flow implemented, notifications/legal conditions verified.
- [ ] Server SDK -> private Storage -> evidence -> isolated worker -> immutable generation-bound approval integrated.
- [ ] Test cases: adult face across all photos, friend/celebrity swapped in, two adults, photo with a child in background, face hidden, underage-looking ambiguity, explicit content, synthetic face, screen replay, deepfake, different people, duplicates, missing photos, changed photo after approval, failed provider, delete during moderation.
- [ ] Error/ambiguous cases stay hidden and offer a reasonable retry; appeals available. Verify false rejections/acceptances across diverse adult volunteers.
- [ ] Telegram Android WebView camera permissions and liveness SDK are tested on Samsung Galaxy A55.
- [ ] Deletion worker removes private media and biometric transient data under an approved retention policy.
- [ ] Only after verified tests and authorized launch, production gates for private media, publication, matches and chats can be considered. No default-off flags should flip merely because this policy module was merged.
