import { createBlikiSupabaseStore } from './bliki-supabase-store.js';
import { runBlikiRetentionOnce } from './bliki-retention-worker.js';

/**
 * One-shot maintenance entry point. Explicit approval and isolated retention
 * credentials required. NEVER run automatically at API startup or on a timer.
 *
 * Example (secrets supplied out-of-band):
 * BLIKI_RETENTION_OWNER_APPROVED=1 BLIKI_RETENTION_RUN_ONCE=1
 * BLIKI_V1_RETENTION_DATABASE_URL=... BLIKI_V1_STORAGE_SECRET=...
 * REM05B_BOT_NAMESPACE=... node dist/bliki/bliki-retention-cli.js
 */
async function main() {
  const env = process.env;
  if (env.BLIKI_RETENTION_RUN_ONCE !== '1' ||
      env.BLIKI_RETENTION_OWNER_APPROVED !== '1') {
    throw new Error('bliki_retention_requires_explicit_approval');
  }
  const namespace = env.REM05B_BOT_NAMESPACE ?? '';
  const databaseUrl = env.BLIKI_V1_RETENTION_DATABASE_URL ?? '';
  const secret = env.BLIKI_V1_STORAGE_SECRET ?? '';
  const projectRef = env.BLIKI_V1_STORAGE_PROJECT_REF ?? '';
  if (!databaseUrl || projectRef !== 'czzyoxrwtnvbicypwrdd' ||
      !secret || !/^[a-z0-9:_-]{1,96}$/i.test(namespace)) {
    throw new Error('bliki_retention_credentials_not_configured');
  }
  const store = createBlikiSupabaseStore({
    projectRef,secret,namespace,bucket:'luemi-bliki-private',
  });
  const result = await runBlikiRetentionOnce({ databaseUrl,namespace,store,maxRecords:10 });
  console.info('bliki_retention', JSON.stringify(result));
}
main().catch(() => {
  console.error('bliki_retention_failed');
  process.exitCode = 1;
});
