import { BLIKI_LIMITS, validateBlikiUpload } from './bliki-policy.js';

export type BlikiSessionRequest = {
  draftId: string;
  operationId: string;
  mimeType: string;
  size: number;
  mediaKind: 'image' | 'video';
};
export type BlikiSessionValidation =
  | { ok: true; value: BlikiSessionRequest }
  | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateBlikiSession(value: unknown): BlikiSessionValidation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'invalid_request' };
  }
  const item = value as Record<string, unknown>;
  if (Object.keys(item).sort().join(',') !== 'draftId,mediaKind,mimeType,operationId,size') {
    return { ok: false, error: 'invalid_fields' };
  }
  if (typeof item.draftId !== 'string' || !UUID.test(item.draftId) ||
      typeof item.operationId !== 'string' || !UUID.test(item.operationId)) {
    return { ok: false, error: 'invalid_id' };
  }
  if ((item.mediaKind !== 'image' && item.mediaKind !== 'video') ||
      typeof item.mimeType !== 'string' || !Number.isSafeInteger(item.size)) {
    return { ok: false, error: 'invalid_media' };
  }
  const kind = item.mediaKind;
  const media = validateBlikiUpload({
    kind, mime: item.mimeType, size: item.size as number,
  });
  if (!media.ok) return { ok: false, error: media.error };
  return { ok: true, value: {
    draftId: item.draftId,
    operationId: item.operationId,
    mediaKind: kind,
    mimeType: item.mimeType,
    size: item.size as number,
  } };
}
export function validateBlikiVideoDuration(durationMs: unknown): boolean {
  return Number.isSafeInteger(durationMs) &&
    (durationMs as number) >= 1000 &&
    (durationMs as number) <= BLIKI_LIMITS.videoMaxDurationMs;
}
export function publicationExpiry(publishedAt: Date): string {
  if (!Number.isFinite(publishedAt.getTime())) throw new Error('invalid_publication_date');
  return new Date(publishedAt.getTime() + BLIKI_LIMITS.lifetimeMs).toISOString();
}
