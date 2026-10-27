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
  if (!Number.isFinite(now)) throw new Error('Invalid Bliki server time');
  return buildBlikiFeed(payload.authors as BlikiFeedCandidate[], { now });
}
