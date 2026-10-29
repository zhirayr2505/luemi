import { useCallback, useEffect, useRef, useState } from 'react';
import { nextAuthor, nextBlik, previousBlik, type BlikAuthor, type BlikPosition } from './blikNavigation';
import { resolveBlikGesture } from './gestureModel';

type Props = {
  authors: BlikAuthor[];
  initial?: BlikPosition;
  onClose: () => void;
  onOpenProfile?: (authorId: string) => void;
  onView?: (storyId: string) => void;
  onReact?: (storyId: string, reaction: 'heart' | 'fire' | 'smile') => Promise<void>;
  onReport?: (storyId: string, reason: 'spam' | 'harassment' | 'nudity' | 'other') => Promise<void>;
  onReply?:(storyId:string,authorId:string,text:string)=>Promise<void>;
  onDelete?:(storyId:string)=>Promise<void>;
  viewerId?: string;
};
const PHOTO_MS = 5000;
const SETTLE_MS = 210;
type PointerStart = { x: number; y: number; at: number; pointerId: number };
type Slide = { from: number; to: number; direction: -1 | 1 } | null;
/** Display sanitized server-editor metadata without activating any editing gesture. */
function StoryLayers({ story }: { story: BlikAuthor['stories'][number] }) {
  return <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    {story.editor?.layers.map(layer => <span key={layer.id} style={{
      position: 'absolute', left: layer.x * 100 + '%', top: layer.y * 100 + '%',
      transform: `translate(-50%,-50%) scale(${layer.scale}) rotate(${layer.rotation}deg)`,
      color: layer.style === 'dark' ? '#18131e' : layer.style === 'accent' ? '#d6a9ff' : '#fff',
      fontSize: 22, textShadow: '0 1px 5px #000', whiteSpace: 'pre-wrap', maxWidth: '85%',
    }}>{layer.value}</span>)}
  </div>;
}

