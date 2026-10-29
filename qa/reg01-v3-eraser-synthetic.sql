-- CI-ONLY: disposable PostgreSQL worker compatibility fixture.
-- Deliberately NOT a production migration or an endorsement of permanent retention.
CREATE SCHEMA IF NOT EXISTS luemi_bliki_private;
CREATE TABLE IF NOT EXISTS luemi_bliki_private.stories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 environment text NOT NULL,
 author_id uuid NOT NULL REFERENCES luemi_private.actors(id)
);
GRANT USAGE ON SCHEMA luemi_bliki_private TO luemi_erasure_worker;
GRANT SELECT(author_id,environment) ON luemi_bliki_private.stories TO luemi_erasure_worker;
ALTER TABLE luemi_bliki_private.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_bliki_private.stories FORCE ROW LEVEL SECURITY;
CREATE POLICY ci_worker_stories ON luemi_bliki_private.stories FOR SELECT
 TO luemi_erasure_worker USING (
  EXISTS (SELECT 1 FROM luemi_private.erasure_requests q
   WHERE q.actor_id=stories.author_id AND q.environment=stories.environment AND q.state='pending')
 );
GRANT SELECT(report_id) ON luemi_private.human_report_reviews TO luemi_erasure_worker;
CREATE POLICY ci_worker_human_reviews ON luemi_private.human_report_reviews FOR SELECT
 TO luemi_erasure_worker USING (
  EXISTS (SELECT 1 FROM luemi_private.reports r
   JOIN luemi_private.erasure_requests q ON q.actor_id IN (r.reporter_id,r.subject_id)
   WHERE r.id=human_report_reviews.report_id AND q.state='pending')
 );
ALTER TABLE luemi_private.actors ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;
CREATE SEQUENCE IF NOT EXISTS luemi_private.deleted_account_sentinel_seq AS bigint
 START WITH 9000000000000000000 INCREMENT BY 1
 MAXVALUE 9223372036854775807 NO CYCLE;
GRANT USAGE ON SEQUENCE luemi_private.deleted_account_sentinel_seq TO luemi_erasure_worker;
GRANT UPDATE(telegram_id,first_name,anonymized_at,updated_at) ON luemi_private.actors TO luemi_erasure_worker;
GRANT SELECT(anonymized_at) ON luemi_private.actors TO luemi_erasure_worker;
CREATE POLICY ci_worker_actor_tombstone ON luemi_private.actors FOR UPDATE
 TO luemi_erasure_worker
 USING(status='deleted' AND EXISTS(SELECT 1 FROM luemi_private.erasure_requests q
   WHERE q.actor_id=actors.id AND q.state='pending' AND q.eligible_at<=clock_timestamp()))
 WITH CHECK(status='deleted' AND anonymized_at IS NOT NULL);
