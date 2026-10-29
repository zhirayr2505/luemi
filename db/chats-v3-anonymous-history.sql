-- LUEMI V3B: maintain recipient-owned chat history after true account identity erasure.
-- STAGED: apply only after synthetic E2E, 72h worker review and retention approval.
BEGIN;
ALTER TABLE luemi_private.actors ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;
-- The existing actors.telegram_id CHECK requires positive values.
-- Reserved, non-Telegram identifiers are generated only by the isolated purge worker.
CREATE SEQUENCE IF NOT EXISTS luemi_private.deleted_account_sentinel_seq AS bigint
 START WITH 9000000000000000000 INCREMENT BY 1 MINVALUE 9000000000000000000
 MAXVALUE 9223372036854775807 NO CYCLE;
REVOKE ALL ON SEQUENCE luemi_private.deleted_account_sentinel_seq FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SEQUENCE luemi_private.deleted_account_sentinel_seq TO luemi_erasure_worker;
GRANT SELECT(anonymized_at) ON luemi_private.actors TO luemi_chats_writer;
GRANT UPDATE(telegram_id,first_name,anonymized_at,updated_at) ON luemi_private.actors TO luemi_erasure_worker;
-- Actor-scoped erasure of non-conversation interactions; matches and their
-- received messages remain until the surviving participant's retention expires.
GRANT USAGE ON SCHEMA luemi_bliki_private,luemi_chats TO luemi_erasure_worker;
GRANT SELECT(author_id,environment) ON luemi_bliki_private.stories TO luemi_erasure_worker;
CREATE POLICY erasure_bliki_presence ON luemi_bliki_private.stories
 FOR SELECT TO luemi_erasure_worker USING (
  author_id IN (SELECT actor_id FROM luemi_private.erasure_requests q
   WHERE q.environment=stories.environment AND q.state='pending'
     AND q.eligible_at<=clock_timestamp())
 );
GRANT SELECT(report_id) ON luemi_private.human_report_reviews TO luemi_erasure_worker;
CREATE POLICY erasure_review_presence ON luemi_private.human_report_reviews
 FOR SELECT TO luemi_erasure_worker USING (
  EXISTS (SELECT 1 FROM luemi_private.reports report
   JOIN luemi_private.erasure_requests q ON q.actor_id IN (report.reporter_id,report.subject_id)
   WHERE report.id=human_report_reviews.report_id AND q.state='pending'
     AND q.eligible_at<=clock_timestamp())
 );
GRANT SELECT(environment,sender_id,receiver_id),DELETE ON luemi_chats.likes TO luemi_erasure_worker;
CREATE POLICY erasure_own_likes ON luemi_chats.likes FOR SELECT TO luemi_erasure_worker
 USING (EXISTS(SELECT 1 FROM luemi_private.erasure_requests q
  WHERE q.actor_id IN (sender_id,receiver_id) AND q.environment=likes.environment
    AND q.state='pending' AND q.eligible_at<=clock_timestamp()));
CREATE POLICY erasure_own_likes_delete ON luemi_chats.likes FOR DELETE TO luemi_erasure_worker
 USING (EXISTS(SELECT 1 FROM luemi_private.erasure_requests q
  WHERE q.actor_id IN (sender_id,receiver_id) AND q.environment=likes.environment
    AND q.state='pending' AND q.eligible_at<=clock_timestamp()));
GRANT SELECT(actor_id),DELETE ON luemi_bliki_private.reactions TO luemi_erasure_worker;
GRANT SELECT(viewer_id),DELETE ON luemi_bliki_private.views TO luemi_erasure_worker;
CREATE POLICY erasure_interaction_reactions ON luemi_bliki_private.reactions FOR SELECT TO luemi_erasure_worker
 USING(EXISTS(SELECT 1 FROM luemi_private.erasure_requests q
  WHERE q.actor_id=reactions.actor_id AND q.state='pending' AND q.eligible_at<=clock_timestamp()));
CREATE POLICY erasure_interaction_reactions_delete ON luemi_bliki_private.reactions FOR DELETE TO luemi_erasure_worker
 USING(EXISTS(SELECT 1 FROM luemi_private.erasure_requests q
  WHERE q.actor_id=reactions.actor_id AND q.state='pending' AND q.eligible_at<=clock_timestamp()));
-- Views use viewer_id instead of actor_id.
GRANT SELECT(viewer_id) ON luemi_bliki_private.views TO luemi_erasure_worker;
CREATE POLICY erasure_interaction_views ON luemi_bliki_private.views FOR SELECT TO luemi_erasure_worker
 USING(EXISTS(SELECT 1 FROM luemi_private.erasure_requests q
  WHERE q.actor_id=views.viewer_id AND q.state='pending' AND q.eligible_at<=clock_timestamp()));
CREATE POLICY erasure_interaction_views_delete ON luemi_bliki_private.views FOR DELETE TO luemi_erasure_worker
 USING(EXISTS(SELECT 1 FROM luemi_private.erasure_requests q
  WHERE q.actor_id=views.viewer_id AND q.state='pending' AND q.eligible_at<=clock_timestamp()));
GRANT SELECT(reporter_id),DELETE ON luemi_bliki_private.reports TO luemi_erasure_worker;
CREATE POLICY erasure_interaction_reports ON luemi_bliki_private.reports FOR SELECT TO luemi_erasure_worker
 USING(EXISTS(SELECT 1 FROM luemi_private.erasure_requests q
  WHERE q.actor_id=reports.reporter_id AND q.state='pending' AND q.eligible_at<=clock_timestamp()));
