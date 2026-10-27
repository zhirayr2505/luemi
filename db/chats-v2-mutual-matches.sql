-- LUEMI mutual matches V2: one actor identity for registration, likes and chats.
-- Apply AFTER 0002..0009 and db/chats-v1-isolated.sql; private schemas only.
-- This replaces legacy public UUID matchmaking for NEW conversations without
-- silently equating public.luemi_users.id to luemi_private.actors.id.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='luemi_match_writer') THEN
  CREATE ROLE luemi_match_writer NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='luemi_chats_writer') THEN
  CREATE ROLE luemi_chats_writer NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
 END IF;
END $$;
CREATE TABLE luemi_chats.likes (
 environment text NOT NULL CHECK (length(environment) BETWEEN 1 AND 96),
 sender_id uuid NOT NULL REFERENCES luemi_private.actors(id),
 receiver_id uuid NOT NULL REFERENCES luemi_private.actors(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(environment,sender_id,receiver_id),
 CHECK(sender_id<>receiver_id)
);
CREATE INDEX chat_likes_receiver_idx ON luemi_chats.likes(environment,receiver_id,sender_id);
CREATE TABLE luemi_chats.matches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 environment text NOT NULL CHECK (length(environment) BETWEEN 1 AND 96),
 actor_low uuid NOT NULL REFERENCES luemi_private.actors(id),
 actor_high uuid NOT NULL REFERENCES luemi_private.actors(id),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 closed_at timestamptz,
 UNIQUE(environment,actor_low,actor_high),
 CHECK(actor_low<actor_high),
 CHECK((status='active' AND closed_at IS NULL) OR status='closed')
);
ALTER TABLE luemi_chats.conversations ALTER COLUMN match_id DROP NOT NULL;
ALTER TABLE luemi_chats.conversations
 ADD COLUMN private_match_id uuid REFERENCES luemi_chats.matches(id);
ALTER TABLE luemi_chats.conversations
 ADD CONSTRAINT chat_exactly_one_match_source CHECK((match_id IS NULL)<>(private_match_id IS NULL));
CREATE UNIQUE INDEX chats_unique_private_match ON luemi_chats.conversations(environment,private_match_id)
 WHERE private_match_id IS NOT NULL;
ALTER TABLE luemi_chats.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.likes FORCE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.matches FORCE ROW LEVEL SECURITY;

REVOKE ALL ON luemi_chats.likes,luemi_chats.matches FROM PUBLIC;
REVOKE ALL ON SCHEMA luemi_chats FROM PUBLIC;
GRANT USAGE ON SCHEMA luemi_chats TO luemi_match_writer,luemi_chats_writer;
GRANT USAGE ON SCHEMA luemi_private TO luemi_match_writer,luemi_chats_writer;
GRANT SELECT,INSERT ON luemi_chats.likes,luemi_chats.matches TO luemi_match_writer;
GRANT SELECT ON luemi_chats.likes,luemi_chats.matches TO luemi_chats_writer;
GRANT SELECT ON luemi_chats.conversations TO luemi_match_writer,luemi_chats_writer;
GRANT INSERT(environment,private_match_id) ON luemi_chats.conversations TO luemi_match_writer;
GRANT INSERT(conversation_id,actor_id,environment) ON luemi_chats.members TO luemi_match_writer;
GRANT SELECT ON luemi_chats.members TO luemi_chats_writer;
GRANT UPDATE(last_read_at) ON luemi_chats.members TO luemi_chats_writer;
GRANT SELECT,INSERT ON luemi_chats.messages TO luemi_chats_writer;
GRANT UPDATE(body,edited_at,deleted_at) ON luemi_chats.messages TO luemi_chats_writer;
GRANT SELECT ON luemi_chats.media TO luemi_chats_writer;

-- Match writer can see only the minimum facts needed for a mutual like.
GRANT SELECT(id,environment,status) ON luemi_private.actors TO luemi_match_writer,luemi_chats_writer;
GRANT SELECT(owner_id,environment,publication_status,display_name)
 ON luemi_private.public_profiles TO luemi_match_writer,luemi_chats_writer;
GRANT SELECT(blocker_id,blocked_id,environment)
 ON luemi_private.blocks TO luemi_match_writer,luemi_chats_writer;
GRANT SELECT(id,owner_id,environment,state,publication_status,position)
 ON luemi_private.media_assets TO luemi_chats_writer;
CREATE POLICY match_actor_active ON luemi_private.actors FOR SELECT TO luemi_match_writer,luemi_chats_writer
 USING(environment=current_setting('luemi.environment',true) AND status='active');
