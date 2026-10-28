-- LUEMI: 72-hour reversible account deletion; migration intentionally not applied
-- to production until role/RLS tests and owner-approved deployment.
BEGIN;
ALTER TABLE luemi_private.erasure_requests
 ADD COLUMN IF NOT EXISTS eligible_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 ADD COLUMN IF NOT EXISTS reason_code text NOT NULL DEFAULT 'prefer_not_to_say',
 ADD COLUMN IF NOT EXISTS reason_details text NOT NULL DEFAULT '';
ALTER TABLE luemi_private.erasure_requests
 ADD CONSTRAINT deletion_reason_code_allowed CHECK
 (reason_code IN ('met_someone','not_useful','privacy','technical','other','prefer_not_to_say')),
 ADD CONSTRAINT deletion_reason_details_size CHECK (char_length(reason_details)<=500);
-- Existing requests preserve their old immediate worker semantics.
-- New requests supply eligible_at=clock_timestamp() + interval '72 hours'.

-- Auth issuer may look up and cancel ONLY the actor identified by a valid
-- server-verified Telegram initData. The role already has narrowly scoped
-- identity issuance and MUST NOT receive direct Storage credentials.
GRANT SELECT(id,actor_id,environment,state,eligible_at),DELETE
 ON luemi_private.erasure_requests TO luemi_auth_issuer;
CREATE POLICY auth_recovery_queue_select ON luemi_private.erasure_requests
 FOR SELECT TO luemi_auth_issuer
 USING (actor_id=NULLIF(current_setting('luemi.actor_id',true),'')::uuid
  AND environment=current_setting('luemi.environment',true) AND state='pending');
CREATE POLICY auth_recovery_queue_delete ON luemi_private.erasure_requests
 FOR DELETE TO luemi_auth_issuer
 USING (actor_id=NULLIF(current_setting('luemi.actor_id',true),'')::uuid
  AND environment=current_setting('luemi.environment',true) AND state='pending'
  AND eligible_at>clock_timestamp());
-- Never expose object keys to a login. Only delete pending snapshots to
-- allow cancellation. The request FK is intentionally NOT ON DELETE CASCADE.
GRANT SELECT(request_id),DELETE ON luemi_private.erasure_objects TO luemi_auth_issuer;
CREATE POLICY auth_recovery_objects_read ON luemi_private.erasure_objects
 FOR SELECT TO luemi_auth_issuer
 USING (EXISTS(SELECT 1 FROM luemi_private.erasure_requests q
  WHERE q.id=request_id AND q.actor_id=NULLIF(current_setting('luemi.actor_id',true),'')::uuid
    AND q.environment=current_setting('luemi.environment',true)
    AND q.state='pending' AND q.eligible_at>clock_timestamp()));
CREATE POLICY auth_recovery_objects_delete ON luemi_private.erasure_objects
 FOR DELETE TO luemi_auth_issuer
 USING (EXISTS(SELECT 1 FROM luemi_private.erasure_requests q
  WHERE q.id=request_id AND q.actor_id=NULLIF(current_setting('luemi.actor_id',true),'')::uuid
    AND q.environment=current_setting('luemi.environment',true)
    AND q.state='pending' AND q.eligible_at>clock_timestamp()));
COMMIT;
