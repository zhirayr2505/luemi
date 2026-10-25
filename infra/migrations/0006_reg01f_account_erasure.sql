-- REG01F-1 | Additive, isolated. DO NOT apply against live Supabase without owner acceptance.
-- Deletion request revokes account immediately. A separate isolated worker purges private storage
-- and relational data; status=complete is never emitted before both steps succeed.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='luemi_erasure_requester') THEN
  CREATE ROLE luemi_erasure_requester NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='luemi_erasure_worker') THEN
  CREATE ROLE luemi_erasure_worker NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
 END IF;
END $$;
CREATE TABLE luemi_private.erasure_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid NOT NULL UNIQUE,
 environment text NOT NULL CHECK(length(environment) BETWEEN 1 AND 96),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','complete')),
 requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 finished_at timestamptz,
 CHECK ((state='pending' AND finished_at IS NULL) OR
        (state='complete' AND finished_at IS NOT NULL))
);
CREATE INDEX luemi_erasure_pending_idx ON luemi_private.erasure_requests(requested_at,id)
 WHERE state='pending';
CREATE TABLE luemi_private.erasure_objects (
 request_id uuid NOT NULL REFERENCES luemi_private.erasure_requests(id),
 object_key text NOT NULL CHECK(length(object_key) BETWEEN 40 AND 256 AND
  object_key LIKE 'private/%/sanitized'),
 deleted_at timestamptz,
 PRIMARY KEY(request_id,object_key)
);
ALTER TABLE luemi_private.erasure_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_private.erasure_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE luemi_private.erasure_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_private.erasure_objects FORCE ROW LEVEL SECURITY;
REVOKE ALL ON luemi_private.erasure_requests,luemi_private.erasure_objects FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA luemi_private TO luemi_erasure_requester,luemi_erasure_worker;

-- Requester may access only its authenticated actor, and can only mark it deleted.
CREATE POLICY f_actor_read ON luemi_private.actors FOR SELECT TO luemi_erasure_requester
 USING(id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true));
CREATE POLICY f_actor_deactivate ON luemi_private.actors FOR UPDATE TO luemi_erasure_requester
 USING(id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true) AND status='active')
 WITH CHECK(id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true) AND status='deleted');
CREATE POLICY f_session_read ON luemi_private.sessions FOR SELECT TO luemi_erasure_requester
 USING(actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true));
CREATE POLICY f_session_revoke ON luemi_private.sessions FOR UPDATE TO luemi_erasure_requester
 USING(actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true))
 WITH CHECK(actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true) AND revoked_at IS NOT NULL);
CREATE POLICY f_profile_read ON luemi_private.public_profiles FOR SELECT TO luemi_erasure_requester
 USING(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true));
CREATE POLICY f_profile_hide ON luemi_private.public_profiles FOR UPDATE TO luemi_erasure_requester
 USING(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true))
 WITH CHECK(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true) AND publication_status='hidden');
CREATE POLICY f_media_read ON luemi_private.media_assets FOR SELECT TO luemi_erasure_requester
 USING(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true));
CREATE POLICY f_media_hide ON luemi_private.media_assets FOR UPDATE TO luemi_erasure_requester
 USING(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true))
 WITH CHECK(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true) AND publication_status='private');
CREATE POLICY f_draft_read ON luemi_private.private_profile_drafts FOR SELECT TO luemi_erasure_requester
 USING(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true));
CREATE POLICY f_draft_revoke ON luemi_private.private_profile_drafts FOR UPDATE TO luemi_erasure_requester
 USING(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true))
 WITH CHECK(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true) AND consent_version IS NULL);
CREATE POLICY f_queue_self ON luemi_private.erasure_requests FOR INSERT TO luemi_erasure_requester
 WITH CHECK(actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true) AND state='pending');
CREATE POLICY f_queue_read ON luemi_private.erasure_requests FOR SELECT TO luemi_erasure_requester
 USING(actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true));
CREATE POLICY f_object_enqueue ON luemi_private.erasure_objects FOR INSERT TO luemi_erasure_requester
 WITH CHECK(EXISTS(SELECT 1 FROM luemi_private.erasure_requests q
 WHERE q.id=request_id AND q.actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND q.environment=current_setting('luemi.environment',true) AND q.state='pending'));
