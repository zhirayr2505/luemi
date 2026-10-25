-- REAL REGISTRATION 01H: REPORT-BASED SUSPENSION AND SIGNED-IDENTITY APPEALS
-- CI / isolated staging only. NEVER apply to live Supabase without owner acceptance.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='luemi_safety_operator') THEN
  CREATE ROLE luemi_safety_operator NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='luemi_safety_appeal') THEN
  CREATE ROLE luemi_safety_appeal NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
 END IF;
END $$;
GRANT USAGE ON SCHEMA luemi_private TO luemi_safety_operator,luemi_safety_appeal;
CREATE TABLE luemi_private.account_enforcements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 environment text NOT NULL,
 actor_id uuid NOT NULL REFERENCES luemi_private.actors(id) ON DELETE CASCADE,
 report_id uuid REFERENCES luemi_private.reports(id) ON DELETE SET NULL,
 state text NOT NULL DEFAULT 'suspended' CHECK(state IN ('suspended','restored')),
 reason_code text NOT NULL CHECK(reason_code IN
  ('spam','harassment','impersonation','unsafe_media','minor_suspected')),
 operator_label text NOT NULL CHECK(length(operator_label) BETWEEN 3 AND 64),
 actioned_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 restored_at timestamptz,
 restored_by text,
 UNIQUE(id,actor_id),
 CHECK((state='suspended' AND restored_at IS NULL AND restored_by IS NULL)
   OR (state='restored' AND restored_at IS NOT NULL
       AND length(restored_by) BETWEEN 3 AND 64))
);
CREATE UNIQUE INDEX account_one_active_suspension
 ON luemi_private.account_enforcements(environment,actor_id) WHERE state='suspended';
CREATE TABLE luemi_private.account_appeals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 environment text NOT NULL,
 enforcement_id uuid NOT NULL UNIQUE,
 actor_id uuid NOT NULL,
 statement text NOT NULL CHECK(length(statement) BETWEEN 20 AND 750),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','accepted','rejected')),
 submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 reviewer_label text,
 review_reason text,
 reviewed_at timestamptz,
 FOREIGN KEY(enforcement_id,actor_id)
  REFERENCES luemi_private.account_enforcements(id,actor_id) ON DELETE CASCADE,
 CHECK((state='pending' AND reviewer_label IS NULL AND review_reason IS NULL AND reviewed_at IS NULL)
 OR (state IN ('accepted','rejected') AND
    length(reviewer_label) BETWEEN 3 AND 64 AND
    length(review_reason) BETWEEN 10 AND 500 AND reviewed_at IS NOT NULL))
);
CREATE INDEX account_appeals_pending_idx ON luemi_private.account_appeals(environment,submitted_at)
 WHERE state='pending';
ALTER TABLE luemi_private.account_enforcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_private.account_enforcements FORCE ROW LEVEL SECURITY;
ALTER TABLE luemi_private.account_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_private.account_appeals FORCE ROW LEVEL SECURITY;
REVOKE ALL ON luemi_private.account_enforcements,luemi_private.account_appeals
 FROM PUBLIC,anon,authenticated;

-- A real operator is entirely disjoint from Telegram issuer, reviewers, media worker and the browser.
CREATE POLICY h_safety_actor_select ON luemi_private.actors FOR SELECT TO luemi_safety_operator
 USING(environment=current_setting('luemi.environment',true));
CREATE POLICY h_safety_actor_update ON luemi_private.actors FOR UPDATE TO luemi_safety_operator
 USING(environment=current_setting('luemi.environment',true)
   AND status IN ('active','suspended'))
 WITH CHECK(environment=current_setting('luemi.environment',true)
   AND ((status='suspended' AND EXISTS(
     SELECT 1 FROM luemi_private.account_enforcements e
     WHERE e.actor_id=luemi_private.actors.id AND e.environment=luemi_private.actors.environment
       AND e.state='suspended'))
    OR (status='active' AND NOT EXISTS(
      SELECT 1 FROM luemi_private.account_enforcements e
      WHERE e.actor_id=luemi_private.actors.id AND e.environment=luemi_private.actors.environment
        AND e.state='suspended')
      AND EXISTS(SELECT 1 FROM luemi_private.account_enforcements e
      WHERE e.actor_id=luemi_private.actors.id AND e.environment=luemi_private.actors.environment
        AND e.state='restored'))));
CREATE POLICY h_safety_session_select ON luemi_private.sessions FOR SELECT TO luemi_safety_operator
 USING(environment=current_setting('luemi.environment',true));
CREATE POLICY h_safety_session_revoke ON luemi_private.sessions FOR UPDATE TO luemi_safety_operator
 USING(environment=current_setting('luemi.environment',true))
 WITH CHECK(environment=current_setting('luemi.environment',true) AND revoked_at IS NOT NULL);
CREATE POLICY h_safety_profile_select ON luemi_private.public_profiles FOR SELECT TO luemi_safety_operator
 USING(environment=current_setting('luemi.environment',true));
CREATE POLICY h_safety_profile_hide ON luemi_private.public_profiles FOR UPDATE TO luemi_safety_operator
 USING(environment=current_setting('luemi.environment',true))
 WITH CHECK(environment=current_setting('luemi.environment',true) AND publication_status='hidden');
CREATE POLICY h_safety_media_select ON luemi_private.media_assets FOR SELECT TO luemi_safety_operator
 USING(environment=current_setting('luemi.environment',true));
