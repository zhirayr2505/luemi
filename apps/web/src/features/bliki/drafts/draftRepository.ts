import type { BlikDraft, BlikDraftMedia, BlikEditorState } from './draftTypes';

/** IndexedDB storage is best-effort: WebView may evict data. */
const NAME = 'luemi-bliki-v1';
const VERSION = 1;
const DRAFTS = 'drafts';
const MEDIA = 'media';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}
function completed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
  });
}
let dbPromise: Promise<IDBDatabase> | undefined;
function openDraftDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DRAFTS)) {
          const store = db.createObjectStore(DRAFTS, { keyPath: 'id' });
          store.createIndex('by-owner', 'ownerId', { unique: false });
        }
        if (!db.objectStoreNames.contains(MEDIA)) db.createObjectStore(MEDIA, { keyPath: 'id' });
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbPromise = undefined; };
        resolve(db);
      };
      req.onerror = () => reject(req.error ?? new Error('Cannot open IndexedDB'));
      req.onblocked = () => reject(new Error('IndexedDB upgrade blocked'));
    }).catch((error: unknown) => { dbPromise = undefined; throw error; });
  }
  return dbPromise;
}
export async function saveNewBlikDraft(draft: BlikDraft, media: BlikDraftMedia): Promise<void> {
  if (!draft.ownerId || draft.ownerId !== media.ownerId || draft.mediaId !== media.id) {
    throw new Error('Draft/media ownership mismatch');
  }
  const db = await openDraftDb();
  const tx = db.transaction([DRAFTS, MEDIA], 'readwrite');
  const done = completed(tx);
  tx.objectStore(MEDIA).put(media);
  tx.objectStore(DRAFTS).put(draft);
  await done;
}
export async function listBlikDrafts(ownerId: string): Promise<BlikDraft[]> {
  if (!ownerId) return [];
  const db = await openDraftDb();
  const tx = db.transaction(DRAFTS, 'readonly');
  const done = completed(tx);
  const drafts = await request<BlikDraft[]>(tx.objectStore(DRAFTS).index('by-owner').getAll(ownerId));
  await done;
  return drafts.filter(d => d.schemaVersion === 1).sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function loadBlikDraft(id: string, ownerId: string): Promise<{ draft: BlikDraft; media: BlikDraftMedia } | null> {
  if (!id || !ownerId) return null;
  const db = await openDraftDb();
  const tx = db.transaction([DRAFTS, MEDIA], 'readonly');
  const done = completed(tx);
  const draft = await request<BlikDraft | undefined>(tx.objectStore(DRAFTS).get(id));
  if (!draft || draft.ownerId !== ownerId || draft.schemaVersion !== 1) { await done; return null; }
  const media = await request<BlikDraftMedia | undefined>(tx.objectStore(MEDIA).get(draft.mediaId));
  await done;
  if (!media || media.ownerId !== ownerId || !(media.blob instanceof Blob)) throw new Error('DRAFT_MEDIA_MISSING');
  return { draft, media };
}
/** Compare-and-swap prevents late autosaves overwriting newer revisions. */
export async function updateBlikDraftEditor(
  id: string, ownerId: string, expectedRevision: number, editor: BlikEditorState
): Promise<BlikDraft> {
  const db = await openDraftDb();
  const tx = db.transaction(DRAFTS, 'readwrite');
  const done = completed(tx);
  const store = tx.objectStore(DRAFTS);
  try {
    const existing = await request<BlikDraft | undefined>(store.get(id));
    if (!existing || existing.ownerId !== ownerId) throw new Error('DRAFT_NOT_FOUND');
    if (existing.revision !== expectedRevision) throw new Error('DRAFT_REVISION_CONFLICT');
    const next: BlikDraft = { ...existing, editor, revision: existing.revision + 1, updatedAt: Date.now() };
    store.put(next);
    await done;
    return next;
  } catch (error) {
    tx.abort();
    await done.catch(() => undefined);
    throw error;
  }
}
export async function deleteBlikDraft(id: string, ownerId: string): Promise<boolean> {
  const db = await openDraftDb();
  const tx = db.transaction([DRAFTS, MEDIA], 'readwrite');
  const done = completed(tx);
  const draft = await request<BlikDraft | undefined>(tx.objectStore(DRAFTS).get(id));
  if (!draft || draft.ownerId !== ownerId) { await done; return false; }
  tx.objectStore(DRAFTS).delete(id);
  tx.objectStore(MEDIA).delete(draft.mediaId);
  await done;
  return true;
}
