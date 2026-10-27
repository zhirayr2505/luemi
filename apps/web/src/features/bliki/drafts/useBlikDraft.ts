import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultBlikEditor, type BlikDraft, type BlikEditorState } from './draftTypes';
import { loadBlikDraft, saveNewBlikDraft, updateBlikDraftEditor } from './draftRepository';

const MAX_IMAGE = 25 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);

export function validateBlikMedia(file: File): 'image' | 'video' {
  const image = IMAGE_TYPES.has(file.type);
  const video = VIDEO_TYPES.has(file.type);
  if (!image && !video) throw new Error('Выбери JPG, PNG, WebP, MP4 или WebM');
  if (!file.size || file.size > (image ? MAX_IMAGE : MAX_VIDEO)) {
    throw new Error('Файл слишком большой или пустой');
  }
  return image ? 'image' : 'video';
}

/** One editor instance owns one write queue, preventing stale autosaves. */
export function useBlikDraft(ownerId: string) {
  const [draft, setDraft] = useState<BlikDraft | null>(null);
  const [editor, setEditor] = useState<BlikEditorState>(defaultBlikEditor);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  const current = useRef<BlikDraft | null>(null);
  const pending = useRef<BlikEditorState | null>(null);
  const editGeneration = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const url = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const assign = useCallback((next: BlikDraft, blob: Blob) => {
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = URL.createObjectURL(blob);
    current.current = next;
    revision.current = next.revision;
    pending.current = null;
    editGeneration.current += 1;
    setDraft(next);
    setEditor(next.editor);
    setMediaUrl(url.current);
  }, []);

  const create = useCallback(async (file: File) => {
    if (!ownerId) throw new Error('Авторизация обязательна');
    const kind = validateBlikMedia(file);
    await flushPending();
    const id = crypto.randomUUID();
    const mediaId = crypto.randomUUID();
    const now = Date.now();
    const next: BlikDraft = {
      id, ownerId, schemaVersion: 1, mediaId, mediaKind: kind,
      mimeType: file.type, originalName: file.name, originalSize: file.size,
      createdAt: now, updatedAt: now, revision: 0, status: 'editing',
      editor: defaultBlikEditor(),
    };
    await saveNewBlikDraft(next, { id: mediaId, ownerId, blob: file, size: file.size, mimeType: file.type });
    assign(next, file);
    setError(null);
  // flushPending declared as function below and intentionally not a dependency
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, assign]);

  const recover = useCallback(async (id: string) => {
    await flushPending();
    const found = await loadBlikDraft(id, ownerId);
    if (!found) throw new Error('Черновик не найден');
    assign(found.draft, found.media.blob);
    setError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, assign]);

  function flushPending(): Promise<void> {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const nextEditor = pending.current;
    const target = current.current;
    if (!nextEditor || !target) return queue.current;
    pending.current = null;
    const generation = editGeneration.current;
    setSaving(true);
    queue.current = queue.current.catch(() => undefined).then(async () => {
      try {
        const saved = await updateBlikDraftEditor(target.id, target.ownerId, revision.current, nextEditor);
        if (current.current?.id === target.id && generation === editGeneration.current) {
          revision.current = saved.revision;
          current.current = saved;
          setDraft(saved);
        }
        setError(null);
      } catch (cause) {
        if (generation === editGeneration.current && pending.current === null) pending.current = nextEditor;
        setError(cause instanceof Error ? cause.message : 'Ошибка сохранения');
        throw cause;
      } finally {
        setSaving(false);
      }
    });
    return queue.current;
  }

  const change = useCallback((next: BlikEditorState) => {
    setEditor(next);
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flushPending().catch(() => undefined); }, 500);
  }, []);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void flushPending().catch(() => undefined);
    };
    const onPageHide = () => { void flushPending().catch(() => undefined); };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onPageHide);
      if (timer.current) clearTimeout(timer.current);
      void flushPending().catch(() => undefined);
      if (url.current) URL.revokeObjectURL(url.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { draft, editor, mediaUrl, saving, error, create, recover, change, flush: flushPending };
}
