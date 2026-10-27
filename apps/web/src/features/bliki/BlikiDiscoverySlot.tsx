import { useCallback, useEffect, useMemo, useState } from 'react';
import { geoCsrf } from '../../auth/session-adapter';
import { BlikDraftEditor } from './editor/BlikDraftEditor';
import { BlikiAvatarRail } from './feed/BlikiAvatarRail';
import { fetchBlikiFeed } from './feed/blikiFeedClient';
import type { BlikiFeedEntry } from './feed/blikiFeed';
import { createBlikiHttpTransport } from './publishing/blikHttpTransport';
import { BlikViewer } from './viewer/BlikViewer';

/** Opt-in Discovery surface, isolated from the existing Profile Morph and deck gestures. */
export function BlikiDiscoverySlot({ ownerId, registerBack }: {
  ownerId: string;
  registerBack: (handler: (() => boolean) | null) => void;
}) {
  const [entries, setEntries] = useState<BlikiFeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [openAuthor, setOpenAuthor] = useState<string | null>(null);
  const socialEnabled = import.meta.env.VITE_BLIKI_V1_INTERACTION_ENABLED === '1';
  const sendAction = useCallback(async (id: string, endpoint: string, body: object) => {
    const csrf = geoCsrf();
    if (!csrf || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Authenticated session required');
    const response = await fetch('/api/v1/bliki/stories/' + encodeURIComponent(id) + '/' + endpoint, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Luemi-CSRF': csrf },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('Bliki interaction unavailable');
  }, []);
  const transport = useMemo(() => {
    const csrf = geoCsrf();
    return csrf ? createBlikiHttpTransport(csrf) : undefined;
  }, [ownerId]);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true); setError('');
    void fetchBlikiFeed(abort.signal).then(feed => {
      if (!abort.signal.aborted) setEntries(feed.entries);
    }).catch(err => {
      if (abort.signal.aborted) return;
      setError(err instanceof Error && /403/.test(err.message)
        ? 'Сначала опубликуй настоящую анкету, чтобы увидеть Блики.'
        : 'Не удалось загрузить Блики. Попробуй ещё раз.');
      setEntries([]);
    }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [ownerId, reload]);
  // BlikiFeedEntry structurally satisfies BlikAuthor; keep the secure DTO unchanged.
  const authors = entries;
  const openIndex = authors.findIndex(author => author.id === openAuthor);
  const closeViewer = useCallback(() => setOpenAuthor(null), []);
  const backFromBliki = useCallback((): boolean => {
    if (editorOpen) { setEditorOpen(false); return true; }
    if (openAuthor) { setOpenAuthor(null); return true; }
    return false;
  }, [editorOpen, openAuthor]);
  useEffect(() => {
    registerBack(backFromBliki);
    return () => registerBack(null);
  }, [registerBack, backFromBliki]);
  return <aside aria-label="Истории LUEMI" style={{
    position: 'relative', zIndex: 8, flexShrink: 0, padding: '2px 12px 4px'
  }}>
    <BlikiAvatarRail candidates={entries} onOpenAuthor={setOpenAuthor}
      onCreate={() => setEditorOpen(true)} />
    {loading && <p role="status" style={{ margin: '0 6px', fontSize: 12 }}>Загружаем Блики…</p>}
    {error && <div role="status" style={{ fontSize: 12, padding: '0 6px 8px' }}>
      {error} <button type="button" onClick={() => setReload(value => value + 1)}>Повторить</button>
    </div>}
    {editorOpen && <BlikDraftEditor ownerId={ownerId}
      publishTransport={transport}
      onClose={() => setEditorOpen(false)}
      onPublished={() => { setEditorOpen(false); setReload(value => value + 1); }} />}
    {openIndex >= 0 && <BlikViewer key={openAuthor} authors={authors}
      initial={{ author: openIndex, story: 0 }} onClose={closeViewer}
      viewerId={ownerId}
      onView={socialEnabled ? id => { void sendAction(id, 'view', {}).catch(() => undefined); } : undefined}
      onReact={socialEnabled ? (id, reaction) => sendAction(id, 'reaction', { reaction }) : undefined}
      onReport={socialEnabled ? (id, reason) => sendAction(id, 'report', { reason }) : undefined} />}
  </aside>;
}
