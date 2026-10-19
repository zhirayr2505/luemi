-- Proposed migration for isolated STAGING only. Do NOT apply to production.
-- Existing LUEMI tables and user data are untouched by this migration.
create schema if not exists luemi_rebuild;
create table if not exists luemi_rebuild.auth_audit (
  id bigint generated always as identity primary key,
  telegram_id bigint not null,
  verified_at timestamptz not null default now()
);
alter table luemi_rebuild.auth_audit enable row level security;
revoke all on schema luemi_rebuild from public, anon, authenticated;
revoke all on all tables in schema luemi_rebuild from public, anon, authenticated;
-- No public access policies. Server-only, after explicit migration approval.
