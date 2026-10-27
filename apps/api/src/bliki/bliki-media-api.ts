import { timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Pool, type PoolClient } from 'pg';
import type { BlikiPrivateMediaStore } from './bliki-private-upload.js';

type Guard = { read: (req: FastifyRequest, reply: FastifyReply) => Promise<void> };
export type BlikiMediaApiOptions = {
  enabled: true; databaseUrl: string; namespace: string; store: BlikiPrivateMediaStore;
};
type MediaRow = {
  media_key: string; mime_type: string; media_bytes: string;
  published_at: Date; status: string;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class Denial extends Error {
  constructor(readonly statusCode: number, readonly code: string) { super(code); }
}
function deny(code: number, message: string): never { throw new Denial(code, message); }

/** No in-memory media buffers; pulls one upstream chunk only when backpressure permits. */
function limitedStream(body: ReadableStream<Uint8Array>, expected: number): Readable {
  const reader = body.getReader();
  async function* chunks() {
    let received = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > expected) throw new Error('bliki_media_overflow');
        yield Buffer.from(value);
      }
      if (received !== expected) throw new Error('bliki_media_truncated');
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  }
  return Readable.from(chunks(), { highWaterMark: 64 * 1024 });
}

/** Same-origin cookie-authorized media; private object keys never reach the caller. */
export function registerBlikiMediaApi(
  app: FastifyInstance, guard: Guard | undefined, options?: BlikiMediaApiOptions,
): void {
  if (!options?.enabled) return;
  if (!guard || !options.databaseUrl || !options.store.open ||
      !/^[a-z0-9:_-]{1,96}$/i.test(options.namespace)) {
    throw new Error('Bliki media requires independent read DB, storage and REM-05B session');
  }
  const cfg = options;
  const pool = new Pool({ connectionString: cfg.databaseUrl, max: 3, connectionTimeoutMillis: 3000 });
  app.addHook('onClose', async () => { await pool.end(); });

  async function lookup(req: FastifyRequest, reply: FastifyReply, id: string): Promise<MediaRow | null> {
    const actor = req.authActor;
    if (!actor || reply.sent) deny(401, 'unauthorized');
    const db: PoolClient = await pool.connect().catch(() => deny(503, 'service_unavailable'));
    try {
      const role = await db.query<{ safe: boolean }>(`
        SELECT (rolcanlogin AND NOT rolsuper AND NOT rolbypassrls
         AND NOT rolcreaterole AND NOT rolcreatedb
         AND current_user=session_user AND current_setting('row_security')='on'
         AND pg_has_role(current_user,'luemi_bliki_media_reader','member')
         AND NOT pg_has_role(current_user,'luemi_bliki_reader','member')
         AND NOT pg_has_role(current_user,'luemi_bliki_request','member')
         AND NOT pg_has_role(current_user,'pg_read_all_data','member')
         AND NOT pg_has_role(current_user,'pg_write_all_data','member')
         AND NOT has_schema_privilege(current_user,'luemi_bliki_private','CREATE')
         AND row_security_active('luemi_bliki_private.stories'::regclass)
         AND has_column_privilege(current_user,'luemi_bliki_private.stories','media_key','SELECT')
         AND NOT has_table_privilege(current_user,'luemi_bliki_private.stories','INSERT')
         AND NOT has_table_privilege(current_user,'luemi_bliki_private.stories','UPDATE')
         AND NOT has_table_privilege(current_user,'luemi_bliki_private.stories','DELETE')
         AND NOT has_table_privilege(current_user,'luemi_bliki_private.stories','SELECT')
         AND NOT has_table_privilege(current_user,'luemi_private.sessions','SELECT')
         AND NOT has_column_privilege(current_user,'luemi_private.media_assets','derivative_key','SELECT')
        ) AS safe FROM pg_roles WHERE rolname=current_user`);
      if (role.rows[0]?.safe !== true) deny(503, 'service_unavailable');
      await db.query('BEGIN READ ONLY');
      await db.query("SELECT set_config('luemi.actor_id',$1,true)", [actor.actorId]);
      await db.query("SELECT set_config('luemi.environment',$1,true)", [cfg.namespace]);
      const found = await db.query<MediaRow>(
        `SELECT media_key,mime_type,media_bytes::text,published_at,status
         FROM luemi_bliki_private.stories
         WHERE id=$1::uuid AND environment=$2 AND status='published'
           AND deleted_at IS NULL AND published_at<=now()
           AND published_at>now()-interval '24 hours'`,
        [id, cfg.namespace],
      );
      // Explicit session revalidation before commit. Policy independently
      // applies published viewer, published author and both block directions.
      await guard.read(req, reply);
      if (reply.sent || !req.authActor || req.authActor.actorId !== actor.actorId ||
          req.authActor.sessionId !== actor.sessionId ||
          req.authActor.hash.length !== actor.hash.length ||
          !timingSafeEqual(req.authActor.hash, actor.hash)) deny(401, 'unauthorized');
      await db.query('COMMIT');
      return found.rows[0] ?? null;
    } catch (error) {
      await db.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { db.release(); }
  }

  app.get<{ Params: { storyId: string } }>('/api/v1/bliki/media/:storyId',
    { preHandler: guard.read }, async (req, reply) => {
      reply.header('Cache-Control', 'private, no-store').header('Vary', 'Cookie')
        .header('X-Content-Type-Options', 'nosniff');
      if (!UUID.test(req.params.storyId)) return reply.code(404).send({ error: 'not_found' });
      try {
        const row = await lookup(req, reply, req.params.storyId);
        if (!row) return reply.sent ? reply : reply.code(404).send({ error: 'not_found' });
        const size = Number(row.media_bytes);
        if (!Number.isSafeInteger(size) || size < 1 || size > 100 * 1024 * 1024)
          deny(503, 'media_unavailable');
        const rawRange = req.headers.range;
        let range: { start: number; end?: number } | undefined;
        if (rawRange !== undefined) {
          const match = /^bytes=(\d+)-(\d*)$/.exec(rawRange);
          if (!match) return reply.code(416).header('Content-Range', `bytes */${size}`)
            .send({ error: 'invalid_range' });
          const start = Number(match[1]), end = match[2] ? Number(match[2]) : undefined;
          if (!Number.isSafeInteger(start) || start >= size ||
              (end !== undefined && (!Number.isSafeInteger(end) || end < start || end >= size)))
            return reply.code(416).header('Content-Range', `bytes */${size}`)
              .send({ error: 'invalid_range' });
          range = { start, ...(end === undefined ? {} : { end }) };
        }
        const opened = await cfg.store.open!(row.media_key, range);
        if (!opened || opened.mimeType !== row.mime_type) {
          await opened?.body.cancel().catch(() => undefined);
          deny(503, 'media_unavailable');
        }
        const expected = range ? 206 : 200;
        if (opened.status !== expected || !Number.isSafeInteger(opened.length) ||
            opened.length < 1 || opened.length > size) {
          await opened.body.cancel().catch(() => undefined);
          deny(503, 'media_unavailable');
        }
        if (range) {
          const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(opened.contentRange ?? '');
          if (!match || Number(match[1]) !== range.start || Number(match[3]) !== size ||
              (range.end !== undefined && Number(match[2]) !== range.end) ||
              Number(match[2]) - Number(match[1]) + 1 !== opened.length) {
            await opened.body.cancel().catch(() => undefined);
            deny(503, 'media_unavailable');
          }
        } else if (opened.length !== size) {
          await opened.body.cancel().catch(() => undefined);
          deny(503, 'media_unavailable');
        }
        // A block or unpublish after the first lookup must prevent even the
        // first byte from leaving this server; never rely on an old feed URL.
        const again = await lookup(req, reply, req.params.storyId);
        if (!again || again.media_key !== row.media_key || again.status !== 'published') {
          await opened.body.cancel().catch(() => undefined);
          return reply.sent ? reply : reply.code(404).send({ error: 'not_found' });
        }
        return reply.code(expected)
          .header('Content-Type', row.mime_type)
          .header('Content-Length', String(opened.length))
          .header('Accept-Ranges', 'bytes')
          .header('Content-Disposition', 'inline')
          .headers(range ? { 'Content-Range': opened.contentRange! } : {})
          .send(limitedStream(opened.body, opened.length));
      } catch (error) {
        if (reply.sent) return reply;
        if (error instanceof Denial) return reply.code(error.statusCode).send({ error: error.code });
        return reply.code(503).send({ error: 'media_unavailable' });
      }
    });
}
