# LUEMI Telegram /start welcome — rollout

## Live native welcome (Bot API)

The /start webhook now sends one branded photo message with an inline
native web_app button. The source is the approved
`wordmark_original_raster_alpha_W06.webp` raster, included without
modification in the branded Soft Plum SVG artwork. GitHub Actions pre-renders
this design to `apps/web/public/assets/telegram/luemi-welcome-banner.jpg`.
Telegram fetches the static JPEG from LUEMI itself; no external converter,
Telegram user IDs or private profile data are sent to other image services.

The bot calls sendPhoto explicitly so a rejected/unavailable image
falls back to a regular sendMessage with identical button and caption.
Only the private-chat signed webhook can send this response. /myid,
invite-only mode, sender checks and Mini App auth/routing are retained.

New/unpublished/unknown: “Начать знакомство 💜”.
Published: “Продолжить знакомство 💜”.
Invite-only: “Открыть LUEMI 💜”.

The self-hosted JPEG is generated automatically from the SVG on a push to
`main`; the sent `sendPhoto` URL is served directly by LUEMI.

## User-facing behavior

The bot /start greeting uses the verified Telegram webhook and opens
the existing Mini App via the native Telegram web_app inline button.
The Mini App validates initData and chooses registration or published account.
Never trust a button label for authorization.

- Published account: “Продолжить знакомство 💜”.
- New account or unpublished draft: “Начать знакомство 💜”.
- DB unavailable or missing trustworthy sender: “Начать знакомство 💜”.
- Explicit invite-only test config: preserve its test language and /myid.

The status lookup uses distinct issuer and publisher database roles, each
with transaction-local RLS scope. It never creates a user or reveals private
profile contents. Unknown is not asserted as published or unregistered.

## HTML message-widget prototype

Source: apps/web/public/widgets/luemi-welcome.html
Preview route: /widgets/luemi-welcome.html

Self-contained HTML+CSS+JS, designed for Telegram widget layer 233. It is
NOT currently sent by the /start Bot API handler.

- No external fonts, assets or network calls.
- chatData is optional, with state new or registered; forwarded messages
  do not inherit it and use a neutral call to action.
- TelegramWidget.openTelegramLink is called only on a real tap.
- Deep link: https://t.me/LuemiAppBot?startapp=welcome
- Tests enforce 32 KB uncompressed / 4 KB zlib-compressed bounds.
- The wordmark in this proof of concept is text-rendered, not the
  pixel-exact approved raster brand asset, which would be too large
  for the compressed media limit. Approve a tiny vector revision first.

## Transport compatibility

As of 6 November 2026 the official public Telegram Bot API documentation
does not include sendWidget, answerWidgetQuery or editMessageWidgetData.
Do not invent methods. Bot API rich_message HTML is a separate capability,
not JavaScript execution.

Once an official widget transport is available, add it as a capability-tested
alternative with chat_data state, no query permissions, and a fallback to the
existing web_app button. Never put private account details in public_data.

## Manual QA before release

1. Run npm run test -w @luemi/api and npm run typecheck; check banner JPEG proxy returns a real image.
2. Send /start from an unregistered Telegram account; verify a photo and clickable web_app button, then register normally.
3. Send /start from a published account; confirm returning-user copy.
4. With database lookup unavailable, verify neutral copy and in-app routing.
5. Verify /myid, invalid signatures and non-private chats remain unchanged.
6. View the HTML prototype on Android and iOS; do not report an HTML widget
   as delivered inside Telegram until confirmed in the client.