CREATE POLICY match_profile_select ON luemi_private.public_profiles FOR SELECT TO luemi_match_writer
 USING(environment=current_setting('luemi.environment',true) AND publication_status='published');
CREATE POLICY match_block_read ON luemi_private.blocks FOR SELECT TO luemi_match_writer,luemi_chats_writer
 USING(environment=current_setting('luemi.environment',true)
 AND (blocker_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
   OR blocked_id=nullif(current_setting('luemi.actor_id',true),'')::uuid));
CREATE POLICY match_likes_read ON luemi_chats.likes FOR SELECT TO luemi_match_writer
 USING(environment=current_setting('luemi.environment',true)
 AND (sender_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 OR receiver_id=nullif(current_setting('luemi.actor_id',true),'')::uuid));
CREATE POLICY match_likes_insert ON luemi_chats.likes FOR INSERT TO luemi_match_writer
 WITH CHECK(environment=current_setting('luemi.environment',true)
 AND sender_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND EXISTS(SELECT 1 FROM luemi_private.public_profiles p WHERE p.owner_id=sender_id AND p.environment=luemi_chats.likes.environment AND p.publication_status='published')
 AND EXISTS(SELECT 1 FROM luemi_private.public_profiles p WHERE p.owner_id=receiver_id AND p.environment=luemi_chats.likes.environment AND p.publication_status='published')
 AND NOT EXISTS(SELECT 1 FROM luemi_private.blocks b WHERE b.environment=luemi_chats.likes.environment
 AND ((b.blocker_id=sender_id AND b.blocked_id=receiver_id) OR (b.blocker_id=receiver_id AND b.blocked_id=sender_id))));
CREATE POLICY match_pair_read ON luemi_chats.matches FOR SELECT TO luemi_match_writer,luemi_chats_writer
 USING(environment=current_setting('luemi.environment',true)
 AND (actor_low=nullif(current_setting('luemi.actor_id',true),'')::uuid
 OR actor_high=nullif(current_setting('luemi.actor_id',true),'')::uuid));
CREATE POLICY match_pair_insert ON luemi_chats.matches FOR INSERT TO luemi_match_writer
 WITH CHECK(environment=current_setting('luemi.environment',true) AND status='active'
 AND (actor_low=nullif(current_setting('luemi.actor_id',true),'')::uuid OR actor_high=nullif(current_setting('luemi.actor_id',true),'')::uuid)
 AND EXISTS(SELECT 1 FROM luemi_chats.likes l WHERE l.environment=luemi_chats.matches.environment AND l.sender_id=actor_low AND l.receiver_id=actor_high)
 AND EXISTS(SELECT 1 FROM luemi_chats.likes l WHERE l.environment=luemi_chats.matches.environment AND l.sender_id=actor_high AND l.receiver_id=actor_low));
GRANT UPDATE(status,closed_at) ON luemi_chats.matches TO luemi_match_writer;
CREATE POLICY match_pair_close ON luemi_chats.matches FOR UPDATE TO luemi_match_writer
 USING(environment=current_setting('luemi.environment',true)
 AND status='active'
 AND (actor_low=nullif(current_setting('luemi.actor_id',true),'')::uuid
 OR actor_high=nullif(current_setting('luemi.actor_id',true),'')::uuid))
 WITH CHECK(environment=current_setting('luemi.environment',true)
 AND status='closed' AND closed_at IS NOT NULL
 AND (actor_low=nullif(current_setting('luemi.actor_id',true),'')::uuid
 OR actor_high=nullif(current_setting('luemi.actor_id',true),'')::uuid));
CREATE POLICY match_conversation_read ON luemi_chats.conversations FOR SELECT TO luemi_match_writer,luemi_chats_writer
 USING(environment=current_setting('luemi.environment',true) AND private_match_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM luemi_chats.matches m WHERE m.id=private_match_id AND m.environment=luemi_chats.conversations.environment
 AND (m.actor_low=nullif(current_setting('luemi.actor_id',true),'')::uuid
 OR m.actor_high=nullif(current_setting('luemi.actor_id',true),'')::uuid)));
CREATE POLICY match_conversation_insert ON luemi_chats.conversations FOR INSERT TO luemi_match_writer
 WITH CHECK(environment=current_setting('luemi.environment',true) AND match_id IS NULL
 AND EXISTS(SELECT 1 FROM luemi_chats.matches m WHERE m.id=private_match_id AND m.environment=luemi_chats.conversations.environment
 AND m.status='active' AND (m.actor_low=nullif(current_setting('luemi.actor_id',true),'')::uuid
 OR m.actor_high=nullif(current_setting('luemi.actor_id',true),'')::uuid)));
