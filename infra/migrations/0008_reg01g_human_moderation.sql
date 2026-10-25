-- REG01G human review, isolated DB roles. NOT a live migration.
-- This role never authenticates users, owns a public endpoint, or bypasses RLS.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='luemi_human_moderator') THEN
  CREATE ROLE luemi_human_moderator NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
 END IF;
END $$;
GRANT USAGE ON SCHEMA luemi_private TO luemi_human_moderator;
ALTER TABLE luemi_private.moderation_decisions DROP CONSTRAINT moderation_decisions_reason_code_check;
ALTER TABLE luemi_private.moderation_decisions ADD CONSTRAINT moderation_decisions_reason_code_check
 CHECK(reason_code IN ('safe_synthetic','policy_violation','human_safe','human_policy_violation','human_minor_suspected'));
CREATE TABLE luemi_private.human_report_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 report_id uuid NOT NULL UNIQUE REFERENCES luemi_private.reports(id) ON DELETE CASCADE,
 environment text NOT NULL,
 action text NOT NULL CHECK(action IN ('triaged','dismissed')),
 moderator_label text NOT NULL CHECK(length(moderator_label) BETWEEN 3 AND 64),
 reason_code text NOT NULL CHECK(reason_code IN ('spam','harassment','impersonation','unsafe_media','no_violation')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE luemi_private.human_report_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_private.human_report_reviews FORCE ROW LEVEL SECURITY;
REVOKE ALL ON luemi_private.human_report_reviews FROM PUBLIC,anon,authenticated;
CREATE POLICY g_human_media_read ON luemi_private.media_assets FOR SELECT TO luemi_human_moderator
 USING(environment=current_setting('luemi.environment',true));
CREATE POLICY g_human_media_decide ON luemi_private.media_assets FOR UPDATE TO luemi_human_moderator
 USING(environment=current_setting('luemi.environment',true)
 AND state='pending_review' AND publication_status='private')
 WITH CHECK(environment=current_setting('luemi.environment',true)
 AND state IN ('approved','rejected') AND publication_status='private');
CREATE POLICY g_human_job_read ON luemi_private.moderation_jobs FOR SELECT TO luemi_human_moderator
 USING(EXISTS(SELECT 1 FROM luemi_private.media_assets a WHERE a.id=asset_id
 AND a.environment=current_setting('luemi.environment',true)));
CREATE POLICY g_human_job_decide ON luemi_private.moderation_jobs FOR UPDATE TO luemi_human_moderator
 USING(state='pending_review' AND EXISTS(SELECT 1 FROM luemi_private.media_assets a
 WHERE a.id=asset_id AND a.environment=current_setting('luemi.environment',true)))
 WITH CHECK(state='decided' AND EXISTS(SELECT 1 FROM luemi_private.media_assets a
 WHERE a.id=asset_id AND a.environment=current_setting('luemi.environment',true)));
CREATE POLICY g_human_decision ON luemi_private.moderation_decisions FOR INSERT TO luemi_human_moderator
 WITH CHECK(reason_code IN ('human_safe','human_policy_violation','human_minor_suspected')
 AND EXISTS(SELECT 1 FROM luemi_private.moderation_jobs j
 JOIN luemi_private.media_assets a ON a.id=j.asset_id
 WHERE j.id=job_id AND j.state='decided'
 AND a.environment=current_setting('luemi.environment',true)));
CREATE POLICY g_human_reports_read ON luemi_private.reports FOR SELECT TO luemi_human_moderator
 USING(environment=current_setting('luemi.environment',true));
CREATE POLICY g_human_reports_decide ON luemi_private.reports FOR UPDATE TO luemi_human_moderator
 USING(environment=current_setting('luemi.environment',true) AND state='open')
 WITH CHECK(environment=current_setting('luemi.environment',true) AND state IN ('triaged','dismissed'));
CREATE POLICY g_human_review_insert ON luemi_private.human_report_reviews FOR INSERT TO luemi_human_moderator
 WITH CHECK(environment=current_setting('luemi.environment',true)
 AND EXISTS(SELECT 1 FROM luemi_private.reports r WHERE r.id=report_id
 AND r.environment=environment AND r.state=action));
GRANT SELECT(id,environment,state,publication_status,derivative_key,generation,owner_id,created_at),
 UPDATE(state) ON luemi_private.media_assets TO luemi_human_moderator;
GRANT SELECT(id,asset_id,generation,state,created_at),UPDATE(state)
 ON luemi_private.moderation_jobs TO luemi_human_moderator;
GRANT INSERT(job_id,moderator_label,decision,reason_code)
 ON luemi_private.moderation_decisions TO luemi_human_moderator;
GRANT SELECT(id,environment,reason_code,state,subject_id,reporter_id,created_at),
 UPDATE(state) ON luemi_private.reports TO luemi_human_moderator;
GRANT INSERT(report_id,environment,action,moderator_label,reason_code)
 ON luemi_private.human_report_reviews TO luemi_human_moderator;
-- No UPDATE on public_profiles, actors, sessions or Telegram IDs.
-- No SELECT on private drafts, auth tokens, internal audit or any user credential.
