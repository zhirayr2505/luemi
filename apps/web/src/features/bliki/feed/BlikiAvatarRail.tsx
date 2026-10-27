import { useMemo, useRef, useState } from 'react';
import { buildBlikiFeed, type BlikiFeedCandidate } from './blikiFeed';
import './blikiRailMotion.css';

type Props = {
  candidates: BlikiFeedCandidate[];
  onOpenAuthor: (authorId: string) => void;
  onCreate: () => void;
  initiallyExpanded?: boolean;
};

/** An avatar is displayed only from the app's authorized, same-origin media route. */
function avatarUrl(raw?: string): string | null {
  if (!raw || !/^\/api\/(?:v\d+\/)?[a-z0-9/_-]+$/i.test(raw) ||
      raw.includes('..') || raw.includes('//')) return null;
  return raw;
}
function AuthorAvatar({ author, size }: { author: BlikiFeedCandidate; size: number }) {
  const src = avatarUrl(author.avatarUrl);
  return <span className="bliki-rail-avatar" style={{ width: size, height: size, flexShrink: 0,
    borderRadius: '50%', overflow: 'hidden', border: '2px solid #a782be',
    background: '#3e3048', display: 'grid', placeItems: 'center' }}>
    {src ? <img src={src} alt="" draggable={false} loading="lazy"
      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : <span aria-hidden="true">💜</span>}
  </span>;
}

/**
 * Native overflow scrolling keeps Android WebView momentum intact.
 * Deliberately avoids pointer capture and never claims Discovery's horizontal swipe.
 * Even with zero authors, the authenticated owner can start creating a Blik.
 */
export function BlikiAvatarRail({ candidates, onOpenAuthor, onCreate, initiallyExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const feed = useMemo(() => buildBlikiFeed(candidates, { now: Date.now() }), [candidates]);
  const start = useRef({ y: 0, x: 0 });
  return <section aria-label="Блики" onTouchStart={event => {
    start.current.y = event.touches[0]?.clientY ?? 0;
    start.current.x = event.touches[0]?.clientX ?? 0;
  }} onTouchEnd={event => {
    const dy = (event.changedTouches[0]?.clientY ?? 0) - start.current.y;
    const dx = (event.changedTouches[0]?.clientX ?? 0) - start.current.x;
    if (Math.abs(dy) > 45 && Math.abs(dy) > Math.abs(dx) * 1.5) setExpanded(dy > 0);
  }} style={{ position: 'relative', touchAction: 'pan-x pan-y' }}>
    {!expanded ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6 }}>
      <button type="button" onClick={onCreate} aria-label="Создать мой Блик"
        style={{ flexShrink: 0, background: 'transparent', border: '1px solid #a782be',
          borderRadius: 22, color: 'inherit', padding: '9px 12px' }}>＋ Мой Блик</button>
      {feed.collapsedAvatars.length > 0 && <button type="button" aria-label="Раскрыть Блики"
        onClick={() => setExpanded(true)}
        style={{ display: 'flex', alignItems: 'center', padding: 4,
          border: 0, background: 'transparent' }}>
        {feed.collapsedAvatars.map((author, index) => <span key={author.id} title={author.name}
          style={{ marginLeft: index ? -12 : 0 }}><AuthorAvatar author={author} size={40}/></span>)}
      </button>}
    </div> : <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Блики</strong><button type="button" onClick={() => setExpanded(false)}>Свернуть</button>
      </div>
      <div className="bliki-rail-scroll" style={{ display: 'flex', gap: 14, padding: '10px 0',
        alignItems: 'center', touchAction: 'pan-x', scrollBehavior: 'auto' }}>
        <button className="bliki-rail-item" type="button" onClick={onCreate}
          style={{ flexShrink: 0 }}>＋ Мой Блик</button>
        {feed.entries.map((author, index) => <div key={author.id} className="bliki-rail-item"
          style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {index === feed.worldStartsAt && <span aria-label="Другие города и страны">🌍 Мир</span>}
          <button type="button" onClick={() => onOpenAuthor(author.id)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <AuthorAvatar author={author} size={48}/>
            <span>{author.name}</span>
          </button>
        </div>)}
      </div>
      {!feed.entries.length && <p role="status">Пока нет Бликов. Твой может стать первым 💜</p>}
    </div>}
  </section>;
}
