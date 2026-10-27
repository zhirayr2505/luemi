# LUEMI Chats V1 architecture

## Boundaries

`Telegram initData → V2 session guard → actor UUID → published profile owner UUID → active mutual match → conversation` is the only supported identity path. Telegram numeric IDs, actor UUIDs and legacy `public.luemi_users.id` values are never compared or substituted by the chat client.

The browser receives only a peer projection. It cannot create conversations, memberships or matches. Every API operation revalidates the V2 session and executes inside a PostgreSQL transaction with `luemi.actor_id` and `luemi.environment` set locally. The dedicated login is rejected at runtime if it is privileged, owns protected tables, bypasses RLS or has broader DML than the chat contract allows.

## Modules

- `packages/contracts/src/index.ts`: transport contracts shared by web/API.
- `apps/web/src/chats/chat-transport.ts`: abortable HTTP transport and normalized errors.
- `apps/web/src/chats/chat-domain.ts`: reconciliation, ordering, scroll and client validation.
- `apps/web/src/chats/RealChats.tsx`: presentation, optimistic state, pagination and gesture ownership.
- `apps/web/src/chats/ChatPhotoViewer.tsx`: isolated pinch/double-tap/dismiss controller.
- `apps/api/src/chats-api.ts`: authenticated routes, transaction scope and PostgreSQL repository queries.
- `apps/api/src/features/chats/chat-media.ts`: byte-signature validation, private object keys and storage port.
- `db/chats-v1/`: forward migration, rollback and read-only verification.

## Main flows

1. List: server projects only active matched peers and sorts by authoritative last activity.
2. History: `(created_at,id)` cursor, 50 rows, newest page returned in chronological order.
3. Send: client UUID creates an optimistic bubble; server unique constraint reconciles retry to one message.
4. Edit/delete: only sender; identity columns are immutable; delete clears body and records `deleted_at`.
5. Read: current member advances `last_read_at` monotonically.
6. Media: validate declared MIME, size and magic bytes; write a random private key; attach metadata to one message; issue a 60-second URL only after live membership is rechecked.

Polling is intentionally used instead of claiming Realtime is provisioned. Requests are aborted on chat switch/unmount; stale generations cannot write into another thread.
