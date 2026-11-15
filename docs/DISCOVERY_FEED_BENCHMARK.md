# LUEMI Discovery Feed — disposable scale benchmark

The benchmark measures the **real authenticated** `GET /api/v3/discovery/feed` route against synthetic rows in the disposable PostgreSQL database used by the REG01 CI workflow.

It does not call production, use real user data, upload photo bytes, or change the approved UI. Synthetic profiles and three metadata-only approved-media rows per profile are inserted under a unique test namespace, then removed in a `finally` block. PostgreSQL statistics are refreshed before timing.

## Run from GitHub Actions

Open **Actions → LUEMI REAL-REG-01A private registration and PostgreSQL QA → Run workflow**.

Set:
- `discovery_feed_benchmark = true`
- `discovery_feed_profiles = 10000`, `25000`, or `100000`

The benchmark runs once on PostgreSQL 17 after the normal disposable schema/role setup and security tests. The ordinary push/PR workflow does not run the large data seed.

## Output

The log line `LUEMI_DISCOVERY_FEED_BENCHMARK` reports:
- PostgreSQL version and synthetic profile/media row counts;
- ten serial authenticated API timings for the first page;
- ten serial timings for a deep page (offset capped at 10,000 by the current cursor contract);
- p50 and p95 latency.

This is an end-to-end route measurement, **not** a hard performance gate. CI machine noise makes fixed latency assertions misleading. Use it as a baseline, then inspect PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` on the same disposable dataset before adding indexes or changing ranking/pagination semantics.

## Safety

The script refuses to run unless `FEED_BENCH_CONFIRM_DISPOSABLE=1` and confirms that `current_database()` is exactly `reg01_disposable`. It requires the synthetic REG01 database-role URLs from CI. It has no production URL or Storage secret input.
