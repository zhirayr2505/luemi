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
  chat?: { id?: number; type?: string };
}
interface TelegramUpdate {
  message?: TelegramMessage;
}

export function registerTelegramWebhook(app: FastifyInstance, config: ApiConfig): void {
  app.post<{ Body: TelegramUpdate }>("/api/telegram/webhook", {config:{rateLimit:{max:120,timeWindow:"1 minute"}}}, async (request, reply) => {
    const header = request.headers["x-telegram-bot-api-secret-token"];
    if (!config.botToken || !constantTimeMatch(header, config.webhookSecret))
      return reply.code(404).send({ error: "not_found" });
    const chat = request.body?.message?.chat;
    const text = request.body?.message?.text ?? "";
    if (chat?.type !== "private" || !Number.isSafeInteger(chat.id) || !/^\/start(?:\s|$)/.test(text))
      return { ok: true };
    // Telegram accepts an API method in the webhook response; no bot token is sent to clients.
    return {
      method: "sendMessage",
      chat_id: chat.id,
      text: "LUEMI 💜\nТвоя история начинается здесь. Открой приложение прямо в Telegram.",
      reply_markup: {
        inline_keyboard: [[{
          text: "Открыть LUEMI 💜",
          web_app: { url: config.origin }
        }]]
      }
    };
  });
}
