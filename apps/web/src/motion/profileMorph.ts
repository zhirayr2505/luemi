/**
 * LUEMI: scroll-bound, deterministic motion for exactly one photograph.
 * Progress depends on scroll offset, never on elapsed time.
 */
export const PROFILE_AVATAR_SIZE = 56;
export const PROFILE_HERO_RADIUS = 27;
export function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}
export function morphProgress(scrollY: number, stageWidth: number): number {
  if (!Number.isFinite(stageWidth) || stageWidth <= 0) return 0;
  const travel = Math.min(325, Math.max(220, stageWidth * .78));
  return clamp01(scrollY / travel);
}
export function morphFrame(scrollY: number, stageWidth: number) {
  const width = Number.isFinite(stageWidth) && stageWidth > 0 ? stageWidth : PROFILE_AVATAR_SIZE;
  const progress = morphProgress(scrollY, stageWidth);
  const eased = progress * progress * (3 - 2 * progress);
  return {
    progress,
    eased,
    scale: 1 + (PROFILE_AVATAR_SIZE / Math.max(PROFILE_AVATAR_SIZE, width) - 1) * eased,
    x: 7 * eased,
    y: 7 * eased,
    radius: PROFILE_HERO_RADIUS + (width / 2 - PROFILE_HERO_RADIUS) * eased,
    heroOpacity: clamp01(1 - eased * 3.2),
    compactOpacity: clamp01((eased - .66) / .25),
    zoom: 1 + eased * .35,
  };
}