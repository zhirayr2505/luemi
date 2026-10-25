# LUEMI 💜 REAL REGISTRATION 01F — account erasure with private Storage outbox

Date: 2026-10-25. GitHub Draft PR stacked after #68 at
`522b87223f2adb0476594c3af6f9e80f3e04e1a3`.

## Consent withdrawal is NOT deletion

01E's `withdraw-consent` hides a profile but retains account records.
01F adds a separately consented irreversible `POST /api/v3/account/request-deletion`.
It is available **ONLY** with all relevant private-draft/media/publication feature
flags already approved and `REM06_ERASURE_REQUEST_ENABLED=1`,
`REM06_ERASURE_POLICY_APPROVED=1` and a **separate** requester login
`REM06_ERASURE_REQUEST_DATABASE_URL`. It is disabled in all live LUEMI services.

The caller must have a fresh, signed Telegram V2 session, same-origin request
and memory-only CSRF and must send exact confirmation
`DELETE MY LUEMI ACCOUNT`. The requester's PostgreSQL role cannot DELETE
account rows, cannot edit secrets or Storage objects and can only affect the
session's own actor. The whole SQL transaction queues sanitized Storage keys,
hides profile/photos, nulls consent, revokes all sessions and sets actor
`status='deleted'`. Issuer code rejects further Telegram login until the
actual erasure worker finishes. Response HTTP 202 explicitly says
`storagePending=true,dataDeleted=false`; server clears the session cookie.

## Durable object and relational cleanup

`infra/migrations/0006_reg01f_account_erasure.sql` creates
`luemi_private.erasure_requests` and `erasure_objects` outbox with
FORCE RLS, plus **distinct** requester and maintenance-worker roles.

`runErasureBatch()` operates exclusively with the isolated
`luemi_erasure_worker` database login:
1. Locks a pending request. Verifies its account was already disabled.
2. Deletes each sanitized private Storage derivative object (404 considered
   already gone); updates the outbox marker transactionally.
3. Erases associated moderation decisions/jobs, uploads, media, reports,
   blocks (both directions), account drafts/public profiles, sessions and
   actor record in FK-safe order. It also removes affected audit references.
4. Removes outbox object keys and marks the opaque request complete only
   **after** all Storage and PostgreSQL operations pass.
5. On any error, rolls back SQL, leaves the request pending, and exits for a
   later explicit retry. Storage deletion is idempotent; PostgreSQL rollback
   cannot reverse external deletes.

The worker is NOT imported by the public HTTP process; the only permitted
entrypoint is the explicitly operator-gated
`apps/api/src/erasure-runner.ts`. It requires
`REM06_ERASURE_WORKER_ENABLED=1`,
`REM06_ERASURE_MAINTENANCE_APPROVED=1`,
`REM06_ERASURE_POLICY_APPROVED=1`, scoped private Storage credentials and a
distinct `REM06_ERASURE_WORKER_DATABASE_URL`. Processes at most one
pending account per invocation. **No Render Cron, automations, secrets,
billed compute or live database writes are configured in this PR.**

The narrow `erasure_requests` receipt retains an opaque deleted actor UUID and
timestamps pending an owner-approved retention policy. This must be handled
under the data policy, not silently treated as an erased legal record.
Never claim 100% erasure while queue is pending, prior backups may remain,
or retention obligations aren't approved.

## Synthetic acceptance

Disposable PostgreSQL 16 with real FORCE RLS and disjoint logins, fully
synthetic Telegram initData, private media and moderator decisions.
A two-user test checks exact-confirmation/CSRF/origin denials, 3 stored
photos, published visibility, immediate session+public-access revocation,
storage failure and retry, and subsequent deletion of PostgreSQL dependencies
without touching the other user.

**NO-GO for friends/live staging:** still requires genuine Storage put/get/delete
with properly provisioned isolated staging credentials; operational scheduling,
recovery alerting and queue age SLAs, real moderation and appeals, legally
approved deletion/retention policy, real device A55 acceptance, invitation
gating and $0 spend proof. No merge, deploy or database migration authorized.
