-- LUEMI V3B: maintain recipient-owned chat history after true account identity erasure.
-- STAGED: apply only after synthetic E2E, 72h worker review and retention approval.
BEGIN;
-- Requires db/chats-v3-tombstone-reader.sql first.
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
-- Reviewed/suspended enforcement data is held until a documented human/legal
-- decision; a pending deletion can never silently erase appeal evidence.
GRANT SELECT(actor_id,environment) ON luemi_private.account_enforcements TO luemi_erasure_worker;
CREATE POLICY erasure_safety_hold_read ON luemi_private.account_enforcements
 FOR SELECT TO luemi_erasure_worker USING (
  EXISTS (SELECT 1 FROM luemi_private.erasure_requests q
   WHERE q.actor_id=account_enforcements.actor_id
     AND q.environment=account_enforcements.environment
     AND q.state='pending' AND q.eligible_at<=clock_timestamp())
 );
CREATE POLICY worker_anonymize_tombstone ON luemi_private.actors FOR UPDATE
 TO luemi_erasure_worker
 USING(status='deleted' AND anonymized_at IS NULL AND EXISTS(
  SELECT 1 FROM luemi_private.erasure_requests q
  WHERE q.actor_id=actors.id AND q.environment=actors.environment
    AND q.state='pending' AND q.eligible_at<=clock_timestamp()))
 WITH CHECK(status='deleted' AND anonymized_at IS NOT NULL AND EXISTS(
  SELECT 1 FROM luemi_private.erasure_requests q
  WHERE q.actor_id=actors.id AND q.environment=actors.environment AND q.state='pending'));
COMMIT;
