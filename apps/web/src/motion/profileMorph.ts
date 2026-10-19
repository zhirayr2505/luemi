/** Pure fallback mapping: one photo stays visible for the whole journey. */
export const PROFILE_AVATAR_SIZE = 56;
export const clamp01 = (n: number): number =>
  Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
export function morphTravel(width: number) {
  return Number.isFinite(width) && width > 0 ? Math.min(325, Math.max(220, width * 0.78)) : 220;
}
export function morphFrame(scrollTop: number, travel: number, finalScale = 0.16) {
  const progress = clamp01(scrollTop / (travel > 0 ? travel : 220));
  return {
    progress,
    heroScale: 1 - (1 - clamp01(finalScale)) * progress,
    compactOpacity: clamp01((progress - 0.54) / 0.35),
    circleRimOpacity: clamp01((progress - 0.75) / 0.25),
    captionOpacity: clamp01((0.38 - progress) / 0.3),
    barsOpacity: clamp01((0.3 - progress) / 0.25),
  };
}
