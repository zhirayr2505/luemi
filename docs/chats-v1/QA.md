# LUEMI Chats V1 QA

Executed on 27 October 2026 from main `fe929de75c290d428312ecf3f33469e665486e76`.

## Passed

- `npm run typecheck` — contracts, API and web passed.
- `npm run lint` — passed with zero errors.
- `node --import tsx --test apps/api/test/*.test.ts` — 95/95 passed.
- `npm run build` — full prebuild, API and Vite multi-page build passed.
- `npm run test:chats` — focused media/domain/gate/source contracts.

## Not executed here

- PostgreSQL secure tests requiring isolated admin/chat/match principals.
- Browser smoke: script is included, but the runner had no Chromium binary and the restricted network returned an empty archive during `playwright install chromium`.
- Applying SQL or running Supabase advisors against production (explicitly forbidden in this task).
- Two real Telegram accounts, actual mutual match, private production object storage.
- Physical Samsung Galaxy A55 performance profiling. No FPS claim is made.

The host uses Node 24/npm 11 while the repository declares Node 22/npm 10. Builds pass, but release CI remains authoritative for the pinned runtime.
