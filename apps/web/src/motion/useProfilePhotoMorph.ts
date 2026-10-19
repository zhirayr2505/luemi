import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { morphFrame } from './profileMorph';

/**
 * CSS scroll-timeline is the sole motion owner in supported browsers.
 * On older browsers one RAF paints transform and opacity only; never scrollTop.
 * Snapping belongs exclusively to the browser's native CSS scroll-snap engine.
 */
export function useProfilePhotoMorph(
  scrollerRef: RefObject<HTMLElement | null>,
  frameRef: RefObject<HTMLDivElement | null>,
  photoRef: RefObject<HTMLDivElement | null>,
  avatarRef: RefObject<HTMLDivElement | null>,
  compactRef: RefObject<HTMLDivElement | null>,
  captionRef: RefObject<HTMLDivElement | null>,
  barsRef: RefObject<HTMLDivElement | null>,
  profileId: string,
  reducedMotion: boolean,
) {
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const frame = frameRef.current;
    const photo = photoRef.current;
    const avatar = avatarRef.current;
    const compact = compactRef.current;
    const caption = captionRef.current;
    const bars = barsRef.current;
    if (!scroller || !frame || !photo || !avatar || !compact || !caption || !bars) return;

    let disposed = false;
    let raf = 0;
    let travel = 220;
    const cssTimeline = CSS.supports('animation-timeline: --luemi-profile-scroll');
    const system = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Reset a newly opened profile before exposing it; never animate scrollTop.
    scroller.scrollTop = 0;
    const updateGeometry = () => {
      // Layout is sampled ONLY in ResizeObserver, never during scrolling/RAF.
      const marker = scroller.querySelector<HTMLElement>('.profile-snap-closed');
      if (!marker) return;
      const start = scroller.querySelector<HTMLElement>('.profile-snap-open');
      travel = Math.max(1, marker.offsetTop - (start?.offsetTop ?? 0));
      queue();
    };
    const drawFallback = () => {
      raf = 0;
      if (disposed || cssTimeline) return;
      const f = morphFrame(scroller.scrollTop, travel);
      const reduced = reducedMotion || system.matches;
      const atEnd = f.progress >= 0.5;
      const progress = reduced ? morphFrame(atEnd ? travel : 0, travel) : f;
      photo.style.transform = `scale(${progress.heroScale})`;
      photo.style.opacity = String(progress.heroOpacity);
      avatar.style.opacity = String(progress.avatarOpacity);
      compact.style.opacity = String(progress.compactOpacity);
      caption.style.opacity = String(progress.captionOpacity);
      bars.style.opacity = String(progress.barsOpacity);
    };
    const queue = () => {
      if (!disposed && !cssTimeline && !raf) raf = requestAnimationFrame(drawFallback);
    };

    const ro = new ResizeObserver(updateGeometry);
    ro.observe(frame);
    const gallerySentinel = scroller.querySelector('.profile-snap-open');
    let galleryObserver: IntersectionObserver | undefined;
    if (gallerySentinel) {
      galleryObserver = new IntersectionObserver(
        (entries) => {
          if (disposed) return;
          frame.classList.toggle('profile-gallery-closed', !entries[0].isIntersecting);
        },
        { root: scroller, threshold: 0 },
      );
      galleryObserver.observe(gallerySentinel);
    }

    // The listener is added only when no native CSS scroll timeline exists.
    if (!cssTimeline) scroller.addEventListener('scroll', queue, { passive: true });
    system.addEventListener('change', queue);
    updateGeometry();
    return () => {
      disposed = true;
      ro.disconnect();
      galleryObserver?.disconnect();
      scroller.removeEventListener('scroll', queue);
      system.removeEventListener('change', queue);
      if (raf) cancelAnimationFrame(raf);
      photo.style.transform = '';
      photo.style.opacity = '';
      avatar.style.opacity = '';
      compact.style.opacity = '';
      caption.style.opacity = '';
      bars.style.opacity = '';
      frame.classList.remove('profile-gallery-closed');
    };
  }, [scrollerRef, frameRef, photoRef, avatarRef, compactRef, captionRef, barsRef, profileId, reducedMotion]);
}