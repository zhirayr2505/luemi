import { createHash } from 'node:crypto';
import type {Readable} from 'node:stream';
import type { BlikiPrivateMediaStore } from './bliki-private-upload.js';

/** Separate private bucket for Bliki. Never use profile-image storage for stories. */
export type BlikiStorageSettings = {
  projectRef: string;
  secret: string;
  bucket: 'luemi-bliki-private';
  namespace: string;
};
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const KEY = new RegExp('^[a-z0-9:_-]{1,96}/' + UUID + '/' + UUID + '$', 'i');
const PROJECT = /^[a-z]{20}$/;
function safeKey(key: string, namespace: string): string {
  if (!KEY.test(key) || !key.startsWith(namespace + '/')) throw new Error('invalid_bliki_key');
  return key.split('/').map(encodeURIComponent).join('/');
}
export function createBlikiSupabaseStore(
  settings: BlikiStorageSettings, transport: typeof fetch = fetch,
): BlikiPrivateMediaStore {
  const { projectRef, secret, namespace, bucket } = settings;
  const opaque = /^sb_secret_[A-Za-z0-9_-]{24,}$/.test(secret);
  const jwt = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(secret);
  if (!PROJECT.test(projectRef) || !/^[a-z0-9:_-]{1,96}$/i.test(namespace) ||
      bucket !== 'luemi-bliki-private' || (!opaque && !jwt)) {
    throw new Error('invalid_bliki_storage_configuration');
  }
  const origin = 'https://' + projectRef + '.supabase.co/storage/v1/object/';
  function headers(mime?: string): Headers {
    const result = new Headers({ apikey: secret, 'Cache-Control': 'no-store' });
    if (jwt) result.set('Authorization', 'Bearer ' + secret);
    if (mime) {
      result.set('Content-Type', mime);
      result.set('x-upsert', 'false');
    }
    return result;
  }
  async function request(
    method: 'POST' | 'GET' | 'DELETE', key: string, mime?: string, body?: Uint8Array,
  ): Promise<Response> {
    const url = origin + (method === 'GET' ? 'authenticated/' : '') +
      bucket + '/' + safeKey(key, namespace);
    const response = await transport(url, {
      method, headers: headers(mime), cache: 'no-store', redirect: 'manual',
      signal: AbortSignal.timeout(30000),
      ...(body ? { body: new Blob([Uint8Array.from(body)], { type: mime }) } : {}),
    });
    if (response.status >= 300 && response.status < 400) throw new Error('storage_redirect_denied');
    return response;
  }
  return {
    async open(key, range) {
      const h = headers();
      h.set('Accept-Encoding', 'identity');
      if (range) {
        if (!Number.isSafeInteger(range.start) || range.start < 0 ||
            (range.end !== undefined &&
             (!Number.isSafeInteger(range.end) || range.end < range.start)))
          throw new Error('bliki_invalid_range');
        h.set('Range', 'bytes=' + range.start + '-' + (range.end ?? ''));
      }
      const response = await transport(origin + 'authenticated/' + bucket + '/' + safeKey(key, namespace), {
        method: 'GET', headers: h, cache: 'no-store', redirect: 'manual',
        signal: AbortSignal.timeout(30000),
      });
      if (response.status === 404) { await response.body?.cancel(); return null; }
      const expectedStatus = range ? 206 : 200;
      if (response.status !== expectedStatus || !response.body) {
        await response.body?.cancel();
        throw new Error('bliki_storage_range_unsupported');
      }
      const mimeType = response.headers.get('content-type')?.split(';')[0].trim() ?? '';
      if (!['image/jpeg', 'image/png', 'image/webp', 'video/mp4'].includes(mimeType)) {
        await response.body.cancel();
        throw new Error('bliki_storage_mime_mismatch');
      }
      const length = Number(response.headers.get('content-length'));
      if (!Number.isSafeInteger(length) || length <= 0 || length > 100 * 1024 * 1024) {
        await response.body.cancel();
        throw new Error('bliki_storage_invalid_length');
      }
      const contentRange = response.headers.get('content-range');
      if (range && (!contentRange || !/^bytes [0-9]+-[0-9]+\/[0-9]+$/.test(contentRange))) {
        await response.body.cancel();
        throw new Error('bliki_storage_invalid_content_range');
      }
      return { status: expectedStatus as 200 | 206, mimeType, length,
        ...(contentRange ? { contentRange } : {}), body: response.body };
    },
    async put(key, bytes, mime) {
      if (bytes.length < 1 || bytes.length > 100 * 1024 * 1024) throw new Error('invalid_bliki_size');
      const response = await request('POST', key, mime, bytes);
      if (![200, 201].includes(response.status)) throw new Error('bliki_storage_write_failed');
      await response.body?.cancel();
    },
    async putStream(key, body:Readable, size:number, mime:string){
      if(!Number.isSafeInteger(size)||size<1||size>100*1024*1024)
        throw new Error('invalid_bliki_size');
      const response=await transport(origin+bucket+'/'+safeKey(key,namespace),{
        method:'POST',headers:headers(mime),cache:'no-store',redirect:'manual',
        signal:AbortSignal.timeout(90_000),body:body as unknown as BodyInit,
        // Required by Node fetch for a streaming request body; browsers never run this module.
        duplex:'half',
      } as RequestInit & {duplex:'half'});
      if(response.status>=300&&response.status<400)throw new Error('storage_redirect_denied');
      if(![200,201].includes(response.status))throw new Error('bliki_storage_write_failed');
      await response.body?.cancel();
    },
    async stat(key) {
      const response = await request('GET', key);
      if (response.status === 404) return null;
      if (response.status !== 200 || !response.body) throw new Error('bliki_storage_read_failed');
      const mime = response.headers.get('content-type')?.split(';')[0].trim() ?? '';
      if (!['image/jpeg', 'image/png', 'image/webp', 'video/mp4'].includes(mime)) {
        await response.body.cancel();
        throw new Error('bliki_storage_mime_mismatch');
      }
      const hash = createHash('sha256');
      let total = 0;
      const reader = response.body.getReader();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          total += value.length;
          if (total > 100 * 1024 * 1024) throw new Error('bliki_storage_oversized');
          hash.update(value);
        }
      } finally { await reader.cancel().catch(() => undefined); }
      if (total < 1) throw new Error('bliki_storage_empty');
      return { size: total, mimeType: mime, sha256: hash.digest('hex') };
    },
    async remove(key) {
      const response = await request('DELETE', key);
      if (![200, 204, 404].includes(response.status)) throw new Error('bliki_storage_delete_failed');
      await response.body?.cancel();
    },
  };
}
