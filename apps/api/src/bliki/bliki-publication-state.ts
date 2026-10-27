import { publicationExpiry, validateBlikiVideoDuration } from './bliki-publication-validation.js';
import type { BlikiUploadTicket } from './bliki-private-upload.js';

export type BlikiPublicationRecord = {
  actorId: string;
  draftId: string;
  operationId: string;
  storyId: string;
  ticket: BlikiUploadTicket;
  state: 'uploading' | 'processing' | 'published' | 'rejected';
  uploadedSha256?: string;
  editor?: unknown;
  publishedAt?: string;
};
export type BlikiPublicationStatus =
  | { state: 'processing' }
  | { state: 'published'; storyId: string; expiresAt: string };

export function sameBlikiOperation(
  existing: BlikiPublicationRecord,
  actorId: string,
  draftId: string,
  ticket: Pick<BlikiUploadTicket, 'mediaKind' | 'mimeType' | 'size'>,
): boolean {
  return existing.actorId === actorId && existing.draftId === draftId &&
    existing.ticket.mediaKind === ticket.mediaKind &&
    existing.ticket.mimeType === ticket.mimeType &&
    existing.ticket.size === ticket.size;
}
export function blikiPublicationStatus(
  record: BlikiPublicationRecord,
  actorId: string,
): BlikiPublicationStatus {
  if (record.actorId !== actorId) throw new Error('publication_not_found');
  if (record.state === 'published' && record.publishedAt) {
    return {
      state: 'published', storyId: record.storyId,
      expiresAt: publicationExpiry(new Date(record.publishedAt)),
    };
  }
  return { state: 'processing' };
}
/**
 * This is a pure transition guard, not a persistence layer.
 * Caller must lock the operation row, verify authenticated actor and storage,
 * and atomically commit the transition in PostgreSQL.
 */
export function confirmBlikiPublication(
  record: BlikiPublicationRecord,
  input: { actorId: string; editor: unknown; durationMs?: number; now: Date },
): BlikiPublicationRecord {
  if (record.actorId !== input.actorId) throw new Error('publication_not_found');
  if (record.state === 'published') return record;
  if (record.state !== 'processing' || !record.uploadedSha256) {
    throw new Error('upload_not_verified');
  }
  if (!Number.isFinite(input.now.getTime())) throw new Error('invalid_publication_date');
  if (record.ticket.mediaKind === 'video' && !validateBlikiVideoDuration(input.durationMs)) {
    throw new Error('invalid_video_duration');
  }
  if (!input.editor || typeof input.editor !== 'object' || Array.isArray(input.editor)) {
    throw new Error('invalid_editor');
  }
  return {
    ...record, editor: input.editor, state: 'published',
    publishedAt: input.now.toISOString(),
  };
}
