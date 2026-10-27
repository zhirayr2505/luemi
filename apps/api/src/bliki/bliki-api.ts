import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { parseBlikiEditor } from './bliki-editor-validation.js';

type Guard = {
  read: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  mutation: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
};
export type BlikiApiOptions = {
  enabled: true; databaseUrl: string; namespace: string;
};
type StoryRow = {
  id: string; author_id: string; media_kind: 'image' | 'video';
  media_duration_ms: number | null;
  published_at_ms: string; caption: string; editor: unknown;
  display_name: string; avatar_id: string | null;
  is_mutual_match: boolean; liked_by_viewer: boolean;
};
type Rejection = { status: number; error: string };
function reject(status: number, error: string): never {
  throw { status, error } satisfies Rejection;
}
function isRejection(value: unknown): value is Rejection {
  return !!value && typeof value === 'object' && 'status' in value &&
    'error' in value && typeof value.status === 'number' && typeof value.error === 'string';
}
function equalHash(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Read-only private Bliki feed. No synthetic users, no raw storage keys or
 * unfiltered story data are returned. Membership in luemi_bliki_reader plus
 * per-actor RLS scopes the SQL before the API builds its typed DTO.
 */
export function registerBlikiApi(app: FastifyInstance, guard: Guard | undefined, options?: BlikiApiOptions) {
  if (!options?.enabled) return;
  if (!guard || !options.databaseUrl || !/^[a-z0-9:_-]{1,96}$/i.test(options.namespace)) {
    throw new Error('Bliki API requires scoped DB and authenticated sessions');
  }
  const auth: Guard = guard;
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
          AND pg_has_role(current_user,'luemi_bliki_reader','member')
          AND NOT pg_has_role(current_user,'luemi_bliki_request','member')
          AND NOT pg_has_role(current_user,'luemi_bliki_media_reader','member')
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
          AND NOT has_column_privilege(current_user,'luemi_private.media_assets','derivative_key','SELECT')
        ) AS safe FROM pg_roles r WHERE r.rolname=current_user`);
      if (role.rows[0]?.safe !== true) reject(503, 'service_unavailable');
      await db.query('BEGIN READ ONLY');
      await db.query("SELECT set_config('luemi.actor_id',$1,true)", [actor.actorId]);
      await db.query("SELECT set_config('luemi.environment',$1,true)", [namespace]);
      // REM-05B authenticates active actors; a published profile is required
      // separately for story access. The reader cannot read actor sessions.
      const eligible = await db.query(
        "SELECT owner_id FROM luemi_private.public_profiles WHERE owner_id=$1 AND environment=$2 AND publication_status='published'",
        [actor.actorId, namespace]);
      if (eligible.rowCount !== 1) reject(403, 'published_profile_required');
      const result = await work(db, actor.actorId);
      await auth.read(request, reply);
      if (reply.sent || !request.authActor ||
        request.authActor.actorId !== actor.actorId ||
        request.authActor.sessionId !== actor.sessionId ||
        !equalHash(request.authActor.hash, actor.hash)) reject(401, 'unauthorized');
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
    reply.header('Cache-Control', 'private, no-store').header('Vary', 'Cookie');
    return scoped(request, reply, async (db, viewer) => {
      // RLS independently verifies published viewer + published author, mutual
      // block visibility, environment and 24h lifetime. Joins only expose
      // already-published profile projections and approved avatar IDs.
      const result = await db.query<StoryRow>(
        `SELECT s.id::text, s.author_id::text, s.media_kind, s.media_duration_ms,
            (extract(epoch from s.published_at)*1000)::bigint::text AS published_at_ms,
            s.caption, s.editor, p.display_name,
            avatar.id::text AS avatar_id,
            EXISTS (SELECT 1 FROM luemi_chats.matches m
              WHERE m.environment=$1 AND m.status='active'
                AND ((m.actor_low=s.author_id AND m.actor_high=$2::uuid)
                OR (m.actor_high=s.author_id AND m.actor_low=$2::uuid))) AS is_mutual_match,
            EXISTS (SELECT 1 FROM luemi_chats.likes l
              WHERE l.environment=$1 AND l.sender_id=s.author_id
                AND l.receiver_id=$2::uuid) AS liked_by_viewer
         FROM luemi_bliki_private.stories s
         JOIN luemi_private.public_profiles p
           ON p.owner_id=s.author_id AND p.environment=s.environment
              AND p.publication_status='published'
         LEFT JOIN LATERAL (
           SELECT a.id FROM luemi_private.media_assets a
           WHERE a.owner_id=s.author_id AND a.environment=s.environment
             AND a.state='approved' AND a.publication_status='published'
           ORDER BY a.position,a.id LIMIT 1
         ) avatar ON true
         WHERE s.environment=$1 AND s.status='published'
           AND s.deleted_at IS NULL AND s.published_at <= now()
           AND s.published_at > now() - interval '24 hours'
         ORDER BY s.published_at DESC, s.id DESC LIMIT 100`,
        [namespace, viewer],
      );
      type AuthorDTO = {
        id: string; name: string; avatarUrl?: string;
        stories: Array<{
          id: string; authorId: string; mediaKind: 'image' | 'video';
          mediaUrl: string; publishedAt: number; caption: string;
          durationMs?: number; editor?: ReturnType<typeof parseBlikiEditor>;
        }>;
        isMutualMatch: boolean; likedByViewer: boolean; isNearby: boolean;
        isSelf: boolean; isBlocked: boolean; isEligible: boolean;
        lastPublishedAt: number;
      };
      const byId = new Map<string, AuthorDTO>();
      const now = Date.now();
      for (const row of result.rows) {
        const publishedAt = Number(row.published_at_ms);
        if (!Number.isSafeInteger(publishedAt) ||
          publishedAt > now || publishedAt <= now - 86400000) continue;
        const editor = parseBlikiEditor(row.editor);
        // All published editors must be parseable; no untrusted DOM payloads.
        if (!editor) continue;
        let author = byId.get(row.author_id);
        if (!author) {
          author = {
            id: row.author_id, name: row.display_name,
            ...(row.avatar_id ? { avatarUrl: '/api/v3/discovery/photo/' + row.avatar_id } : {}),
            stories: [], isMutualMatch: row.is_mutual_match,
            likedByViewer: row.liked_by_viewer, isNearby: false,
            isSelf: row.author_id === viewer, isBlocked: false,
            isEligible: true, lastPublishedAt: publishedAt,
          };
          byId.set(author.id, author);
        }
        author.stories.push({
          id: row.id, authorId: row.author_id, mediaKind: row.media_kind,
          mediaUrl: '/api/v1/bliki/media/' + row.id,
          publishedAt, caption: row.caption ?? '',
          ...(row.media_duration_ms == null ? {} : { durationMs: row.media_duration_ms }),
          editor,
        });
      }
      const priority = (a: AuthorDTO) => a.isMutualMatch ? 0 : a.likedByViewer ? 1 : a.isNearby ? 2 : 3;
      const authors = Array.from(byId.values()).sort((a, b) =>
        priority(a) - priority(b) || b.lastPublishedAt - a.lastPublishedAt ||
        a.id.localeCompare(b.id));
      // Cursor pagination requires stable snapshot semantics across expiring
      // stories. Do not advertise a cursor until that contract is implemented.
      return { authors, serverNow: new Date(now).toISOString(), nextCursor: null };
    });
  });
}
