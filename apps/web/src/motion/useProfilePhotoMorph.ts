import { useLayoutEffect, type RefObject } from 'react';
import { morphFrame } from './profileMorph';

/**
 * One scroll container and one RAF are the only animation drivers.
 * A single physical image morphs from large portrait to circular avatar.
 * No React render during scrolling, no second transition or setTimeout.
 */
export function useProfilePhotoMorph(
  stageRef: RefObject<HTMLDivElement | null>,
  photoRef: RefObject<HTMLDivElement | null>,
  compactRef: RefObject<HTMLDivElement | null>,
  captionRef: RefObject<HTMLDivElement | null>,
  profileId: string,
  reducedMotion: boolean,
) {
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const photo = photoRef.current;
    const compact = compactRef.current;
    const caption = captionRef.current;
    const scroller = stage?.closest<HTMLElement>('.profile-detail');
    if (!stage || !photo || !compact || !caption || !scroller) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const img = photo.querySelector('img');
    let raf = 0;
    let width = 0;
    let disposed = false;
    let collapsed = false;

    // When a different person opens, start at the beginning of THEIR profile.
    scroller.scrollTop = 0;
    const draw = () => {
      raf = 0;
      if (disposed || !width) return;
      const raw = morphFrame(scroller.scrollTop, width);
      const f = reducedMotion || media.matches
        ? morphFrame(raw.progress >= .5 ? Number.MAX_SAFE_INTEGER : 0, width)
        : raw;
      // Transform is compositor-driven; radius repaints but NEVER reflows content.
      photo.style.transform = `translate3d(${f.x.toFixed(2)}px,${f.y.toFixed(2)}px,0) scale(${f.scale.toFixed(6)})`;
      photo.style.borderRadius = `${f.radius.toFixed(2)}px`;
      caption.style.opacity = String(f.heroOpacity);
      compact.style.opacity = String(f.compactOpacity);
      // Small LUEMI-style liquid highlight, synced to the existing scroll RAF.
      compact.style.setProperty('--glass-light-x', `${(24 + f.eased * 42).toFixed(1)}%`);
      compact.style.setProperty('--glass-light-y', `${(12 + f.eased * 15).toFixed(1)}%`);
      if (img) img.style.transform = `scale(${f.zoom.toFixed(4)})`;
      const nowCollapsed = f.progress >= .995;
      if (nowCollapsed !== collapsed) {
        stage.dataset.collapsed = String(nowCollapsed);
        collapsed = nowCollapsed;
      }
    };
    const frame = () => {
      if (!disposed && !raf) raf = requestAnimationFrame(draw);
    };
    const resize = () => {
      width = stage.clientWidth;
      frame();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    observer.observe(scroller);
    scroller.addEventListener('scroll', frame, { passive: true });
    media.addEventListener('change', frame);
    resize();
    return () => {
      disposed = true;
      scroller.removeEventListener('scroll', frame);
      media.removeEventListener('change', frame);
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
      photo.style.transform = '';
      photo.style.borderRadius = '';
      caption.style.opacity = '';
      compact.style.opacity = '';
      compact.style.removeProperty('--glass-light-x');
      compact.style.removeProperty('--glass-light-y');
      if (img) img.style.transform = '';
      delete stage.dataset.collapsed;
    };
  }, [stageRef, photoRef, compactRef, captionRef, profileId, reducedMotion]);
}