
-- LUEMI Stage 00: isolated beta schema. Security-first: all tables have RLS
-- and ZERO public/anon/authenticated client policies. Server service role ONLY.
-- Never expose the service_role key to a Telegram Mini App.
create table if not exists public.luemi_users (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique check (telegram_user_id > 0),
  display_name text not null check (char_length(display_name) between 2 and 40),
  birth_date date check (birth_date is null or (birth_date between date '1900-01-01' and (current_date - interval '18 years')::date)),
  gender text check (gender in ('woman','man','other')),
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  city text check (char_length(city) <= 120),
  seeks text check (seeks in ('men','women','everyone')),
  purpose text check (purpose in ('relationship','dating','friendship','undecided')),
  bio text not null default '' check (char_length(bio) <= 250),
  language text not null default 'ru' check (language in ('ru','en','hy')),
  status text not null default 'draft' check (status in ('draft','pending_review','active','suspended','deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists luemi_users_discovery_idx on public.luemi_users (status,country_code,created_at desc);

create table if not exists public.luemi_photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.luemi_users(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 3 and 512),
  position smallint not null check (position between 0 and 5),
  moderation text not null default 'pending' check (moderation in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  unique (owner_id,position)
);
create index if not exists luemi_photos_owner_idx on public.luemi_photos(owner_id,position);

create table if not exists public.luemi_interests (
  owner_id uuid not null references public.luemi_users(id) on delete cascade,
  interest_key text not null check (char_length(interest_key) between 1 and 50),
  created_at timestamptz not null default now(),
  primary key(owner_id,interest_key)
);

create table if not exists public.luemi_likes (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.luemi_users(id) on delete cascade,
  receiver_id uuid not null references public.luemi_users(id) on delete cascade,
  kind text not null default 'normal' check (kind in ('normal','special')),
  created_at timestamptz not null default now(),
  check(sender_id<>receiver_id),
  unique(sender_id,receiver_id)
);
create index if not exists luemi_likes_received_idx on public.luemi_likes(receiver_id,created_at desc);

create table if not exists public.luemi_matches (
  id uuid primary key default gen_random_uuid(),
  user_low uuid not null references public.luemi_users(id) on delete cascade,
  user_high uuid not null references public.luemi_users(id) on delete cascade,
  status text not null default 'active' check(status in ('active','closed')),
  created_at timestamptz not null default now(),
  check(user_low < user_high),
  unique(user_low,user_high)
);

create table if not exists public.luemi_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.luemi_matches(id) on delete cascade,
  sender_id uuid not null references public.luemi_users(id) on delete cascade,
  body text not null check(char_length(body) between 1 and 2000),
  moderation text not null default 'pending' check (moderation in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists luemi_messages_thread_idx on public.luemi_messages(match_id,created_at desc);
-- Sender membership in match MUST be checked by server transactions before insert.
-- No client SQL access; enforced in API and a later server-side policy gate.

create table if not exists public.luemi_blocks (
  blocker_id uuid not null references public.luemi_users(id) on delete cascade,
  blocked_id uuid not null references public.luemi_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (blocker_id <> blocked_id),
  primary key(blocker_id,blocked_id)
);

create table if not exists public.luemi_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.luemi_users(id) on delete cascade,
  reported_id uuid not null references public.luemi_users(id) on delete cascade,
  reason text not null check (char_length(reason) between 2 and 120),
  details text check (char_length(details) <= 2000),
  state text not null default 'open' check (state in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);
create index if not exists luemi_reports_moderation_idx on public.luemi_reports(state,created_at desc);

alter table public.luemi_users enable row level security;
alter table public.luemi_photos enable row level security;
alter table public.luemi_interests enable row level security;
alter table public.luemi_likes enable row level security;
alter table public.luemi_matches enable row level security;
alter table public.luemi_messages enable row level security;
alter table public.luemi_blocks enable row level security;
alter table public.luemi_reports enable row level security;

revoke all on table public.luemi_users, public.luemi_photos, public.luemi_interests,
 public.luemi_likes, public.luemi_matches, public.luemi_messages,
 public.luemi_blocks, public.luemi_reports from anon, authenticated;
-- No policies: deny by default to client tokens. Admin service role bypasses RLS
-- only on trusted backend. App must never accept arbitrary user_id from client.
