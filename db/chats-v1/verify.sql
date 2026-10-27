-- Read-only verification; expected result is one row where every boolean is true.
SELECT
 to_regclass('luemi_chats.messages') IS NOT NULL AS messages_exists,
 to_regclass('luemi_chats.media') IS NOT NULL AS media_exists,
 (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='luemi_chats.messages'::regclass) AS messages_force_rls,
 (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='luemi_chats.media'::regclass) AS media_force_rls,
 NOT has_schema_privilege('anon','luemi_chats','USAGE') AS anon_denied,
 NOT has_schema_privilege('authenticated','luemi_chats','USAGE') AS authenticated_denied;
