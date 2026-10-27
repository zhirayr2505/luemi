import { useCallback, useEffect, useRef, useState } from 'react';
import { nextAuthor, nextBlik, previousBlik, type BlikAuthor, type BlikPosition } from './blikNavigation';

type Props = { authors: BlikAuthor[]; initial?: BlikPosition; onClose: () => void; onOpenProfile?: (id: string) => void };
const PHOTO_DURATION = 5000;
const SWIPE_DISTANCE = 55;
const SWIPE_VELOCITY = 0.45;
export function BlikViewer({ authors, initial = { author: 0, story: 0 }, onClose, onOpenProfile }: Props) {
  const [position, setPosition] = useState(initial);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(document.visibilityState !== 'visible');
  const [progress, setProgress] = useState(0);
  const [offset, setOffset] = useState(0);
  const gesture = useRef<{ x: number; y: number; at: number; mode: 'pending' | 'horizontal' | 'vertical' } | null>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const video = useRef<HTMLVideoElement>(null);
  const positionRef = useRef(position);
  positionRef.current = position;
  const author = authors[position.author];
  const story = author?.stories[position.story];

  const advance = useCallback(() => {
    const next = nextBlik(authors, positionRef.current);
    if (next) setPosition(next);
    else onClose();
  }, [authors, onClose]);
  useEffect(() => { setProgress(0); }, [position]);
  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState !== 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  useEffect(() => {
    if (!story || story.mediaKind !== 'image' || paused || hidden || gesture.current?.mode === 'horizontal') return;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const delta = Math.min(100, now - last);
      last = now;
      setProgress(p => {
        const next = p + delta / (story.durationMs || PHOTO_DURATION);
        if (next >= 1) { queueMicrotask(advance); return 1; }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [story, paused, hidden, advance]);
  useEffect(() => {
    const element = video.current;
    if (!element || !story || story.mediaKind !== 'video') return;
    if (paused || hidden) element.pause();
    else void element.play().catch(() => setPaused(true));
  }, [story, paused, hidden, position]);
  if (!story) return null;

  function onDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLElement && event.target.closest('button')) return;
    gesture.current = { x: event.clientX, y: event.clientY, at: performance.now(), mode: 'pending' };
    held.current = false;
    hold.current = setTimeout(() => { held.current = true; setPaused(true); }, 250);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onMove(event: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g) return;
    const dx = event.clientX - g.x, dy = event.clientY - g.y;
    if (g.mode === 'pending' && Math.max(Math.abs(dx), Math.abs(dy)) > 12) {
      g.mode = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      if (hold.current) clearTimeout(hold.current);
    }
    if (g.mode === 'horizontal') { setPaused(true); setOffset(dx); }
  }
  function onUp(event: React.PointerEvent<HTMLDivElement>) {
    if (hold.current) clearTimeout(hold.current);
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    const dx = event.clientX - g.x, dy = event.clientY - g.y;
    const elapsed = Math.max(1, performance.now() - g.at);
    setOffset(0);
    setPaused(false);
    if (held.current) return;
    if (g.mode === 'vertical' && dy > 90) { onClose(); return; }
    if (g.mode === 'horizontal') {
      const direction = dx < 0 ? 1 : -1;
      if (Math.abs(dx) >= SWIPE_DISTANCE || Math.abs(dx) / elapsed > SWIPE_VELOCITY) {
        const next = nextAuthor(authors, positionRef.current, direction as -1 | 1);
        if (next) setPosition(next);
      }
      return;
    }
    const next = event.clientX > window.innerWidth * 0.5
      ? nextBlik(authors, positionRef.current)
      : previousBlik(authors, positionRef.current);
    if (next) setPosition(next);
    else if (event.clientX > window.innerWidth * 0.5) onClose();
  }
  return <div role="dialog" aria-label="Просмотр Бликов" onPointerDown={onDown} onPointerMove={onMove}
    onPointerUp={onUp} onPointerCancel={() => { gesture.current = null; setOffset(0); setPaused(false); }}
    style={{ position: 'fixed', inset: 0, zIndex: 2100, background: '#120f17', color: 'white',
      touchAction: 'none', overflow: 'hidden', userSelect: 'none' }}>
    <div style={{ display: 'flex', gap: 3, padding: 'max(12px, env(safe-area-inset-top)) 10px 8px' }}>
      {author.stories.map((item, i) => <div key={item.id} style={{ flex: 1, height: 3, background: '#5c5362', borderRadius: 2 }}>
        <div style={{ width: `${i < position.story ? 100 : i === position.story ? progress * 100 : 0}%`,
          height: '100%', background: 'white' }} />
      </div>)}
    </div>
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12 }}>
      <button onClick={() => { setPaused(true); onOpenProfile?.(author.id); }}>{author.name}</button>
      <button onClick={onClose}>Закрыть</button>
    </header>
    <div style={{ width: '100%', height: 'calc(100% - 145px)', transform: `translate3d(${offset}px,0,0)`,
      transition: gesture.current?.mode === 'horizontal' ? 'none' : 'transform 210ms ease-out' }}>
      {story.mediaKind === 'image'
        ? <img src={story.mediaUrl} alt={story.caption || 'Блик'} draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        : <video ref={video} key={story.id} src={story.mediaUrl} playsInline autoPlay
            onTimeUpdate={event => {
              const el = event.currentTarget;
              if (el.duration > 0) setProgress(el.currentTime / el.duration);
            }} onEnded={advance} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
    </div>
    <footer style={{ padding: 12, textAlign: 'center' }}>{story.caption || ''}</footer>
  </div>;
}
