-- Durable idempotency marker for private owner-initiated moderation notifications.
-- No public roles, no automatic approval and no Telegram identifiers in this table.
BEGIN;
CREATE TABLE IF NOT EXISTS luemi_private.profile_review_requests (
 owner_id uuid PRIMARY KEY,
 environment text NOT NULL,
 revision bigint NOT NULL CHECK(revision>0),
 photo_count integer NOT NULL CHECK(photo_count BETWEEN 3 AND 6),
 notified_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE luemi_private.profile_review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_private.profile_review_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON luemi_private.profile_review_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON luemi_private.profile_review_requests TO luemi_request;
CREATE POLICY review_request_owner ON luemi_private.profile_review_requests FOR ALL TO luemi_request
 USING(owner_id::text=nullif(current_setting('luemi.actor_id',true),'')
    AND environment=nullif(current_setting('luemi.environment',true),''))
 WITH CHECK(owner_id::text=nullif(current_setting('luemi.actor_id',true),'')
    AND environment=nullif(current_setting('luemi.environment',true),''));
COMMIT;