CREATE POLICY h_safety_media_hide ON luemi_private.media_assets FOR UPDATE TO luemi_safety_operator
 USING(environment=current_setting('luemi.environment',true))
 WITH CHECK(environment=current_setting('luemi.environment',true) AND publication_status='private' AND state='revoked');
CREATE POLICY h_safety_report_select ON luemi_private.reports FOR SELECT TO luemi_safety_operator
 USING(environment=current_setting('luemi.environment',true));
CREATE POLICY h_safety_report_action ON luemi_private.reports FOR UPDATE TO luemi_safety_operator
 USING(environment=current_setting('luemi.environment',true) AND state='triaged')
 WITH CHECK(environment=current_setting('luemi.environment',true) AND state='actioned');
CREATE POLICY h_safety_human_review ON luemi_private.human_report_reviews FOR SELECT TO luemi_safety_operator
 USING(environment=current_setting('luemi.environment',true));
CREATE POLICY h_safety_cases ON luemi_private.account_enforcements FOR ALL TO luemi_safety_operator
 USING(environment=current_setting('luemi.environment',true))
 WITH CHECK(environment=current_setting('luemi.environment',true)
 AND ((state='suspended' AND report_id IS NOT NULL AND
    EXISTS(SELECT 1 FROM luemi_private.reports r
    JOIN luemi_private.human_report_reviews h ON h.report_id=r.id
    WHERE r.id=luemi_private.account_enforcements.report_id
     AND r.subject_id=luemi_private.account_enforcements.actor_id
     AND r.environment=luemi_private.account_enforcements.environment
     AND r.state='triaged' AND h.action='triaged' AND h.environment=r.environment))
 OR (state='restored' AND EXISTS(
    SELECT 1 FROM luemi_private.account_appeals a
    WHERE a.enforcement_id=luemi_private.account_enforcements.id
     AND a.actor_id=luemi_private.account_enforcements.actor_id
     AND a.state='accepted'))));
CREATE POLICY h_safety_appeals ON luemi_private.account_appeals FOR ALL TO luemi_safety_operator
 USING(environment=current_setting('luemi.environment',true))
 WITH CHECK(environment=current_setting('luemi.environment',true));

GRANT SELECT(id,environment,status),UPDATE(status) ON luemi_private.actors TO luemi_safety_operator;
GRANT SELECT(id,actor_id,environment,revoked_at),UPDATE(revoked_at)
 ON luemi_private.sessions TO luemi_safety_operator;
GRANT SELECT(owner_id,environment,publication_status),UPDATE(publication_status)
 ON luemi_private.public_profiles TO luemi_safety_operator;
GRANT SELECT(id,owner_id,environment,publication_status),UPDATE(publication_status,state)
 ON luemi_private.media_assets TO luemi_safety_operator;
GRANT SELECT(id,subject_id,environment,state,reason_code),UPDATE(state)
 ON luemi_private.reports TO luemi_safety_operator;
GRANT SELECT(report_id,environment,action)
 ON luemi_private.human_report_reviews TO luemi_safety_operator;
GRANT SELECT(id,environment,actor_id,report_id,state,reason_code,operator_label,actioned_at),
 INSERT(environment,actor_id,report_id,state,reason_code,operator_label),
 UPDATE(state,restored_at,restored_by)
 ON luemi_private.account_enforcements TO luemi_safety_operator;
GRANT SELECT(id,environment,enforcement_id,actor_id,statement,state,submitted_at,
 reviewer_label,review_reason,reviewed_at),UPDATE(state,reviewer_label,review_reason,reviewed_at)
 ON luemi_private.account_appeals TO luemi_safety_operator;

-- Signed Telegram initData maps to ONE suspended actor. Never use a browser-provided actor ID.
CREATE POLICY h_appeal_actor ON luemi_private.actors FOR SELECT TO luemi_safety_appeal
 USING(environment=current_setting('luemi.environment',true)
   AND telegram_id=nullif(current_setting('luemi.telegram_id',true),'')::bigint
   AND status='suspended');
CREATE POLICY h_appeal_case ON luemi_private.account_enforcements FOR SELECT TO luemi_safety_appeal
 USING(environment=current_setting('luemi.environment',true)
 AND state='suspended'
 AND EXISTS(SELECT 1 FROM luemi_private.actors a WHERE a.id=actor_id
   AND a.environment=luemi_private.account_enforcements.environment
   AND a.status='suspended'));
CREATE POLICY h_appeal_insert ON luemi_private.account_appeals FOR INSERT TO luemi_safety_appeal
 WITH CHECK(environment=current_setting('luemi.environment',true)
 AND state='pending' AND reviewer_label IS NULL AND review_reason IS NULL
 AND reviewed_at IS NULL
 AND EXISTS(SELECT 1 FROM luemi_private.account_enforcements e
 WHERE e.id=enforcement_id AND e.actor_id=luemi_private.account_appeals.actor_id
 AND e.environment=luemi_private.account_appeals.environment AND e.state='suspended'));
GRANT SELECT(id,environment,telegram_id,status) ON luemi_private.actors TO luemi_safety_appeal;
GRANT SELECT(id,actor_id,environment,state) ON luemi_private.account_enforcements TO luemi_safety_appeal;
GRANT INSERT(environment,enforcement_id,actor_id,statement) ON luemi_private.account_appeals TO luemi_safety_appeal;
-- No access to auth sessions, raw photos, drafts, published profiles or other appeals.
