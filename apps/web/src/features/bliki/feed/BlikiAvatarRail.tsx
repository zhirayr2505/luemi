import { useMemo, useState } from 'react';
import { buildBlikiFeed, type BlikiFeedCandidate } from './blikiFeed';

type Props = {
  candidates: BlikiFeedCandidate[];
  onOpenAuthor: (authorId: string) => void;
  onCreate: () => void;
  /** Controlled by Discovery route lifecycle: remount to collapse on fresh entry. */
  initiallyExpanded?: boolean;
};

/** Isolated prototype: no Discovery gesture handler is modified until integration QA. */
export function BlikiAvatarRail({ candidates, onOpenAuthor, onCreate, initiallyExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const feed = useMemo(() => buildBlikiFeed(candidates, { now: Date.now() }), [candidates]);
  const start = { y: 0, x: 0 };
  if (!feed.entries.length) return null;
  return <section aria-label="Блики" onTouchStart={event => {
    start.y = event.touches[0]?.clientY ?? 0;
    start.x = event.touches[0]?.clientX ?? 0;
  }} onTouchEnd={event => {
    const dy = (event.changedTouches[0]?.clientY ?? 0) - start.y;
    const dx = (event.changedTouches[0]?.clientX ?? 0) - start.x;
    if (Math.abs(dy) > 45 && Math.abs(dy) > Math.abs(dx) * 1.5) setExpanded(dy > 0);
  }} style={{ position: 'relative' }}>
    {!expanded ? <button type="button" aria-label="Раскрыть Блики" onClick={() => setExpanded(true)}
      style={{ display: 'flex', alignItems: 'center', padding: 6, border: 0, background: 'transparent' }}>
      {feed.collapsedAvatars.map((author, index) => <span key={author.id} title={author.name}
        style={{ width: 40, height: 40, borderRadius: '50%', marginLeft: index ? -12 : 0,
          background: '#3e3048', border: '2px solid #a782be', display: 'grid', placeItems: 'center',
          color: '#fff', fontWeight: 600 }}>{author.name.slice(0, 1)}</span>)}
    </button> : <div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong>Блики</strong><button type="button" onClick={() => setExpanded(false)}>Свернуть</button>
      </div>
      <div style={{ display: 'flex', overflowX: 'auto', gap: 14, padding: '10px 0' }}>
        <button type="button" onClick={onCreate}>＋ Мой Блик</button>
        {feed.entries.map((author, index) => <div key={author.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {index === feed.worldStartsAt && <span aria-label="Другие города и страны">🌍 Мир</span>}
          <button type="button" onClick={() => onOpenAuthor(author.id)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ borderRadius: '50%', background: '#3e3048', padding: 12 }}>{author.name.slice(0, 1)}</span>
            <span>{author.name}</span>
          </button>
        </div>)}
      </div>
    </div>}
  </section>;
}
