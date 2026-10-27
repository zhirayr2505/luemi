import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { BLIKI_LIMITS, validateBlikiUpload } from './bliki-policy.js';

/**
 * A private media storage boundary. Implementations MUST write to a private
 * bucket, verify ownership, and never return a permanent public media URL.
 */
export interface BlikiPrivateMediaStore {
  put(key: string, bytes: Uint8Array, mimeType: string): Promise<void>;
  stat(key: string): Promise<{ size: number; sha256: string; mimeType: string } | null>;
  remove(key: string): Promise<void>;
}
export type BlikiUploadTicket = {
  operationId: string;
  actorId: string;
  mediaKind: 'image' | 'video';
  mimeType: string;
  size: number;
  key: string;
  expiresAt: number;
};
export function createBlikiUploadTicket(input: {
  operationId: string; actorId: string; namespace: string;
  mediaKind: 'image' | 'video'; mimeType: string; size: number;
}, now = Date.now()): BlikiUploadTicket {
  if (!/^[a-z0-9:_-]{1,96}$/i.test(input.namespace) ||
      !/^[0-9a-f-]{36}$/i.test(input.operationId) ||
      !/^[0-9a-f-]{36}$/i.test(input.actorId)) throw new Error('invalid_upload_identity');
  const valid = validateBlikiUpload({
    kind: input.mediaKind, mime: input.mimeType, size: input.size,
  });
  if (!valid.ok) throw new Error(valid.error);
  if (!Number.isFinite(now)) throw new Error('invalid_clock');
  const key = input.namespace + '/' + input.actorId + '/' + randomUUID();
  return {
    operationId: input.operationId, actorId: input.actorId,
    mediaKind: input.mediaKind, mimeType: input.mimeType,
    size: input.size, key, expiresAt: now + 10 * 60 * 1000,
  };
}
export async function storeBlikiUpload(
  store: BlikiPrivateMediaStore, ticket: BlikiUploadTicket,
  bytes: Uint8Array, now = Date.now(),
): Promise<{ sha256: string; size: number }> {
  if (!Number.isFinite(now) || now >= ticket.expiresAt) throw new Error('upload_expired');
  if (bytes.byteLength !== ticket.size) throw new Error('upload_size_mismatch');
  if (bytes.byteLength > BLIKI_LIMITS.videoMaxBytes) throw new Error('upload_too_large');
  const valid = validateBlikiUpload({
    kind: ticket.mediaKind, mime: ticket.mimeType, size: bytes.byteLength,
  });
  if (!valid.ok) throw new Error(valid.error);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  await store.put(ticket.key, bytes, ticket.mimeType);
  const stored = await store.stat(ticket.key);
  const actual = stored?.sha256;
  if (!stored || stored.size !== bytes.byteLength ||
      stored.mimeType !== ticket.mimeType || !actual ||
      !/^[a-f0-9]{64}$/.test(actual) ||
      !timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(sha256, 'hex'))) {
    await store.remove(ticket.key).catch(() => undefined);
    throw new Error('upload_integrity_failed');
  }
  return { sha256, size: bytes.byteLength };
}
