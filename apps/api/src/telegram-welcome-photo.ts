/**
 * The welcome photo uses the approved LUEMI raster wordmark untouched.
 * wsrv.nl converts the public WebP into a Telegram-compatible JPEG and adds
 * a solid Soft Plum background. No user IDs or bot credentials are forwarded.
 * Replace this with a self-hosted JPEG when a pre-rendered brand asset is ready.
 */
export function welcomePhotoUrl(origin: string): string {
  const logo = new URL("/assets/brand/wordmark_original_raster_alpha_W06.webp", origin);
  const image = new URL("https://wsrv.nl/");
  image.searchParams.set("url", logo.toString());
  image.searchParams.set("w", "1000");
  image.searchParams.set("h", "540");
  image.searchParams.set("fit", "contain");
  image.searchParams.set("cbg", "211725");
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
