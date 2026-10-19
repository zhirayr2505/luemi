/** Pure fallback mapping: one photo stays visible for the whole journey. */
export const PROFILE_AVATAR_SIZE = 56;
export const clamp01 = (n: number): number => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
export function morphTravel(width: number) {
  return Number.isFinite(width) && width > 0 ? Math.min(325, Math.max(220, width * .78)) : 220;
}
export function morphFrame(scrollTop: number, travel: number, finalScale = .16) {
  const progress = clamp01(scrollTop / (travel > 0 ? travel : 220));
  return {
    progress,
    heroScale: 1 - (1 - clamp01(finalScale)) * progress,
    compactOpacity: clamp01((progress - .54) / .35),
    circleRimOpacity: clamp01((progress - .75) / .25),
    captionOpacity: clamp01((.38 - progress) / .3),
    barsOpacity: clamp01((.3 - progress) / .25),
  };
}