CREATE POLICY erasure_interaction_reports_delete ON luemi_bliki_private.reports FOR DELETE TO luemi_erasure_worker
 USING(EXISTS(SELECT 1 FROM luemi_private.erasure_requests q
  WHERE q.actor_id=reports.reporter_id AND q.state='pending' AND q.eligible_at<=clock_timestamp()));
CREATE POLICY worker_anonymize_tombstone ON luemi_private.actors FOR UPDATE
 TO luemi_erasure_worker
 USING(status='deleted' AND anonymized_at IS NULL AND EXISTS(
  SELECT 1 FROM luemi_private.erasure_requests q
  WHERE q.actor_id=actors.id AND q.environment=actors.environment
    AND q.state='pending' AND q.eligible_at<=clock_timestamp()))
 WITH CHECK(status='deleted' AND anonymized_at IS NOT NULL AND EXISTS(
  SELECT 1 FROM luemi_private.erasure_requests q
  WHERE q.actor_id=actors.id AND q.environment=actors.environment AND q.state='pending'));
-- A deleted actor is visible to an existing match ONLY as an anonymous state:
-- no Telegram identifiers, user names, deleted profile photos or location are granted.
CREATE POLICY match_anonymized_peer_read ON luemi_private.actors
 FOR SELECT TO luemi_chats_writer
 USING(environment=current_setting('luemi.environment',true)
 AND status='deleted' AND anonymized_at IS NOT NULL
 AND EXISTS (
  SELECT 1 FROM luemi_chats.matches pair
  WHERE pair.environment=actors.environment AND pair.status='active'
   AND ((pair.actor_low=actors.id AND pair.actor_high=NULLIF(current_setting('luemi.actor_id',true),'')::uuid)
    OR (pair.actor_high=actors.id AND pair.actor_low=NULLIF(current_setting('luemi.actor_id',true),'')::uuid))
 ));
CREATE OR REPLACE FUNCTION luemi_chats.archived_peer_history(p_conversation uuid,p_actor uuid,p_environment text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT EXISTS (
  SELECT 1 FROM luemi_chats.conversations c
  JOIN luemi_chats.matches mt ON mt.id=c.private_match_id AND mt.environment=c.environment AND mt.status='active'
  JOIN luemi_private.actors viewer ON viewer.id=p_actor AND viewer.environment=c.environment AND viewer.status='active'
  JOIN luemi_private.public_profiles profile ON profile.owner_id=viewer.id AND profile.environment=c.environment
    AND profile.publication_status='published'
  JOIN luemi_private.actors peer ON peer.id=(
   CASE WHEN mt.actor_low=p_actor THEN mt.actor_high ELSE mt.actor_low END)
   AND peer.environment=c.environment AND peer.status='deleted' AND peer.anonymized_at IS NOT NULL
  WHERE c.id=p_conversation AND c.environment=p_environment
   AND p_actor=NULLIF(current_setting('luemi.actor_id',true),'')::uuid
   AND p_actor IN (mt.actor_low,mt.actor_high)
   AND NOT EXISTS (SELECT 1 FROM luemi_private.blocks b
     WHERE b.environment=c.environment
       AND ((b.blocker_id=mt.actor_low AND b.blocked_id=mt.actor_high)
        OR (b.blocker_id=mt.actor_high AND b.blocked_id=mt.actor_low)))
 ) $$;
REVOKE ALL ON FUNCTION luemi_chats.archived_peer_history(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION luemi_chats.archived_peer_history(uuid,uuid,text) TO luemi_chats_writer;
DROP POLICY chats_members_read ON luemi_chats.members;
CREATE POLICY chats_members_read ON luemi_chats.members FOR SELECT TO luemi_chats_writer
 USING(actor_id=NULLIF(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true)
 AND (luemi_chats.live_match(conversation_id,actor_id,environment)
   OR luemi_chats.archived_peer_history(conversation_id,actor_id,environment)));
-- IMPORTANT: archive-only membership must NOT permit new messages or editing old messages.
DROP POLICY IF EXISTS chats_messages_insert ON luemi_chats.messages;
CREATE POLICY chats_messages_insert ON luemi_chats.messages FOR INSERT TO luemi_chats_writer
 WITH CHECK(sender_id=NULLIF(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true)
 AND luemi_chats.live_match(conversation_id,sender_id,environment));
DROP POLICY IF EXISTS chats_messages_update ON luemi_chats.messages;
CREATE POLICY chats_messages_update ON luemi_chats.messages FOR UPDATE TO luemi_chats_writer
 USING(sender_id=NULLIF(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true)
 AND luemi_chats.live_match(conversation_id,sender_id,environment))
 WITH CHECK(sender_id=NULLIF(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true)
 AND luemi_chats.live_match(conversation_id,sender_id,environment));
DROP POLICY IF EXISTS chats_media_read ON luemi_chats.media;
CREATE POLICY chats_media_read ON luemi_chats.media FOR SELECT TO luemi_chats_writer
 USING(environment=current_setting('luemi.environment',true)
 AND state='ready'
 AND (luemi_chats.live_match(conversation_id,NULLIF(current_setting('luemi.actor_id',true),'')::uuid,environment)
 OR luemi_chats.archived_peer_history(conversation_id,NULLIF(current_setting('luemi.actor_id',true),'')::uuid,environment)));
COMMIT;
