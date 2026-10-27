-- LUEMI Chats V1 dedicated private Storage bucket.
-- Apply only in the authorized LUEMI Supabase project, after owner approval.
-- This is additive: it creates no public object policies and grants no browser access.
BEGIN;
DO $$
BEGIN
 IF EXISTS (
  SELECT 1 FROM storage.buckets
   WHERE id='luemi-chat-private'
   AND (public IS DISTINCT FROM false
    OR file_size_limit IS DISTINCT FROM 10485760
    OR allowed_mime_types IS DISTINCT FROM ARRAY['image/jpeg','image/png','image/webp']::text[])
 ) THEN
  RAISE EXCEPTION 'Existing LUEMI chat bucket has unsafe or unexpected settings';
 END IF;
END
$$;
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
 VALUES ('luemi-chat-private','luemi-chat-private',false,10485760,
         ARRAY['image/jpeg','image/png','image/webp']::text[])
 ON CONFLICT (id) DO NOTHING;
COMMIT;

-- Verify independently:
-- SELECT id, public, file_size_limit, allowed_mime_types
-- FROM storage.buckets WHERE id='luemi-chat-private';
-- SELECT policyname, roles, cmd FROM pg_policies
-- WHERE schemaname='storage' AND tablename='objects';
-- No policy may grant anon/authenticated read/write access to chat-media keys.
