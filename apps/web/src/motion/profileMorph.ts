/** Profile geometry used by browsers that do not support CSS scroll timelines. */
export const PROFILE_AVATAR_SIZE = 56;
export const PROFILE_SNAP_THRESHOLD = 0.3;

export function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function morphTravel(containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 220;
  return Math.min(325, Math.max(220, containerWidth * 0.78));
}

export function morphFrame(scrollTop: number, travel: number) {
  const progress = clamp01(scrollTop / (travel > 0 ? travel : 220));
  // Compositing only: opacity and transform. No radius, blur or box-shadow changes.
  return {
    progress,
    heroScale: 1 - progress * 0.84,
    heroOpacity: clamp01((0.78 - progress) / 0.28),
    avatarOpacity: clamp01((progress - 0.55) / 0.28),
    captionOpacity: clamp01((0.38 - progress) / 0.3),
    compactOpacity: clamp01((progress - 0.55) / 0.28),
    barsOpacity: clamp01((0.3 - progress) / 0.25),
  };
}
