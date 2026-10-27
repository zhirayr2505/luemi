import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';

type Guard = {
  read: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  mutation: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
};
export type BlikiApiOptions = {
  enabled: true;
  databaseUrl: string;
  namespace: string;
};
type StoryRow = {
  id: string;
  author_id: string;
  media_kind: 'image' | 'video';
  published_at: string;
  caption: string;
};
type Rejection = { status: number; error: string };
function reject(status: number, error: string): never {
  throw { status, error } satisfies Rejection;
}
function isRejection(value: unknown): value is Rejection {
  return !!value && typeof value === 'object' && 'status' in value &&
    'error' in value && typeof value.status === 'number' && typeof value.error === 'string';
}

/**
 * Private read API. Requires a separately provisioned RLS-scoped DB principal.
 * Does not expose media keys, unmoderated assets, or user identity details.
 * Disabled by default. Publishing is NOT registered until upload/moderation is complete.
 */
export function registerBlikiApi(app: FastifyInstance, guard: Guard | undefined, options?: BlikiApiOptions) {
  if (!options?.enabled) return;
  if (!guard || !options.databaseUrl || !/^[a-z0-9:_-]{1,96}$/i.test(options.namespace)) {
    throw new Error('Bliki API requires scoped DB and authenticated sessions');
  }
  const namespace = options.namespace;
  const pool = new Pool({ connectionString: options.databaseUrl, max: 4, connectionTimeoutMillis: 3000 });
  app.addHook('onClose', async () => { await pool.end(); });

  async function scoped<T>(request: FastifyRequest, reply: FastifyReply,
    work: (db: PoolClient, actorId: string) => Promise<T>): Promise<T | FastifyReply> {
    const actor = request.authActor;
    if (reply.sent || !actor) return reply;
    const db = await pool.connect().catch(() => null);
    if (!db) return reply.code(503).send({ error: 'service_unavailable' });
    try {
      const role = await db.query<{ safe: boolean }>(
        `SELECT (r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolbypassrls
          AND NOT r.rolcreaterole AND NOT r.rolcreatedb
          AND session_user=current_user AND current_setting('row_security')='on'
          AND NOT pg_has_role(current_user,'pg_read_all_data','member')
          AND NOT pg_has_role(current_user,'pg_write_all_data','member')
          AND NOT has_schema_privilege(current_user,'luemi_bliki_private','CREATE')
          AND NOT EXISTS (
            SELECT 1 FROM pg_class c
            WHERE c.oid='luemi_bliki_private.stories'::regclass AND c.relowner=r.oid
          )
          AND row_security_active('luemi_bliki_private.stories'::regclass)
          AND NOT has_table_privilege(current_user,'luemi_bliki_private.stories','INSERT')
          AND NOT has_table_privilege(current_user,'luemi_bliki_private.stories','UPDATE')
          AND NOT has_table_privilege(current_user,'luemi_bliki_private.stories','DELETE')
          AND NOT has_table_privilege(current_user,'luemi_bliki_private.stories','SELECT')
          AND has_column_privilege(current_user,'luemi_bliki_private.stories','id','SELECT')
          AND has_column_privilege(current_user,'luemi_bliki_private.stories','author_id','SELECT')
          AND has_column_privilege(current_user,'luemi_bliki_private.stories','published_at','SELECT')
          AND has_column_privilege(current_user,'luemi_bliki_private.stories','media_kind','SELECT')
          AND has_column_privilege(current_user,'luemi_bliki_private.stories','caption','SELECT')
          AND NOT has_column_privilege(current_user,'luemi_bliki_private.stories','media_key','SELECT')
        ) AS safe FROM pg_roles r WHERE r.rolname=current_user`);
      if (role.rows[0]?.safe !== true) reject(503, 'service_unavailable');
      await db.query('BEGIN READ ONLY');
      await db.query("SELECT set_config('luemi.actor_id',$1,true)", [actor.actorId]);
      await db.query("SELECT set_config('luemi.environment',$1,true)", [namespace]);
      const active = await db.query(
        "SELECT id FROM luemi_private.actors WHERE id=$1 AND environment=$2 AND status='active'",
        [actor.actorId, namespace],
      );
      if (active.rowCount !== 1) reject(401, 'unauthorized');
      const result = await work(db, actor.actorId);
      await guard.read(request, reply);
      if (reply.sent || !request.authActor ||
        request.authActor.actorId !== actor.actorId ||
        request.authActor.sessionId !== actor.sessionId ||
        !timingSafeEqual(request.authActor.hash, actor.hash)) reject(401, 'unauthorized');
      await db.query('COMMIT');
      return result;
    } catch (error) {
      await db.query('ROLLBACK').catch(() => undefined);
      if (reply.sent) return reply;
      if (isRejection(error)) return reply.code(error.status).send({ error: error.error });
      return reply.code(503).send({ error: 'service_unavailable' });
    } finally {
      db.release();
    }
  }

  app.get('/api/v1/bliki/feed', { preHandler: guard.read }, async (request, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    return scoped(request, reply, async db => {
      // RLS is the final privacy boundary. No direct client-supplied actor filter.
      const result = await db.query<StoryRow>(
        `SELECT id::text, author_id::text, media_kind, published_at::text, caption
         FROM luemi_bliki_private.stories
         WHERE environment=$1 AND status='published'
           AND deleted_at IS NULL AND published_at <= now()
           AND published_at > now() - interval '24 hours'
         ORDER BY published_at DESC, id DESC LIMIT 100`, [namespace],
      );
      return { stories: result.rows, serverNow: new Date().toISOString(), nextCursor: null };
    });
  });
}
