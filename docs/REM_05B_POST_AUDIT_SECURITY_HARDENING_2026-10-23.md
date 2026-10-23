# LUEMI 💜 — REM-05B additional security hardening verification

23 October 2026 | Scope REM-05B ONLY | Existing Draft PR #52
Accepted base: bc994acfb815d4712431fad5c13070793d361af6
Previous accepted candidate: 28a3b21baf2eb5f79a41c2dc79fac246092129e0
Repository: intentionally PUBLIC. No live Supabase/Render/webhook/secret changes, merge or deploy.
Final SHA and exact completed CI run links: the immutable PR #52 head and its description; a committed report cannot self-contain its own Git commit hash.
Release gate: CLOSED; ready only for owner engineering review after same-SHA CI passes.

## Finding: mixing issuer and request PG roles

Original safeRole() checked pg_has_role(current_user, expected_role, MEMBER) but failed to exclude membership in the opposite role. PostgreSQL may combine permissive SELECT policies using OR. Real disposable PostgreSQL 16 fixtures show that accounts inheriting BOTH luemi_auth_issuer and luemi_request can SELECT synthetic Actor A and Actor B without actor context; RLS ENABLE/FORCE plus NOBYPASSRLS alone does NOT solve this policy union.

Hardening:
- Require expected membership and deny opposite membership (including indirect and NOINHERIT membership), system-wide data/file/program reader/writer role membership and CREATEROLE/CREATEDB/SUPERUSER/BYPASSRLS.
- Guard requires session_user=current_user, no table ownership, no CREATE on private schema, row_security=on, effective active FORCE RLS for both private tables.
- Validate actual effective SELECT permissions. The request role has column-level access to id/status/environment only, NOT table-wide SELECT, nor additional private actor/session columns; reject unexpected direct column grants. Deny request writes.
- Run the guard against the SAME checked-out pg PoolClient as the following operation, not a different connection through pool.query. Fail closed (HTTP 503) for role/config errors.
- The positive issuer path retains minimal columns and opaque session issuance; scoped user SELECT still uses BEGIN, transaction-local set_config actor UUID, parameterized read, COMMIT/ROLLBACK and post-read session revalidation.
- Existing SQL migrations remain additive and are applied to disposable CI DB only. Live Supabase Data API, ownership policies and Storage are deliberately NOT VERIFIED.

Sources: PostgreSQL 16 pg_has_role, row_security_active, has_column_privilege, and predefined roles:
https://www.postgresql.org/docs/16/functions-info.html
https://www.postgresql.org/docs/16/predefined-roles.html

## Token/logout semantics and step-up policy

- Ordinary logout now matches session id, actor id, namespace AND token_hash. A stale pre-rotation logout cannot revoke a newly rotated generation; competing logout/refresh results explicitly accept the valid race winner and require the old cookie to be denied.
- Logout-all route is intentionally DENIED by default (403 additional_confirmation_required) and makes NO DB modifications. Valid CSRF plus a session is NOT a meaningful high-impact step-up. Telegram initData may be replayed during its authorization window, so resubmitting it is not an approved second factor.
- A future verified, user-approved recent-auth/step-up design is required before enabling all-device logout. Test DBA SQL can emulate revocation only inside disposable PostgreSQL, not through a production bypass endpoint.

## Expanded negative test evidence

- Synthetic mixed-role DIRECT and INDIRECT (transitive) login roles: demonstrate effective A+B leakage at SQL level then API 503 for both issuer and request configurations.
- NOINHERIT membership also rejected; absent schema USAGE is expected and must not weaken the guard.
- Privileged superuser/table owner, CREATEROLE, pg_read_all_data, direct unexpected telegram_id SELECT: each rejected without exposing actors through the API.
- A/B self-read, anonymous deny, missing GUC, A→B→anonymous pooled connection reuse, deliberate SQL error and ROLLBACK, no residual connection actor context.
- Valid Telegram bot HMAC with a signature field covered in canonical message, tampered signature field rejected, duplicate percent-decoded keys, malformed/oversized/unsigned data, blank names, international Unicode names and forged role/owner headers. Ed25519-only third-party signature is NOT authorization for this bot-token HMAC endpoint.
- Concurrent refresh/logout with token-generation integrity; session expiry and blocked/deleted account status; existing 50-concurrent bootstrap UUID/session ceiling unchanged.
- Browser synthetic test: same-origin v2 startup PASS, cookie blocked fails closed, A→B mock account switch retains separate IDB fixture and does not call indexedDB.deleteDatabase or persist session secrets. This cannot prove real Telegram device/native account isolation.
- Preserve existing REM-00A–REM-04D CI, PhotoViewer, blur, viewport, modal, 50-cycle performance regression; do not alter UX or Motion.
Official Telegram WebAppData verification:
https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

## PASS / PARTIAL / BLOCKED matrix

| Work item | Status | Exact limit |
|---|---|---|
| Combined issuer/request RLS issue reproduced | PASS | Disposable PostgreSQL 16 shows A+B SQL SELECT |
| Direct, indirect, NOINHERIT union refused | PASS subject to final same-SHA CI | Actual PostgreSQL credentials, 503 API |
| Effective role, owner and grants audited | PASS subject to final same-SHA CI | Current 05B actors/sessions only |
| Direct sensitive-column grant denied | PASS subject to final same-SHA CI | Actual disposable PG column privilege fixture |
| Scoped A/B user query and rollback | PASS subject to final same-SHA CI | No client SQL/GUC ownership |
| Refresh/logout concurrency and token generation | PASS subject to final same-SHA CI | Actual synthetic Fastify + PG races |
| Logout-all confirmed step-up design | BLOCKED | Route deliberately returns 403; owner policy required |
| Telegram bot-token HMAC modern fields | PASS synthetic | Ed25519-only path not independently implemented |
| Same-origin cookie, blocked cookie fail closed | PASS synthetic | Physical native Android/iOS not tested |
| Chrome account-switch, local IDB retention | PARTIAL | Browser dummy fixture, not full real-user profiles |
| Supabase Data API/Storage policy and real DB roles | BLOCKED | Live project not accessed; no live SQL |
| Historical public-repo and webhook secret exposure | BLOCKED / not verified | No active secret checked, no rotation |
| Production real-user readiness G6 | BLOCKED | REM-05C–05F and separately approved tests needed |
| Native Android Telegram and iOS WKWebView | BLOCKED | Desktop Chromium alone is insufficient |

## Evidence/acceptance rules

Exact same SHA must have completed push and pull_request runs: Foundation CI 7+7 jobs; Full Behavioral QA 2+2; REM-05B Focused 3+3 (disposable PostgreSQL security, browser preservation, REM-04C vs current 50-cycle). Total 24/24 SUCCESS if and only if all six final-SHA workflows and all their job/check-run conclusions are complete. Check detailed TAP test count, public diff scan zero categories, Chrome account-switch marker, absence of skipped tests. PR #52 description records latest SHA and final run links. Historical intermediate failures do not count as final pass.

No second PR, no merge/deploy, no code or operational work on REM-05C. Preserve old drafts, session rows and approved UX. Feature activation flags remain OFF in existing services.

## Decision

CODE + AUTOMATED SYNTHETIC QA READY FOR OWNER TECHNICAL REVIEW once exact SHA is completely green. NOT production ready. STOP for independent owner acceptance.