GRANT SELECT(id,environment,status) ON luemi_private.actors TO luemi_erasure_requester;
GRANT UPDATE(status,first_name) ON luemi_private.actors TO luemi_erasure_requester;
GRANT SELECT(id,actor_id,environment,revoked_at) ON luemi_private.sessions TO luemi_erasure_requester;
GRANT UPDATE(revoked_at) ON luemi_private.sessions TO luemi_erasure_requester;
GRANT SELECT(owner_id,environment,publication_status) ON luemi_private.public_profiles TO luemi_erasure_requester;
GRANT UPDATE(publication_status) ON luemi_private.public_profiles TO luemi_erasure_requester;
GRANT SELECT(owner_id,environment,derivative_key,publication_status) ON luemi_private.media_assets TO luemi_erasure_requester;
GRANT UPDATE(publication_status) ON luemi_private.media_assets TO luemi_erasure_requester;
GRANT SELECT(owner_id,environment,consent_version) ON luemi_private.private_profile_drafts TO luemi_erasure_requester;
GRANT UPDATE(consent_version) ON luemi_private.private_profile_drafts TO luemi_erasure_requester;
GRANT INSERT,SELECT(id,actor_id,environment,state) ON luemi_private.erasure_requests TO luemi_erasure_requester;
GRANT INSERT(request_id,object_key) ON luemi_private.erasure_objects TO luemi_erasure_requester;

-- Worker cannot create a request or deactivate active actors. All its DELETE policies
-- require an existing pending erasure AND an already deactivated actor.
CREATE POLICY f_worker_queue ON luemi_private.erasure_requests FOR ALL TO luemi_erasure_worker
 USING(true) WITH CHECK(true);
CREATE POLICY f_worker_objects ON luemi_private.erasure_objects FOR ALL TO luemi_erasure_worker
 USING(true) WITH CHECK(true);
CREATE POLICY f_worker_actor ON luemi_private.actors FOR SELECT TO luemi_erasure_worker USING(
 status='deleted' AND EXISTS(SELECT 1 FROM luemi_private.erasure_requests q
 WHERE q.actor_id=luemi_private.actors.id AND q.environment=luemi_private.actors.environment AND q.state='pending'));
CREATE POLICY f_worker_actor_delete ON luemi_private.actors FOR DELETE TO luemi_erasure_worker USING(
 status='deleted' AND EXISTS(SELECT 1 FROM luemi_private.erasure_requests q
 WHERE q.actor_id=luemi_private.actors.id AND q.environment=luemi_private.actors.environment AND q.state='pending'));
-- Only rows tied to a pending, deleted actor may be purged.
CREATE POLICY f_worker_sessions ON luemi_private.sessions FOR ALL TO luemi_erasure_worker
 USING(EXISTS(SELECT 1 FROM luemi_private.actors a JOIN luemi_private.erasure_requests q
 ON q.actor_id=a.id AND q.environment=a.environment
 WHERE a.id=luemi_private.sessions.actor_id AND a.status='deleted' AND q.state='pending'))
 WITH CHECK(false);
CREATE POLICY f_worker_drafts ON luemi_private.private_profile_drafts FOR ALL TO luemi_erasure_worker
 USING(EXISTS(SELECT 1 FROM luemi_private.actors a JOIN luemi_private.erasure_requests q
 ON q.actor_id=a.id AND q.environment=a.environment
 WHERE a.id=owner_id AND a.status='deleted' AND q.state='pending'))
 WITH CHECK(false);
CREATE POLICY f_worker_profiles ON luemi_private.public_profiles FOR ALL TO luemi_erasure_worker
 USING(EXISTS(SELECT 1 FROM luemi_private.actors a JOIN luemi_private.erasure_requests q
 ON q.actor_id=a.id AND q.environment=a.environment
 WHERE a.id=owner_id AND a.status='deleted' AND q.state='pending'))
 WITH CHECK(false);
CREATE POLICY f_worker_assets ON luemi_private.media_assets FOR ALL TO luemi_erasure_worker
 USING(EXISTS(SELECT 1 FROM luemi_private.actors a JOIN luemi_private.erasure_requests q
 ON q.actor_id=a.id AND q.environment=a.environment
 WHERE a.id=owner_id AND a.status='deleted' AND q.state='pending'))
 WITH CHECK(false);
CREATE POLICY f_worker_uploads ON luemi_private.media_uploads FOR ALL TO luemi_erasure_worker
 USING(EXISTS(SELECT 1 FROM luemi_private.actors a JOIN luemi_private.erasure_requests q
 ON q.actor_id=a.id AND q.environment=a.environment
 WHERE a.id=owner_id AND a.status='deleted' AND q.state='pending'))
 WITH CHECK(false);
