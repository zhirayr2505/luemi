# Chat conversation interactions

- Add browser coverage to the shared demo thread for tap, double tap, hold, swipe, and reply. Add authenticated two-participant API assertions for receipts, quotes, reactions, presence, and bulk visibility.
- Extend the existing chat transport and scoped PostgreSQL routes. Keep the chat writer limited to its own interaction writes and to active peers' presence. Preserve the existing visibility and clear behavior.
- Rework the thread header, anchored message actions, selection, and composer. Use the shared gesture arbiter and animate arriving rows separately from their reply swipe.
- Run the root checks, the mobile browser smoke, and the disposable PostgreSQL suite. Use a dedicated branch for review. Production migration and real Telegram device verification are separate acceptance steps.
