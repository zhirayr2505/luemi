# LUEMI 💜 — human moderation and data-erasure operations | 28 October 2026

**Internal operator procedure, NOT an activation approval.** Public audience: adults 18+. Product operator: Гулгулджян Жирайр Григорьевич; public complaint channel: Telegram @zhiiirro. Moderation may expose private personal images; only authorized reviewers should ever view the images. Do not copy identity documents, private media or Telegram IDs to GitHub.

## Current infrastructure limitations

- `luemi_beta_human` and `luemi_beta_erasure` exist as **NOLOGIN** roles. The eight successfully bootstrapped app roles do not substitute for operator/moderator roles. A successful bootstrap does not provide moderation workers.
- The moderator CLI `apps/api/src/human-review-runner.ts`, erasure CLI `apps/api/src/erasure-runner.ts` and safety CLI `apps/api/src/safety-runner.ts` are implemented, but are isolated from the public HTTP server and all require separate preconditions.
- No Render cron or operator dashboard is commissioned. Do not present these as staffed 24/7 services.

## Roles and separation

| Process | PostgreSQL grants checked in code | Required operational conditions |
| --- | --- | --- |
| Human photo/report review | `luemi_human_moderator`, not request/issuer/worker | Dedicated role, `REG01G_HUMAN_REVIEW_ENABLED=1`, `REG01G_HUMAN_REVIEW_POLICY_APPROVED=1`, operator label |
| Irreversible erasure worker | `luemi_erasure_worker`, not user session role | Dedicated DB login, `REM06_ERASURE_WORKER_ENABLED=1`, `REM06_ERASURE_POLICY_APPROVED=1`, `REM06_ERASURE_MAINTENANCE_APPROVED=1`, valid private Storage credentials |
| Safety/suspension operator | `luemi_safety_operator`, not human-review or HTTP role | Dedicated SQL login, `REG01H_SAFETY_OPERATOR_ENABLED=1`, `REG01H_SAFETY_POLICY_APPROVED=1`, operator label |
| Account erasure request HTTP endpoint | `luemi_erasure_request` | Separate requester role and `REM06_ERASURE_REQUEST_ENABLED=1`, `REM06_ERASURE_POLICY_APPROVED=1`, secure real session and private/published profile gates |

**Never reuse the owner URL, PostgreSQL superuser, Supabase service role, shared operator credentials, any of the eight application roles, or any `VITE_*` environment variable.** Establish credential recovery, rotation and revocation before activation. A mere nonempty connection string is not proof of least privilege: actually run the runtime role checks and negative RLS probes.

## Procedure: photograph review

1. The published profile must start hidden or pending, without any unreviewed image entering the discovery feed. Auto-reencoding is a security preprocessing step, **not** content moderation.
2. At each duty period, privately inspect the bounded queue. For an approved, secure operator terminal, the implementation supports `queue`, `preview <assetId> <newPrivatePath>`, `approve <assetId>`, and `reject <assetId> human_policy_violation|human_minor_suspected`.
3. `preview` fetches only a pending, private sanitized PNG and uses an exclusive new local file at mode 0600. Review with an application that does not sync/cache the file to public/cloud services. Securely remove the local copy after review per a written retention procedure.
4. Reject suspected minors, sexual exploitation, impersonation, nonconsensual private content, abusive/violent/hateful content or other prohibited media; escalate reports and urgent threats. Do not make claims of automatic age verification or perfect abuse detection.
5. `approve` is allowed only after a real human saw the pixels. Each approval or rejection must be recorded by the operator CLI in append-only moderation decisions. Duplicate decisions, stale generations and post-deletion access must fail. Never manually set `state='approved'` in a SQL console.
6. User feedback should distinguish `pending_review`, rejected media needing replacement and published profile. Never publicly expose pending storage objects or signed reviewer URLs.

## Procedure: reports, suspension and appeals

- The same human CLI supports `report <reportId> triaged spam|harassment|impersonation|unsafe_media` and `report <reportId> dismissed no_violation`.
- Triage is **not** an actual takedown. Follow through using the separately approved safety operator, evidence evaluation and due process. Keep reviewed evidence private with minimal access, delete according to policy, and document appeals.
- Assign a named human who actually checks @zhiiirro and the moderation queue; define an operational coverage window and escalation contact. Without staffing, leave publication disabled.
- If suspected child abuse exploitation appears, do not distribute images to reviewers by chat. Follow applicable law and appropriate escalation procedures.

## Procedure: deletion and failures

- Deletion requires a fresh authenticated session and explicit confirmation. The HTTP request must revoke sessions and hide the profile immediately; returning HTTP 202 only means **queued**, not fully erased.
- A trusted operator triggers `erasure-runner.ts` under a distinct least-privileged role with private Storage. Verify durable outbox success and failures/retries for 404 or network errors.
- Monitor outstanding age and count of deletion requests; no real-user production rollout until monitoring and response coverage are demonstrated. Do not invent a deletion SLA; set the lawful timeline and backup retention through an approved policy.
- If a Storage purge fails, never tell the user erasure is complete; preserve retry evidence, do not expose media and restore worker access only through approved recovery.
- Roll back unsafe feature flags without erasing existing users or changing the namespace unexpectedly.

## Dry-run acceptance checklist

- [ ] Human-review operator role and credentials provisioned securely, can connect with correct `current_user`, `session_user`, `row_security=on`, no privilege escalation.
- [ ] Same checks for independent erasure and safety operator roles; negative tests deny cross-role use.
- [ ] Real private Storage GET/PUT/DELETE behavior verified including crash/retry, without exposing objects.
- [ ] A human reviewed 3–6 actual private photos; decision auditable. Foreign account cannot read pending media; late decisions are rejected.
- [ ] Real report handling, suspension/revocation, appeal, block/unmatch, and another user's privacy verified.
- [ ] Test account deletion: session revoked immediately, objects and rows removed by worker, failure/retry handled; no claim of success until verified.
- [ ] Operator contact, incident response, legal retention and international transfer review approved.
- [ ] Same scenarios on actual Telegram Android WebView and two separate real accounts.

**Default status: NO-GO.** This checklist is operational planning, not evidence that any test has passed.
