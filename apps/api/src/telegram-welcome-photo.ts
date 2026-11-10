/**
 * The /start photo is a locally served JPEG, pre-rendered from the branded
 * source SVG with the approved original LUEMI wordmark intact.
 * Runtime delivery never depends on an external image-conversion service.
 */
export function welcomePhotoUrl(origin: string): string {
  // Static, first-party JPEG. No third-party image proxy or user data.
  return new URL("/assets/telegram/luemi-welcome-banner.jpg", origin).toString();
}

export interface WelcomePhotoMessage {
  chat_id: number;
  photo: string;
  caption: string;
  parse_mode: "HTML";
  reply_markup: { inline_keyboard: Array<Array<{ text: string; web_app: { url: string } }>> };
}
export type WelcomePhotoSender = (token: string, payload: WelcomePhotoMessage) => Promise<boolean>;

/** Explicit Bot API call lets us fall back to text if Telegram rejects the photo. */
export async function sendTelegramWelcomePhoto(
  token: string,
  payload: WelcomePhotoMessage,
  fetcher: typeof fetch = fetch
): Promise<boolean> {
  if (!token) return false;
  try {
    // Do not log the URL: it contains the Telegram bot token.
    const response = await fetcher(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6500)
    });
    if (!response.ok) return false;
    const ack = await response.json() as { ok?: boolean };
    return ack.ok === true;
  } catch {
    return false;
  }
}
