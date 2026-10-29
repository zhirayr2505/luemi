-- LUEMI REG01 background uploads: owner-only photo ordering.
-- The existing m_self RLS enforces signed actor/environment; this grants only
-- the single mutable order column, never state/owner/keys to request role.
BEGIN;
GRANT UPDATE(position) ON luemi_private.media_assets TO luemi_request;
COMMIT;
