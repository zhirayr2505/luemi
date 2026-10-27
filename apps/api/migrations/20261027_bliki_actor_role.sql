-- BLIKI V1 owner-scoped PostgreSQL role; deploy after private schema.
-- NOLOGIN by design. Never use postgres/service_role credentials in the API.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='luemi_bliki_request') THEN
  CREATE ROLE luemi_bliki_request NOLOGIN NOINHERIT NOBYPASSRLS;
 END IF;
END $$;
GRANT USAGE ON SCHEMA luemi_bliki_private TO luemi_bliki_request;
GRANT SELECT, INSERT, UPDATE ON luemi_bliki_private.stories TO luemi_bliki_request;
CREATE POLICY bliki_owner_select ON luemi_bliki_private.stories FOR SELECT TO luemi_bliki_request
 USING (author_id::text = nullif(current_setting('luemi.actor_id',true),'')
   AND environment = nullif(current_setting('luemi.environment',true),''));
CREATE POLICY bliki_owner_insert ON luemi_bliki_private.stories FOR INSERT TO luemi_bliki_request
 WITH CHECK (author_id::text = nullif(current_setting('luemi.actor_id',true),'')
   AND environment = nullif(current_setting('luemi.environment',true),'') AND status='uploading');
CREATE POLICY bliki_owner_update ON luemi_bliki_private.stories FOR UPDATE TO luemi_bliki_request
 USING (author_id::text = nullif(current_setting('luemi.actor_id',true),'')
   AND environment = nullif(current_setting('luemi.environment',true),''))
 WITH CHECK (author_id::text = nullif(current_setting('luemi.actor_id',true),'')
   AND environment = nullif(current_setting('luemi.environment',true),''));
COMMIT;
