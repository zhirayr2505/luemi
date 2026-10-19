import { useLayoutEffect, type RefObject } from 'react';
import { morphFrame } from './profileMorph';

/** A single persistent photo. CSS owns scroll-linked motion on supported browsers.
 * Legacy fallback owns only transform and opacity, never scrollTop or custom scroll settling.
 */
export function useProfilePhotoMorph(
  scrollerRef: RefObject<HTMLElement | null>,
  frameRef: RefObject<HTMLDivElement | null>,
  photoRef: RefObject<HTMLDivElement | null>,
  compactRef: RefObject<HTMLDivElement | null>,
  captionRef: RefObject<HTMLDivElement | null>,
  barsRef: RefObject<HTMLDivElement | null>,
  profileId: string,
  reducedMotion: boolean,
) {
  useLayoutEffect(() => {
    const scroller = scrollerRef.current,
      frame = frameRef.current;
    const photo = photoRef.current,
      compact = compactRef.current;
    const caption = captionRef.current,
      bars = barsRef.current;
    if (!scroller || !frame || !photo || !compact || !caption || !bars) return;
    const system = matchMedia('(prefers-reduced-motion: reduce)');
    const cssTimeline =
      typeof CSS !== 'undefined' && CSS.supports('animation-timeline: --luemi-profile-scroll');
    let disposed = false,
      raf = 0,
      travel = 220,
      finalScale = 0.16,
      rounded = false;
    scroller.scrollTop = 0; // only initial reset; never written during gestures.

    const drawFallback = () => {
      raf = 0;
      if (disposed || cssTimeline) return;
      const raw = morphFrame(scroller.scrollTop, travel, finalScale);
      const f =
        reducedMotion || system.matches
          ? morphFrame(raw.progress >= 0.5 ? travel : 0, travel, finalScale)
          : raw;
      photo.style.transform = `scale(${f.heroScale})`;
      compact.style.opacity = String(f.compactOpacity);
      caption.style.opacity = String(f.captionOpacity);
      bars.style.opacity = String(f.barsOpacity);
      // The legacy rounded-corner fallback switches the clipping once, only at the endpoint.
      const nextRounded = f.progress >= 0.9;
      if (nextRounded !== rounded) {
        rounded = nextRounded;
        frame.classList.toggle('profile-shape-collapsed', rounded);
      }
    };
    const queue = () => {
      if (!disposed && !cssTimeline && !raf) raf = requestAnimationFrame(drawFallback);
    };
    const resize = () => {
      const width = frame.clientWidth;
      if (width <= 0) return;
      finalScale = 56 / width;
      frame.style.setProperty('--profile-final-scale', String(finalScale));
      const close = scroller.querySelector<HTMLElement>('.profile-snap-closed');
      const open = scroller.querySelector<HTMLElement>('.profile-snap-open');
      if (close) travel = Math.max(1, close.offsetTop - (open?.offsetTop ?? 0));
      queue();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(frame);
    const openMarker = scroller.querySelector('.profile-snap-open');
    let galleryObserver: IntersectionObserver | undefined;
    if (openMarker) {
      galleryObserver = new IntersectionObserver(
        (entries) => {
          if (!disposed)
            frame.classList.toggle('profile-gallery-closed', !entries[0].isIntersecting);
        },
        { root: scroller, threshold: 0 },
      );
      galleryObserver.observe(openMarker);
    }
    if (!cssTimeline) scroller.addEventListener('scroll', queue, { passive: true });
    system.addEventListener('change', queue);
    resize();
    return () => {
      disposed = true;
      observer.disconnect();
      galleryObserver?.disconnect();
      scroller.removeEventListener('scroll', queue);
      system.removeEventListener('change', queue);
      if (raf) cancelAnimationFrame(raf);
      frame.style.removeProperty('--profile-final-scale');
      frame.classList.remove('profile-gallery-closed', 'profile-shape-collapsed');
      photo.style.transform = '';
      compact.style.opacity = '';
      caption.style.opacity = '';
      bars.style.opacity = '';
    };
  }, [scrollerRef, frameRef, photoRef, compactRef, captionRef, barsRef, profileId, reducedMotion]);
}
