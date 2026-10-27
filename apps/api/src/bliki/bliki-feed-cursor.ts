/** Opaque, bounded keyset cursor. RLS still authorizes every returned row. */
export type BlikiPageCursor = { v: 1; anchorMs: number; beforeAt: string; beforeId: string };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
export function decodeBlikiCursor(raw: unknown, now = Date.now()): BlikiPageCursor | null {
  if (typeof raw !== 'string' || raw.length < 16 || raw.length > 512 ||
      !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const value: unknown = JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const v = value as Record<string, unknown>;
    if (Object.keys(v).sort().join(',') !== 'anchorMs,beforeAt,beforeId,v' ||
        v.v !== 1 || !Number.isSafeInteger(v.anchorMs) ||
        (v.anchorMs as number) <= now-86400000 ||
        (v.anchorMs as number) > now+5000 ||
        typeof v.beforeAt !== 'string' || !TIMESTAMP.test(v.beforeAt) ||
        !Number.isFinite(Date.parse(v.beforeAt)) ||
        Date.parse(v.beforeAt) > (v.anchorMs as number) ||
        typeof v.beforeId !== 'string' || !ID.test(v.beforeId)) return null;
    return v as BlikiPageCursor;
  } catch { return null; }
}
export function encodeBlikiCursor(value: BlikiPageCursor): string {
  if (!decodeBlikiCursor(Buffer.from(JSON.stringify(value)).toString('base64url'),value.anchorMs))
    throw new Error('invalid_bliki_cursor');
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
