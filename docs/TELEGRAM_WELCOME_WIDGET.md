# LUEMI /start — Telegram HTML widget (Bot API 10.4)

The bot now sends a real interactive HTML message using Bot API sendWidget
in private chats. It is not a photo. The widget contains a vector-traced
approximation of LUEMI's approved wordmark, three interactive information
tabs (Likes, Matches, Chats), soft plum styles and a working Start Dating
button inside the message. The approved raster logo remains unchanged
in the project's brand assets.

Widget source: apps/web/public/widgets/luemi-welcome.html
Transport: apps/api/src/telegram-welcome-widget.ts
Webhook: apps/api/src/telegram-webhook.ts

The HTML is self-contained: no external fonts/scripts/images or network
requests. The start button uses TelegramWidget.openTelegramLink with
https://t.me/LuemiAppBot?startapp=welcome on a real user tap.

Signed webhook private-chat checks, status lookup, /myid, invite-only
mode and all existing Mini App authentication/routing remain unchanged.
The widget chat_data carries only a neutral/new/registered/invite state;
no personally identifying fields or secrets are embedded. It disables
widget queries and is not shared. Production Bot API 10.4 currently
supports widgets only in private chat with the bot.

If Telegram rejects sendWidget or loading the HTML fails, the bot
sends regular text with a native web_app inline keyboard instead, not
a photo. Existing photographs in older chat messages remain as they were.
HTML limit: 32768 UTF-8 bytes and 4096 deflate bytes at level 9.

QA: run npm run test -w @luemi/api, npm run typecheck, npm run build;
check /start in Telegram Android and iOS, tap all tabs and launch Mini App.

## Soft Plum V2 welcome (November 11, 2026)

The approved hero concept has been translated to an actual mobile-width widget,
not a JPEG mockup. The HTML contains original LUEMI silhouette-based vector
lettering, a small heart crest, glass-wave gradients, three select-able feature
tabs, feature tiles, and a primary Mini App CTA. It uses a fixed 556 logical-pixel
height (under the Bot API 600 limit) with Telegram's bottom time safe area.
The chat message displays a short caption above the widget. Feature tiles
have descriptive text, not fabricated private like/match/message counts.
The widget remains network-free, self-contained, and uses no third-party
fonts or images. Tab changes are local to that message; only a real tap opens
the Mini App. The server keeps the text/keyboard fallback for sendWidget errors.
