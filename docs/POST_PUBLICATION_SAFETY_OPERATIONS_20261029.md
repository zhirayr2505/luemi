# LUEMI 💜 — Post-publication safety operations (operator runbook)

Status: ENGINEERING IMPLEMENTATION; NOT an approved production operations policy.

## Product rule
All consenting eligible adult users may publish 3–6 sanitized private-backed photos without prior human pre-review. **Technical image sanitation is not content verification.** Other eligible signed-in adults may report a published profile or block another user instantly. Blocking and reporting are independent actions. Reports do not reveal reporter identities to the subject.

## Report taxonomy and immediate priority
- **Urgent:** suspected child/minor (`minor_suspected`), images uploaded without permission (`nonconsensual_photo`), explicit prohibited/unsafe imagery (`unsafe_media`), threats and harassment.
- **Routine:** impersonation, spam/advertising.
- For urgent material involving child sexual exploitation or imminent harm, preserve a minimal lawful incident record and follow appropriate local emergency/reporting procedures; avoid downloading, redistributing, or viewing illegal images unnecessarily.

## Workflows and scoped permissions
1. Signed-in member presses `Пожаловаться`, picks a reason, and the existing authenticated POST `/api/v2/profile/reports` creates an immutable owner-scoped report ID. `Заблокировать` is separately immediate.
2. A dedicated `luemi_human_moderator` login (NOT public API credentials) calls the existing operator CLI `human-review-runner report <reportId> triaged <reason>` or `... dismissed no_violation`. `listReviewQueue` shows IDs, reasons and age, not Telegram IDs or private media keys.
3. An independent `luemi_safety_operator` login calls `safety-runner suspend <reportId> <reason>` only after triage. The action hides the subject's profile and images, revokes all active sessions, creates an enforcement record, and changes actor status. No one can suspend a user from the browser.
4. Affected user can submit an authenticated appeal where enabled. Operator reviews the appeal and, if accepted, restores access. **A restored account stays hidden** until its owner explicitly republishes.
5. Account erasure requests use a separate requester and worker, and cannot be processed as a substitute for report resolution. Remove profile data and private photos per the published retention policy.

## Staff access / safety gates (still pending)
- Explicitly appoint a responsible human able to review urgent reports. The previous operator bootstrap branch `feature/open-launch-operator-automation-20261028` has not been merged/provisioned; four isolated logins are not active.
- Establish documented review and escalation windows, audit log retention, lawful data transfers, off-hours emergency handling, and appeal path.
- Before enabling public admission, verify with consented synthetic actors: six reason codes, immediate block two-way hiding, report receipt, independent triage, urgent suspension, media denial after suspension, and proper appeal/erasure.
- **No manual per-photo pre-approval queue may be used as a condition of publishing.** Reviewing specific reported photos after publication is permitted for safety.
- Do not set `REG01G_HUMAN_REVIEW_POLICY_APPROVED` or `REG01H_SAFETY_POLICY_APPROVED` merely because this runbook exists. Approval must reflect live staffed operations.

## Security
- Private Supabase Storage remains private. Never send object keys, session tokens, database URLs, or photo bytes into GitHub Actions logs.
- Report check constraints on `reports`, `human_report_reviews`, and `account_enforcements` must all recognize new urgent reasons before enabling the new API.
- Changes to this flow are DB-migration-first, then verified API/UI deployment. Prior four reasons retain backward compatibility.
