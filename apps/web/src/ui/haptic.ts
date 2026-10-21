/** Best-effort optional Telegram bridge. Never leak bridge payloads or
 * permit a missing/throwing haptic implementation to interrupt UI transactions. */
export function selectionHaptic():void {
 try { window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); }
 catch { /* Optional physical feedback must not control application state. */ }
}
