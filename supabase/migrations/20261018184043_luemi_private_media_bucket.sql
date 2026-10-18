-- Private media bucket for LUEMI: no anonymous/public access or direct client policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('luemi-profile-private', 'luemi-profile-private', false, 6291456, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
