import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { ApiConfig } from "./config.js";

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

/**
 * Telegram WebView can reuse an already-open HTML document after a deploy.
 * A fresh /start message supplies a different URL per Render commit, without
 * changing the bot's permanent menu URL, the trust origin, or stored drafts.
 * Invalid/missing revision fails closed to the canonical root URL.
 */
export function versionedWebAppUrl(origin: string, gitCommit: string | undefined, route?: "likes"): string {
  if (!["https://luemi-stage01.onrender.com","https://luemi.onrender.com"].includes(origin)) return origin;
  if(!route&&(!gitCommit||!/^[0-9a-f]{40}$/i.test(gitCommit))) return origin;
  const url = new URL(origin);
  if(gitCommit && /^[0-9a-f]{40}$/i.test(gitCommit))
    url.searchParams.set("luemiRelease", gitCommit.slice(0, 12));
  if(route) url.searchParams.set("luemiRoute", route);
  return url.toString();
}

export function registerTelegramWebhook(app: FastifyInstance, config: ApiConfig): void {
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
    if (!/^\/start(?:\s|$)/.test(text))return {ok:true};
    // Telegram accepts an API method in the webhook response; no bot token is sent to clients.
    return {
      method: "sendMessage",
      chat_id: chat.id,
      text: config.rem05b?.inviteOnly===true?
        "LUEMI 💜\nИдёт закрытый тест для приглашённых друзей. Нажми кнопку ниже, чтобы открыть приложение. Для получения Telegram ID отправь /myid.":
        "LUEMI 💜\nТвоя история начинается здесь. Открой приложение прямо в Telegram.",
      reply_markup: {
        inline_keyboard: [[{
          text: "Открыть LUEMI 💜",
          web_app: { url: versionedWebAppUrl(config.origin, process.env.RENDER_GIT_COMMIT) }
        }]]
      }
    };
  });
}
