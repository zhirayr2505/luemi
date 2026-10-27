import { createHash } from 'node:crypto';
import type { BlikiPrivateMediaStore } from './bliki-private-upload.js';

/** Separate private bucket for Bliki. Never use profile-image storage for stories. */
export type BlikiStorageSettings = {
  projectRef: string;
  secret: string;
  bucket: 'luemi-bliki-private';
  namespace: string;
};
const KEY = /^[a-z0-9:_-]{1,96}\/([0-9a-f]{8}-[0-9a-f-]{27})\/([0-9a-f]{8}-[0-9a-f-]{27})$/i;
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
    async put(key, bytes, mime) {
      if (bytes.length < 1 || bytes.length > 100 * 1024 * 1024) throw new Error('invalid_bliki_size');
      const response = await request('POST', key, mime, bytes);
      if (![200, 201].includes(response.status)) throw new Error('bliki_storage_write_failed');
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
      const chunks: Uint8Array[] = [];
      let total = 0;
      const reader = response.body.getReader();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          total += value.length;
          if (total > 100 * 1024 * 1024) throw new Error('bliki_storage_oversized');
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => undefined); }
      const hash = createHash('sha256');
      for (const chunk of chunks) hash.update(chunk);
      return { size: total, mimeType: mime, sha256: hash.digest('hex') };
    },
    async remove(key) {
      const response = await request('DELETE', key);
      if (![200, 204, 404].includes(response.status)) throw new Error('bliki_storage_delete_failed');
      await response.body?.cancel();
    },
  };
}
