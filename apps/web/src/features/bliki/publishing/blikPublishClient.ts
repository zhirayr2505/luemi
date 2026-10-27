import { getOrCreateBlikOperation } from './blikOperationStore';
import type { BlikDraft } from '../drafts/draftTypes';
import { loadBlikDraft } from '../drafts/draftRepository';

/**
 * Transport adapter deliberately requires authenticated server endpoints.
 * No fake publish success, no optimistic deletion of local drafts.
 */
export type BlikPublishTransport = {
  /** Must return an authenticated, scoped upload session and stable operation id. */
  createSession: (args: {
    draftId: string; mimeType: string; size: number; mediaKind: 'image' | 'video';
    operationId: string;
  }) => Promise<{ uploadUrl: string; operationId: string }>;
  upload: (url: string, blob: Blob, mimeType: string) => Promise<void>;
  confirm: (operationId: string, editor: BlikDraft['editor']) =>
    Promise<{ state: 'published'; storyId: string; expiresAt: string } | { state: 'processing' }>;
  lookup: (operationId: string) =>
    Promise<{ state: 'published'; storyId: string; expiresAt: string } | { state: 'processing' } | { state: 'missing' }>;
};
export type PublishOutcome =
  | { state: 'published'; storyId: string; expiresAt: string }
  | { state: 'processing'; operationId: string };

const inFlight = new Map<string, Promise<PublishOutcome>>();

/** Idempotent for concurrent calls in this WebView; server must enforce idempotency across restarts. */
export function publishBlikDraft(
  ownerId: string, draftId: string, transport: BlikPublishTransport,
  operationId: string
): Promise<PublishOutcome> {
  if (!ownerId || !draftId || !operationId) return Promise.reject(new Error('Missing authenticated publication context'));
  const key = ownerId + ':' + draftId;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const job = (async (): Promise<PublishOutcome> => {
    const found = await loadBlikDraft(draftId, ownerId);
    if (!found) throw new Error('Draft not found');
    const { draft, media } = found;
    const prior = await transport.lookup(operationId);
    if (prior.state === 'published') return prior;
    // An interrupted upload may leave a server session in processing.
    // Never create a second upload; ask the server to finish the same operation.
    if (prior.state === 'processing') {
      const resumed = await transport.confirm(operationId, draft.editor);
      return resumed.state === 'published' ? resumed : { state: 'processing', operationId };
    }
    const session = await transport.createSession({
      draftId, mimeType: draft.mimeType, size: media.size, mediaKind: draft.mediaKind, operationId,
    });
    if (session.operationId !== operationId) throw new Error('Publication operation mismatch');
    await transport.upload(session.uploadUrl, media.blob, draft.mimeType);
    const result = await transport.confirm(operationId, draft.editor);
    return result.state === 'published' ? result : { state: 'processing', operationId };
  })();
  inFlight.set(key, job);
  void job.finally(() => { if (inFlight.get(key) === job) inFlight.delete(key); }).catch(() => undefined);
  return job;
}

/**
 * Preferred UI entry point. Reuses the same server idempotency key after
 * a reload or interrupted upload; never generates a new operation per tap.
 */
export async function publishBlikDraftPersisted(
  ownerId: string, draftId: string, transport: BlikPublishTransport,
): Promise<PublishOutcome> {
  const operationId = await getOrCreateBlikOperation(ownerId, draftId);
  return publishBlikDraft(ownerId, draftId, transport, operationId);
}
