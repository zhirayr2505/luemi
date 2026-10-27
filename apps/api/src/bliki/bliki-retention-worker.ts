import { Pool, type PoolClient } from 'pg';
import type { BlikiPrivateMediaStore } from './bliki-private-upload.js';

/**
 * Opt-in, one-shot retention processor. NEVER mount this on a public HTTP route.
 * A separately provisioned LOGIN member of the NOLOGIN retention role is
 * required. The worker never shares the writer, reader, or media DSN.
 *
 * No scheduler is started here: deployment and cadence require owner approval.
 */
export type BlikiRetentionOptions = {
  databaseUrl: string;
  namespace: string;
  store: Pick<BlikiPrivateMediaStore, 'remove'>;
  maxRecords?: number;
};
export type BlikiRetentionResult = { removed: number; failed: number };
type Candidate = { id: string; author_id: string; media_key: string };
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const uuid = new RegExp('^' + UUID + '$', 'i');
const retryClause = `(cleanup_attempt_at IS NULL OR
  cleanup_attempt_at < now() - interval '10 minutes')`;
const expiredClause = `(
 (status='deleted' AND deleted_at IS NOT NULL)
 OR (status='published' AND published_at < now()-interval '25 hours')
 OR (status IN ('uploading','processing','rejected')
   AND created_at < now()-interval '48 hours')
)`;
function verifyKey(namespace: string, row: Candidate): boolean {
  return uuid.test(row.author_id) &&
    new RegExp('^' + namespace + '/' + row.author_id + '/' + UUID + '$', 'i').test(row.media_key);
}
async function checkRole(db: PoolClient): Promise<void> {
  const role = await db.query<{ safe: boolean }>(`SELECT (
    rolcanlogin AND NOT rolsuper AND NOT rolbypassrls
    AND NOT rolcreaterole AND NOT rolcreatedb AND current_user=session_user
    AND current_setting('row_security')='on'
    AND pg_has_role(current_user,'luemi_bliki_retention','member')
    AND NOT pg_has_role(current_user,'luemi_bliki_request','member')
    AND NOT pg_has_role(current_user,'luemi_bliki_reader','member')
    AND NOT pg_has_role(current_user,'luemi_bliki_media_reader','member')
    AND NOT pg_has_role(current_user,'luemi_bliki_interaction','member')
    AND NOT pg_has_role(current_user,'pg_read_all_data','member')
    AND NOT pg_has_role(current_user,'pg_write_all_data','member')
    AND NOT has_schema_privilege(current_user,'luemi_bliki_private','CREATE')
    AND row_security_active('luemi_bliki_private.stories'::regclass)
    AND NOT has_table_privilege(current_user,'luemi_private.sessions','SELECT')
    AND NOT has_table_privilege(current_user,'luemi_bliki_private.stories','DELETE')
    AND NOT has_column_privilege(current_user,'luemi_bliki_private.stories','status','UPDATE')
    AND NOT has_column_privilege(current_user,'luemi_bliki_private.stories','media_key','UPDATE')
  ) AS safe FROM pg_roles WHERE rolname=current_user`);
  if (role.rows[0]?.safe !== true) throw new Error('unsafe_bliki_retention_role');
}

export async function runBlikiRetentionOnce(options: BlikiRetentionOptions): Promise<BlikiRetentionResult> {
  if (!/^[a-z0-9:_-]{1,96}$/i.test(options.namespace) ||
      !options.databaseUrl || !options.store ||
      (options.maxRecords !== undefined &&
        (!Number.isSafeInteger(options.maxRecords) || options.maxRecords < 1 || options.maxRecords > 50))) {
    throw new Error('invalid_bliki_retention_configuration');
  }
  const max = options.maxRecords ?? 10;
  const result: BlikiRetentionResult = { removed: 0, failed: 0 };
  const pool = new Pool({ connectionString: options.databaseUrl, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const db = await pool.connect();
    try {
      await checkRole(db);
      for (let i = 0; i < max; i++) {
        await db.query('BEGIN');
        try {
          await db.query("SELECT set_config('luemi.environment',$1,true)", [options.namespace]);
          const rows = await db.query<Candidate>(`SELECT id::text,author_id::text,media_key
            FROM luemi_bliki_private.stories
            WHERE environment=$1 AND media_cleaned_at IS NULL
              AND ${expiredClause} AND ${retryClause}
            ORDER BY created_at ASC,id ASC
            FOR UPDATE SKIP LOCKED LIMIT 1`, [options.namespace]);
          const item = rows.rows[0];
          if (!item) { await db.query('ROLLBACK'); break; }
          try {
            if (!verifyKey(options.namespace, item)) throw new Error('invalid_retention_key');
            // Storage DELETE is idempotent: 404 means it was already removed.
            // The DB transaction holds the row lock until the removal finishes.
            // No active publication can transition or replace this locked row.
            await options.store.remove(item.media_key);
            const updated = await db.query(`UPDATE luemi_bliki_private.stories
              SET media_cleaned_at=clock_timestamp(),
                  cleanup_attempts=cleanup_attempts+1,
                  cleanup_attempt_at=clock_timestamp()
              WHERE id=$1 AND environment=$2 AND media_cleaned_at IS NULL`,
              [item.id,options.namespace]);
            if (updated.rowCount !== 1) throw new Error('retention_mark_failed');
            result.removed++;
          } catch {
            // Record a durable failure, then exclude it for at least ten
            // minutes so poison objects never monopolize the batch.
            await db.query(`UPDATE luemi_bliki_private.stories
              SET cleanup_attempts=cleanup_attempts+1,
                  cleanup_attempt_at=clock_timestamp()
              WHERE id=$1 AND environment=$2 AND media_cleaned_at IS NULL`,
              [item.id,options.namespace]);
            result.failed++;
          }
          await db.query('COMMIT');
        } catch (error) {
          await db.query('ROLLBACK').catch(() => undefined);
          throw error;
        }
      }
    } finally { db.release(); }
  } finally { await pool.end(); }
  return result;
}
