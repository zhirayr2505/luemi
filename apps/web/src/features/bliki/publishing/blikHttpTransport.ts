import type { BlikPublishTransport } from './blikPublishClient';

type PublishState =
  | { state: 'published'; storyId: string; expiresAt: string }
  | { state: 'processing' }
  | { state: 'missing' };

function sameOriginPath(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') ||
      /[?#]/.test(path)) throw new Error('Invalid Bliki upload URL');
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/v1/bliki/')) {
    throw new Error('Untrusted Bliki upload destination');
  }
  return url.pathname;
}
function parseState(payload: unknown, allowMissing: boolean): PublishState {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid publication response');
  const item = payload as Record<string, unknown>;
  if (item.state === 'processing') return { state: 'processing' };
  if (allowMissing && item.state === 'missing') return { state: 'missing' };
  if (item.state === 'published' && typeof item.storyId === 'string' &&
      typeof item.expiresAt === 'string' && Number.isFinite(Date.parse(item.expiresAt))) {
    return { state: 'published', storyId: item.storyId, expiresAt: item.expiresAt };
  }
  throw new Error('Invalid publication state');
}
export function createBlikiHttpTransport(csrfToken: string): BlikPublishTransport {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(csrfToken)) throw new Error('Missing authenticated CSRF token');
  async function json(path: string, method: 'GET' | 'POST', body?: unknown): Promise<unknown> {
    const response = await fetch(sameOriginPath(path), {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(method === 'POST' ? {
          'Content-Type': 'application/json',
          'X-Luemi-CSRF': csrfToken,
        } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error('Bliki request failed: ' + response.status);
    return response.json() as Promise<unknown>;
  }
  return {
    async createSession(args) {
      const value = await json('/api/v1/bliki/publications', 'POST', args);
      if (!value || typeof value !== 'object') throw new Error('Invalid upload session');
      const result = value as Record<string, unknown>;
      if (typeof result.uploadUrl !== 'string' || result.operationId !== args.operationId) {
        throw new Error('Invalid upload session');
      }
      return { uploadUrl: sameOriginPath(result.uploadUrl), operationId: args.operationId };
    },
    async upload(url, blob, mimeType) {
      if (!['image/jpeg', 'image/png', 'image/webp', 'video/mp4'].includes(mimeType) ||
          blob.size < 1 || blob.size > 100 * 1024 * 1024) throw new Error('Invalid Bliki media');
      const response = await fetch(sameOriginPath(url), {
        method: 'PUT', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': mimeType, 'X-Luemi-CSRF': csrfToken },
        body: blob,
      });
      if (!response.ok) throw new Error('Bliki upload failed: ' + response.status);
    },
    async confirm(operationId, editor) {
      const result = parseState(
        await json('/api/v1/bliki/publications/' + encodeURIComponent(operationId) + '/confirm',
          'POST', { editor }), false);
      if (result.state === 'missing') throw new Error('Publication not found');
      return result;
    },
    async lookup(operationId) {
      return parseState(
        await json('/api/v1/bliki/publications/' + encodeURIComponent(operationId), 'GET'), true);
    },
  };
}
