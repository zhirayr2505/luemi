# LUEMI 💜 — REM-05C technical verification / owner review

**Date:** 2026-10-23 · **Scope:** ONLY REM-05C, LU-25/26/27 · **Status:** CODE + AUTOMATED SYNTHETIC QA CANDIDATE — NOT PRODUCTION READY. The final exact HEAD and same-SHA GitHub Actions links must be recorded in Draft PR #53 (the document cannot embed its own future commit SHA).

## 1. Immutable provenance / authorization

- **Accepted parent:** `7c95016a10db7e03af24c460072275f85c5f98b6` (REM-05B, Draft PR #52, OPEN/UNMERGED).
- **One implementation branch:** `remediation/rem-05c-geo-rate-cache-telegramweb-20261023`, born exactly at accepted parent (never main/staging).
- **One Draft PR:** https://github.com/zhirayr2505/luemi/pull/53 against `remediation/rem-05b-telegram-identity-sessions-20261023`.
- **PUBLIC is deliberate.** All new text, synthetic fixtures and CI output considered publicly visible; no real credentials or real users introduced.
- **No operational side effects:** NO Render deploy/env/config, NO Supabase migrations/Storage, NO bot webhook/menu/secret rotation, NO Geoapify billable calls, NO merge/production data. PostgreSQL 16 migrations apply exclusively to disposable GitHub-hosted test DBs.

The architecture follows master §12.3–12.5, REM-05A ADR-07/08, and the independent REM-05B hardening report. This step does **not** grant permission for REM-05D–05F or product features.

## 2. New implementation and trust boundaries

| Boundary | Implemented behavior | Notes / limits |
| --- | --- | --- |
| `GET /api/geo/search` legacy | Local seven-city fixture only, honest `coverage:"demo"`; never calls Geoapify even if a key is present | Search query 2–80 Unicode code points; too-short query returns an empty demo list |
| `POST /api/geo/reverse` legacy | Explicit 503 `geocoder_unavailable` | Cannot transmit GPS to unprotected provider |
| `GET /api/v2/geo/search` | Requires REM-05B opaque verified session; 400 invalid input; opt-in provider budget or honest demo results | No trust in X-Actor-Id, raw initDataUnsafe, XFF, HTTP Origin alone |
| `POST /api/v2/geo/reverse` | Requires REM-05B verified session **plus** original `protectedMutation` Origin/CSRF guard; POST JSON; body 1024B and finite legal lat/lon | No pre-approved real provider activation; client manual fallback |
| Chargeable provider admission | Requires **all** REM05B sessions + REM05C + provider flag, server key, valid isolated global budget store, known vendor quota & explicit stop-cap | Key presence alone never enables the vendor |
| `luemi_private.geo_daily_usage` | Atomic shared per-actor daily operation counters and global daily charges; global limit enforced under PostgreSQL transaction-scoped advisory lock | Global ceiling `<=floor(0.8*verifiedVendorDailyQuota)`; UTC accounting from DB clock; conservative no-refund on provider failure |
| `luemi_private.geo_inflight` | Shared provider concurrency leases, strict configured maximum, 12s expired-lease recovery, released after provider response/error | Connection failure / bad role / unavailable quota store fail closed before fetch |
| DB roles | New `luemi_geo_budget` role separate from both `luemi_auth_issuer` and `luemi_request`, no actors/sessions SQL read; `ENABLE/FORCE RLS` for new quota tables | Own least-privilege login for disposable test; 05B `safeRole()` disjoint membership and effective grants **unchanged** |
| Provider | Hardcoded Geoapify host/path, URLSearchParams encoding, 5s AbortController deadline, no automatic retry, normalization through existing `normalizeGeoapify` and `normalizeCountryCode` | Fake `providerFetch` seam used in tests, no credit consumed |
| Native user journey | Existing 8 registration steps, LU-18 cancellation generation, manual city recovery, local IDB preserved | GPS real upload requires **explicit build/runtime opt-in** and v2 verified CSRF; /geo-qa.html fixture can exercise synthetic GPS only when Vite DEV |
| Logging/secrets | Fastify request logging remains disabled for sensitive payloads; API errors generic, no provider URL/key/query/coordinates in response | Redacted public diff scanner remains a required CI gate |

### A. Authorization chain

```text
Telegram signed initData --(REM05B HMAC)--> opaque HttpOnly session
  --> REM05B session validation (actor UUID from server DB)
  --> [reverse only: Origin + CSRF] + route/body validators
  --> shared PostgreSQL budget (separate luemi_geo_budget role, RLS, txn)
  --> bounded provider concurrency lease
  --> hard-coded fake-only Geoapify endpoint in CI
  --> sanitized normalization + response; release lease
```

Direct `X-Actor-Id`, forged `X-Forwarded-For`, input `placeId` and CSS UI flags have **no** authority. Even with `GEOAPIFY_API_KEY`, legacy routes cannot call upstream. A disabled or unavailable budget store is never replaced by a local unlimited counter. No public city publishing is performed: any manual/forged placeId remains a local draft candidate, never verified published server identity.

### B. Quota reservation and rollback semantics

Within the same checked-out PostgreSQL quota-principal connection: confirm least-privilege role and effective active RLS; `BEGIN`; acquire namespace-scoped `pg_advisory_xact_lock`; compute UTC day in DB; delete expired inflight leases; enforce shared inflight ceiling; atomic `INSERT ... ON CONFLICT DO UPDATE WHERE used < cap RETURNING` once per actor and once per global vendor; create expiring lease; `COMMIT`; only **then** perform fake provider fetch; finally release lease. Any denied reservation `ROLLBACK` undoes both actor and global provisional increments. A reserved vendor request retains the charge even when the provider fails or times out, avoiding unbounded retry cost. This is a **conservative reservation model**, not vendor-invoice reconciliation. UTC day boundary, expiry leases, distributed lock overhead and possible quota overcount are documented operational tradeoffs.

**Policy values are provisional synthetic test controls, not production decisions.** Intended search 30/day/actor, reverse 10/day/actor, in-flight 3 and global <=80% verified vendor credits. CI uses deliberately tiny isolated caps to prove overspend resistance. No actual vendor limit or billing rate has been independently established.

### C. Rate topology (LU-26)

Fastify keeps `trustProxy:false`, so network throttling identifies the socket peer (`request.ip`) rather than an arbitrary X-Forwarded-For value. A small explicit route-aware `onRequest` guard supersedes the former global 60/min plugin registration. Current synthetic per-process defaults: preauth 80/min/peer + 400/min/instance; webhook 120/min/peer + 2400/min/instance; protected readiness 30/min/peer + 1200/min/instance. Liveness and static do not consume those buckets. After a **verified** REM-05B actor session, `/api/v2/me` has its own 180/min/actor process-local bucket. Geo cost is protected separately by shared PostgreSQL actor/global counters. `Retry-After` present when rejected. Invalid webhook secret still denied. **This does not prove global/distributed ordinary API rate security or real NAT fairness behind Render; actual proxy hop/CIDR chain is NOT VERIFIED.** Never change `trustProxy` without evidence.

### D. HTTP and Telegram Web embedding (LU-27)

| Route/content | Cache-Control | Frame policy |
| --- | --- | --- |
| Auth/geo/me/private/dynamic API and errors | `private, no-store`; `Vary: Origin, Cookie, Authorization` for API; remove ETag/Last-Modified | `frame-ancestors 'none'`, XFO DENY |
| HTML shell / SPA fallback | `no-store` (fresh version/hash) | Default CSP `frame-ancestors 'none'` + XFO DENY |
| Fingerprinted `/assets/<name>-<hash>.js/css/...` GET success only | `public, max-age=31536000, immutable` | Frame default DENY; content-neutral assets only |
| Unversioned/static/unmatched routes | `no-cache` | Frame default DENY |
| **Explicit** opted-in HTML iframe | `no-store` | HTTP CSP `frame-ancestors 'self' <exact-HTTPS-origin-list>`; remove conflicting XFO **only on HTML** |

`nosniff`, `Referrer-Policy:no-referrer`, `Cross-Origin-Resource-Policy:same-origin` set by onSend. HTTPS ancestor origins must be explicit and exact, no `*`, userinfo, query, path or wildcard. Default allowlist is empty and embedding **OFF**. Real Telegram Web ancestor/origin and nested frame behavior not verified. Existing REM-05B `SameSite=Lax` cookie untouched; no auto `SameSite=None`, memory bearer or BotFather changes. Chromium synthetic TLS iframe test confirms configured allowed parent and blocked attacker; **this is not real Telegram Web compatibility.** Synthetic tests cover representative MIME and cache behavior but no real CDN/Render on-wire proof or complete static asset ETag deployment validation.

## 3. HTTP error contracts (sanitized)

| Condition | HTTP | Error |
| --- | --- | --- |
| No/stale/revoked verified session | 401 | `unauthorized` |
| Invalid Origin or mutation CSRF | 403 | `forbidden` |
| Invalid query/coordinates/content type | 400 | `invalid_query` / `invalid_coordinates` / `invalid_content_type` |
| No city from valid provider response | 404 | `city_not_found` |
| Quota exhausted or provider rate-limited | 429 | `geo_quota_exceeded` / `provider_rate_limited` + `Retry-After` |
| Provider/budget store down; feature disabled | 503 | `geocoder_unavailable` / `service_unavailable` |

Examples use only synthetic values:
```http
GET /api/v2/geo/search?q=Yerevan HTTP/1.1
Cookie: __Host-luemi_sid=<synthetic-example-token>
```
No raw coordinates, API keys, real cookies or signed Telegram launch data belong in logs, URL examples, public artifacts or issue comments.

## 4. Synthetic validation matrix / independent CI evidence

**Evidence quality:** all executable assertions are in exact-SHA public Actions jobs and use only fake provider endpoints and disposable PostgreSQL16 roles; an earlier green SHA is not sufficient. Final run URLs, statuses and job counts are recorded separately in Draft PR #53 when all jobs finish. If any job on final SHA is pending/failing, the entire same-SHA gate remains **BLOCKED**.

| ID | State / evidence and limits |
| --- | --- |
| SEC-G01 | **PASS synthetic**: anonymous geo 401, legacy key present still demo only with zero provider calls; REM-05B session revoked/expired covered by inherited 8 PG groups. |
| SEC-G02 | **PASS synthetic**: actor A/B shared NAT, independent actor budget, verified sessions; no forged actor identity. |
| SEC-G03 | **PASS synthetic**: XFF, X-Actor-Id and malicious Origin/CSRF fail to alter geo admissions; no trusted raw userId. |
| SEC-G04 | **PASS synthetic**: two PostgreSQL pools + 100 concurrent reservations; two actual OS worker processes with a shared disposable DB, count <= cap. |
| SEC-G05 | **PASS only if final-same-SHA focused suite green**: fake provider 429, 503, malformed JSON and >5s AbortController timeout; no exposed key. No real upstream used. |
| SEC-G06 | **PARTIAL**: no server publish endpoint activated and no placeId promotion; future REM-05D ownership/location publication not implemented. |
| SEC-G07 | **PASS synthetic**: no provider key or feature opt-in returns demo seven-city fixture; legacy reverse denies. |
| SEC-G08 | **PARTIAL**: query Unicode/angle brackets, finite bounded coordinates and content type validated; adversarial fuzz / oversized content matrix not exhaustive. |
| SEC-G09 | **PASS synthetic**: exhausted quota 429/Retry-After, budget store refusal 503, reservations rollback atomically; provider receives zero call after deny. |
| R01 | **PASS synthetic**: liveness/static isolated from auth/geocoder buckets. |
| R02 | **PASS synthetic**: preauth bounded despite rotating forged XFF; trusted socket peer only, plus local global ceiling. |
| R03 | **PASS synthetic**: spoofed actor headers do not create an authenticated actor. |
| R04 | **PASS synthetic**: actors behind identical NAT have independent shared PG spending buckets. |
| R05 | **PASS synthetic**: webhook separate rate class and secret check; live Telegram retry/backoff not measured. |
| R06 | **PARTIAL**: quota distributed PG PASS, network/normal API limit local-process ONLY; Render proxy topology and full horizontal limit design pending. |
| SEC-W01 | **PASS synthetic Chromium HTTPS**: exact allowed parent frame loads and attacker parent cannot load. |
| SEC-W02 | **PASS inherited synthetic**: REM-05B blocked third-party cookie fails closed; real Web iframe cookies unknown. |
| SEC-W03 | **PARTIAL**: protected API no-store and vary tested, no CDN/shared cache in deployment examined. |
| SEC-W04 | **PASS synthetic**: hashed assets immutable, HTML fresh and unversioned nonimmutable; real deployed CDN/ETag unknown. |
| SEC-W05 | **PASS synthetic**: CSP strict defaults, no broad wildcard, XFO consistent with opt-in document. |
| SEC-W06 | **PASS only if final exact-SHA behavioral and 05B preservation runs succeed**; physical A55/iOS device GPU not tested. |
| SEC-W07 | **PASS synthetic**: invalid Origin + forged CSRF forbidden, CORS not used as auth; full attacker-browser CSRF adversary simulation not exhaustive. |
| SEC-W08 | **PASS no-change**: BotFather/Telegram Web security settings left untouched; actual ancestor and native Web embedding remain BLOCKED. |
| REM-05B PostgreSQL 8/8 | **MUST PASS unchanged** on final SHA: mixed PG roles direct/indirect/NOINHERIT, effective grants, scoped RLS, actor/session/CSRF races and disabled logout-all. |
| Previous client QA | **MUST PASS unchanged** on final SHA: REM00C, REM01A manual/GPS fixture, REM02–04D gesture/viewer/viewport/modal, IDB, 50 cycles. |

For each required run: actual `completed/success` job and steps (not status badge alone), no skipped security checks. Manual A55, iOS WKWebView and real Telegram Web remain **BLOCKED** by absence of authorized device/test origin. No test claim about native physical metrics, GPU memory or universal iframe cookie support.

## 5. Flags / deploy and rollback (names only)

**All new feature gates OFF in existing services.** For an independently approved *future isolated* environment only, relevant names: `REM05B_SESSIONS_ENABLED`, `VITE_LUEMI_AUTH_V2`, `REM05C_ENABLED`, `REM05C_GEO_PROVIDER_ENABLED`, `VITE_LUEMI_GEO_PROVIDER_ENABLED`, `GEOAPIFY_API_KEY`, `REM05C_BUDGET_DATABASE_URL`, `REM05B_BOT_NAMESPACE`, `REM05C_SEARCH_DAILY`, `REM05C_REVERSE_DAILY`, `REM05C_GLOBAL_DAILY_CAP`, `REM05C_VENDOR_DAILY_QUOTA`, `REM05C_MAX_INFLIGHT`, `REM05C_TELEGRAM_WEB_EMBED_ENABLED`, `REM05C_EMBED_ANCESTORS`. No current env values inspected or modified.

Rollback **without deleting data**: keep or set REM05C provider enabled OFF; all legacy geo becomes explicitly demo only and reverse 503; keep new quota rows for audit until approved retention; turn embed flag OFF to restore HTTP `frame-ancestors 'none'` / `X-Frame-Options:DENY`; do not drop new tables or revoke existing live permissions; do not erase IDB v2 local drafts. Authentication remains fail-closed. An old frontend still using legacy geo endpoints sees demo-only city search instead of paid global search. No destructive `DOWN` migration.

## 6. Threats and residual risk ledger

| Threat / dependency | Mitigation / residual limitation |
| --- | --- |
| Anonymous vendor key drain | Paid proxy requires verified actor and shared cost budget. Legacy key ignored. Key/flags are all OFF live. |
| Role union / RLS bypass | New budget login cannot inherit issuer/request; previous REM05B safeRole same-client disjoint checks unchanged; real disposable negative SQL. Live Supabase/role config NOT VERIFIED. |
| Multi-server overspend | Atomic DB reservations + lock and actor/global counters; two OS processes tested; clock from DB UTC. Full provider invoice unit semantics and scaling contention still unknown. |
| Provider outage / quota DB unavailable | 503 fail-closed; no provider call without reservation, conservative overcount accepted. Rate and retry policy may need tuning after vendor approvals. |
| Proxy spoof / NAT collision | `trustProxy:false`, key by network socket peer for unverified auth, verified actor for paid geo. Actual Render forwarded hop and NAT distribution NOT VERIFIED. |
| Shared CDN cache disclosure | API private no-store, Vary and stripped validators; no deployed CDN test. |
| Clickjacking vs Telegram Web | Default `frame-ancestors 'none'` + DENY; opt-in exact origins tested in Chrome HTTPS. Real Telegram Web ancestor hierarchy/3P cookies pending. |
| Geographic privacy / precise GPS | Safe manual fallback, no silent GPS provider call with unapproved flags; exact coordinates not logged. Future account publication approval not implemented. |
| Historical webhook secret/public history | Repo intentionally PUBLIC, scan only **new diff**; no historical clearance or rotation claimed, retained for REM-05E/operator incident review. |
| Native regression | Existing Chromium test gates and fixtures, no real phone/iOS proof; G4/G6 remain closed. |

## 7. Required owner/operator decisions before any live activation

1. Verify actual Geoapify plan, billable credit units, daily hard maximum, billing/alert budget; ratify actor and global limits. Never infer allowance from API key alone.
2. Verify Render ingress proxy chain and trusted hop/CIDR / true peer address (prefer synthetic isolated inventory). Do not enable blanket `trustProxy:true`.
3. Verify Telegram Web real iframe ancestor origin hierarchy, CSP/script/style compatibility and browser third-party cookie behavior on Web, Android, iOS; choose narrowly scoped auth transport and separate launch gate.
4. Approve operational quota-store ownership, backups, multiserver audit, incident alerts and retirement/reconciliation policy. Current live Supabase untouched.
5. Physical Galaxy A55 Telegram and iOS/VoiceOver/TalkBack acceptance, privacy/legal and future REM-05D profile/media/moderation before public users.
6. Historical webhook-secret exposure/rotation is separately REM-05E, **not** silently fixed; public GitHub is owner-approved but historical public clones may exist.

## 8. Release / stop rule

**PASS** is allowed for exact-SHA synthetic code/CI where logged. **PARTIAL** describes coverage gaps; **BLOCKED** for real iframe/proxy/vendor/device/Supabase production evidence and overall real-user **G6**. Even if all required CI is green, the verdict cannot exceed **REM-05C CODE + ISOLATED QA READY FOR OWNER INDEPENDENT TECHNICAL REVIEW; NOT PRODUCTION READY**. PR remains OPEN/DRAFT/UNMERGED. No REM-05D work until new explicit owner approval.

LUEMI 💜

---

## 9. Post-audit independent boundary-case remediation — 2026-10-23

**Scope stays REM-05C in existing Draft PR #53**, from technically accepted REM-05B `7c95016a10db7e03af24c460072275f85c5f98b6`. No new branch/PR, no new live authorization. These four findings were **confirmed by originally failing synthetic tests before the fix** on reproduced test-only commit `2dbdc3580c76f477e01d058e5a7d24cba6214a69`. Public GitHub Actions run: https://github.com/zhirayr2505/luemi/actions/runs/40003288161. Its failure is deliberate red-phase evidence and MUST NOT be mistaken for a final-HEAD status.

| Finding | Pre-fix negative test observation (actual vs expected) | Security remediation | Expected green-test proof |
| --- | --- | --- | --- |
| C1 Provider quota across bot namespaces | Two `GeoBudget` instances with different bot namespaces and same paid key each admitted 3 charges, making **6 instead of 3** shared-global reservations | Derive a stable *opaque* provider quota namespace via SHA-256 domain-separated fingerprint of the server-only **Geoapify API key**; use it for global daily counter, shared advisory lock and inflight concurrency. Actor counters remain independently scoped by verified bot namespace + UUID. Same key and same PostgreSQL store now share a global cap across bot namespaces | `POST-AUDIT C1` actual PostgreSQL 16 counters, two namespaces/actors, global used exactly 3; previous 2-process/100-inflight fixtures |
| C2 Chargeable cross-site GET | Valid `SameSite=Lax` cookie + external Origin/Fetch Metadata navigation returned **200 instead of 403**, resulting in provider call | GET `/api/v2/geo/search` uses a specific `protectedGeoRead`: verify opaque REM05B session, require **session-generation-bound memory-only CSRF header**, reject cross-origin Origin and cross-site / navigation Fetch Metadata. Same-origin JS sends `X-Luemi-CSRF`; rejected v2 may recover to safe legacy demo, never paid retry. Existing POST mutation CSRF unchanged | `POST-AUDIT C2` missing CSRF / cross-site / forged metadata 403 and **zero upstream calls**; authorized same-origin with CSRF 200, one fake upstream call |
| C3 Missing hashed asset returns HTML | Synthetic `/assets/missing-deadbeef.js` returned `text/html`, HTTP 200 but incorrectly `Cache-Control: public, max-age=31536000, immutable` | Never classify by URL regex alone: immutable requires GET 200, recognized hashed extension and **matching response MIME**. `text/html` shell and error responses are `no-store`. SPA fallback explicitly does **not** serve `index.html` under `/assets/`; existing asset output remains immutable only with correct MIME | `POST-AUDIT C3`: synthetic successful HTML fallback under hashed URL has `no-store`; regular real-MIME versioned JS remains immutable |
| C4 Provider reverse contains `null` element | Valid fake provider JSON `{"results":[null]}` resulted in **HTTP 500 instead of 404** | Check reverse elements are non-null objects before reading properties, ignore invalid entries and return sanitized `city_not_found` when no city survives. Later valid element still resolves normally. No raw upstream payload/key echoed | `POST-AUDIT C4`: `[null]` returns 404, `[null, valid city]` returns 200, fake upstream only |

### Isolation, privacy and unchanged security invariants

- **REM-05B `safeRole()` SQL guard unchanged.** Additional `protectedGeoRead` uses the exact validated session and existing derived CSRF; its sole added read-route policy does not grant issuer/request SQL roles or modify `logout-all` 403.
- No new SQL migration is needed for the fingerprint-scoped global key because existing disposable schema already identifies rows by `(namespace,scope,actor_id,kind,period)`. New global entries use an opaque *provider* namespace rather than a bot namespace, and lease rows use the same provider namespace. Existing actor rows retain the bot namespace. **A deployed system with pre-existing per-bot global usage would need an operator-approved accounting reconciliation before activation; this has not been applied to live databases.**
- A fingerprint is **not** the credential itself and API key bytes never enter database SQL, logs or HTTP payloads. Its stability is scoped to *the exact server-only key*, not necessarily a Geoapify billing account with multiple keys. A common durable quota store and matching approved limits across all app instances/keys remain prerequisites; separate databases or different keys for a single vendor subscription are **NOT VERIFIED/BLOCKED** for live use.
- New read CSRF is mandatory only on the billable v2 geo GET. Legacy seven-city demo remains no-credit; cookie `SameSite=Lax` stays as REM05B, and no bearer fallback or broad Telegram iframe permission was added. `VITE_LUEMI_AUTH_V2` off means old GeoPicker request paths are unchanged. The `/geo-qa.html` route remains dev-only synthetic browser fixture.
- Error HTML / hashed-asset cache assertions are synthetic Fastify injection; actual deployed Render/Telegram browser response edge, service-worker/corporate proxy/CDN behavior and physical iOS/A55 remain not verified.
- All tests use mock provider and disposable PostgreSQL only; **real Geoapify credits used: zero**. GitHub intentionally remains PUBLIC. No Render/Supabase/webhook/real-key/user data/deploy/merge operation performed.

### Verification acceptance contract

Final HEAD is pinned by [Draft PR #53](https://github.com/zhirayr2505/luemi/pull/53), not this historical report text. The final commit must show completed **8/8 push+PR workflows and 30/30 jobs SUCCESS on one exact SHA**: Foundation 14, REM00C Behavioral 4, REM05B Focused 6 (8/8 PostgreSQL RLS groups), REM05C Focused 6 (new C1/C2/C4 and C3 plus all old security tests and Chromium). No skipped mandatory jobs or disabled test runner. The red-phase failures are explicitly retained as evidence; only the final green-phase SHA can be offered for owner acceptance.

**Technical decision:** subject to that final exact-SHA gate, **post-audit C1–C4 PASS (synthetic)**, real Geoapify budget account/Render proxy/Supabase policy/native Telegram Web and physical device behavior **PARTIAL/BLOCKED**. G6 NOT production ready. Stop after REM-05C for independent re-review. No REM-05D without new permission.
