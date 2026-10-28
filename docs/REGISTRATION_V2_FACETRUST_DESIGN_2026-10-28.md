# LUEMI 💜 — Registration V2 / FaceTrust
**Product design recommendation and interactive QA preview — 28 Oct 2026**

Status: DESIGN CANDIDATE. The owner requested a full rethinking of registration with free-first automatic photo and selfie verification. This feature branch contains a **real interactive design prototype**, a pure flow gate and tests. This document **does not mean AI verification is implemented or production onboarding is replaced**.

## Direct audit of current registration V1

| Current actual step | Main implementation | Keep/change |
| --- | --- | --- |
| 1 Name + trial consent | `apps/web/src/registration/Steps.tsx`, `model.ts` | Move name into identity block; keep explicit, meaningful disclosure |
| 2 DOB + gender | Same | Combine with identity; 18+ stays server-enforced |
| 3 City / GPS / radius | `GeoPicker.tsx`, `geo-device.ts` | Reuse location logic with explicit permission and manual city; radius moves to matching screen |
| 4 Who seeks + age + goal | `Steps.tsx` | Retain data but simplify presentation |
| 5 Interests | `InterestCatalog` | Keep chips, make optional / combine with bio |
| 6 About + languages | `Steps.tsx` | Combine with interests; bio maximum 250 recommended after migration (current 750) |
| 7 Photos + reorder | `PhotoSorter.tsx`, `photo-preview.ts`, `server-media.ts` | Preserve working reorder/sanitization; enforce 3–6 before verification |
| 8 Static preview | `Preview.tsx` | Move behind honest FaceTrust status; render existing approved profile look without allowing accidental public publish |

Technical ground truth:
- Authentication is server-verified signed Telegram `initData` and allowlist for current friends beta.
- Private text draft is stored in PostgreSQL; photos remain local in friends beta.
- Private Storage upload/media proxy and publication machinery exist behind **disabled** server + frontend switches.
- `apps/api/src/automatic-photo-review.ts` provides **only a fail-closed decision contract**; it does not infer real evidence, perform liveness, or approve/publish photos.
- Existing publisher requires 3–6 **approved** images and RLS.
- V1 is coupled inside `App.tsx` (step index 1–8), making face verification awkward to insert without a dedicated flow/phase machine.

## New definitive design direction: 8 stages, grouped by purpose

1. **About you** — name, date of birth, gender, adult-only gate; large serif-free heading, restrained glass input cards.
2. **Your city** — one city screen; GPS on permission or typed search, city only shown, no raw coordinates.
3. **Your people** — who seeks, age range, connection goal, search distance (initial default; advanced filters after registration).
4. **Your world** — interests chips, short bio and languages, optional. Don't punish users who skip it.
5. **Your photos** — 3 required/3 optional reorderable images, one clear primary image; inline rules: one person in the frame; face visible; no minors, sexual or impersonated content. Local preview stays local until agreed upload.
6. **FaceTrust explanation + consent** — understandable, stand-alone biometric-processing consent before camera/provider interaction; state clearly what is analyzed, where data goes, purpose, retention, deletion and non-biometric alternate path.
7. **Live camera + FaceTrust verdict** — dedicated camera with proper secure liveness SDK, random server-owned challenge, retry help and accessibility fallback. UX may show "look left/right/up", but those gestures alone are NOT evidence of live identity; server can only enter `eligible` upon authenticated SDK results and exact-match, generation-bound verification across all photos.
8. **True profile preview** — what other users will see, photos/name/city/goal, verification status. Publish CTA is enabled only after trusted evidence; otherwise "Verification pending", "Replace photo", "Retry" or "Review requested". No fake checkmark.

## Design system / motion

- Retain approved LUEMI brand/wordmark, premium soft-glass cream/lavender/soft rose palette. **No redesign of Discovery, Profile Morph or tabs.**
- Mobile-first: eyebrow label, short personal title, one microdescription, centered user action. 8 unobtrusive horizontal progress capsules top; safe-area-aware sticky bottom "Continue" + back arrow; focus rings, at least 44px touch targets.
- Step transitions: 160–240ms opacity + small translate for ordinary steps, reduced-motion opt-out. Do not animate photo grids during scroll or use `backdrop-filter`, `mask`, `mix-blend` in hot paths. Keep camera on a separate GPU-aware isolated screen; no active scrolling while capture occurs.
- Inline errors at fields; save local draft safely, persist server revision with adult consent; on resume restore the *actual server state* (not just step 1). Edits to any photo revoke previously verified generations.
- Phone primary target Samsung Galaxy A55 Telegram Android WebView; verify camera permission flow, app background/foreground, cancelled uploads, slow network, keyboard, viewport, gestures and last known consent.

