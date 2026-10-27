/** Pure, server-enforceable Bliki V1 constraints. No DB or network side effects. */
export const BLIKI_LIMITS = Object.freeze({
  photoMaxBytes: 25 * 1024 * 1024,
  videoMaxBytes: 100 * 1024 * 1024,
  videoMaxDurationMs: 15_000,
  captionMaxChars: 150,
  lifetimeMs: 24 * 60 * 60 * 1000,
  photoDurationMs: 5_000,
});

export type BlikiMediaKind = 'image' | 'video';
export type BlikiPublicationStatus = 'uploading' | 'processing' | 'published' | 'rejected' | 'deleted';

export function validateBlikiUpload(input: {
  kind: BlikiMediaKind;
  mime: string;
  size: number;
  durationMs?: number;
}): { ok: true } | { ok: false; error: string } {
  const { kind, mime, size, durationMs } = input;
  if (!Number.isSafeInteger(size) || size <= 0) return { ok: false, error: 'invalid_size' };
  if (kind === 'image') {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return { ok: false, error: 'invalid_image_type' };
    if (size > BLIKI_LIMITS.photoMaxBytes) return { ok: false, error: 'image_too_large' };
    return { ok: true };
  }
  if (kind === 'video') {
    if (mime !== 'video/mp4') return { ok: false, error: 'invalid_video_type' };
    if (size > BLIKI_LIMITS.videoMaxBytes) return { ok: false, error: 'video_too_large' };
    if (durationMs !== undefined &&
      (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > BLIKI_LIMITS.videoMaxDurationMs))
      return { ok: false, error: 'invalid_video_duration' };
    return { ok: true };
  }
  return { ok: false, error: 'invalid_kind' };
}

export function expiresAtFromPublication(publishedAt: Date): Date {
  if (!Number.isFinite(publishedAt.getTime())) throw new Error('invalid_publication_date');
  return new Date(publishedAt.getTime() + BLIKI_LIMITS.lifetimeMs);
}

export function isBlikiActive(input: {
  status: BlikiPublicationStatus;
  publishedAt: Date | null;
  expiresAt: Date | null;
  now: Date;
}): boolean {
  return input.status === 'published' &&
    input.publishedAt !== null && input.expiresAt !== null &&
    Number.isFinite(input.now.getTime()) &&
    input.publishedAt.getTime() <= input.now.getTime() &&
    input.expiresAt.getTime() > input.now.getTime();
}

export type BlikiAudienceContext = {
  viewerId: string;
  authorId: string;
  viewerEligible: boolean;
  authorEligible: boolean;
  blockedEitherDirection: boolean;
  authorVisibleInDiscovery: boolean;
};

export function canViewBliki(input: BlikiAudienceContext): boolean {
  return Boolean(input.viewerId && input.authorId && input.viewerEligible &&
    input.authorEligible && !input.blockedEitherDirection &&
    (input.viewerId === input.authorId || input.authorVisibleInDiscovery));
}

export function canReplyToBliki(input: {
  viewerId: string; authorId: string; isMutualMatch: boolean; blockedEitherDirection: boolean;
}): boolean {
  return Boolean(input.viewerId && input.authorId && input.viewerId !== input.authorId &&
    input.isMutualMatch && !input.blockedEitherDirection);
}