export function BlikViewer({ authors, initial = { author: 0, story: 0 }, onClose, onOpenProfile,
  onView, onReact, onReport, onReply, onDelete, viewerId }: Props) {
  const [position, setPosition] = useState(initial);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [socialBusy, setSocialBusy] = useState(false);
  const [replyText,setReplyText]=useState('');
  const recordedViews = useRef(new Set<string>());
  const [hidden, setHidden] = useState(document.visibilityState !== 'visible');
  const [slide, setSlide] = useState<Slide>(null);
  const [settling, setSettling] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const moving = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const pointer = useRef<PointerStart | null>(null);
  const held = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef(0);
  const positionRef = useRef(position);
  positionRef.current = position;
  const author = authors[position.author];
  const story = author?.stories[position.story];
  useEffect(() => {
    if (!story || hidden || !onView || recordedViews.current.has(story.id)) return;
    recordedViews.current.add(story.id);
    onView(story.id);
  }, [story, hidden, onView]);
  const interact = async (kind: 'react' | 'report', value: string) => {
    if (!story || socialBusy) return;
    setSocialBusy(true);
    try {
      if (kind === 'react') await onReact?.(story.id, value as 'heart' | 'fire' | 'smile');
      else await onReport?.(story.id, value as 'spam' | 'harassment' | 'nudity' | 'other');
      setFeedback(kind === 'react' ? 'Реакция отправлена 💜' : 'Жалоба отправлена на проверку');
      setReportOpen(false);
    } catch {
      setFeedback('Не удалось отправить. Проверь соединение и повтори.');
    } finally { setSocialBusy(false); }
  };
  const replyToStory=async()=>{
    const text=replyText.trim();if(!story||!author||!onReply||!text||socialBusy)return;
    setSocialBusy(true);
    try{await onReply(story.id,author.id,text);setReplyText('');setFeedback('Ответ отправлен в чат 💜');}
    catch(error){setFeedback(error instanceof Error&&error.message==='match_required'?
      'Ответить можно после взаимной симпатии.':'Не удалось отправить ответ. Попробуй ещё раз.');}
    finally{setSocialBusy(false);}
  };
  const deleteOwnStory=async()=>{
    if(!story||!onDelete||socialBusy||!window.confirm('Удалить этот Блик?'))return;
    setSocialBusy(true);
    try{await onDelete(story.id);}catch{setFeedback('Не удалось удалить Блик. Попробуй ещё раз.');setSocialBusy(false);}
  };
  const advance = useCallback(() => {
    const next = nextBlik(authors, positionRef.current);
    if (next) setPosition(next);
    else onClose();
  }, [authors, onClose]);

  useEffect(() => {
    const listener = () => setHidden(document.visibilityState !== 'visible');
    document.addEventListener('visibilitychange', listener);
    return () => document.removeEventListener('visibilitychange', listener);
  }, []);
  useEffect(() => {
    progressRef.current = 0;
    setProgress(0);
    setFeedback('');
    setReportOpen(false);
    if (video.current) video.current.currentTime = 0;
  }, [story?.id]);
  useEffect(() => {
    if (!story || story.mediaKind !== 'image' || paused || hidden || slide || settling) return;
    let frame = 0;
    let last = performance.now();
    let lastRender = 0;
    const tick = (now: number) => {
      const delta = Math.min(100, now - last);
      last = now;
      progressRef.current = Math.min(1, progressRef.current + delta / (story.durationMs || PHOTO_MS));
      if (now - lastRender >= 40 || progressRef.current >= 1) {
        setProgress(progressRef.current);
        lastRender = now;
      }
      if (progressRef.current >= 1) { advance(); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [story, paused, hidden, slide, settling, advance]);
  useEffect(() => {
    const element = video.current;
    if (!element || story?.mediaKind !== 'video') return;
    if (paused || hidden || slide || settling) element.pause();
    else void element.play().catch(() => setPaused(true));
  }, [story?.id, story?.mediaKind, paused, hidden, slide, settling]);
  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  function clearHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }
  function moveTrack(px: number, animate: boolean) {
    const element = moving.current;
    if (!element) return;
    element.style.transition = animate ? `transform ${SETTLE_MS}ms cubic-bezier(.22,.61,.36,1)` : 'none';
    element.style.transform = `translate3d(${px}px,0,0)`;
  }
  function finishSlide(target: number, direction: -1 | 1) {
    const width = root.current?.clientWidth ?? window.innerWidth;
    setSettling(true);
    requestAnimationFrame(() => moveTrack(direction * -width, true));
    settleTimer.current = setTimeout(() => {
      setPosition({ author: target, story: 0 });
      setSlide(null);
      setSettling(false);
      moveTrack(0, false);
      setPaused(false);
    }, SETTLE_MS + 25);
  }
  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLElement &&
        event.target.closest('button,input,textarea,select,a,[role="dialog"]')) return;
    if (settling || slide) return;
    pointer.current = { x: event.clientX, y: event.clientY, at: performance.now(), pointerId: event.pointerId };
    held.current = false;
    clearHold();
    holdTimer.current = setTimeout(() => { held.current = true; setPaused(true); }, 250);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const p = pointer.current;
    if (!p || p.pointerId !== event.pointerId || settling) return;
    const dx = event.clientX - p.x;
    const dy = event.clientY - p.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 12) clearHold();
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      const direction: -1 | 1 = dx < 0 ? 1 : -1;
      const next = nextAuthor(authors, positionRef.current, direction);
      if (!next) return;
      if (!slide) setSlide({ from: positionRef.current.author, to: next.author, direction });
      setPaused(true);
      moveTrack(dx, false);
    }
  }
  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const p = pointer.current;
    if (!p || p.pointerId !== event.pointerId) return;
    pointer.current = null;
    clearHold();
    const dx = event.clientX - p.x;
    const dy = event.clientY - p.y;
    const action = resolveBlikGesture({ dx, dy, durationMs: performance.now() - p.at, held: held.current },
      p.x, root.current?.clientWidth ?? window.innerWidth);
    if (action.type === 'dismiss') { onClose(); return; }
    if (action.type === 'author' && slide) {
      const next = nextAuthor(authors, positionRef.current, action.direction);
      if (next && next.author === slide.to) { finishSlide(next.author, action.direction); return; }
    }
    if (slide) {
      moveTrack(0, true);
      setSettling(true);
      settleTimer.current = setTimeout(() => {
        setSlide(null);
        setSettling(false);
        setPaused(false);
      }, SETTLE_MS + 25);
      return;
    }
    setPaused(false);
    if (action.type !== 'tap') return;
    const next = action.side === 'right'
      ? nextBlik(authors, positionRef.current) : previousBlik(authors, positionRef.current);
    if (next) setPosition(next);
    else if (action.side === 'right') onClose();
  }
  if (!story || !author) return null;
  const width = root.current?.clientWidth ?? window.innerWidth;
  const other = slide ? authors[slide.to] : null;
  const otherStory = other?.stories[0];
  return <div ref={root} role="dialog" aria-label="Просмотр Бликов" className="bliki-viewer" onPointerDown={onPointerDown}
    onPointerMove={onPointerMove} onPointerUp={onPointerUp}
    onPointerCancel={() => { pointer.current = null; clearHold(); moveTrack(0, false); setSlide(null); setPaused(false); }}
    style={{ position: 'fixed', inset: 0, zIndex: 2100, background: '#120f17',
      color: '#fff', overflow: 'hidden', touchAction: 'none', userSelect: 'none' }}>
    <div style={{ display: 'flex', gap: 3, padding: 'max(12px, env(safe-area-inset-top)) 10px 8px' }}>
      {author.stories.map((item, i) => <div key={item.id} style={{ flex: 1, height: 3, background: '#5c5362' }}>
        <div style={{ height: '100%', background: '#fff', width:
          `${i < position.story ? 100 : i === position.story ? progress * 100 : 0}%` }} />
      </div>)}
    </div>
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12 }}>
      <button onClick={() => { setPaused(true); onOpenProfile?.(author.id); }}>{author.name}</button>
      <button onClick={onClose}>Закрыть</button>
    </header>
    <div ref={moving} className="bliki-viewer-track" style={{ position: 'relative', width: '100%', height: 'calc(100% - 145px)',
      willChange: 'transform', transform: 'translate3d(0,0,0)' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        {story.mediaKind === 'image'
          ? <img src={story.mediaUrl} alt={story.caption || 'Блик'} draggable={false}
              style={{ width: '100%', height: '100%', objectFit: story.editor?.fit ?? 'contain',
                transform: story.editor ? `translate3d(${story.editor.translateX}px,${story.editor.translateY}px,0) scale(${story.editor.scale})` : undefined }} />
          : <video ref={video} key={story.id} src={story.mediaUrl} playsInline muted={story.editor?.muted}
              onTimeUpdate={event => { const el = event.currentTarget;
                if (el.duration > 0) setProgress(el.currentTime / el.duration); }}
              onEnded={advance} style={{ width: '100%', height: '100%', objectFit: story.editor?.fit ?? 'contain' }} />}
        <StoryLayers story={story} />
      </div>
      {otherStory && slide && <div style={{ position: 'absolute', top: 0, bottom: 0,
        left: slide.direction === 1 ? width : -width, width }}>
        {otherStory.mediaKind === 'image'
          ? <img src={otherStory.mediaUrl} alt={otherStory.caption || 'Следующий Блик'}
              draggable={false} style={{ width: '100%', height: '100%', objectFit: otherStory.editor?.fit ?? 'contain',
                transform: otherStory.editor ? `translate3d(${otherStory.editor.translateX}px,${otherStory.editor.translateY}px,0) scale(${otherStory.editor.scale})` : undefined }} />
          : <video src={otherStory.mediaUrl} playsInline preload="metadata"
              style={{ width: '100%', height: '100%', objectFit: otherStory.editor?.fit ?? 'contain' }} />}
        <StoryLayers story={otherStory} />
      </div>}
    </div>
    <footer style={{ padding: 12, textAlign: 'center' }}>
      <div>{story.caption || ''}</div>
      {onReact && author.id !== viewerId &&
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 8 }}>
          <button type="button" disabled={socialBusy} aria-label="Реакция: нравится"
            onClick={() => { void interact('react', 'heart'); }}>💜</button>
          <button type="button" disabled={socialBusy} aria-label="Реакция: огонь"
            onClick={() => { void interact('react', 'fire'); }}>🔥</button>
          <button type="button" disabled={socialBusy} aria-label="Реакция: улыбка"
            onClick={() => { void interact('react', 'smile'); }}>🥰</button>
        </div>}
      {onReport && author.id !== viewerId && <button type="button" disabled={socialBusy}
        onClick={() => setReportOpen(value => !value)}>Пожаловаться</button>}
      {author.id===viewerId&&onDelete&&<button type="button" disabled={socialBusy}
        onClick={()=>{void deleteOwnStory();}}>Удалить Блик</button>}
      {onReply&&author.id!==viewerId&&<div style={{display:'flex',gap:8,marginTop:8}}>
        <input value={replyText} maxLength={1000} aria-label="Ответ на Блик"
          placeholder="Ответить на Блик…" onChange={event=>setReplyText(event.target.value)}
          style={{flex:1,minWidth:0}}/>
        <button type="button" disabled={socialBusy||!replyText.trim()} onClick={()=>{void replyToStory();}}>Отправить</button>
      </div>}
      {reportOpen && <div role="group" aria-label="Причина жалобы" style={{
        display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 6
      }}>
        {([['spam','Спам'],['harassment','Оскорбления'],['nudity','Неприемлемое содержимое'],
          ['other','Другое']] as const).map(([key,label]) =>
          <button key={key} disabled={socialBusy} onClick={() => { void interact('report', key); }}>
            {label}
          </button>)}
      </div>}
      {feedback && <p role="status" style={{ margin: 4, fontSize: 12 }}>{feedback}</p>}
    </footer>
  </div>;
}