CREATE POLICY f_worker_jobs ON luemi_private.moderation_jobs FOR ALL TO luemi_erasure_worker
 USING(EXISTS(SELECT 1 FROM luemi_private.media_assets m
 JOIN luemi_private.actors a ON a.id=m.owner_id
 JOIN luemi_private.erasure_requests q ON q.actor_id=a.id AND q.environment=a.environment
 WHERE m.id=asset_id AND a.status='deleted' AND q.state='pending'))
 WITH CHECK(false);
CREATE POLICY f_worker_decisions ON luemi_private.moderation_decisions FOR ALL TO luemi_erasure_worker
 USING(EXISTS(SELECT 1 FROM luemi_private.moderation_jobs j
 JOIN luemi_private.media_assets m ON m.id=j.asset_id
 JOIN luemi_private.actors a ON a.id=m.owner_id
 JOIN luemi_private.erasure_requests q ON q.actor_id=a.id AND q.environment=a.environment
 WHERE j.id=job_id AND a.status='deleted' AND q.state='pending'))
 WITH CHECK(false);
CREATE POLICY f_worker_blocks ON luemi_private.blocks FOR ALL TO luemi_erasure_worker
 USING(EXISTS(SELECT 1 FROM luemi_private.erasure_requests q
 JOIN luemi_private.actors a ON a.id=q.actor_id AND a.status='deleted'
 WHERE q.state='pending' AND q.environment=luemi_private.blocks.environment
 AND (q.actor_id=blocker_id OR q.actor_id=blocked_id))) WITH CHECK(false);
CREATE POLICY f_worker_reports ON luemi_private.reports FOR ALL TO luemi_erasure_worker
 USING(EXISTS(SELECT 1 FROM luemi_private.erasure_requests q
 JOIN luemi_private.actors a ON a.id=q.actor_id AND a.status='deleted'
 WHERE q.state='pending' AND q.environment=luemi_private.reports.environment
 AND (q.actor_id=reporter_id OR q.actor_id=subject_id))) WITH CHECK(false);
CREATE POLICY f_worker_audit ON luemi_private.audit_events FOR ALL TO luemi_erasure_worker
 USING(EXISTS(SELECT 1 FROM luemi_private.erasure_requests q
 JOIN luemi_private.actors a ON a.id=q.actor_id AND a.status='deleted'
 WHERE q.state='pending' AND (q.actor_id=luemi_private.audit_events.actor_id OR EXISTS(
 SELECT 1 FROM luemi_private.media_assets m WHERE m.id=luemi_private.audit_events.resource_ref AND m.owner_id=q.actor_id))))
 WITH CHECK(false);

GRANT SELECT(id,actor_id,environment,state,requested_at,finished_at),UPDATE(state,finished_at)
 ON luemi_private.erasure_requests TO luemi_erasure_worker;
GRANT SELECT(request_id,object_key,deleted_at),UPDATE(deleted_at),DELETE
 ON luemi_private.erasure_objects TO luemi_erasure_worker;
GRANT SELECT(id,environment,status),DELETE ON luemi_private.actors TO luemi_erasure_worker;
GRANT SELECT(id,actor_id,environment),DELETE ON luemi_private.sessions TO luemi_erasure_worker;
GRANT SELECT(owner_id,environment),DELETE ON luemi_private.private_profile_drafts,luemi_private.public_profiles TO luemi_erasure_worker;
GRANT SELECT(id,owner_id,environment),DELETE ON luemi_private.media_assets,luemi_private.media_uploads TO luemi_erasure_worker;
GRANT SELECT(id,asset_id),DELETE ON luemi_private.moderation_jobs TO luemi_erasure_worker;
GRANT SELECT(id,job_id),DELETE ON luemi_private.moderation_decisions TO luemi_erasure_worker;
GRANT SELECT(blocker_id,blocked_id,environment),DELETE ON luemi_private.blocks TO luemi_erasure_worker;
GRANT SELECT(id,reporter_id,subject_id,environment),DELETE ON luemi_private.reports TO luemi_erasure_worker;
GRANT SELECT(id,actor_id,resource_ref),DELETE ON luemi_private.audit_events TO luemi_erasure_worker;
-- Never grant any of these privileges to anon, authenticated, issuer or reader.
