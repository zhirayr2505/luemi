/**
 * Owner-side display safety for a private account preview.
 * Does not alter or delete the user's original draft; editing retains it.
 * When a Telegram bot-token-like credential is pasted into "О себе", show
 * a redacted preview and instruct the owner to remove/revoke it.
 */
export function safeOwnerAbout(value:string):{text:string;containsCredential:boolean}{
 const containsCredential=/\b\d{7,12}:[A-Za-z0-9_-]{28,}(?![A-Za-z0-9_-])/.test(value);
 return{
  text:containsCredential?"Описание скрыто: обнаружена строка, похожая на секретный ключ.":value,
  containsCredential
 };
}
