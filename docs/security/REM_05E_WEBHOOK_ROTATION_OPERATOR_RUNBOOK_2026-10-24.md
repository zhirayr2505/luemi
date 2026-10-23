# LUEMI 💜 REM-05E — Telegram webhook secret generation operator runbook

# NOT AN EXECUTABLE AUTHORIZATION — NO LIVE TELEGRAM/RENDER/BOTFATHER CHANGES IN REM-05E

**Version:** 2026-10-24 · **Classification:** public, nonsecret, DRY-RUN · **Gate:** CLOSED.
No credential values, secret fingerprints, bot-token-bearing URLs, real Telegram calls,
production actions, Render writes, webhook writes, BotFather changes or deployments are approved.
This is a future procedure, not an execution record.

## Security premise

getWebhookInfo.url and the Telegram bot menu identify destinations, NOT Telegram-configured
secret_token generation. Bot API cannot report the current generation. setWebhook
acknowledgement can establish a requested change was accepted, but cannot establish
receiver generation or private delivery. Record generation labels through independently
protected change records and an end-to-end receiver proof. A label is not a credential.

Existing TELEGRAM_SETUP_ON_START is a legacy staging setup switch, NOT a rotation
switch. Its same URL/menu path remains a no-op. REM-05E adds an entirely separate
isolated-mock-only operation. There is NO operator live CLI nor production transport,
and no flag to enable one by setting an environment variable.

## Gate 0 — incident triage / safe inventory

Before reading anything live, obtain separate approval even for safe metadata.
Record environment/bot identity (nonsecret identifier), intended HTTPS origin,
menu path, environment manager name, current credential generation label, creation
and rotation dates, who approved each change, last incident ticket and provenance.
Read protected records in their access-controlled platform; publish only nonsecret
metadata and an evidence pointer. Do not copy secret values, hashes/fingerprints
derived from the values, raw message/chat IDs, auth headers, requests or credentials
into GitHub, chat, issues, actions, artifacts or terminal history.

Historical docs/OPEN_QUESTIONS.md exposure note is NOT VERIFIED as resolved.
A documented rotation event for an unrelated generation is insufficient.
If protected records establish that a previously exposed secret remains active,
classify INCIDENT / OWNER ACTION NEEDED and escalate promptly for a separate,
time-bounded emergency operational authorization. Do not claim an active incident
without evidence, and do not rotate the secret in this code stage.

## Gate 1 — separately signed owner permission (NOT PROVIDED)

Written owner authority must name exact bot/environment, current/proposed nonsecret
generation IDs, operator, peer reviewer, start/end window, permitted Bot API
read/write calls, accepted delivery outage and secure recovery plan. Confirm staging
bot identity, destination path and menu before any write. Name which receiver gets
new secret and the observer validating acceptance. No approval is inferred from
this document, code, PR or successful mock CI.

## Gate 2 — secure change plan and dry-run

Use a protected credential store to generate and hold a sufficiently random
24–256 character Telegram-compatible candidate matching [A-Za-z0-9_-].
Never put candidate in argument lists, URLs, shell commands, developer consoles
or CI logs. Keep single-active-secret receiver policy unless a separately approved,
narrow transition explicitly changes it. If old secret is compromised, choose
a brief coordinated fail-closed outage instead of prolonged dual acceptance.

Owner-approved sequence to review: (1) prepare candidate in protected store;
(2) coordinate receiver accepting only candidate at cutover point;
(3) force Telegram setWebhook(secret_token) even if URL unchanged;
(4) validate Bot API ok:true AND result:true;
(5) send a synthetic non-PII update and prove candidate accepted and old rejected;
(6) inspect safe transport metadata;
(7) destroy/retire old generation under policy.
Coordinate downtime explicitly: requests may transiently fail closed. If the
sequence differs, document its rationale and a safe reconciliation model.

## Gate 3 — Telegram mutation (FUTURE ONLY)

Use protected Bot API transport in the authorized environment only after
identity, menu and webhook destination preflight. Reject foreign bot, webhook
URL, menu origin/path/query, scheme and unexpected operation.
On separately approved new-generation cutover call setWebhook with intended
URL, candidate secret_token, allowed_updates:["message"] and
drop_pending_updates:false. Never silently delete pending updates.
HTTP 200 + ok:true with result:false, timeout, malformed response and
getWebhookInfo.url alone never prove rotation. No infinite/backoff loop.
Default attempt count 1; subsequent attempt needs explicit review because
the first may have reached Telegram.

## Gate 4 — delivery and old-generation rejection

Approved harness must send harmless synthetic /start traffic and verify receiver
response, zero unauthenticated bot method side effects, old/missing/wrong
X-Telegram-Bot-Api-Secret-Token gives 404, and no second acceptance path.
Capture pass/fail and nonsecret trace IDs, labels, environment, timestamp,
approval reference and reviewer. Separately inspect Telegram error counters and
last error time only if authorized. Never collect raw updates, private chat IDs,
headers or full payloads. Bot API ACK is not receiver proof; public REM-05E
mock pass is not equivalent to live evidence.

## Gate 5 — failure matrix and stop / recovery

| Failure | Truthful state | Authorized recovery principle |
|---|---|---|
| Foreign bot/menu/webhook | REFUSED / NO WRITE | Investigate ownership; NEVER overwrite |
| Invalid credential/approval | REFUSED | Repair protected change request only |
| Receiver switched before Telegram failed | PARTIAL / fail-closed | Explicit controlled retry or keep outage; do not restore exposed token |
| Telegram accepted but response lost | TELEGRAM_STATE_UNKNOWN | Investigate secure records and delivery; authorize bounded retry |
| Telegram ack, receiver still old | DELIVERY_NOT_VERIFIED | Coordinate receiver update; minimize exposure |
| Menu changed but webhook failed | PARTIAL_MENU_APPLIED | Document partial config; separately approve corrective path |
| Old generation accepted after cutover | SECURITY FAILURE | Stop rollout and investigate receiver dual accept |
| Mock proof succeeds but live delivery fails | REAL_DELIVERY_UNVERIFIED | Review network/receiver metadata; no premature closure |

Never automatically roll back to a possibly leaked generation, retry from app
startup, downgrade traffic or disable webhook verification.

## Gate 6 — closure and monitoring

Close only after signed evidence proves current generation and replacement,
independent receiver proof, old-secret rejection, credential retirement, alert
owner/thresholds, retention and incident review. Record secret-manager version
ID without secret material. Historical public artifacts need separate audit:
added-lines PR scanner cannot prove public history and clones are clean.
PUBLIC repo visibility remains unchanged as owner authorized.

## REM-05E mock state machine and non-live proof

- refused: authorization/environment/bot/destination invalid; no mutation.
- duplicate_synthetic_proof: metadata-only duplicate suppression; NOT a live attestation.
- telegram_update_acknowledged_synthetic: fake Bot API result:true; delivery UNKNOWN.
- end_to_end_synthetic_proof: injected candidate acceptance and previous rejection;
  still NOT live.
- partial_menu_applied / telegram_state_unknown / synthetic_delivery_failed:
  partial or unverified; never claim live cutover.
- Every public result carries liveTelegramVerified:false. No real-value operation
  is implemented by REM-05E code.

STOP after REM-05E. No merge, deploy, live key rotation, webhook change,
BotFather change, RLS change or REM-05F under this authorization.
