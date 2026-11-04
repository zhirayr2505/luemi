-- LUEMI product matching V3: ordinary/super likes, weekly wallet and match inbox.
-- Apply after db/chats-v2-mutual-matches.sql. Additive; existing likes stay ordinary.
BEGIN;

ALTER TABLE luemi_chats.likes
 ADD COLUMN kind text NOT NULL DEFAULT 'ordinary'
   CHECK(kind IN ('ordinary','super')),
 ADD COLUMN status text NOT NULL DEFAULT 'active'
   CHECK(status IN ('active','rejected')),
 ADD COLUMN responded_at timestamptz;
ALTER TABLE luemi_chats.likes
 ADD CONSTRAINT chat_like_response_state CHECK(
  (status='active' AND responded_at IS NULL) OR
  (status='rejected' AND responded_at IS NOT NULL));
CREATE INDEX chat_active_incoming_idx ON luemi_chats.likes
 (environment,receiver_id,kind,created_at,sender_id) WHERE status='active';

ALTER TABLE luemi_chats.matches ADD COLUMN started_at timestamptz;
UPDATE luemi_chats.matches pair SET started_at=source.first_message
 FROM (SELECT c.private_match_id,min(message.created_at) AS first_message
  FROM luemi_chats.conversations c JOIN luemi_chats.messages message
   ON message.conversation_id=c.id AND message.environment=c.environment
  WHERE c.private_match_id IS NOT NULL GROUP BY c.private_match_id) source
 WHERE pair.id=source.private_match_id;

