import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoCsrf } from '../../auth/session-adapter';
import { BlikDraftEditor } from './editor/BlikDraftEditor';
import { BlikiAvatarRail } from './feed/BlikiAvatarRail';
import { fetchBlikiFeedPage as fetchBlikiFeed } from './feed/blikiFeedClient';
import { buildBlikiFeed } from './feed/blikiFeed';
import type { BlikiFeedEntry } from './feed/blikiFeed';
import { createBlikiHttpTransport } from './publishing/blikHttpTransport';
import { BlikViewer } from './viewer/BlikViewer';
import './bliki-ui.css';

/** Opt-in Discovery surface, isolated from the existing Profile Morph and deck gestures. */
export function BlikiDiscoverySlot({ ownerId, registerBack }: {
  ownerId: string;
  registerBack: (handler: (() => boolean) | null) => void;
}) {
  const [entries, setEntries] = useState<BlikiFeedEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageAbortRef = useRef<AbortController | null>(null);
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
  const sendReply=useCallback(async (_storyId:string,authorId:string,text:string)=>{
    const csrf=geoCsrf();
    const body=text.trim();
    if(!csrf||!body||body.length>1000)throw new Error('reply_unavailable');
    const list=await fetch('/api/v4/chats',{credentials:'same-origin',cache:'no-store'});
    if(!list.ok)throw new Error('reply_unavailable');
    const payload=await list.json() as {conversations?:Array<{id?:unknown;peerId?:unknown}>};
    const conversation=payload.conversations?.find(item=>item.peerId===authorId);
    if(!conversation||typeof conversation.id!=="string")throw new Error('match_required');
    const sent=await fetch('/api/v4/chats/'+encodeURIComponent(conversation.id)+'/messages',{
      method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json','X-Luemi-CSRF':csrf},
      body:JSON.stringify({body:'Ответ на твой Блик 💜\n'+body,clientId:crypto.randomUUID(),mediaIds:[]})
    });
    if(!sent.ok)throw new Error('reply_unavailable');
  },[]);
  const deleteStory=useCallback(async(storyId:string)=>{
    const csrf=geoCsrf();if(!csrf)throw new Error('delete_unavailable');
    const response=await fetch('/api/v1/bliki/stories/'+encodeURIComponent(storyId),{
      method:'DELETE',credentials:'same-origin',cache:'no-store',headers:{'X-Luemi-CSRF':csrf}
    });
    if(!response.ok)throw new Error('delete_unavailable');
    setOpenAuthor(null);setReload(value=>value+1);
  },[]);
  const transport = useMemo(() => {
    if (!ownerId) return undefined;
    const csrf = geoCsrf();
    return csrf ? createBlikiHttpTransport(csrf) : undefined;
  }, [ownerId]);
  useEffect(() => {
    const abort = new AbortController();
    pageAbortRef.current?.abort();
    setLoading(true); setError(''); setNextCursor(null);
    void fetchBlikiFeed(abort.signal).then(feed => {
      if (!abort.signal.aborted) { setEntries(feed.entries); setNextCursor(feed.nextCursor); }
    }).catch(err => {
      if (abort.signal.aborted) return;
      setError(err instanceof Error && /403/.test(err.message)
        ? 'Сначала опубликуй настоящую анкету, чтобы увидеть Блики.'
        : 'Не удалось загрузить Блики. Попробуй ещё раз.');
      setEntries([]); setNextCursor(null);
    }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => { abort.abort(); pageAbortRef.current?.abort(); };
  }, [ownerId, reload]);
  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore || loading) return;
    const abort = new AbortController();
    pageAbortRef.current?.abort();
    pageAbortRef.current = abort;
    setLoadingMore(true);
    void fetchBlikiFeed(abort.signal, nextCursor).then(feed => {
      if (abort.signal.aborted) return;
      setEntries(previous => {
        const combined = new Map(previous.map(author => [author.id, author]));
        for (const incoming of feed.entries) {
          const prior = combined.get(incoming.id);
          if (!prior) { combined.set(incoming.id, incoming); continue; }
          const seen = new Set(prior.stories.map(story => story.id));
          const stories = [...prior.stories];
          for (const story of incoming.stories) {
            if (!seen.has(story.id)) { seen.add(story.id); stories.push(story); }
          }
          combined.set(incoming.id, { ...prior, stories,
            lastPublishedAt: Math.max(prior.lastPublishedAt, incoming.lastPublishedAt) });
        }
        return buildBlikiFeed([...combined.values()], { now: Date.now() }).entries;
      });
      setNextCursor(feed.nextCursor);
    }).catch(() => {
      if (!abort.signal.aborted) setError('Не удалось загрузить следующие Блики. Попробуй ещё раз.');
    }).finally(() => { if (!abort.signal.aborted) setLoadingMore(false); });
  }, [nextCursor, loadingMore, loading]);
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
  return <aside aria-label="Истории LUEMI" className="bliki-surface">
    <BlikiAvatarRail candidates={entries} onOpenAuthor={setOpenAuthor}
      hasMore={nextCursor !== null} loadingMore={loadingMore} onLoadMore={loadMore}
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
      onReport={socialEnabled ? (id, reason) => sendAction(id, 'report', { reason }) : undefined}
      onReply={socialEnabled&&import.meta.env.VITE_LUEMI_REAL_CHATS==='1'?sendReply:undefined}
      onDelete={deleteStory} />}
  </aside>;
}
