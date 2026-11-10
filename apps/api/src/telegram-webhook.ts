import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { ApiConfig } from "./config.js";
import { versionedWebAppUrl } from "./telegram-web-app-url.js";
import { createWelcomeStatusLookup } from "./telegram-welcome-status.js";
import type { WelcomeStatusLookup } from "./telegram-welcome-status.js";
import { sendTelegramWelcomePhoto, welcomePhotoUrl } from "./telegram-welcome-photo.js";
import type { WelcomePhotoSender } from "./telegram-welcome-photo.js";
export { versionedWebAppUrl } from "./telegram-web-app-url.js";

function constantTimeMatch(received: unknown, expected: string): boolean {
  if (typeof received !== "string" || !expected) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
interface TelegramMessage {
  text?: string;
  from?: { id?: number };
  chat?: { id?: number; type?: string };
}
interface TelegramUpdate {
  message?: TelegramMessage;
}

export function registerTelegramWebhook(
  app: FastifyInstance, config: ApiConfig,
  lookup: WelcomeStatusLookup = createWelcomeStatusLookup(app, config),
  sendPhoto: WelcomePhotoSender = sendTelegramWelcomePhoto
): void {
  app.post<{ Body: TelegramUpdate }>("/api/telegram/webhook", async (request, reply) => {
    const header = request.headers["x-telegram-bot-api-secret-token"];
    if (!config.botToken || !constantTimeMatch(header, config.webhookSecret))
      return reply.code(404).send({ error: "not_found" });
    const chat = request.body?.message?.chat;
    const text = request.body?.message?.text ?? "";
    if (chat?.type !== "private" || typeof chat.id !== "number" || !Number.isSafeInteger(chat.id))
      return { ok: true };
    const chatId = chat.id;
    const senderId = request.body?.message?.from?.id;
    // Private /myid replies expose only the requesting Telegram sender's ID.
    if (/^\/(?:id|myid)(?:@LuemiAppBot)?(?:\s|$)/i.test(text)) {
      if (!Number.isSafeInteger(senderId) || senderId !== chatId) return { ok: true };
      return { method: "sendMessage", chat_id: chatId,
        text: "Твой Telegram ID: " + senderId +
          (config.rem05b?.inviteOnly === true
            ? "\nЭто закрытый тест. Для приглашения отправь свой ID владельцу: @zhiiirro. После подтверждения снова открой /start."
            : "\nДля регистрации открой LUEMI через /start.") };
    }
    if (!/^\/start(?:\s|$)/i.test(text)) return { ok: true };

    // Only the Telegram sender in their own private chat can be looked up.
    // The app, not the greeting, authenticates and routes to registration/home.
    const state = Number.isSafeInteger(senderId) && senderId === chatId
      ? await lookup(senderId as number).catch(() => "unknown" as const)
      : "unknown";
    const inviteOnly = config.rem05b?.inviteOnly === true;
    const button = inviteOnly ? "Открыть LUEMI 💜"
      : state === "registered" ? "Продолжить знакомство 💜"
      : "Начать знакомство 💜";
    const greeting = inviteOnly
      ? "<b>LUEMI 💜</b>\n\nИдёт закрытый тест для приглашённых друзей. Нажми кнопку ниже, чтобы открыть приложение. Для получения Telegram ID отправь /myid."
      : state === "registered"
        ? "<b>Твоя история продолжается 💜</b>\nАнкета уже здесь. Самое интересное — впереди."
        : "<b>Знакомства начинаются здесь 💜</b>\nВзаимные симпатии, живые чаты и люди, с которыми хочется быть собой.";
    const reply_markup = {
      inline_keyboard: [[{
        text: button,
        web_app: { url: versionedWebAppUrl(config.origin, process.env.RENDER_GIT_COMMIT) }
      }]]
    };

    // A direct sendPhoto returns an acknowledgement, unlike a webhook-method
    // response. If Telegram or the image CDN fails, deliver the CTA as text.
    const sent = await sendPhoto(config.botToken, {
      chat_id: chatId,
      photo: welcomePhotoUrl(config.origin),
      caption: greeting,
      parse_mode: "HTML",
      reply_markup
    }).catch(() => false);
    if (sent) return { ok: true };
    return {
      method: "sendMessage",
      chat_id: chatId,
      parse_mode: "HTML",
      text: greeting,
      reply_markup
    };
  });
}
