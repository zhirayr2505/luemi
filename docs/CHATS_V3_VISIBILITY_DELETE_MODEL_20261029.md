# LUEMI Chats V3: deletion and visibility (29 October 2026)

Status: isolated implementation; DO NOT merge or deploy until database migration and real role-based tests pass.

## Behavior
- An authenticated participant may hide any message in a one-to-one conversation either only for themself or for both members.
- A participant may hide the full past conversation for themself or for both. Later messages must be visible. The app must not resurrect hidden messages through polling, pagination or media URL access.
- If the other account is removed, the surviving participant should retain an existing legitimately accessible conversation under the name "Удалённый аккаунт"; profile navigation must be disabled. Final-erasure and matches rework remains a separate blocker.
- Display-level deletion is represented by additive, actor-scoped event tables. The original chat payload is not rewritten for a visibility event. Legacy DELETE is a compatibility alias to globally hide an author's message.

## Privacy boundaries
Display removal DOES NOT mean irreversible erasure from the backend. Unlimited secret archival of every private photo or message is NOT approved. A lawful, disclosed, limited retention schedule and narrowly scoped safety/legal-hold process are required. Final deletion must respect rights to erasure while considering the other participant's lawful copy.

An export requires the requester's verified identity and must protect the other participant's privacy. It can include the requester's account, photos, activity and their legitimately accessible chat content, but cannot bypass globally hidden messages, reveal unrelated personal data or permit blanket administrator downloads.

## Implementation gates
Apply db/chats-v3-visibility.sql in a test environment first. The API queries assume both visibility tables already exist. The isolated writer role has SELECT and INSERT rights only; RLS enforces current authenticated actor and membership. Do not grant anon/authenticated access or expose Supabase Storage publicly.

Required before production: PostgreSQL 16/17 RLS assertions, real peer-session integration tests, media access regression, polling and pagination tests, confirmation of final account tombstones, explicit data retention policy, and full 72-hour account-erasure work including chats and Bliki files. Do not activate worker or public registration flags on the basis of this feature.
