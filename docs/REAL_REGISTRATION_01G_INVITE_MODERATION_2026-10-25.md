# LUEMI 💜 — REAL REGISTRATION 01G | Invite-only beta and human moderation

Date 2026-10-25. Stack: #62 → #64 → #65 → #66 → #67 → #68 → #69 → 01G.
**NOT APPROVED OR DEPLOYED.** This file and every code change live exclusively
in isolated GitHub Draft PRs. No live migrations, Render/Telegram/Supabase/Storage
changes, no Veyra access and no extra spend.

## A. Telegram allowlist, not public invite links

Database migration `infra/migrations/0007_reg01g_invite_gate.sql` provisions
`luemi_private.beta_invites` with a private environment + real Telegram
numeric ID pair, `active/revoked` states and FORCE RLS. It contains NO sample
real users. Only the isolated `luemi_invite_operator` login may grant/revoke.
An active invite is looked up from *Telegram signed initData* by the
`luemi_auth_issuer` login BEFORE creating an actor or session. No client-side
header, self-entered Telegram ID, password or link bypasses authorization.

If `REM06_BETA_INVITES_ENABLED=1` and
`REM06_BETA_INVITES_APPROVED=1` (plus prior approved privacy/V2 gates), the
session issuer also rechecks that signed actor's Telegram ID still has an
active invitation for every authenticated operation. Revoking an invite
immediately makes the old session return Unauthorized; signed initData
replay cannot create a new session. New user creation and profile publication
are blocked without an invite. **01G enforces the invite gate for ALL
real-profile publication**. Turning on publication without the gate
now fails configuration at startup.

An owner-controlled **manual** operator command is implemented by
`apps/api/src/beta-invite-operator.ts`; requires an isolated DB login and
`REG01G_INVITES_OPERATOR_ENABLED=1`,
`REG01G_INVITES_APPROVED=1`. Credentials and real Telegram IDs are **not**
contained in GitHub or printed by the operator. Revoked accounts remain
private rows pending approved account deletion policy; invite revocation is
not user-data erasure.

## B. Real human photo queue and report triage (not synthetic approval)

Migration `infra/migrations/0008_reg01g_human_moderation.sql` creates
a separate `luemi_human_moderator` role and an append-only
`human_report_reviews` evidence table. It adds policy reason codes for
real people reviewing private PNG media.

Operator-only `apps/api/src/human-review-runner.ts` supports:

- `queue`: list a bounded number of pending photo IDs and open report IDs;
- `preview <assetId> <localPrivateFile>`: read a **pending private PNG** from
  private Storage and write a new local mode-0600 file, with a second
  permission/generation check after remote download; never sends signed URLs
  or uploads media to a public bucket. Human operator must delete the local
  reviewed copy according to the approved policy;
- `approve <assetId>` or
  `reject <assetId> human_policy_violation|human_minor_suspected`:
  single-decision only, locks the current photo/job generation, changes
  pending → approved/rejected, adds a moderator-labelled decision in the
  same database transaction, no auto-publication;
- `report <reportId> triaged <reportedReason>` or
  `report <reportId> dismissed no_violation`: review open reports,
  transition once and add independent moderator-labelled human-review record.

No generic public moderator HTTP endpoint, shared user login, unbounded
review queue or Data API exposure exists. The moderator role cannot read
Telegram IDs, private draft fields, sessions, user auth credentials or edit
published profile/ban users. Even having a copied UUID cannot bypass role
checks or scoped RLS.

**A report marked triaged is NOT equivalent to an enforced removal or ban.**
Appeals, escalation, emergency protection, moderation policy and safeguards
for minors and risky content require their own independently approved steps.
The operator must actually inspect each photograph before approving it;
the software never calls syntheticModerate for real operations.

Maintenance is disabled unless
`REG01G_HUMAN_REVIEW_ENABLED=1` AND
`REG01G_HUMAN_REVIEW_POLICY_APPROVED=1`, correct operator ID and separate
PostgreSQL credentials are provisioned. No cron/job or staff credentials have
been created.

## C. Synthetic acceptance

`real-ops.test.ts` with actual temporary PostgreSQL 16 and disjoint logins:

- Signed Telegram outsider denied `403 invitation_required` before actor insert.
- Owner-granted invite permits exact identity; owner revoke makes old cookie
  fail and prevents new session.
- Invite operator cannot inspect sessions/actors or another namespace;
  issuer credential cannot operate invite roster.
- 3 sanitized pending photos can be privately inspected and human-approved
  in one transaction per item. Duplicate approval fails; already approved
  images cannot be retrieved as a pending review.
- A real signed user can report another account; human moderator records
  triage and a second decision fails. No user-facing moderator route.
- Human reviewer credential cannot be substituted with the normal request
  role. Existing REM01A-01F tests remain active.

## D. Hard requirements before friends join

1. Confirm real Supabase database schema and strict credentials in an
   isolated approved staging environment, not the current live project.
2. Audit and verify private Storage binary behavior, moderation preview,
   local reviewed-copy cleanup, and per-actor delete outbox under genuine
   network faults. Only synthetic Storage tested in this PR.
3. Owner-approved invitation cohort (consenting adults, real Telegram IDs)
   and a staff operator with identity/permission/incident management.
4. Production security review of moderation policy, report escalation,
   takedown/ban and appeals; a human reviewer must be available.
5. Approved privacy/consent, GDPR/data retention/export and actual
   account deletion review, backup retention and deletion receipts.
6. Verified no additional paid expenses (Render free quotas, Supabase
   branch/project budget). No extra service or dev DB should be created
   until price/quota risk is confirmed.
7. A55 Telegram Android WebView device QA for all registration, photo
   recovery, deletion, allowed/revoked cohort and stale-session boundaries.
8. Explicit owner go-live signoff, staged rollout and rollback protocol.

**Verdict: NOT LIVE, NO-GO for unsupervised real adult beta.** Approved
mock/visual screens and original LUEMI assets are untouched with feature
flags OFF. Existing services remain frozen.
