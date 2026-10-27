import type { BlikiFeedCandidate, BlikiFeedResult } from './blikiFeed';
import { buildBlikiFeed } from './blikiFeed';

export type BlikiFeedEnvelope = {
  authors: BlikiFeedCandidate[];
  serverNow: string;
  nextCursor: string | null;
};

/**
 * Only accepts already-authorized story DTOs returned by the private API.
 * A missing endpoint is an error, never a synthetic empty feed.
 */
export async function fetchBlikiFeed(signal?: AbortSignal): Promise<BlikiFeedResult> {
  const response = await fetch('/api/v1/bliki/feed', {
    method: 'GET', credentials: 'same-origin', cache: 'no-store', signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Bliki feed unavailable (${response.status})`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || !('authors' in payload) ||
      !Array.isArray(payload.authors) || !('serverNow' in payload) ||
      typeof payload.serverNow !== 'string') throw new Error('Invalid Bliki feed response');
  const now = Date.parse(payload.serverNow);
  if ('stories' in payload) throw new Error('Bliki server contract mismatch: expected author groups');
  if (!Number.isFinite(now)) throw new Error('Invalid Bliki server time');
  // The API must deliver server-authorized author groups with resolved media URLs.
  // A raw story-row envelope is NOT safe or sufficient for rendering.
  const authors = payload.authors as unknown[];
  if (!authors.every(author => {
    if (!author || typeof author !== 'object') return false;
    const a = author as Record<string, unknown>;
    if (typeof a.id !== 'string' || typeof a.name !== 'string' ||
        typeof a.isBlocked !== 'boolean' || typeof a.isEligible !== 'boolean' ||
        typeof a.isMutualMatch !== 'boolean' || typeof a.likedByViewer !== 'boolean' ||
        typeof a.isNearby !== 'boolean' || typeof a.isSelf !== 'boolean' ||
        typeof a.lastPublishedAt !== 'number' || !Array.isArray(a.stories)) return false;
    return a.stories.every(story => {
      if (!story || typeof story !== 'object') return false;
      const item = story as Record<string, unknown>;
      if (typeof item.id !== 'string' || typeof item.authorId !== 'string' ||
          typeof item.mediaUrl !== 'string' || !item.mediaUrl.startsWith('/') ||
          item.mediaUrl.startsWith('//') || item.mediaUrl.includes('\\\\') ||
          /[?#]/.test(item.mediaUrl) || !item.mediaUrl.startsWith('/api/v1/bliki/media/')) return false;
      if ('publishedAt' in item && (!Number.isFinite(item.publishedAt) ||
          typeof item.publishedAt !== 'number')) return false;
      return item.mediaKind === 'image' || item.mediaKind === 'video';
    });
  })) throw new Error('Invalid authorized Bliki author payload');
  return buildBlikiFeed(authors as BlikiFeedCandidate[], { now });
}