## Prototype location

`apps/web/registration-v2-preview.html` is an isolated **non-production** entry for local Vite/dev and QA. It is included only when `VITE_LUEMI_REAL_ONLY` is not `1`. It allows browsing all screen designs and uploading local photos **without any server request**, but it NEVER records consent, opens the camera, declares a face verified, or publishes a profile. An explicit footer and disabled publish CTA make this clear. The stage chooser lets the owner inspect the entire flow; it does not represent a bypass in any live runtime.

## Integrated invited-user V2 path — implementation progress

The branch also contains a **feature-flagged real registration UI**, `apps/web/src/registration/v2/RealRegistration.tsx`, with opt-in build flag `VITE_LUEMI_REGISTRATION_V2=1`.

- It uses the **existing authenticated Telegram account**, registration fields, live city picker, existing reorderable `PhotoSorter`, data validation, local draft recovery, private PostgreSQL save and same consent-version rules. This is not the mock design preview.
- It appears **only** when private server draft mode is enabled and the public-media/discovery feature is OFF. Old V1 is preserved as a fallback; existing invited accounts with a stored draft still open their real private account view.
- It groups V1 fields into the new eight-stage structure and restores the next unfinished stage after local storage loads.
- It performs a **free, local SHA-256 check for byte-identical photos** before FaceTrust. This is *not* same-face detection or a reliable detector of manipulated/near-duplicate photos.
- The camera screen uses `getUserMedia({video:{facingMode:"user"},audio:false})` on explicit tap, closes streams when leaving, and permits a guided preview of head movement. No frame capture, embedding, video upload or pretend liveness verification takes place.
- `GET /api/v2/facetrust/status` is authenticated, cache-disabled and reports `provider_not_connected` / `verified:false` / `publicProfileEligible:false`. The frontend uses that factual server state; it cannot earn a verified badge through manual gestures.
- There is a separate opt-in for camera rehearsal, **not** a biometric-processing consent for any future identity service. A full biometric consent and notification must be implemented before actual AI biometric processing.
- The owner may save a private draft **without FaceTrust**. Neither photo upload nor publishing becomes available merely by enabling `VITE_LUEMI_REGISTRATION_V2`. Only the original server-controlled moderation/publication gates can grant real approval.

**What is NOT yet implemented:** working open-source models for photo content/person count and same-face matching, secure anti-spoof liveness with a server-trusted provider, calibration/false-match testing, privileged AI-review SQL worker, stored verification grants or automatic publication. Mark this stage as private registration UX, not completed FaceTrust identity verification.

## Required implementation stages to replace V1

- A. Approve the design on a real device; fix QA findings without altering existing production visuals. Source of truth: `apps/web/src/registration/v2/flow.ts` for design stage order and V1 data migration plan. No production switchover.
- B. Refactor registration into isolated `registration-v2` route/stage machine, reusing `GeoPicker`, `PhotoSorter`, real session and persisted drafts. Keep all existing backend authorization/RLS checks. Add `onboarding_version` and resumable `verification_state` only through reviewed migration.
- C. Provider-integrated, consented, server-run content + person count + face count + spoof/liveness + same-face matching; a free/open-source model may serve limited trial but is NOT a guaranteed free scalable identity solution. Use dedicated bounded worker, quota, model licensing and rights audit; never place embeddings, provider keys or face scans in browser or Render logs. Explicit Armenian biometric notification and international transfer review before actual biometric processing.
- D. Privileged server-side approval of exact current photo versions, retry/review paths, genuine publication through existing publisher, revoked on deletion/edited photos; fully test two invited users and an unauthorized user.
- E. Only after evidence from physical Android QA, moderation policy, storage deletion and trusted verification, introduce opt-in V2 flag for real audiences; remove outdated V1 UI only once data migration and rollback are verified.

## Exit criteria

- [ ] 8-stage mobile flow smooth, no flicker or repeat-registration after restart.
- [ ] Identity, location, choices and 3–6 photos work with server draft storage; unreviewed photos stay private.
- [ ] Separate, revocable consent recorded; face media not retained beyond defined purpose.
- [ ] Multiple people, child risk, pornographic content, swapped identity, replay, different image versions and unknown provider results are NOT auto-approved.
- [ ] True SDK liveness verified on Samsung Galaxy A55.
- [ ] Only server can publish and show "Фото подтверждены" after all checks.
- [ ] False negatives have retry/review and appeal; no perfect-identity/100% safety promise.
- [ ] Existing chat, Discovery, Profile Morph, registration V1 and bots unaffected until controlled migration.
