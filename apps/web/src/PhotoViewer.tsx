import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import type { Profile } from '../../../packages/core/domain';
import { Icon, Portrait } from './ui';

type PhotoAction = 'report' | 'block' | 'share';
type Props = {
  profile: Profile;
  initialIndex: number;
  reducedMotion: boolean;
  notify: (message: string) => void;
  onClose: () => void;
  onPhotoAction?: (action: PhotoAction) => void;
};
type Point = { x: number; y: number };
type ImageMetrics = { width: number; height: number; photoWidth: number; photoHeight: number };
type Gesture = {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startAt: number;
  startScale: number;
  startTranslateX: number;
  startTranslateY: number;
  swipeDown: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function PhotoViewer({
  profile,
  initialIndex,
  reducedMotion,
  notify,
  onClose,
  onPhotoAction,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const stageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const metrics = useRef<ImageMetrics[]>([]);
  const points = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const zoom = useRef({ scale: 1, x: 0, y: 0 });
  const pinch = useRef({ distance: 0, scale: 1, x: 0, y: 0 });
  const lastTap = useRef({ time: 0, x: 0, y: 0 });
  const returnFocus = useRef<HTMLElement | null>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const menuFirst = useRef<HTMLButtonElement>(null);
  const [index, setIndex] = useState(initialIndex);
  const [menuOpen, setMenuOpen] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'returning' | 'leaving'>('idle');
  const photos = profile.photos;
  const own = profile.id === 'self';

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    const viewport = strip.current;
    if (viewport) viewport.scrollLeft = initialIndex * viewport.clientWidth;
    return () => {
      if (element.open) element.close();
      returnFocus.current?.focus({ preventScroll: true });
    };
  }, [initialIndex]);

  useEffect(() => {
    const root = strip.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.6)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setIndex(Number((visible.target as HTMLElement).dataset.index));
      },
      { root, threshold: [0.6, 0.85] },
    );
    root.querySelectorAll<HTMLElement>('.pv-slide').forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [photos.length]);

  useEffect(() => {
    if (menuOpen) menuFirst.current?.focus();
  }, [menuOpen]);

  const measure = (at: number) => {
    const stage = stageRefs.current[at];
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    const image = stage.querySelector('img');
    const width = image?.naturalWidth || bounds.width;
    const height = image?.naturalHeight || bounds.height;
    const fit = Math.min(bounds.width / width, bounds.height / height);
    metrics.current[at] = {
      width: bounds.width,
      height: bounds.height,
      photoWidth: width * fit,
      photoHeight: height * fit,
    };
  };

  useEffect(() => {
    const observer = new ResizeObserver(() => photos.forEach((_, at) => measure(at)));
    for (const stage of stageRefs.current) if (stage) observer.observe(stage);
    photos.forEach((_, at) => measure(at));
    return () => observer.disconnect();
  }, [photos]);

  const constrain = (at: number, scale: number, x: number, y: number) => {
    const bounds = metrics.current[at];
    if (!bounds) return { x, y };
    const maxX = Math.max(0, (bounds.photoWidth * scale - bounds.width) / 2);
    const maxY = Math.max(0, (bounds.photoHeight * scale - bounds.height) / 2);
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  };

  const paint = (at: number, scale: number, x: number, y: number) => {
    const stage = stageRefs.current[at];
    if (!stage) return;
    const bounded = constrain(at, scale, x, y);
    stage.style.transform = `translate3d(${bounded.x}px, ${bounded.y}px, 0) scale(${scale})`;
    zoom.current = { scale, ...bounded };
    dialog.current?.classList.toggle('is-zoomed', scale > 1.001);
  };

  const animateReset = (at: number, transition: 'returning' | 'leaving') => {
    // A CSS media preference can turn off transitions even when the in-app toggle is off.
    // In that case transitionend will never fire, so finish synchronously.
    const noTransition =
      reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPhase(noTransition ? 'idle' : transition);
    const stage = stageRefs.current[at];
    if (transition === 'leaving') {
      if (noTransition) onClose();
      else if (stage) stage.style.transform = 'translate3d(0, 160px, 0) scale(1)';
      return;
    }
    if (noTransition) {
      if (stage) stage.style.transform = 'translate3d(0, 0, 0) scale(1)';
      zoom.current = { scale: 1, x: 0, y: 0 };
      dialog.current?.classList.remove('is-zoomed');
    } else {
      if (stage) stage.style.transform = 'translate3d(0, 0, 0) scale(1)';
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>, at: number) => {
    if (event.button !== 0) return;
    const current = zoom.current;
    points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    gesture.current = {
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      startAt: performance.now(),
      startScale: current.scale,
      startTranslateX: current.x,
      startTranslateY: current.y,
      swipeDown: false,
    };
    if (points.current.size >= 2) {
      const [first, second] = [...points.current.values()];
      const rect = event.currentTarget.getBoundingClientRect();
      pinch.current = {
        distance: Math.hypot(second.x - first.x, second.y - first.y),
        scale: zoom.current.scale,
        x: first.x / 2 + second.x / 2 - rect.left - rect.width / 2,
        y: first.y / 2 + second.y / 2 - rect.top - rect.height / 2,
      };
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // The browser may have ended a pointer before capture was requested.
      }
    } else if (current.scale > 1) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // The browser may have ended a pointer before capture was requested.
      }
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>, at: number) => {
    if (!points.current.has(event.pointerId)) return;
    points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const activeGesture = gesture.current;
    if (points.current.size >= 2) {
      const [first, second] = [...points.current.values()];
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const currentPinch = pinch.current;
      const scale = clamp(
        currentPinch.scale * (distance / Math.max(1, currentPinch.distance)),
        1,
        4,
      );
      const focalX = currentPinch.x,
        focalY = currentPinch.y;
      const x = focalX - (focalX - zoom.current.x) * (scale / Math.max(1, zoom.current.scale));
      const y = focalY - (focalY - zoom.current.y) * (scale / Math.max(1, zoom.current.scale));
      paint(at, scale, x, y);
      return;
    }
    if (!activeGesture || !points.current.has(event.pointerId)) return;
    const dx = event.clientX - activeGesture.lastX;
    const dy = event.clientY - activeGesture.lastY;
    activeGesture.lastX = event.clientX;
    activeGesture.lastY = event.clientY;
    if (zoom.current.scale > 1) {
      paint(at, zoom.current.scale, zoom.current.x + dx, zoom.current.y + dy);
      return;
    }
    if (!activeGesture.swipeDown && Math.abs(event.clientY - activeGesture.startY) > 8) {
      activeGesture.swipeDown =
        event.clientY > activeGesture.startY &&
        Math.abs(event.clientY - activeGesture.startY) >
          Math.abs(event.clientX - activeGesture.startX);
    }
    if (activeGesture.swipeDown) {
      const travel = Math.max(0, event.clientY - activeGesture.startY);
      const stage = stageRefs.current[at];
      if (stage) stage.style.transform = `translate3d(0, ${travel}px, 0) scale(1)`;
      const backdrop = dialog.current?.querySelector<HTMLElement>('.pv-backdrop');
      if (backdrop) backdrop.style.opacity = String(Math.max(0, 1 - Math.abs(travel) / 400));
    }
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>, at: number, cancelled = false) => {
    const before = points.current.get(event.pointerId);
    points.current.delete(event.pointerId);
    if (points.current.size >= 2) {
      const [first, second] = [...points.current.values()];
      pinch.current.distance = Math.hypot(second.x - first.x, second.y - first.y);
      pinch.current.scale = zoom.current.scale;
      return;
    }
    if (points.current.size === 1) {
      gesture.current = null;
      return;
    }
    const activeGesture = gesture.current;
    gesture.current = null;
    if (!activeGesture) return;
    if (activeGesture.swipeDown && !cancelled) {
      const dy = event.clientY - activeGesture.startY;
      const elapsed = Math.max(1, performance.now() - activeGesture.startAt);
      const speed = dy / elapsed;
      if (dy > 120 || speed > 0.6) {
        animateReset(at, 'leaving');
      } else {
        animateReset(at, 'returning');
      }
      return;
    }
    if (zoom.current.scale < 1) animateReset(at, 'returning');
    if (cancelled || !before) return;
    const elapsed = performance.now() - activeGesture.startAt;
    const distance = Math.hypot(
      event.clientX - activeGesture.startX,
      event.clientY - activeGesture.startY,
    );
    const tapped = distance < 12 && elapsed < 300;
    const prior = lastTap.current;
    if (
      tapped &&
      performance.now() - prior.time < 300 &&
      Math.hypot(event.clientX - prior.x, event.clientY - prior.y) < 28
    ) {
      const nextScale = zoom.current.scale > 1 ? 1 : 2.5;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      paint(
        at,
        nextScale,
        nextScale === 1 ? 0 : x - (x - zoom.current.x) * nextScale,
        nextScale === 1 ? 0 : y - (y - zoom.current.y) * nextScale,
      );
      lastTap.current = { time: 0, x: 0, y: 0 };
    } else if (tapped) {
      lastTap.current = { time: performance.now(), x: event.clientX, y: event.clientY };
    }
  };

  const closeMenuOrViewer = () => {
    if (menuOpen) {
      setMenuOpen(false);
      moreButton.current?.focus();
    } else onClose();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      notify('Ссылка скопирована');
    } catch {
      notify('Не удалось скопировать ссылку');
    }
    setMenuOpen(false);
  };

  const share = async () => {
    setMenuOpen(false);
    if (navigator.share) {
      try {
        await navigator.share({ url: location.href });
      } catch {
        // A dismissed native share sheet is not an application error.
      }
    } else await copyLink();
  };

  const action = (name: 'report' | 'block') => {
    setMenuOpen(false);
    onClose();
    onPhotoAction?.(name);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeMenuOrViewer();
      return;
    }
    if (menuOpen) return;
    let next = index;
    if (event.key === 'ArrowRight') next = Math.min(photos.length - 1, index + 1);
    else if (event.key === 'ArrowLeft') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = photos.length - 1;
    else return;
    event.preventDefault();
    const viewport = strip.current;
    if (viewport) viewport.scrollLeft = next * viewport.clientWidth;
  };

  return (
    <dialog
      ref={dialog}
      className={`photo-viewer${phase === 'idle' ? '' : ` is-${phase}`}`}
      aria-label="Просмотр фотографий"
      onCancel={(event) => {
        event.preventDefault();
        closeMenuOrViewer();
      }}
      onKeyDown={onKeyDown}
      onClick={(event) => {
        if (event.target === dialog.current && menuOpen) setMenuOpen(false);
      }}
    >
      <div className="pv-backdrop" aria-hidden="true" />
      <header className="pv-header">
        <button type="button" className="pv-control" aria-label="Закрыть" onClick={onClose}>
          <Icon name="close" size={22} />
        </button>
        <span className="pv-counter" aria-live="polite">
          {index + 1} / {photos.length}
        </span>
        <button
          ref={moreButton}
          type="button"
          className="pv-control"
          aria-label="Действия с фото"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Icon name="more" size={22} />
        </button>
      </header>
      <div className="pv-strip" ref={strip} aria-label="Галерея фотографий">
        {photos.map((photo, at) => (
          <div className="pv-slide" key={photo.id} data-index={at}>
            <div
              ref={(node) => {
                stageRefs.current[at] = node;
              }}
              className="pv-photo-stage"
              onPointerDown={(event) => onPointerDown(event, at)}
              onPointerMove={(event) => onPointerMove(event, at)}
              onPointerUp={(event) => onPointerEnd(event, at)}
              onPointerCancel={(event) => onPointerEnd(event, at, true)}
              onLoadCapture={() => measure(at)}
              onTransitionEnd={(event) => {
                if (event.target !== event.currentTarget || event.propertyName !== 'transform')
                  return;
                if (phase === 'leaving') onClose();
                if (phase === 'returning') {
                  setPhase('idle');
                  const backdrop = dialog.current?.querySelector<HTMLElement>('.pv-backdrop');
                  if (backdrop) backdrop.style.opacity = '';
                  zoom.current = { scale: 1, x: 0, y: 0 };
                  dialog.current?.classList.remove('is-zoomed');
                }
              }}
            >
              <Portrait photo={photo} alt={`Фото ${at + 1} из ${photos.length}`} />
            </div>
            <span className="sr-only">
              Фото {at + 1} из {photos.length}
            </span>
          </div>
        ))}
      </div>
      {menuOpen && (
        <div className="pv-menu-layer" onClick={() => setMenuOpen(false)}>
          <div
            className="pv-menu-sheet"
            role="menu"
            aria-label="Действия с фото"
            onClick={(event) => event.stopPropagation()}
          >
            <button ref={menuFirst} type="button" role="menuitem" onClick={share}>
              Поделиться
            </button>
            <button type="button" role="menuitem" onClick={copyLink}>
              Скопировать ссылку
            </button>
            {!own && (
              <>
                <button type="button" role="menuitem" onClick={() => action('report')}>
                  Пожаловаться на фото
                </button>
                <button
                  className="pv-danger"
                  type="button"
                  role="menuitem"
                  onClick={() => action('block')}
                >
                  Заблокировать
                </button>
              </>
            )}
            <p>В демоверсии жалобы сохраняются только на устройстве.</p>
          </div>
        </div>
      )}
    </dialog>
  );
}
