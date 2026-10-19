import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimationBatch, SLIDE_DURATION, SLIDE_EASING, slideDirection, slideFrames } from './slide';

const ReducedMotion = createContext(false);

export function MotionProvider({ reduced, children }: { reduced: boolean; children: ReactNode }) {
  const [system, setSystem] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setSystem(mq.matches);
    mq.addEventListener('change', change);
    return () => mq.removeEventListener('change', change);
  }, []);
  return <ReducedMotion.Provider value={reduced || system}>{children}</ReducedMotion.Provider>;
}

type DeckProps = {
  active: string;
  order: readonly string[];
  pages: Record<string, ReactNode>;
  className?: string;
  flow?: boolean;
};

/**
 * One cancellable WAAPI owner for panel transitions. Profiles fade without
 * translating the scroll-timeline/portrait layers; regular tabs can slide.
 */
export function SlideDeck({ active, order, pages, className = '', flow = false }: DeckProps) {
  const reduced = useContext(ReducedMotion);
  const elements = useRef(new Map<string, HTMLDivElement>());
  const last = useRef(active);
  const batch = useRef(new AnimationBatch());
  const visited = useRef(new Set<string>());
  visited.current.add(active);

  useLayoutEffect(() => {
    const previous = last.current;
    const from = elements.current.get(previous);
    const to = elements.current.get(active);
    if (!to) return;
    const viewport = to.parentElement;
    if (!viewport) return;
    const viewportWidth = viewport.getBoundingClientRect().width;
    const fromOffset = from ? from.getBoundingClientRect().left - viewport.getBoundingClientRect().left : 0;
    batch.current.cancel();
    last.current = active;

    for (const [key, node] of elements.current) {
      node.dataset.visible = String(key === active || key === previous);
      node.style.transform = '';
      node.style.willChange = '';
    }
    const settle = () => {
      for (const [key, node] of elements.current) {
        node.dataset.visible = String(key === active);
        node.style.transform = '';
        node.style.willChange = '';
      }
    };
    const focused = document.activeElement;
    if (from && focused instanceof HTMLElement && from.contains(focused)) focused.blur();
    if (reduced || !from || previous === active || !viewportWidth || typeof to.animate !== 'function') {
      settle();
      return;
    }

    // Never transform the profile pane; it is already a scroll animation scope.
    const profileTransition = active === 'profile' || previous === 'profile';
    if (profileTransition) {
      const options: KeyframeAnimationOptions = { duration: 170, easing: 'ease-out', fill: 'both' };
      batch.current.run([
        from.animate([{ opacity: 1 }, { opacity: 0 }], options),
        to.animate([{ opacity: 0 }, { opacity: 1 }], options),
      ], settle);
      return;
    }

    const direction = slideDirection(previous, active, order);
    const frames = slideFrames(direction, viewportWidth, fromOffset);
    const options: KeyframeAnimationOptions = { duration: SLIDE_DURATION, easing: SLIDE_EASING, fill: 'both' };
    from.style.willChange = 'transform';
    to.style.willChange = 'transform';
    batch.current.run([
      from.animate(frames.outgoing, options),
      to.animate(frames.incoming, options),
    ], settle);
    const observer = new ResizeObserver(() => {
      if (viewport.getBoundingClientRect().width !== viewportWidth) {
        batch.current.cancel();
        settle();
      }
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [active, reduced, order]);
  useEffect(() => () => batch.current.cancel(), []);

  return (
    <div className={`slide-deck ${flow ? 'slide-deck--flow' : ''} ${className}`}>
      {[...visited.current].map((key) => (
        <div
          key={key}
          className="slide-pane"
          data-page={key}
          aria-hidden={key !== active}
          inert={key !== active}
          ref={(el) => {
            if (el) elements.current.set(key, el);
            else elements.current.delete(key);
          }}
        >{pages[key]}</div>
      ))}
    </div>
  );
}

/** Maintains the nested tab state without a second transition controller. */
export function SlideSwap({ active, order, children, className = '', flow = true }: {
  active: string;
  order: readonly string[];
  children: ReactNode;
  className?: string;
  flow?: boolean;
}) {
  const cache = useRef<Record<string, ReactNode>>({});
  cache.current[active] = children;
  return <SlideDeck active={active} order={order} pages={cache.current} className={className} flow={flow} />;
}