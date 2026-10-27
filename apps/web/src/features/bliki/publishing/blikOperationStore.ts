/** Durable, owner-scoped operation IDs survive WebView restarts and network retries. */
const DB_NAME = 'luemi-bliki-publish-v1';
const STORE = 'operations';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Publication storage unavailable'));
    req.onblocked = () => reject(new Error('Publication storage blocked'));
  });
}
function key(ownerId: string, draftId: string): string {
  if (!UUID.test(ownerId) || !UUID.test(draftId)) throw new Error('Invalid publication identity');
  return ownerId + ':' + draftId;
}
export async function getOrCreateBlikOperation(ownerId: string, draftId: string): Promise<string> {
  const db = await open();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const id = key(ownerId, draftId);
    const result = await new Promise<string>((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => {
        const saved: unknown = req.result;
        if (saved !== undefined && (typeof saved !== 'string' || !UUID.test(saved))) {
          reject(new Error('Corrupted publication operation')); return;
        }
        const operationId = typeof saved === 'string' ? saved : crypto.randomUUID();
        if (saved === undefined) store.put(operationId, id);
        resolve(operationId);
      };
      req.onerror = () => reject(req.error ?? new Error('Publication operation read failed'));
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('Publication operation write failed'));
      tx.onerror = () => reject(tx.error ?? new Error('Publication operation write failed'));
    });
    return result;
  } finally { db.close(); }
}
export async function clearBlikOperation(ownerId: string, draftId: string): Promise<void> {
  const db = await open();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key(ownerId, draftId));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('Publication operation delete failed'));
      tx.onerror = () => reject(tx.error ?? new Error('Publication operation delete failed'));
    });
  } finally { db.close(); }
}
