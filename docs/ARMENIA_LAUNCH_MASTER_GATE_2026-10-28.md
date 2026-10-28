# LUEMI 💜 — Armenia launch master gate | 28 October 2026

**Current decision:** legal launch jurisdiction Armenia; operator is an individual, Гулгулджян Жирайр Григорьевич; complaints/data requests: [@zhiiirro](https://t.me/zhiiirro). This is an **internal preflight plan**, not published legal advice, consent, or authorization to start processing. Audience goal remains all eligible verified 18+ Telegram users, NOT an invitation-only whitelist. Two owner accounts are initial QA only.

## Ground-truth checks (28 October, read only)

| Boundary | Verified | Still missing |
| --- | --- | --- |
| GitHub / Render | Main has protected diagnostics; production app hosted at luemi.onrender.com | No end-to-end real-user success |
| PostgreSQL | 8 separate app-specific LOGIN roles; no SUPERUSER/BYPASSRLS; FORCE RLS tables in luemi_private/luemi_chats | No live API path/probe proven; remote TLS peer trust still unverified |
| Storage | luemi-profile-private, luemi-chat-private, luemi-bliki-private have public=false | No live binary upload/read/delete + cleanup test |
| People | 0 real actors as observed 28 October | Registration, restore, matching, moderation and chat not tested with real users |
| Human review / erasure | Separate operator command implementations exist | luemi_beta_human and luemi_beta_erasure are NOLOGIN; no verified operator credentials, approvals, scheduled coverage or alerts |

**Important:** The GitHub bootstrap success verifies 8 app-role connections from GitHub Actions. It does NOT prove the protected operational roles can run, a Render HTTP request reached Supabase, or that a human is reviewing actual images.

## Release sequence — do not skip

### 1. Armenian privacy and cross-border transfer review (BLOCKING)

- Confirm the operator's legally required address/registration information *privately*. Never commit residential addresses, identity documents or credentials to this public repository.
- Use the Armenian Data Protection Law **HO-49-N**, incorporated version effective 15 August 2026, especially articles 10 (notice and informed consent), 20 (requests), 23 (biometric/special category notification) and **27 (international transfer)**. Official current text: https://www.arlis.am/hy/acts/229131 ; official English is reference translation, not a substitute for the current Armenian text: https://www.arlis.am/en/acts/117034 .
- Map personal-data recipients: Telegram platform/transport; Render application server **Frankfurt, Germany**; Supabase Postgres + private Storage **eu-central-1, EU**; *no* paid geocoder unless separately enabled. Identify each legal entity/processor and the exact purposes and classes of data.
- Check destination countries and applicable lists/treaties for an adequate protection level under Article 27. **The Armenian Personal Data Protection Agency published a newer adequacy-country list decision on 19 June 2026 (decision dated 18 June 2026):** https://dataprotection.moj.gov.am/articles/որոշումներ/անձնական-տվյալների-պաշտպանության-բավարար-մակարդակն-ապահովող-պետությունների-ցանկը-հաստատելու-մասին-18062026-թվականի-որոշում . Verify the **current** list and the actual countries of recipients instead of relying on the older 2024 list; this plan does not assert that any individual destination is approved. If not covered, determine whether a contract and authorization by the competent Armenian authority are required **before** transfer. Mere user consent or encryption does not in itself demonstrate every requirement has been satisfied.
- Check if the dating app collects any special-category data directly or indirectly. Photos are not always biometric, but face recognition would create additional issues. Article 23 requires notice before biometric/special-category processing. Confirm any required notification/registration with the Armenian Personal Data Protection Agency.
- Consider additional requirements when users from Russia, the EU or other places use LUEMI. Armenian incorporation does not exempt all international users from their local rules.
- Complete and approve the separate, publicly readable `/privacy` document, consent/version, retention/deletion/backup policies. Until formally reviewed, keep `REM06_PRIVACY_APPROVED=0`.

### 2. Operational moderation with an actual reviewer (BLOCKING)

- Use `apps/api/src/human-review-runner.ts` and `docs/ARMENIA_MODERATION_OPERATIONS_2026-10-28.md`.
- Authorize a human reviewer with a **separate** non-admin, non-BYPASSRLS SQL principal; verify its role against `luemi_human_moderator` and actual RLS checks. The current `luemi_beta_human` NOLOGIN shell is not an active moderator.
- Review private sanitized image pixels before approval; never automatically approve queued content. Record audit decision and test revocation after deletion/blocked actor. Configure report triage and safety escalation with a distinct safety operator.
- Test CLI queue/preview/approve/reject/report from an approved secured operator environment. No public moderator HTTP route or reviewer service is authorized.

### 3. Real deletion and safety enforcement (BLOCKING)

- Provision distinct **operator-only** erasure requester, erasure worker, and safety/suspension credentials with minimal grants; never reuse the 8 app connections or the owner/session-pooler URL.
- Confirm end-to-end `POST /api/v3/account/request-deletion` instantly revokes sessions/hides profile AND the outbox worker physically removes private objects + database rows with retry on storage outage. Document backup retention and queue monitoring, no false “deleted” success while pending.
- Record who handles reports through @zhiiirro, when the queue is checked, incident response and appeals, including suspected minors.

### 4. Auth / profiles / chats / Android QA (BLOCKING)

- Enable only verified server paths after privacy/moderation/legal gates, then separately rebuild Vite with real-only UI flags. Do NOT merely flip VITE flags and expose demo identities.
- Test two independent real Telegram initData identities: signed login/cookie/CSRF, 8 steps, unique server draft/revision, explicit GPS permission and graceful manual city, 3–6 private photos, human review, publish, restart restores account, feed includes other user but not self, mutual like then text/photo chat, block/unmatch/revoke/delete. Test an unrelated third adult's legitimate access once OPEN admissions are enabled. Confirm no synthetic profile appears.
- Test physically on Android Telegram WebView / Samsung Galaxy A55. No CI browser emulator is a substitute. Re-check login, scrolling, gestures and cold Render start.

### 5. Launch and rollback

- Execute an owner-approved release checklist with evidence references and signoff. Only after required verifications set `REM06_OPEN_SIGNUPS_ENABLED=1` and separately approved application switches (not BETA invites) for all eligible 18+ users.
- Fail closed on any mismatch; disable publicly available Vite real routes by rebuilding, and server feature flags by an approved rollback, **without deleting data**.
- Keep `LUEMI_CHATS_LOCAL_MEDIA=0`, charged Geoapify flags OFF unless approved budgeted provider, and never commit API keys, addresses or other secrets.

## Operational truth

`GET /api/health/release` is protected by `X-Health-Key`, and its reported flags are **configuration-only**. The additional CLI gates are only proof of an opt-in with distinct URL strings, **not** a verified SQL login, photo review, lawful transfer or successful deletion. A `configured_not_verified` state is never a go-live signoff. QA and legal gates require human evidence.

The current decision is **NO-GO for public registration** until the above is resolved. Do not enable `REM06_MODERATION_OPERATIONAL_APPROVED` or `REM06_PRIVACY_APPROVED` solely to satisfy tests.
