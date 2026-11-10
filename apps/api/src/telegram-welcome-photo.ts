/**
 * The banner SVG includes the original approved raster wordmark unchanged,
 * centered inside a true Soft Plum glass composition. The public converter
 * returns a Telegram-compatible JPEG. No personal data is sent to the image service.
 * The SVG is self-hosted and can be pre-rendered locally into JPEG later.
 */
export function welcomePhotoUrl(origin: string): string {
  const artwork = new URL("/assets/telegram/luemi-welcome-banner.svg", origin);
  const image = new URL("https://wsrv.nl/");
  image.searchParams.set("url", artwork.toString());
  image.searchParams.set("w", "1200");
  image.searchParams.set("h", "700");
  image.searchParams.set("fit", "cover");
  image.searchParams.set("output", "jpg");
  image.searchParams.set("q", "90");
  return image.toString();
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
