import { useRef, useState, type PointerEvent, type RefObject } from 'react';
import type { Profile } from '../../../packages/core/domain';
import { Portrait } from './ui';

type GalleryProps = {
  profile: Profile;
  display: string;
  barsRef: RefObject<HTMLDivElement | null>;
  onOpen: (index: number) => void;
};

type Swipe = { id: number; x: number; y: number; time: number; horizontal: boolean };

/** Horizontal gallery gestures never own vertical scrolling or profile morph. */
export function ProfileGallery({ profile, display, barsRef, onOpen }: GalleryProps) {
  const [index, setIndex] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  const selected = useRef(0);
  const swipe = useRef<Swipe>({ id: -1, x: 0, y: 0, time: 0, horizontal: false });
  const total = profile.photos.length;

  const position = (pixels: number, animate: boolean, chosen = selected.current) => {
    const el = strip.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 280ms cubic-bezier(.22,.8,.22,1)' : 'none';
    el.style.transform = `translate3d(calc(${-chosen * 100}% + ${pixels.toFixed(1)}px),0,0)`;
  };
  const choose = (next: number) => {
    const value = Math.max(0, Math.min(total - 1, next));
    selected.current = value;
    setIndex(value);
    position(0, true, value);
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    const frame = event.currentTarget.closest('.profile-morph-frame');
    if (event.button !== 0 || total < 1 || frame?.classList.contains('profile-gallery-closed'))
      return;
    swipe.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
      horizontal: false,
    };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = swipe.current;
    if (gesture.id !== event.pointerId) return;
    if (total < 2) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.horizontal) {
      if (Math.abs(dy) > 11 && Math.abs(dy) > Math.abs(dx)) {
        gesture.id = -1;
        return;
      }
      if (Math.abs(dx) < 9 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
      gesture.horizontal = true;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer may have been released by the browser's native vertical gesture.
      }
    }
    const atEdge = (selected.current === 0 && dx > 0) || (selected.current === total - 1 && dx < 0);
    position(atEdge ? dx * 0.22 : dx, false);
  };
  const finish = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const gesture = swipe.current;
    if (gesture.id !== event.pointerId) return;
    gesture.id = -1;
    if (!gesture.horizontal || cancelled) {
      const frame = event.currentTarget.closest('.profile-morph-frame');
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (
        !cancelled &&
        !gesture.horizontal &&
        Math.abs(dx) < 8 &&
        Math.abs(dy) < 8 &&
        performance.now() - gesture.time < 300 &&
        !frame?.classList.contains('profile-gallery-closed') &&
        total > 0
      ) {
        onOpen(selected.current);
      }
      position(0, true);
      return;
    }
    const dx = event.clientX - gesture.x;
    const elapsed = Math.max(25, performance.now() - gesture.time);
    const width = strip.current?.clientWidth || 360;
    const direction =
      Math.abs(dx) > width * 0.22 || Math.abs(dx / elapsed) > 0.55 ? Math.sign(dx) : 0;
    choose(selected.current - direction);
  };

  return (
    <>
      <div
        className="profile-morph-gallery"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={(event) => finish(event, true)}
      >
        <div className="profile-morph-strip" ref={strip}>
          {total ? (
            profile.photos.map((photo, i) => (
              <div className="profile-morph-slide" key={photo.id}>
                <Portrait photo={photo} alt={`Фото ${i + 1}: ${display}`} />
              </div>
            ))
          ) : (
            <div className="profile-morph-slide">
              <Portrait alt="Нет фото" />
            </div>
          )}
        </div>
      </div>
      <div className="profile-morph-photo-bars" ref={barsRef} aria-label="Фотографии профиля">
        {total > 1 &&
          profile.photos.map((photo, i) => (
            <button
              key={photo.id}
              aria-label={`Фото ${i + 1} из ${total}`}
              aria-current={index === i ? 'true' : undefined}
              className={index === i ? 'active' : ''}
              onClick={() => choose(i)}
            >
              <span />
            </button>
          ))}
      </div>
    </>
  );
}
