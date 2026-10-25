# LUEMI 💜 — REAL REGISTRATION 01H | Safety suspension, appeals, beta release gate

Date: 2026-10-25. GitHub stack: #62 → #64 → #65 → #66 → #67 → #68 → #69 → #70 → #71.
All code lives in unmerged Draft branches. **NOT DEPLOYED; not ready for inviting adults.**

## Sanctions: evidence and atomic privacy

Migration `infra/migrations/0009_reg01h_enforcement_appeals.sql` creates FORCE-RLS
private tables `account_enforcements` and `account_appeals` with distinct roles:
`luemi_safety_operator` (back-office, operator credential) and
`luemi_safety_appeal` (server-scoped signed Telegram identity). Neither has
Supabase Data API grants or SECURITY DEFINER shortcuts.

A separately approved operator can suspend an active account **ONLY after**
a specific report has been marked `triaged` by a human reviewer in 01G.
`suspendReportedActor` locks user/media/publication operations and then in
one transaction: records the report-backed reason and operator label, marks
the account suspended, revokes its existing sessions, hides public profile
and permanently revokes approval of formerly published photos, and marks the report actioned.
The current read-side account-status and signed-session checks deny further
profile/media access. Accounts already deleted, banned or suspended cannot
be forcibly re-suspended or accessed through this operator tool.

**A safety report does NOT by itself suspend anyone:** a deliberate
human-reviewed action and a separate role are required. There is no
public moderation API and no automatic sanction by a machine classifier.

## Appealing without an active session

A suspended user cannot log into a normal V2 cookie session.
`POST /api/v3/safety/appeal` therefore requires a fresh Telegram-signed
`initData` (valid maximum age 5 minutes) and an exactly matching Origin.
It derives the user solely from the Telegram cryptographic signature;
caller-supplied actor IDs and guessed enforcement IDs are not accepted.
The `luemi_safety_appeal` SQL role may look up **only its own suspended actor**
and open enforcement, then insert one bounded text statement (20–750 chars).
The database enforces one appeal per enforcement record. Duplicates return
409; non-suspended users have no accessible case. The appeal principal
cannot read sessions, private drafts, raw photos, other appeal statements,
Telegram IDs of other users or update statuses.

The opt-in `SafetyAppealPanel` appears in the failed-login entry state only
when `VITE_LUEMI_SAFETY_APPEALS_UI=1` AND
`VITE_LUEMI_AUTH_V2=1`. It never stores initData or session tokens.
With flags disabled, the accepted LUEMI welcome and registration screens
remain unchanged.

## Resolving appeals

`safety-runner.ts` is a manual operator-only CLI, not an HTTP endpoint.
It requires explicitly approved policy flags, an isolated DB operator login
and a distinguishable operator label. It lists pending appeals and resolves
each **once** as accepted or rejected, recording the reason and reviewer.
On acceptance, the suspended account changes back to active in the same
transaction; the existing sanctions record is retained as restored evidence.
**Previously revoked cookies, hidden profiles and media approvals remain
revoked/private. Formerly public photos cannot be republished without new
upload and human review.** New signed Telegram login and fresh publication approval
are needed before other adults can view the profile again.

The worker's database permissions cannot DELETE user accounts, bypass RLS,
read raw Telegram IDs or inspect auth token hashes.

## Synthetic CI acceptance

CI provisions PostgreSQL 16 disposable roles and applies migrations
0002–0009. A multi-user test checks:
- untriaged report cannot trigger a suspension;
- a human triaged report enables deliberate, atomic hide and session revoke;
- a suspended identity cannot log in or access old photos;
- forged, cross-origin or foreign identity appeals are rejected;
- fresh signed Telegram data can submit one appeal, duplicates are denied;
- only the operator can accept, and the old cookie remains unusable;
- other invited users remain unaffected;
- previously reinstated account deletion also removes safety and appeal
  evidence, with no access to unrelated users' data.

## Staging go/no-go — remaining blockers

- [ ] Confirm genuine Supabase isolated database/Storage behavior and full
      migration compatibility. **No live 0002–0009 migrations applied.**
- [ ] Review current Supabase free billing/quotas and Render build-minute/CPU
      limits, plus any cost of separate staging/branch. Budget for additional
      paid expenses remains **$0**.
- [ ] Approved moderation/suspension and escalation policy, trained humans,
      appeal handling SLA and decisions on emergency/minor protection.
- [ ] User privacy/retention policy, data erasure, backups, moderator local
      reviewed-photo handling, appeal record retention and subject data rights.
- [ ] Actual bot webhook secret rotation/identity readiness, abuse throttling
      and credential provisioning under explicit owner control.
- [ ] Closed adult invitation cohort; run complete registration/appeal/photo/
      deletion journeys on Samsung Galaxy A55 **inside** Telegram WebView.
- [ ] Independent security sign-off on accepted SHA and rollback procedure.

**Verdict: software work in an isolated PR; no live service is launched.**
No merge, Render deploy, new service, active bot/Supabase/Veyra change,
secrets modification, paid expense or real user write was performed.