CREATE POLICY match_member_insert ON luemi_chats.members FOR INSERT TO luemi_match_writer
 WITH CHECK(environment=current_setting('luemi.environment',true)
 AND EXISTS(SELECT 1 FROM luemi_chats.conversations c
 JOIN luemi_chats.matches m ON m.id=c.private_match_id AND m.environment=c.environment
 WHERE c.id=luemi_chats.members.conversation_id AND c.environment=luemi_chats.members.environment AND m.status='active'
 AND (m.actor_low=nullif(current_setting('luemi.actor_id',true),'')::uuid
 OR m.actor_high=nullif(current_setting('luemi.actor_id',true),'')::uuid)
 AND luemi_chats.members.actor_id IN (m.actor_low,m.actor_high)));

-- A block, hidden profile, suspended actor or closed match revokes chat access
-- at query time, even before maintenance removes obsolete membership rows.
CREATE POLICY chat_peer_profile_read ON luemi_private.public_profiles FOR SELECT TO luemi_chats_writer
 USING(environment=current_setting('luemi.environment',true) AND publication_status='published'
 AND (owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid OR EXISTS(SELECT 1 FROM luemi_chats.matches m WHERE m.environment=luemi_private.public_profiles.environment AND m.status='active'
 AND ((m.actor_low=owner_id AND m.actor_high=nullif(current_setting('luemi.actor_id',true),'')::uuid)
 OR (m.actor_high=owner_id AND m.actor_low=nullif(current_setting('luemi.actor_id',true),'')::uuid)))));
CREATE POLICY chat_peer_media_read ON luemi_private.media_assets FOR SELECT TO luemi_chats_writer
 USING(environment=current_setting('luemi.environment',true) AND state='approved' AND publication_status='published'
 AND EXISTS(SELECT 1 FROM luemi_private.public_profiles p WHERE p.owner_id=luemi_private.media_assets.owner_id AND p.environment=luemi_private.media_assets.environment AND p.publication_status='published'));
CREATE OR REPLACE FUNCTION luemi_chats.live_match(p_conversation uuid,p_actor uuid,p_environment text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT EXISTS (
 SELECT 1 FROM luemi_chats.conversations c
 JOIN luemi_chats.matches m ON m.id=c.private_match_id AND m.environment=c.environment AND m.status='active'
 JOIN luemi_private.actors a ON a.id=m.actor_low AND a.environment=m.environment AND a.status='active'
 JOIN luemi_private.actors b ON b.id=m.actor_high AND b.environment=m.environment AND b.status='active'
 JOIN luemi_private.public_profiles p ON p.owner_id=m.actor_low AND p.environment=m.environment AND p.publication_status='published'
 JOIN luemi_private.public_profiles q ON q.owner_id=m.actor_high AND q.environment=m.environment AND q.publication_status='published'
 WHERE c.id=p_conversation AND c.environment=p_environment AND
 (m.actor_low=p_actor OR m.actor_high=p_actor)
 AND p_actor=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND NOT EXISTS(SELECT 1 FROM luemi_private.blocks bl WHERE bl.environment=m.environment
 AND ((bl.blocker_id=m.actor_low AND bl.blocked_id=m.actor_high)
 OR (bl.blocker_id=m.actor_high AND bl.blocked_id=m.actor_low)))
 ) $$;
REVOKE ALL ON FUNCTION luemi_chats.live_match(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION luemi_chats.live_match(uuid,uuid,text) TO luemi_chats_writer;
DROP POLICY chats_members_read ON luemi_chats.members;
CREATE POLICY chats_members_read ON luemi_chats.members FOR SELECT TO luemi_chats_writer
 USING(actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid AND environment=current_setting('luemi.environment',true)
 AND luemi_chats.live_match(conversation_id,actor_id,environment));
DROP POLICY chats_members_update_read ON luemi_chats.members;
CREATE POLICY chats_members_update_read ON luemi_chats.members FOR UPDATE TO luemi_chats_writer
 USING(actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid AND environment=current_setting('luemi.environment',true)
 AND luemi_chats.live_match(conversation_id,actor_id,environment))
 WITH CHECK(actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid AND environment=current_setting('luemi.environment',true)
 AND luemi_chats.live_match(conversation_id,actor_id,environment));
COMMIT;
