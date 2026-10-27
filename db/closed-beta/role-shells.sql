-- Applied to LUEMI Supabase on 2026-10-27 as
-- luemi_two_account_beta_role_shells.
-- Permanent NOLOGIN shells: no passwords, API clients or public grants.
-- Each account may later receive a unique, operator-managed password and LOGIN
-- after testing on a private connection. NEVER commit credentials.
BEGIN;
DO $beta$
DECLARE item record;
BEGIN
 FOR item IN SELECT principal, member_of FROM (VALUES
 ('luemi_beta_auth','luemi_auth_issuer'),
 ('luemi_beta_request','luemi_request'),
 ('luemi_beta_media','luemi_media_worker'),
 ('luemi_beta_publisher','luemi_profile_publisher'),
 ('luemi_beta_discovery','luemi_discovery_reader'),
 ('luemi_beta_chats','luemi_chats_writer'),
 ('luemi_beta_matches','luemi_match_writer'),
 ('luemi_beta_geo','luemi_geo_budget'),
 ('luemi_beta_human','luemi_human_moderator'),
 ('luemi_beta_erasure','luemi_erasure_requester')
 ) AS roles(principal,member_of)
 LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=item.principal)
   THEN RAISE EXCEPTION 'Beta role already exists: %', item.principal;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=item.member_of)
   THEN RAISE EXCEPTION 'Missing permission group: %',item.member_of;
  END IF;
  EXECUTE format('CREATE ROLE %I NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 3',item.principal);
  EXECUTE format('GRANT %I TO %I',item.member_of,item.principal);
 END LOOP;
END
$beta$;
COMMIT;
