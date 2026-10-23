# LUEMI 💜 — REM-05E Webhook Secret Hygiene & Mock-Only Rotation QA

**Date:** 2026-10-24.
**Immutable accepted parent:** c7e434175db648ca3d911963f538192a9cf74cfa.
**Branch:** remediation/rem-05e-webhook-secret-rotation-20261024.
**PR target:** remediation/rem-05d-private-media-rls-moderation-20261023 (NOT main).
**Final code+documentation SHA and PR ID:** read the final verified PR metadata;
this document deliberately avoids a self-referential commit SHA.
**Execution verdict:** SOURCE/MOCK SCOPE UNDER INDEPENDENT REVIEW; live
environment UNKNOWN / NOT VERIFIED. Owner acceptance separately required.

## 1. Source-verified problem and vendor semantics

At the accepted parent apps/api/src/telegram-setup.ts, configureStagingTelegramBot
reads getMe, getWebhookInfo, getChatMenuButton, then returns early on unchanged
webhook URL and normalized menu. The receiver verifies the supplied
X-Telegram-Bot-Api-Secret-Token with timingSafeEqual and a single active secret
in apps/api/src/telegram-webhook.ts. Since Telegram's WebhookInfo includes URL,
error, pending updates and related transport metadata but NOT secret_token,
same URL/menu is destination consistency only; it never proves secret generation
is synchronized with the receiver.

Official vendor contract (read 2026-10-24):
https://core.telegram.org/bots/api#setwebhook
https://core.telegram.org/bots/api#getwebhookinfo

**Historical exposure status: UNKNOWN.** The legacy OPEN_QUESTIONS note reports
accidental staging webhook secret exposure; no protected change history or live
secret is inspected in this stage. No conclusion of active compromise or
successful historical rotation is justified. PUBLIC repository policy unchanged.

## 2. Code-flow: before / after

BEFORE:
  normal server opt-in TELEGRAM_SETUP_ON_START
    -> getMe -> getWebhookInfo -> getChatMenuButton
    -> URL and menu equal => NO setWebhook
    -> implicit human temptation to interpret this as secret-sync proof.

AFTER:
  normal server opt-in TELEGRAM_SETUP_ON_START
    -> same read-only destination check and same no-op
    -> result.secretGenerationStatus = unknown_not_attested
    -> NO generation comparison or new rotation side effect.

  separate exported executeSyntheticWebhookRotation, not wired into server/config:
    -> require explicit mock-only mode + synthetic test token + owner-approved
       synthetic invocation + staging destination + distinct generation labels
       + policy-valid candidate + not listed exposed
    -> verify fake getMe + fake getWebhookInfo + fake menu (foreign=>refuse)
    -> optionally fake setChatMenuButton when menu not yet configured
    -> FORCE fake setWebhook even when URL unchanged
       (allowed_updates=["message"], drop_pending_updates=false)
    -> ACK requires ok:true/result:true; otherwise partial/UNKNOWN
    -> optional injected receiver proof must accept candidate AND reject old
    -> only synthetic proof state; liveTelegramVerified ALWAYS false.

There is no real Telegram transport/CLI/endpoint in this module. Normal config
flags do NOT turn it on. Single-active-token Fastify verification is unchanged;
no production dual-secret acceptance.

## 3. Security decisions and traceability

| Source | Requirement | REM-05E realization |
|---|---|---|
| MASTER §12.6 / LU-35 | URL != secret attestation | Explicit unknown/not-attested normal result; mock forced update |
| MASTER §12.8 | code/procedure separated from live rotation | isolated executor, dry-run runbook, no real secrets |
| ADR-05A-10 | public repo and incident unknown | nonsecret ledger, no historical closure |
| ADR §12.5 REM-05E | fail-closed negative paths | mock identity, destination, generation, API failure tests |
| PRE05-007 | historical exposure unverified | separate future operator triage and possible escalation |
| Existing REM-05D | preserve D-R4 / RLS / Chromium | no source or migration modifications in 05B/C/D |
| Future REM-05F | readiness only after separate permission | NOT STARTED |

### Default-deny state matrix

| State | Meaning | Operator follow-up |
|---|---|---|
| refused | no approved mock execution or foreign/invalid preflight | inspect safe cause metadata |
| duplicate_synthetic_proof | known synthetic generation repeated | never infer live attestation |
| telegram_update_acknowledged_synthetic | fake Bot API acknowledged | receiver still unverified |
| end_to_end_synthetic_proof | injection accepted candidate, rejected previous | only mock proof |
| partial_menu_applied | menu potentially updated, webhook incomplete | reconcile before retry |
| telegram_state_unknown | fake webhook write may have applied | no blind retry, investigate |
| synthetic_delivery_failed | fake receiver proof fails after ack | fail closed |

## 4. Negative security matrix and non-live fixtures

All E01–E19 in apps/api/test/rem05e-rotation.test.ts use exclusively synthetic
Bot credentials and a function-injected fake Bot API; tests must pass only when
the fake payload explicitly has allowed_updates=["message"] and
drop_pending_updates=false. No network access to Telegram, no bot-token URL,
no raw Telegram update logging. No deployment flags or webhook writes.

