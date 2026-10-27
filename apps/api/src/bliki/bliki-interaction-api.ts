import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Pool, type PoolClient } from 'pg';

type Guard = {
  read: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  mutation: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
};
export type BlikiInteractionApiOptions = {
  enabled: true; databaseUrl: string; namespace: string;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Action = 'view' | 'react' | 'report';
class Rejection extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
function fail(status: number, code: string): never { throw new Rejection(status, code); }
function plain(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}
function parseBody(action: Action, value: unknown): string | null {
  if (!plain(value)) return null;
  const keys = Object.keys(value);
  if (action === 'view') return keys.length === 0 ? '' : null;
  if (action === 'react') return keys.length === 1 && keys[0] === 'reaction' &&
    ['heart', 'fire', 'smile'].includes(String(value.reaction)) ? String(value.reaction) : null;
  return keys.length === 1 && keys[0] === 'reason' &&
    ['spam', 'harassment', 'nudity', 'other'].includes(String(value.reason))
    ? String(value.reason) : null;
}

/** Separate POST-only interaction connection; never uses a media or writer role. */
export function registerBlikiInteractionApi(
  app: FastifyInstance, guard: Guard | undefined, options?: BlikiInteractionApiOptions,
): void {
  if (!options?.enabled) return;
  if (!guard || !options.databaseUrl || !/^[a-z0-9:_-]{1,96}$/i.test(options.namespace))
    throw new Error('Bliki interactions require isolated actor-scoped DB and session guards');
  const auth: Guard = guard;
  const cfg = options;
  const pool = new Pool({ connectionString: cfg.databaseUrl, max: 3, connectionTimeoutMillis: 3000 });
  app.addHook('onClose', async () => { await pool.end(); });

  async function transact(
    request: FastifyRequest, reply: FastifyReply, storyId: string, action: Action, payload: string,
  ) {
    const actor = request.authActor;
    if (!actor || !UUID.test(actor.actorId)) return reply.code(401).send({ error: 'unauthorized' });
    const db: PoolClient = await pool.connect().catch(() => fail(503, 'service_unavailable'));
    try {
      const role = await db.query<{ safe: boolean }>(`SELECT (
        rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb
        AND NOT rolcreaterole AND session_user=current_user
        AND current_setting('row_security')='on'
        AND pg_has_role(current_user,'luemi_bliki_interaction','member')
        AND NOT pg_has_role(current_user,'luemi_bliki_request','member')
        AND NOT pg_has_role(current_user,'luemi_bliki_reader','member')
        AND NOT pg_has_role(current_user,'luemi_bliki_media_reader','member')
        AND NOT pg_has_role(current_user,'pg_read_all_data','member')
        AND NOT pg_has_role(current_user,'pg_write_all_data','member')
        AND NOT has_schema_privilege(current_user,'luemi_bliki_private','CREATE')
        AND row_security_active('luemi_bliki_private.stories'::regclass)
        AND row_security_active('luemi_bliki_private.views'::regclass)
        AND row_security_active('luemi_bliki_private.reactions'::regclass)
        AND row_security_active('luemi_bliki_private.reports'::regclass)
        AND NOT has_column_privilege(current_user,'luemi_bliki_private.stories','media_key','SELECT')
        AND NOT has_table_privilege(current_user,'luemi_private.sessions','SELECT')
      ) AS safe FROM pg_roles WHERE rolname=current_user`);
      if (role.rows[0]?.safe !== true) fail(503, 'service_unavailable');
      await db.query('BEGIN');
      await db.query("SELECT set_config('luemi.actor_id',$1,true)", [actor.actorId]);
      await db.query("SELECT set_config('luemi.environment',$1,true)", [cfg.namespace]);
      const target = await db.query<{ author_id: string }>(
        `SELECT author_id::text FROM luemi_bliki_private.stories
         WHERE id=$1::uuid AND environment=$2 AND status='published'
          AND deleted_at IS NULL AND published_at<=now()
          AND published_at>now()-interval '24 hours'`,
        [storyId, cfg.namespace],
      );
      if (target.rowCount !== 1) fail(404, 'not_found');
      if (action !== 'view' && target.rows[0].author_id === actor.actorId)
        fail(403, 'self_interaction_denied');
      const args = [storyId, actor.actorId];
      if (action === 'view') {
        await db.query(
          `INSERT INTO luemi_bliki_private.views(story_id,viewer_id)
           VALUES($1::uuid,$2::uuid) ON CONFLICT DO NOTHING`, args);
      } else if (action === 'react') {
        await db.query(
          `INSERT INTO luemi_bliki_private.reactions(story_id,actor_id,reaction_kind)
           VALUES($1::uuid,$2::uuid,$3) ON CONFLICT DO NOTHING`,
          [...args, payload]);
      } else {
        await db.query(
          `INSERT INTO luemi_bliki_private.reports(story_id,reporter_id,reason)
           VALUES($1::uuid,$2::uuid,$3) ON CONFLICT DO NOTHING`,
          [...args, payload]);
      }
      await auth.read(request, reply);
      if (reply.sent || !request.authActor ||
          request.authActor.actorId !== actor.actorId ||
          request.authActor.sessionId !== actor.sessionId ||
          request.authActor.hash.length !== actor.hash.length ||
          !timingSafeEqual(request.authActor.hash, actor.hash)) fail(401, 'unauthorized');
      await db.query('COMMIT');
      return { state: 'recorded' };
    } catch (error) {
      await db.query('ROLLBACK').catch(() => undefined);
      if (reply.sent) return reply;
      if (error instanceof Rejection) return reply.code(error.status).send({ error: error.code });
      return reply.code(503).send({ error: 'service_unavailable' });
    } finally { db.release(); }
  }

  function route(action: Action, suffix: string) {
    app.post<{ Params: { storyId: string }; Body: unknown }>(
      '/api/v1/bliki/stories/:storyId/' + suffix,
      { preHandler: guard!.mutation, bodyLimit: 2048 },
      async (request, reply) => {
        if (!UUID.test(request.params.storyId)) return reply.code(404).send({ error: 'not_found' });
        const body = parseBody(action, request.body);
        if (body === null) return reply.code(422).send({ error: 'invalid_action' });
        return transact(request, reply, request.params.storyId, action, body);
      });
  }
  route('view', 'view');
  route('react', 'reaction');
  route('report', 'report');
}
