import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { ApiConfig } from "./config.js";
import { versionedWebAppUrl } from "./telegram-web-app-url.js";
import { createWelcomeStatusLookup } from "./telegram-welcome-status.js";
import type { WelcomeStatusLookup } from "./telegram-welcome-status.js";
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
  lookup: WelcomeStatusLookup = createWelcomeStatusLookup(app, config)
): void {
  app.post<{ Body: TelegramUpdate }>("/api/telegram/webhook", async (request, reply) => {
    const header = request.headers["x-telegram-bot-api-secret-token"];
    if (!config.botToken || !constantTimeMatch(header, config.webhookSecret))
      return reply.code(404).send({ error: "not_found" });
    const chat = request.body?.message?.chat;
    const text = request.body?.message?.text ?? "";
    if (chat?.type !== "private" || !Number.isSafeInteger(chat.id))
      return {ok:true};
    const senderId=request.body?.message?.from?.id;
    // Private /myid replies expose only the requesting Telegram sender's ID.
    if (/^\/(?:id|myid)(?:@LuemiAppBot)?(?:\s|$)/i.test(text)) {
      if (!Number.isSafeInteger(senderId)||senderId!==chat.id)return {ok:true};
      return {method:"sendMessage",chat_id:chat.id,
       text:"Твой Telegram ID: "+senderId+
        (config.rem05b?.inviteOnly===true?
         "\nЭто закрытый тест. Для приглашения отправь свой ID владельцу: @zhiiirro. После подтверждения снова открой /start.":
         "\nДля регистрации открой LUEMI через /start.")};
    }
    if (!/^\/start(?:\s|$)/i.test(text))return {ok:true};

    // The only trusted identity for the greeting is the Telegram webhook
    // sender in the same private chat. Without it, show a neutral welcome.
    const state = Number.isSafeInteger(senderId) && senderId === chat.id
      ? await lookup(senderId as number).catch(() => "unknown" as const)
      : "unknown";
    const inviteOnly = config.rem05b?.inviteOnly === true;
    const button = inviteOnly ? "Открыть LUEMI 💜" :
      state === "registered" ? "Продолжить знакомство 💜" :
      state === "new" ? "Зарегистрироваться 💜" : "Начать знакомство 💜";
    const greeting = inviteOnly
      ? "<b>luemi 💜</b>\n\nИдёт закрытый тест для приглашённых друзей. Нажми кнопку ниже, чтобы открыть приложение. Для получения Telegram ID отправь /myid."
      : state === "registered"
        ? "<b>luemi 💜</b>\n\n<b>Снова вместе!</b>\nТвоя анкета уже здесь. Продолжай знакомиться и находить близких по духу людей."
        : "<b>luemi 💜</b>\n\n<b>Люди ближе, чем кажется.</b>\nЗнакомься, общайся и находи тех, с кем хочется быть собой.\n\nТвоя история начинается здесь.";
    // Telegram's public Bot API does not yet support sending HTML/JS
    // message widgets. This standard Web App CTA works on stable clients.
    // The app authenticates the viewer and chooses registration vs home.
    return {
      method: "sendMessage",
      chat_id: chat.id,
      parse_mode: "HTML",
      text: greeting,
      reply_markup: {
        inline_keyboard: [[{
          text: button,
          web_app: { url: versionedWebAppUrl(config.origin, process.env.RENDER_GIT_COMMIT) }
        }]]
      }
    };
  });
}