| Cases | Expected controls | Evidence gate |
|---|---|---|
| E01/E02/E14 | explicit same URL rotation vs normal no-op, never false generation attestation | rem05e mock suite |
| E03/E04 | duplicate generation only skipped with labelled synthetic proof | rem05e mock suite |
| E05/E06/E19 | foreign bot, URL, path, origin and query refused | rem05e mock suite |
| E07 | missing approval, invalid env, real-looking token, invalid candidate/label, known exposed ID refused before any transport call | rem05e mock suite |
| E08/E09 | false result, fake HTTP failure, malformed/missing response, throw, no verified status | rem05e mock suite |
| E10 | interrupted menu/webhook sequence returns PARTIAL/UNKNOWN | rem05e mock suite |
| E11/E12/E13 | isolated Fastify old/wrong/absent header 404 with no sendMessage response; candidate accepted | rem05e mock suite |
| E15/E16 | injected mock only, sanitized outputs, no raw failure body/token-bearing endpoint | rem05e mock suite |
| E17 | exactly one attempted setWebhook call; operator controls bounded retry | rem05e mock suite |
| E18/E19 | approved Telegram payload and inherited bootstrap tests | rem05e preservation suite |
| E20 | prior PostgreSQL security, 50-cycle Chromium and browser regressions | existing 05B/C/D workflow matrix |

The E02 before/after behavior is source-confirmed: previously, a same-destination
startup returned without any setWebhook even if the receiver environment
credential had changed. We do NOT intentionally mutate or inspect the live
credential or claim a live RED reproduction. E01 is the distinct explicit mock
executor now capable of forced same-URL update.

## 5. GitHub matrix / CI provenance

**Authoritative results are the PR's same-final-SHA workflow/job ledger.**
Before new focused CI is complete, test statuses are not predeclared PASS.
The accepted parent 10 workflows / 34 jobs were independently inspected:
- Foundation push/pr: 40026161871 / 40026166658 — 7+7
- Browser REM-00C push/pr: 40026161744 / 40026166628 — 2+2
- REM-05B push/pr: 40026161764 / 40026166571 — 3+3
- REM-05C push/pr: 40026161752 / 40026166522 — 3+3
- REM-05D push/pr: 40026161761 / 40026166562 — 2+2

Parent #54 pull_request rem05d-preservation failed first attempt on
unchanged REM-02D physical-pixel timing comparison (393 vs 0) and passed
attempt 2 on identical SHA. Do not conceal, disable or silently normalize
this flaky Chromium evidence. Future CI failures/retries must be disclosed.

New REM-05E workflow is push+PR, two focused jobs per event. Existing
05B/C/D workflows must trigger on REM-05E head/base in addition to existing
triggers, with intact SQL/Chromium scripts. Expected target for final SHA:
12 workflow runs / 38 completed jobs, if repository execution matches topology.
No live database, storage, credential or user content is used in these jobs.

Public added-lines diff scanner is required but cannot prove older public Git
history/Actions artifacts/archived clones lack historical exposed credentials.
Separate owner-authorized historical inspection remains open.

## 6. Non-live side-effect ledger

| Surface | REM-05E allowed operation | Evidence |
|---|---|---|
| GitHub | one new branch, one draft PR, additive code/tests/docs/CI | PR diff & Actions |
| Telegram | ZERO live Bot API calls, webhook writes, BotFather updates | no runtime transport in module |
| Render, Supabase, Storage | ZERO reads/writes of live secrets, users, objects | no connector calls |
| User messages/photos | ZERO; synthetic Fastify fixture only | test code |
| Repo visibility | unchanged PUBLIC | no repo settings mutation |
| Merge / deploy | ZERO | draft/unmerged PR |
| Existing REM-05B/C/D | preserve previous controls and D-R4 | prior CI on exact new SHA |

## 7. Operator runbook and actual BLOCKED evidence

DRY RUN ONLY:
docs/security/REM_05E_WEBHOOK_ROTATION_OPERATOR_RUNBOOK_2026-10-24.md

**Required separate authorization:** protected metadata-only history of which
generation was exposed, current secured generation and any past rotation; exact
Bot/Render/receiver cutover approval and window; verified new secret-manager
version and signed synthetic delivery/rejection observations; incident closure
evidence. DO NOT supply secret values in PR, chat or issue.

### Acceptance classification

- PASS only if same-final-SHA code mock, all negative tests, inherited tests,
  real PG and Chromium gates, and 0 new secret scanner violations are verified.
- PARTIAL: future operator plan, historical metadata triage and environment
  threat assessment still requiring owner/secure-operator evidence.
- BLOCKED / NOT VERIFIED: current actual webhook generation, historical
  rotation/incident closure, live webhook cutover, staging delivery and G6
  production readiness. These are explicitly OUTSIDE REM-05E authorization.

**STOP after REM-05E for owner's independent technical acceptance.**
No merge/deploy, live secret operation or REM-05F authorized.
