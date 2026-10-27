import { timingSafeEqual } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Pool } from 'pg';
import { createBlikiUploadTicket, storeBlikiUpload, type BlikiPrivateMediaStore } from './bliki-private-upload.js';
import { validateBlikiSession } from './bliki-publication-validation.js';
import { inspectBlikiMp4 } from './bliki-video-validation.js';
import { parseBlikiEditor } from './bliki-editor-validation.js';

type Guard = {
  read: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  mutation: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
};
export type BlikiPublicationApiOptions = {
  enabled: true;
  databaseUrl: string;
  namespace: string;
  store: BlikiPrivateMediaStore;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Row = {
  id: string; author_id: string; operation_id: string; media_kind: 'image' | 'video';
  mime_type: string; media_key: string; media_bytes: string; status: string;
  published_at: Date | null;
};
class RequestError extends Error {
  constructor(readonly statusCode: number, readonly code: string) { super(code); }
}
function fail(statusCode: number, code: string): never { throw new RequestError(statusCode, code); }
function status(row: Row) {
  if (row.status === 'published' && row.published_at) {
    return { state: 'published', storyId: row.id,
      expiresAt: new Date(new Date(row.published_at).getTime() + 86400000).toISOString() };
  }
  if (row.status === 'uploading') return { state: 'uploading' };
  if (row.status === 'processing') return { state: 'processing' };
  return { state: 'rejected' };
}
/**
 * Opt-in API only. Database must have a dedicated actor-scoped RLS role with
 * SELECT/INSERT/UPDATE on stories. Never pass service_role DB credentials.
 */
export function registerBlikiPublicationApi(
  app: FastifyInstance, guard: Guard | undefined, options?: BlikiPublicationApiOptions,
): void {
  if (!options?.enabled) return;
  if (!guard || !options.databaseUrl || !/^[a-z0-9:_-]{1,96}$/i.test(options.namespace)) {
    throw new Error('Bliki publication requires authenticated actor-scoped storage');
  }
  const cfg = options;
  const pool = new Pool({ connectionString: cfg.databaseUrl, max: 3, connectionTimeoutMillis: 3000 });
  app.addHook('onClose', async () => { await pool.end(); });
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: 25 * 1024 * 1024 },
    (_request, body, done) => done(null, body));
  async function transaction<T>(request: FastifyRequest, reply: FastifyReply,
    work: (db: import('pg').PoolClient, actor: string) => Promise<T>): Promise<T | FastifyReply> {
    const actor = request.authActor;
    if (!actor || reply.sent || !UUID.test(actor.actorId)) return reply.code(401).send({ error: 'unauthorized' });
    const db = await pool.connect().catch(() => null);
    if (!db) return reply.code(503).send({ error: 'service_unavailable' });
    try {
      const role = await db.query<{ safe: boolean }>(`SELECT
        (rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole
         AND NOT rolcreatedb AND current_user=session_user
         AND pg_has_role(current_user,'luemi_bliki_request','member')
         AND current_setting('row_security')='on'
         AND row_security_active('luemi_bliki_private.stories'::regclass)
         AND NOT pg_has_role(current_user,'pg_write_all_data','member')
         AND NOT pg_has_role(current_user,'pg_read_all_data','member')
         AND NOT has_schema_privilege(current_user,'luemi_bliki_private','CREATE')
         AND NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='luemi_bliki_private.stories'::regclass AND relowner=pg_roles.oid)
        ) AS safe FROM pg_roles WHERE rolname=current_user`);
      if (role.rows[0]?.safe !== true) throw new Error('unsafe_database_role');
      await db.query('BEGIN');
      await db.query("SELECT set_config('luemi.actor_id',$1,true)", [actor.actorId]);
      await db.query("SELECT set_config('luemi.environment',$1,true)", [cfg.namespace]);
      // Session guard already checks actor status using its own scoped identity DB.
      // This database role intentionally has no access to session or actor tables.
      const result = await work(db, actor.actorId);
      await guard.read(request, reply);
      if (reply.sent || !request.authActor || request.authActor.actorId !== actor.actorId ||
          request.authActor.sessionId !== actor.sessionId ||
          request.authActor.hash.length !== actor.hash.length ||
          !timingSafeEqual(request.authActor.hash, actor.hash)) throw new Error('session_changed');
      await db.query('COMMIT');
      return result;
    } catch (error) {
      await db.query('ROLLBACK').catch(() => undefined);
      if (reply.sent) return reply;
      if (error instanceof RequestError) return reply.code(error.statusCode).send({ error: error.code });
      return reply.code(503).send({ error: 'service_unavailable' });
    } finally { db.release(); }
  }
  async function find(db: import('pg').PoolClient, actor: string, operation: string, lock = false) {
    const result = await db.query<Row>(`SELECT id,author_id,operation_id,media_kind,mime_type,media_key,
      media_bytes::text,status,published_at FROM luemi_bliki_private.stories
      WHERE environment=$1 AND author_id=$2 AND operation_id=$3${lock ? ' FOR UPDATE' : ''}`,
      [cfg.namespace, actor, operation]);
    return result.rows[0] ?? null;
  }
  app.post<{ Body: unknown }>('/api/v1/bliki/publications', { preHandler: guard.mutation }, async (request, reply) => {
    const parsed = validateBlikiSession(request.body);
    if (!parsed.ok) return reply.code(422).send({ error: parsed.error });
    // Fail closed until a bounded codec validation/transcoding worker is available.
    // MP4 movie-header inspection alone does not prove decodable or safe video.
    if (parsed.value.mediaKind === 'video') return reply.code(503).send({ error: 'video_pipeline_unavailable' });
    return transaction(request, reply, async (db, actor) => {
      const p = parsed.value;
      let row = await find(db, actor, p.operationId, true);
      if (!row) {
        const ticket = createBlikiUploadTicket({ actorId: actor, operationId: p.operationId,
          namespace: cfg.namespace, mediaKind: p.mediaKind, mimeType: p.mimeType, size: p.size });
        const created = await db.query<Row>(`INSERT INTO luemi_bliki_private.stories
          (id,environment,author_id,operation_id,media_kind,mime_type,media_key,media_bytes,status)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,'uploading')
          ON CONFLICT (environment,author_id,operation_id) DO NOTHING
          RETURNING id,author_id,operation_id,media_kind,mime_type,media_key,media_bytes::text,status,published_at`,
          [randomUUID(), cfg.namespace, actor, p.operationId, p.mediaKind, p.mimeType, ticket.key, p.size]);
        row = created.rows[0] ?? await find(db, actor, p.operationId, true);
      }
      if (!row || row.media_kind !== p.mediaKind || row.mime_type !== p.mimeType ||
          Number(row.media_bytes) !== p.size) fail(409, 'operation_conflict');
      if (row.status === 'processing' || row.status === 'published') return status(row);
      if (row.status !== 'uploading') fail(409, 'operation_conflict');
      return { operationId: p.operationId, uploadUrl: '/api/v1/bliki/uploads/' + p.operationId };
    });
  });
  app.get<{ Params: { operationId: string } }>('/api/v1/bliki/publications/:operationId',
    { preHandler: guard.read }, async (request, reply) => {
      if (!UUID.test(request.params.operationId)) return reply.code(422).send({ error: 'invalid_id' });
      return transaction(request, reply, async (db, actor) => {
        const row = await find(db, actor, request.params.operationId);
        return row ? status(row) : { state: 'missing' };
      });
    });
  app.put<{ Params: { operationId: string }; Body: Buffer }>('/api/v1/bliki/uploads/:operationId',
    { preHandler: guard.mutation, bodyLimit: 25 * 1024 * 1024 }, async (request, reply) => {
      if (!UUID.test(request.params.operationId) || !Buffer.isBuffer(request.body)) {
        return reply.code(422).send({ error: 'invalid_upload' });
      }
      return transaction(request, reply, async (db, actor) => {
        const row = await find(db, actor, request.params.operationId, true);
        if (!row) fail(404, 'operation_not_found');
        if (row.status === 'processing' || row.status === 'published') return status(row);
        if (row.status !== 'uploading') fail(409, 'operation_unavailable');
        if (row.media_kind === 'video') fail(503, 'video_pipeline_unavailable');
        const ticket = { operationId: row.operation_id, actorId: actor, mediaKind: row.media_kind,
          mimeType: row.mime_type, size: Number(row.media_bytes), key: row.media_key,
          expiresAt: Date.now() + 60000 };
        if (row.media_kind === 'video') {
          try { inspectBlikiMp4(request.body); }
          catch { fail(422, 'invalid_video'); }
        }
        try { await storeBlikiUpload(cfg.store, ticket, request.body); }
        catch (error) {
          if (error instanceof Error && /^(invalid_|upload_size_mismatch|upload_too_large)/.test(error.message))
            fail(422, 'invalid_upload');
          throw error;
        }
        const updated = await db.query(`UPDATE luemi_bliki_private.stories SET status='processing'
          WHERE id=$1 AND author_id=$2 AND status='uploading'`, [row.id, actor]);
        if (updated.rowCount !== 1) throw new Error('upload_transition_failed');
        return { state: 'processing' };
      });
    });
  app.post<{ Params: { operationId: string }; Body: { editor?: unknown } }>(
    '/api/v1/bliki/publications/:operationId/confirm',
    { preHandler: guard.mutation }, async (request, reply) => {
      if (!UUID.test(request.params.operationId)) return reply.code(422).send({ error: 'invalid_id' });
      return transaction(request, reply, async (db, actor) => {
        const row = await find(db, actor, request.params.operationId, true);
        if (!row) fail(404, 'operation_not_found');
        if (row.status === 'published') return status(row);
        if (row.status === 'rejected' || row.status === 'deleted') fail(409, 'operation_unavailable');
        if (row.status !== 'processing') fail(409, 'upload_not_ready');
        if (row.media_kind === 'video') fail(503, 'video_pipeline_unavailable');
        const editor = parseBlikiEditor(request.body?.editor);
        if (!editor) fail(422, 'invalid_editor');
        const stored = await cfg.store.stat(row.media_key);
        if (!stored || stored.size !== Number(row.media_bytes) || stored.mimeType !== row.mime_type) {
          fail(503, 'media_integrity_unavailable');
        }
        // Only an inspected image may be published. Video requires a trusted worker.
        // Publication is still gated by storage integrity and actor-scoped RLS.
        const result = await db.query<Row>(`UPDATE luemi_bliki_private.stories
          SET status='published',editor=$2::jsonb,published_at=clock_timestamp()
          WHERE id=$1 AND status='processing'
          RETURNING id,author_id,operation_id,media_kind,mime_type,media_key,media_bytes::text,status,published_at`,
          [row.id, JSON.stringify(editor)]);
        if (result.rowCount !== 1) throw new Error('publication_transition_failed');
        return status(result.rows[0]);
      });
    });
}