CREATE TABLE luemi_chats.premium_entitlements (
 environment text NOT NULL CHECK(length(environment) BETWEEN 1 AND 96),
 actor_id uuid NOT NULL REFERENCES luemi_private.actors(id),
 active_until timestamptz NOT NULL,
 source text NOT NULL CHECK(source IN ('telegram_stars','gift','support')),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(environment,actor_id)
);
CREATE TABLE luemi_chats.superlike_wallets (
 environment text NOT NULL CHECK(length(environment) BETWEEN 1 AND 96),
 actor_id uuid NOT NULL REFERENCES luemi_private.actors(id),
 week_started date NOT NULL,
 weekly_remaining smallint NOT NULL CHECK(weekly_remaining BETWEEN 0 AND 7),
 weekly_cap smallint NOT NULL CHECK(weekly_cap IN (3,7)),
 purchased_remaining integer NOT NULL DEFAULT 0 CHECK(purchased_remaining>=0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(environment,actor_id)
);
CREATE TABLE luemi_chats.stars_superlike_purchases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 environment text NOT NULL CHECK(length(environment) BETWEEN 1 AND 96),
 actor_id uuid NOT NULL REFERENCES luemi_private.actors(id),
 telegram_charge_id text NOT NULL CHECK(length(telegram_charge_id) BETWEEN 1 AND 256),
 pack_size smallint NOT NULL CHECK(pack_size IN (3,5,10,15)),
 stars_amount integer NOT NULL CHECK(stars_amount>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(environment,telegram_charge_id)
);
CREATE TABLE luemi_chats.match_views (
 environment text NOT NULL CHECK(length(environment) BETWEEN 1 AND 96),
 match_id uuid NOT NULL REFERENCES luemi_chats.matches(id),
 actor_id uuid NOT NULL REFERENCES luemi_private.actors(id),
 seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(environment,match_id,actor_id)
);
CREATE TABLE luemi_chats.incoming_like_reveals (
 environment text NOT NULL CHECK(length(environment) BETWEEN 1 AND 96),
 receiver_id uuid NOT NULL REFERENCES luemi_private.actors(id),
 sender_id uuid NOT NULL REFERENCES luemi_private.actors(id),
 revealed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(environment,receiver_id,sender_id),
 CHECK(receiver_id<>sender_id)
);

ALTER TABLE luemi_chats.premium_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.premium_entitlements FORCE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.superlike_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.superlike_wallets FORCE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.stars_superlike_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.stars_superlike_purchases FORCE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.match_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.match_views FORCE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.incoming_like_reveals ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.incoming_like_reveals FORCE ROW LEVEL SECURITY;
REVOKE ALL ON luemi_chats.premium_entitlements,luemi_chats.superlike_wallets,
 luemi_chats.stars_superlike_purchases,luemi_chats.match_views,
 luemi_chats.incoming_like_reveals FROM PUBLIC,anon,authenticated;

GRANT USAGE ON SCHEMA luemi_chats TO luemi_discovery_reader;
GRANT SELECT ON luemi_chats.likes TO luemi_discovery_reader;
CREATE POLICY discovery_like_read ON luemi_chats.likes FOR SELECT TO luemi_discovery_reader
 USING(environment=current_setting('luemi.environment',true)
  AND (sender_id=nullif(current_setting('luemi.viewer_id',true),'')::uuid
    OR receiver_id=nullif(current_setting('luemi.viewer_id',true),'')::uuid));

GRANT SELECT ON luemi_chats.premium_entitlements TO luemi_match_writer;
GRANT SELECT,INSERT ON luemi_chats.superlike_wallets TO luemi_match_writer;
GRANT UPDATE(week_started,weekly_remaining,weekly_cap,purchased_remaining,updated_at)
 ON luemi_chats.superlike_wallets TO luemi_match_writer;
GRANT SELECT ON luemi_chats.stars_superlike_purchases TO luemi_match_writer;
GRANT SELECT,INSERT,UPDATE(seen_at) ON luemi_chats.match_views TO luemi_match_writer;
GRANT SELECT,INSERT ON luemi_chats.incoming_like_reveals TO luemi_match_writer;
GRANT UPDATE(started_at) ON luemi_chats.matches TO luemi_chats_writer;
GRANT SELECT(owner_id,environment,publication_status,display_name,interests,gender)
 ON luemi_private.public_profiles TO luemi_match_writer;
GRANT SELECT(id,owner_id,environment,state,publication_status,position)
 ON luemi_private.media_assets TO luemi_match_writer;
CREATE POLICY match_media_read ON luemi_private.media_assets FOR SELECT TO luemi_match_writer
 USING(environment=current_setting('luemi.environment',true)
  AND state='approved' AND publication_status='published'
  AND EXISTS(SELECT 1 FROM luemi_private.public_profiles p
   WHERE p.owner_id=luemi_private.media_assets.owner_id
    AND p.environment=luemi_private.media_assets.environment
    AND p.publication_status='published'));
CREATE POLICY chat_match_start ON luemi_chats.matches FOR UPDATE TO luemi_chats_writer
 USING(environment=current_setting('luemi.environment',true) AND status='active'
  AND (actor_low=nullif(current_setting('luemi.actor_id',true),'')::uuid
    OR actor_high=nullif(current_setting('luemi.actor_id',true),'')::uuid))
 WITH CHECK(environment=current_setting('luemi.environment',true) AND status='active'
  AND started_at IS NOT NULL
  AND (actor_low=nullif(current_setting('luemi.actor_id',true),'')::uuid
    OR actor_high=nullif(current_setting('luemi.actor_id',true),'')::uuid));
GRANT UPDATE(kind,status,responded_at) ON luemi_chats.likes TO luemi_match_writer;

CREATE POLICY match_entitlement_read ON luemi_chats.premium_entitlements
 FOR SELECT TO luemi_match_writer
 USING(environment=current_setting('luemi.environment',true)
  AND actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid);
CREATE POLICY match_wallet_read ON luemi_chats.superlike_wallets
 FOR SELECT TO luemi_match_writer
 USING(environment=current_setting('luemi.environment',true)
  AND actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid);
CREATE POLICY match_wallet_insert ON luemi_chats.superlike_wallets
 FOR INSERT TO luemi_match_writer
 WITH CHECK(environment=current_setting('luemi.environment',true)
  AND actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
  AND purchased_remaining=0);
CREATE POLICY match_wallet_update ON luemi_chats.superlike_wallets
 FOR UPDATE TO luemi_match_writer
 USING(environment=current_setting('luemi.environment',true)
  AND actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid)
 WITH CHECK(environment=current_setting('luemi.environment',true)
  AND actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid);
CREATE POLICY match_purchase_read ON luemi_chats.stars_superlike_purchases
 FOR SELECT TO luemi_match_writer
 USING(environment=current_setting('luemi.environment',true)
  AND actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid);
CREATE POLICY match_view_owner ON luemi_chats.match_views
 FOR ALL TO luemi_match_writer
 USING(environment=current_setting('luemi.environment',true)
  AND actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
  AND EXISTS(SELECT 1 FROM luemi_chats.matches m WHERE m.id=match_id
   AND m.environment=luemi_chats.match_views.environment AND m.status='active'
   AND luemi_chats.match_views.actor_id IN (m.actor_low,m.actor_high)))
 WITH CHECK(environment=current_setting('luemi.environment',true)
  AND actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
  AND EXISTS(SELECT 1 FROM luemi_chats.matches m WHERE m.id=match_id
   AND m.environment=luemi_chats.match_views.environment AND m.status='active'
   AND luemi_chats.match_views.actor_id IN (m.actor_low,m.actor_high)));
CREATE POLICY incoming_reveal_read ON luemi_chats.incoming_like_reveals
 FOR SELECT TO luemi_match_writer
 USING(environment=current_setting('luemi.environment',true)
  AND receiver_id=nullif(current_setting('luemi.actor_id',true),'')::uuid);
CREATE POLICY incoming_reveal_insert ON luemi_chats.incoming_like_reveals
 FOR INSERT TO luemi_match_writer
 WITH CHECK(environment=current_setting('luemi.environment',true)
  AND receiver_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
  AND EXISTS(SELECT 1 FROM luemi_chats.likes l WHERE l.environment=incoming_like_reveals.environment
   AND l.receiver_id=incoming_like_reveals.receiver_id AND l.sender_id=incoming_like_reveals.sender_id
   AND l.kind='ordinary' AND l.status='active'));

-- A sender may reject only an incoming active like. An ordinary like can be
-- promoted to super only for the same authenticated sender before a response.
CREATE POLICY match_likes_update ON luemi_chats.likes FOR UPDATE TO luemi_match_writer
 USING(environment=current_setting('luemi.environment',true)
  AND (sender_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
    OR receiver_id=nullif(current_setting('luemi.actor_id',true),'')::uuid))
 WITH CHECK(environment=current_setting('luemi.environment',true)
  AND (sender_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
    OR receiver_id=nullif(current_setting('luemi.actor_id',true),'')::uuid));

COMMIT;
