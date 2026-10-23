import type { ApiConfig } from "./config.js";

const REQUIRED_TEST_BOT = "luemiappbot";
const WEBHOOK_PATH = "/api/telegram/webhook";

interface BotApiResponse<T> {
  ok: boolean;
  result?: T;
}

interface BotIdentity {
  id: number;
  is_bot: boolean;
  username?: string;
}
interface WebhookInfo {
  url?: string;
}
interface MenuButton {
  type: string;
  web_app?: { url?: string };
}

export interface TelegramSetupResult {
  botUsername: string;
  webhookUrl: string;
  menuConfigured: true;
  /** URL/menu checks cannot attest Telegram secret generation. */
  secretGenerationStatus: "unknown_not_attested";
}

/**
 * Set up a dedicated staging bot only, after verifying its identity and
 * existing webhook/menu destinations. Secret values must stay in Render env.
 * Foreign webhook/menu destinations are never overwritten.
 */
export async function configureStagingTelegramBot(
  config: ApiConfig,
  fetcher: typeof fetch = fetch
): Promise<TelegramSetupResult> {
  const webhookUrl = new URL(WEBHOOK_PATH, config.origin).toString();
  if (config.stagingOnly || !config.botToken || !config.webhookSecret) {
    throw new Error("Telegram staging credentials are not enabled");
  }
  if (config.origin !== "https://luemi-stage01.onrender.com" ||
      config.expectedBotUsername?.toLowerCase() !== REQUIRED_TEST_BOT) {
    throw new Error("Telegram setup restricted to LUEMI staging");
  }
  if (!/^[a-zA-Z0-9_-]{24,256}$/.test(config.webhookSecret)) {
    throw new Error("Invalid webhook secret policy");
  }

  async function invoke<T>(method: string, payload?: object): Promise<T> {
    // Bot API requires the token in its private HTTPS URL. Never log this URL.
    const endpoint = `https://api.telegram.org/bot${config.botToken}/${method}`;
    const options: RequestInit = payload
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) }
      : { method: "GET", signal: AbortSignal.timeout(10000) };
    const response = await fetcher(endpoint, options);
    if (!response.ok) throw new Error("Telegram API request failed");
    const parsed = (await response.json()) as BotApiResponse<T>;
    if (!parsed.ok || parsed.result === undefined) throw new Error("Telegram API refused request");
    return parsed.result;
  }

  const me = await invoke<BotIdentity>("getMe");
  if (!me.is_bot || me.username?.toLowerCase() !== REQUIRED_TEST_BOT) {
    throw new Error("Bot credential belongs to another bot; no settings changed");
  }
  const webhook = await invoke<WebhookInfo>("getWebhookInfo");
  if (webhook.url && webhook.url !== webhookUrl) {
    throw new Error("Another webhook is already installed; no settings changed");
  }
  const menu = await invoke<MenuButton>("getChatMenuButton");
  // Telegram sometimes normalizes a Web App root URL with a final slash.
  // Accept only the same HTTPS origin and the root path; other paths remain foreign.
  let existingMenuMatches = false;
  if (menu.type === "web_app") {
    try {
      const actualMenu = new URL(menu.web_app?.url ?? "");
      const expectedMenu = new URL(config.origin);
      existingMenuMatches = actualMenu.protocol === "https:" &&
        actualMenu.origin === expectedMenu.origin &&
        actualMenu.pathname === "/" &&
        !actualMenu.search &&
        !actualMenu.hash;
    } catch {
      existingMenuMatches = false;
    }
    if (!existingMenuMatches)
      throw new Error("Bot menu points to another app; no settings changed");
  }
  // Fully configured bot: startup is idempotent, do not rewrite Telegram settings.
  if (existingMenuMatches && webhook.url === webhookUrl) {
    return { botUsername: me.username ?? "LuemiAppBot", webhookUrl, menuConfigured: true, secretGenerationStatus: "unknown_not_attested" };
  }

  // All read-only checks have passed; customize the global bot menu button.
  await invoke<boolean>("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "Открыть LUEMI 💜",
      web_app: { url: config.origin }
    }
  });
  await invoke<boolean>("setWebhook", {
    url: webhookUrl,
    secret_token: config.webhookSecret,
    allowed_updates: ["message"],
    drop_pending_updates: false
  });
  return { botUsername: me.username ?? "LuemiAppBot", webhookUrl, menuConfigured: true, secretGenerationStatus: "unknown_not_attested" };
}
