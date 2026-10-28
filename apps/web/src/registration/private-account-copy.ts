/**
 * Owner-side display safety for a private account preview.
 * Does not alter or delete the user's original draft; editing retains it.
 * When a Telegram bot-token-like credential is pasted into "О себе", show
 * a redacted preview and instruct the owner to remove/revoke it.
 */
const telegramCredential=/\b\d{7,12}:[A-Za-z0-9_-]{28,}\b/g;
export function safeOwnerAbout(value:string):{text:string;containsCredential:boolean}{
 const containsCredential=/\b\d{7,12}:[A-Za-z0-9_-]{28,}\b/.test(value);
 return{
  text:value.replace(telegramCredential,"[скрытый ключ]"),
  containsCredential
 };
}
