# LUEMI 💜 — account deletion with 72-hour cancellation window

## Requested experience
1. `Профиль → Настройки аккаунта → Удалить аккаунт`. Reason select (including “Не хочу указывать”), optional note up to 500 characters.
2. Confirm `Начать удаление`. Server hides published profile/photos, revokes all sessions, marks account inactive, stores actor-specific outbox and **server-calculated** `eligible_at=clock_timestamp()+interval '72 hours'`.
3. User sees 3-day countdown. Passive Telegram reopen never restores or republishes the account. Only an explicit `Восстановить аккаунт` POST with recent signed initData can cancel the outbox before the cutoff.
4. Restore retains private images and registration fields, revives actor and requires a fresh authenticated session. **Profile remains hidden until voluntary republication** (no automatic re-exposure of photos).
5. At or after `eligible_at`, a **separately scheduled** restricted erasure worker may delete private Storage objects and linked database rows. The countdown is the *earliest processing time*, not guaranteed finish at exactly 72:00:00; worker requires real credentials, queue processing and monitoring. Retention of backups and lawful exceptions require a published policy.

## Implemented in isolated branch
- DB migration: `db/account-deletion-72h-recovery.sql` (NOT applied to live Supabase).
- API request: strict reason codes, one account-owned consented deletion receipt including server time.
- Authentication: pending deletion state and signed explicit recovery endpoint before 72 hours.
- Cleanup worker: only selects overdue requests, row-locked to prevent races.
- Android-friendly UI: reasons, optional text, countdown and restore action.
- Tests for guardrails and client contracts.

## Must verify before enabling
- Apply migration only after testing against isolated PG16/17 and checking FORCE RLS / role privileges for issuer, requester and worker.
- Verify `erasure_requests` and `erasure_objects` ownership-limited permissions. No public API caller can supply another actor ID.
- Multi-session tests: delete then deny all existing cookies; block public discovery and own media GET; verify restore as same Telegram user before deadline, reject unrelated users; verify restored profile stays hidden; allow explicit republication.
- Simulate deadline expiration with isolated synthetic data; worker must never purge before deadline. Test cancel and worker concurrency.
- Run synthetic Storage removal and DB cleanup under dedicated, verified worker credential, then schedule recurring execution and queue alarms.
- UX: users can request erasure even if draft is not yet published; this remains to be completed before public activation.
- Publish verified privacy terms distinguishing a reversible **account deletion request** from a separate urgent personal data removal request where applicable law requires faster action.

## Status
NOT merged, NOT deployed, NOT enabled. Existing immediate irreversible deletion endpoint remains unchanged on Render. This change requires a coordinated schema/API/web rollout; never deploy these new handlers against an old schema or grant operator permissions on the public `anon` role.
