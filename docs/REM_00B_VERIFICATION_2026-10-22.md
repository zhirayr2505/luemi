# LUEMI 💜 — REM-00B · dependency and release gate verification

Date: 2026-10-22 (Europe/Moscow). Scope: **REM-00B / LU-32 only** in the approved master remediation specification `LUEMI_MASTER_REMEDIATION_TZ_2026-10-21.md`.

## Source and isolation
- Based on REM-00A: `fe33760ef426d75747f889cda8ec8f6e825df227`.
- Working branch: `remediation/rem-00b-dependency-gates-20261022`.
- REM-00A workflow repair is preserved; all changes are confined to dependency/tooling/CI/tests/docs.
- No changes to `apps/web/src`, `apps/api/src`, `packages/contracts/src`, asset files, animation/gesture behavior, Render dashboard, Supabase, users, or other repositories. No merge or deployment.
- Existing `main`: `072bc425e4f487d15a5260f0ac978a2059b50e34`. Existing staging: `62470ddd143a94a9f987c0aa1c7193656a29df15`.

## LU-32 work done
1. Toolchain: `.node-version` = Node 22.16.0; root `packageManager` = npm 10.9.2; root engines constrain Node 22/npm 10. Playwright 1.58.2 and eslint-plugin-react-hooks 5.2.0 are explicit dev dependencies. Other dependency ranges have **not** been gratuitously bumped.
2. Root npm v3 `package-lock.json` created in a temporary read-only GitHub job, then committed through a separate Git object commit. Lock graph has **351 package entries**. The temporary provenance workflow was removed from the Git tree after capture. Baseline generation run: [39680667053](https://github.com/zhirayr2505/luemi/actions/runs/39680667053); `npm ci --ignore-scripts` and `npm ls --all --omit=optional` succeeded.
3. Mandatory foundation and historical browser workflow use `npm ci` and `actions/setup-node` cache keyed by root lockfile; all checkouts use the actual event SHA and `persist-credentials: false`. Ubuntu runner family fixed at ubuntu-24.04; npm version explicitly installed. Playwright Chromium comes from the pinned Playwright package, no floating `npm install --no-save`.
4. Foundation push scopes include `main`, `staging/**`, `remediation/**` plus historical relevant branches. PR scopes include `main`, `staging/**`, `remediation/**`; the PR merge SHA is tested when the event is a PR. No `pull_request_target`, no secret-bearing CI environment.
5. Independent mandatory matrix lanes, with `fail-fast: false`: `ci-infrastructure`, `lint-hooks`, `type-contracts`, `source-marker-contracts`, `api-isolated`, `build`, and `local-smoke`. A failing lane does not hide unrelated results. Root `npm run check` expresses the sequential developer gate and **continues failing** on outstanding source markers.
6. React Hooks rules `rules-of-hooks` (error) and `exhaustive-deps` (warning) enabled on web TS/TSX. Five pre-existing exhaustive-deps diagnostics in four files are fingerprinted in `qa/react-hooks-baseline.json`; `scripts/rem-00b-hooks-baseline.mjs` **fails on any new diagnostic, changed fingerprint or unacknowledged rules-of-hooks error**. The original five remain visible in ESLint output; they are not fixed blindly or disabled.
7. Source-marker UI/discovery tests are labeled `test:source-contracts`, **not behavioral proof**. API isolated tests use existing mocked/test APIs. Browser QA is still an explicitly labeled historical scenario. REM-00C alone will update its outdated DOM selectors/behavior assertions.
8. Added `test:ci-contract`: root manifest-to-lock consistency, intentional bad-lock negative fixture, trigger and permission assertions, mandatory matrix entries and pinned browser checks. Source-marker config test is explicitly infrastructure validation, not a browser test.

## Actual executed checks before this report commit
- Lock generator [run 39680667053](https://github.com/zhirayr2505/luemi/actions/runs/39680667053): **SUCCESS**, actual hosted runner, resolved and clean-installed lock graph.
- [Foundation matrix run 39681267543](https://github.com/zhirayr2505/luemi/actions/runs/39681267543) on `c9ccb51`:
  - `lint-hooks`: **PASS**, five existing warnings visible, no React Hooks errors.
  - `type-contracts`: **PASS**.
  - `api-isolated`: **PASS**.
  - `build`: **PASS**, app/web/API/contracts build output generated in runner only.
  - `local-smoke`: **PASS**, same-origin app, original raster asset, local health, disabled bot auth/webhook. It starts only `127.0.0.1` HTTP and clears bot secrets; does **not** contact Render production.
  - `source-marker-contracts`: **FAIL (known baseline)**, `scripts/stage03e-contract.test.mjs:34`, old string-based predicate for gesture code in `DiscoveryApp.tsx`. Nothing was disabled or changed to fake a pass.
- [Visual run 39681267644](https://github.com/zhirayr2505/luemi/actions/runs/39681267644) on `c9ccb51`: checkout/npm ci/pinned browser install **PASS**; foundation gate fails on same known source-marker; historical `stage03g7` browser script fails at `getComputedStyle(null)` in `scripts/stage03g7-android-visual-qa.mjs:25`. Artifact upload **PASS**. Both are follow-up REM-00C investigation candidates, not fixed in REM-00B.

These source-marker and visual failures are intentionally **not hidden**; the repository is **not release-green**. Clean CI across 7 independent lanes has not replaced real device testing. A55/iOS manual runs are NOT VERIFIED under this infrastructure stage.

## Known remaining baseline debt / stage boundary
- Historical `stage03e-contract.test.mjs` asserts literal source fragments; behavior remains NOT VERIFIED. Do not weaken the assertion as a CI shortcut. Review against current behavior in the authorized future behavior/testability stage, without changing app gestures in REM-00B.
- Legacy visual Android scenario contains obsolete selectors/renderer assumptions and fails. **REM-00C** will update it, without changing app UI.
- Hooks warning ledger (five at this checkpoint): `GlobalHeader.tsx` (1), `PhotoViewer.tsx` (2), `VisitorProfileRoute.tsx` (1), `PhotoSorter.tsx` (1). Some require gesture/motion ownership refactors in REM-02/03; their presence is not proof of a runtime failure.
- GitHub Actions warning about Node 20 used by upstream actions/checkout@v4/setup-node@v4 is from action runtime compatibility and is not the pinned application Node22. Updating actions majors is a separately reviewed tooling task, not a forced upgrade here.
- Remote Render service command was not rechecked. The documentation presently states `npm install --include=dev ... && npm run build`. This does not require `test:discovery` or the source-marker gate. **Configuration gap exists in documented command.** Do not change actual Render settings in REM-00B. Candidate future command after gates become release-green and Node/npm configured: `npm ci --include=dev --no-audit --no-fund && npm run check && npm run build`. Implications: clean node_modules every deploy, extra CI time, duplicate prebuild/lint execution, fail-closed deployment when checks fail. Owner approval required.
- Public repository visibility was changed by owner beforehand and was not part of this stage; historical secret audit remains incomplete and is not security sign-off.

## Rollback / checkpoint
- Reversible boundary: REM-00B base `fe33760ef426d75747f889cda8ec8f6e825df227`.
- No force push, branch deletion, cleanup of user data, or overwrite of original REM-00A history.
- To abandon REM-00B, **close its Draft PR without merging** and keep `remediation/rem-00a-workflow-20261021` at `fe33760`. For partial rollback, revert REM-00B commits on a separate temporary branch; never reset shared `main`.
- Do not merge with `main` or deploy until explicit owner approval. This checkpoint stops before REM-00C.
