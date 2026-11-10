import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

/**
 * The exact self-contained HTML sent via Bot API 10.4.
 * No auth data, Telegram ID or bot token is embedded in the widget.
 * Both src (tests) and dist (production) resolve the same public file.
 */
let cachedHtml: string | null | undefined;
export function welcomeWidgetHtml(): string | null {
  if (cachedHtml !== undefined) return cachedHtml;
  try {
    const html = readFileSync(new URL("../../web/public/widgets/luemi-welcome.html", import.meta.url), "utf8");
    const raw = Buffer.from(html, "utf8");
    if (!raw.length || raw.byteLength > 32768 ||
        deflateSync(raw, { level: 9 }).byteLength > 4096 || html.includes("\0")) {
      cachedHtml = null;
    } else {
      cachedHtml = html;
    }
  } catch {
    cachedHtml = null;
  }
  return cachedHtml;
}

export interface WelcomeWidgetMessage {
  chat_id: number;
  html: string;
  height: number;
  chat_data: string;
  allow_queries: false;
  is_shared: false;
}
export type WelcomeWidgetSender = (token: string, payload: WelcomeWidgetMessage) => Promise<boolean>;

/** Explicit API call allows a native text fallback when a widget is rejected. */
export async function sendTelegramWelcomeWidget(
  token: string,
  payload: WelcomeWidgetMessage,
  fetcher: typeof fetch = fetch
): Promise<boolean> {
  if (!token) return false;
  try {
    // Never log Bot API URLs: they contain the secret token.
    const endpoint = "https://api.telegram.org/bot" + token + "/sendWidget";
    const response = await fetcher(endpoint, {
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
