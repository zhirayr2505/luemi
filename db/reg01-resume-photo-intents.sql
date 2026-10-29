-- LUEMI REG-01: retry the SAME expired private photo upload intent.
-- No new RLS policy and no public table access: requester can only update
-- expires_at for its own row (existing u_self RLS and session-bound scope).
BEGIN;
GRANT UPDATE(expires_at) ON luemi_private.media_uploads TO luemi_request;
COMMIT;
