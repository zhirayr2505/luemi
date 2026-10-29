# LUEMI early beta — real registration, 29 October 2026

Scope: real adult Telegram accounts, 3–6 sanitized photos in private Supabase Storage, instant publication, live discovery, mutual matches and chats. Bliki OFF. No demo profiles.

Admission: REM06_EARLY_BETA_ENABLED=1 plus REM06_OPEN_SIGNUPS_ENABLED=1 and REM06_EARLY_BETA_MAX_ACCOUNTS=10; no Telegram invitation whitelist. All existing users and storage objects remain untouched.

Before enabling, merge this tested code and set only LUEMI_BETA_PREFLIGHT=1. Render startup then reports names of missing env variables without any secret values. Read the log, confirm live role/Storage readiness and confirm old draft-only modes are not enabled. Do NOT enable incomplete settings that fail readConfig startup.

Server switches for the verified beta: REM05B_SESSIONS_ENABLED=1, REM06_PRIVATE_DRAFT_ENABLED=1, REM06_MEDIA_ENABLED=1, REM06_MEDIA_BUCKET=luemi-profile-private, REM06_PUBLICATION_ENABLED=1, REM06_INSTANT_PUBLICATION_ENABLED=1, REM06_INSTANT_PUBLICATION_OWNER_ACCEPTED=1, REM06_PRIVACY_APPROVED=1, REM06_OPEN_SIGNUPS_APPROVED=1, REM06_OPEN_SIGNUPS_ENABLED=1, LUEMI_CHATS_V1_ENABLED=1, LUEMI_CHATS_POLICY_APPROVED=1, LUEMI_MATCHES_V1_ENABLED=1, LUEMI_MATCHES_POLICY_APPROVED=1, REM06_ERASURE_REQUEST_ENABLED=1, REM06_ERASURE_POLICY_APPROVED=1, REG01H_SAFETY_OPERATOR_ENABLED=1, REG01H_SAFETY_POLICY_APPROVED=1, REG01H_OPERATOR_LABEL=luemi_owner.

Set REM06_BETA_INVITES_ENABLED=0, REM06_SELF_SERVICE_BETA_ENABLED=0, REM06_FRIENDS_TEST_ENABLED=0. Leave REM06_ERASURE_WORKER_ENABLED=0, LUEMI_BLIKI_ENABLED=0 and irreversible erasure automation OFF. Do not claim actual final purge after 72h until separately proven. The user-visible removal request can hide and revoke access promptly, and an operator must handle final erasure appropriately.

Build-time Vite switches: VITE_LUEMI_REAL_ONLY=1, VITE_LUEMI_AUTH_V2=1, VITE_LUEMI_PRIVATE_DRAFT_UI=1, VITE_LUEMI_PRIVATE_MEDIA_UI=1, VITE_LUEMI_OPEN_SIGNUPS_UI=1, VITE_LUEMI_REGISTRATION_V2=1, VITE_LUEMI_INSTANT_PUBLICATION_UI=1, VITE_LUEMI_REAL_DISCOVERY_UI=1, VITE_LUEMI_REAL_CHATS=1, VITE_LUEMI_REAL_MATCHES=1, VITE_LUEMI_FRIENDS_TEST_MODE=0, VITE_LUEMI_PRIVACY_POLICY_PATH=/privacy.

Keep REM06_CONSENT_VERSION and VITE_LUEMI_CONSENT_VERSION identical: luemi-beta-20261029-v1. Publish the owner-approved privacy content and do not misrepresent unverified legal transfer and retention operations.

Check in Telegram Android WebView with two distinct 18+ accounts: sign in, consent, create and publish real photo profile, reopen, like reciprocally, chat, report/block, request account deletion and restore. Confirm all records are real. If a Render deploy fails, restore the prior feature-switch set without erasing live users or storage. Do not call a CI green result a real Telegram E2E pass.