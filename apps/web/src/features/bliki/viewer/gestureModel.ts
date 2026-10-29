/** Pure gesture arbitration: pointer movement never changes Discovery gestures. */
export type BlikGesture = { dx: number; dy: number; durationMs: number; held: boolean };
export type BlikGestureAction =
  | { type: 'tap'; side: 'left' | 'right' }
  | { type: 'author'; direction: -1 | 1 }
  | { type: 'dismiss' }
  | { type: 'none' };

export function resolveBlikGesture(gesture: BlikGesture, startX: number, viewportWidth: number): BlikGestureAction {
  const { dx, dy, durationMs, held } = gesture;
  if (held) return { type: 'none' };
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absY > absX * 1.15 && dy > 90) return { type: 'dismiss' };
  if (absX > absY * 1.15 && (absX >= 55 || (absX > 12 && absX / Math.max(1, durationMs) > 0.45))) {
    return { type: 'author', direction: dx < 0 ? 1 : -1 };
  }
  if (absX > 12 || absY > 12) return { type: 'none' };
  return { type: 'tap', side: startX >= viewportWidth / 2 ? 'right' : 'left' };
}
