# LUEMI — Render Web Service, safe dashboard setup

## Current state
New Supabase project `LUEMI` exists and is healthy: `czzyoxrwtnvbicypwrdd` (Frankfurt region, eu-central-1). Its eight `public.luemi_*` tables have RLS enabled, **no client access policies** and no real people/data. The private media bucket is `luemi-profile-private`.

The Render connector could not create a new service (the operation was blocked), so this deployment is a one-time manual action. **Do not change existing service `veyra`**.

## Create a separate FREE web service
1. Open https://dashboard.render.com/web/new and choose **New Web Service** in **My Workspace**.
2. Authorize Render's GitHub integration for the private repository `zhirayr2505/luemi` if prompted. Select **only LUEMI**.
3. Choose `zhirayr2505/luemi`, branch `main`, name `luemi`, region **Frankfurt**, runtime **Node**.
4. Set Instance Type **Free**. Verify price before creating. Do not accept Starter/paid without owner's approval.
5. Build command: `npm install --include=dev && npm run build`
6. Start command: `npm start`
7. Environment: `NODE_VERSION=22`, `NODE_ENV=production` (no bot token, database keys or actual user data yet).
8. Health-check path: `/api/health`. Enable Auto Deploy for `main`.
9. Click **Deploy Web Service**. Save the public `https://…onrender.com` address.

## Verification after creation
- `GET /api/health` => HTTP 200, `{"service":"luemi","status":"ok","stage":"demo"}`
- `GET /api/readiness` => HTTP 503 **by design** (Telegram auth/database backend not yet connected).
- Root `/` => rendered LUEMI Vite app.

This is an intentionally nonfunctional public demo with synthetic profile data. Not production, do not invite real users yet.
