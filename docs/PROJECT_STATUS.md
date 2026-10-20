# LUEMI · Project Status · 2026-10-19

- GitHub repo `zhirayr2505/luemi`: PRIVATE. Main `09f012b` unchanged.
- Backups preserved: `backup/pre-rebuild-20261019-main`, `backup/pre-rebuild-20261019-profile-v6`.
- Stage 01 Telegram bot: `@LuemiAppBot` on `https://luemi-stage01.onrender.com`. Real owner Android Telegram screenshot confirms Telegram WebView and signed auth (2026-10-19). LIVE Render, original backend guarded verification unchanged.
- Stage 02A source: `feat/stage02-onboarding-v1`, commit `d365dd32d240992ab4ba53ebf31180c78d441995`, verified GitHub CI success: https://github.com/zhirayr2505/luemi/actions/runs/39268775360.
- Stage 02A: React eight-step interactive MOBILE PREVIEW, strict client-side 18+, interests <=15, temporary-only browser photo mosaic. Welcome screen replaced Stage 01 card. Ready for staging QA, NOT full registration.
- Open: authenticated server drafts, official rules/consent, geo provider, file sanitation/upload/storage, private moderation workflow, actual shared public profile, mobile gesture/keyboard QA, full bilingual UX and WCAG acceptance.
- No real profiles created/published, no real photos uploaded, no Supabase mutation and no payments. Stage 02 complete only when these are implemented and verified.
- W06 unchanged wordmark derivative present. Canonical W04 exact PNG still to import as verified binary.
- VEYRA and blotX untouched. Production main untouched.

## Stage 02B · Animated launch, 2026-10-19
- New feature branch `feat/stage02-welcome-motion-v1` from staging commit `971c30e`. Startup loader checks real critical assets and Telegram; W12-style soft animated mist and subtle logo entry, motion preferences.
- Stage 02A registration layout, positions of arrows, wordmark header and gradient progress stripe are unchanged.
- Implementation pending CI, Render staging deployment and Galaxy A55 motion acceptance; not production-final.

## Stage 02D1 — One-screen welcome, 2026-10-19
- Owner approved retaining FIRST fullscreen LUEMI intro only (centered small W06 logo + “Твоя история начинается здесь” on Milky Mist background), removing SECOND welcome composition entirely.
- Intro stays visible at least 1.8 s; after verified Telegram login, same screen reveals animated bottom “Начать” button. Tap transitions to step 1 in 280 ms (or immediately when reduced-motion is active).
- Existing registration logo/gradient strip and round arrows, Telegram fullscreen, and secure auth remain untouched.
- This is a test-preview UI; Stage 02 remains incomplete until persistent signed drafts, photo moderation and approvals.

## Stage 02D · Major UI + photo repair (2026-10-19)
- Based on 68-second Galaxy A55 Telegram recording `1000068619.mp4`. User approved maintaining single intro and existing firm gradient branding.
- Removed legacy launch-bar markup/CSS, obsolete placeholder animation and unused state, leaving exactly one branded intro and CTA on same screen.
- Theme: light/dark only, 43px sun/moon glass button lowered beneath Telegram controls; native View Transition circular reveal with reduced-motion fallback.
- Registration shell: removed boxed logo island, transparent sticky header with original raster logo and light refraction masked to its exact silhouette; retained gradient progress indicator.
- Navigation: unchanged 56px button placement with new translucent white back and branded lavender-pink gradient forward Liquid Glass faces.
- Distance: branded gradient single range, prior text input explicitly blurred on touch to avoid unintended keyboard. Ages: one overlaid double-thumb 18–80 range with gradient fill.
- Interests: 21 unique pastel gradients + one icon per interest, provisional catalog remains unchanged.
- Photos: reproduced video symptom (selected images in Android Photos but none added to mosaic); FileList is now copied synchronously before input reset, bypassing emptied live FileList in deferred React state. Adds count and swipe in local preview.
- Form blocks enter from below with short stagger. Obsolete styling was deleted, not overlaid.
- CI contract-smoke added. Render `prebuild` now runs lint, regression smoke and API tests, then compiles. GitHub Actions queue may be delayed.
- Scope: feature branch `feat/stage02d-major-ui-polish`, staging only after build gate. Production main, Supabase schema/storage and other projects unchanged. Real user registration and photo publishing disabled. Real-device post-deploy acceptance pending.

## Stage 02D Render release verification
- 2026-10-19 16:07 UTC: staging deploy `dep-dbb40c142hec738466m0` for code commit `d3283f4d63cd0b5e84a4254450c46fe8c47d5604` reached Render LIVE.
- Render build preflight: ESLint PASS, 12/12 Stage 02D UI source regressions PASS, 16/16 API tests PASS, TypeScript & Vite bundles built successfully.
- Server startup confirmed, `LuemiAppBot` staging setup confirmed.
- Manual Galaxy A55 UI verification of new design/photo swipes/themes still pending. GitHub Actions runner had queued jobs at time of release; Render build independently validated.
- `main`, Supabase, VEYRA, blotX untouched.

## Stage 02E · Premium Registration Master · 2026-10-19
- Owner APPROVED 7 decisions: sequential brand/text/CTA (~1.95s), lavender-pink glass CTA, uniform soft glass, one validated country+city picker, 750-character bio, 275ms photo hold/reorder, card+profile preview tabs.
- Restoration ref: `backup/pre-stage02e-20261019` at `9b4556d6b9c0ff3ddc185109d267e99c8bfff537`.
- Feature branch: `feat/stage02e-premium-registration`; GitHub CI for `387b5795a1a1b86633b987f0f993bb141ceac74f`: SUCCESS (Actions run 39290830771).
- Replaced legacy registration Steps.tsx and the entire accumulated styles.css; installed lucide-react; shared Glass, InterestCatalog, GeoPicker, PhotoSorter, PhotoCarousel and Preview.
- Country/city validates ID + ISO country code; server `/api/geo/search` and explicit opt-in `/api/geo/reverse` route created. **Without Geoapify key:** only a small labeled DEMO subset of verified cities is available. Do NOT claim full world provider active.
- Intro logo decodes before staged title fade, CTA after visual readiness; only light/dark, lightweight radial accent, stable header/footer around scroll-only form.
- Name Latin/Armenian/Cyrillic etc allowed with spaces, apostrophes, hyphens only; 18+ and 15 interests client-gated; 750 bio; photo mosaic 1+5 reordered by touch hold; preview has card/profile tabs sharing photo carousel.
- **STAGING PREVIEW ONLY:** photos remain local, user data not persisted, no public accounts, no moderation or payments, no production gate passed. Real-device video confirmation still pending.

## Stage 02F · Approved premium refinement · 2026-10-19
- Approved by owner: radius 1–5000 km; radius/country/world search scopes; six one-select goals including “Пока не определился”; 10 categories with 12–16 interests each; 60 searchable languages; 66 bundled round SVG flags; single full-profile preview and one edit action.
- Backup: `backup/pre-stage02f-20261019` at `b6aacb68186a10e2bfa40e2ffb5b475622f3b952`. Feature: `feat/stage02f-premium-finish`.
- Telegram system BackButton remains native; NO application-made upper back button. Compact theme toggle moved beside small brand image under Telegram controls. Logo uses unchanged W06 raster with continuously looping masked highlight.
- Keyboard: stable outside shell height, visible form area shrinks, footer is hidden rather than elevated over the keyboard; focus outline is inset and fully visible. Background beneath footer is transparent.
- Geography: geo-first CTA/manual morph, exact ID selection, three exclusive search scopes and non-linear 5000 km range. Without a configured GEOAPIFY_API_KEY worldwide city autocomplete remains LIMITED DEMO and reverse location reports unavailable; never claim world dataset connected.
- Interests: 10 categories (12–13 items each), 119 unique IDs, selected 15 maximum. Pinned selected-chips region is outside the scrollable form. Languages: 60 entries with search and self-hosted SVG flag badges; language flag representative only.
- Photos: replaced previous faulty preview drag using portal at client viewport pointer position, FLIP movement of surrounding slots, edge scrolling, accessible earlier/later buttons and 1+5 principal badge. Single public-like profile preview reuses photo carousel and all public data.
- Old theme overlay, boxed header CSS, old scroll-attached interest panel, previous 2-tab profile preview, old slider limit, and original photo-drag implementation removed rather than layered.
- **STAGING-ONLY QA**; not a public/complete registration. Device video review and availability of real worldwide geocoder remain open.

## Stage 02F.1 / 02G feedback polish · 2026-10-19
- Owner feedback from new 190.8-second recording `1000068622.mp4`: branded shimmer looked like duplicate white raster, header/logo low, theme icon too large with white disk, focus ring too strong, native Android blue tap flash, interest selection unclear, categories should remain fixed, language chips too large, photo arrows obsolete, photo processing progress missing, goal badge under-emphasized, draft lost after reopening Telegram.
- Work branch `feat/stage02g-feedback-polish`; backup `backup/pre-stage02g-20261019` at `333e49fbddb7ac83cadc17f989dc9b857ddb24c8`.
- Removed mask-based repeated logo glare altogether; original logo stays unchanged. Brand header raised 16px; tiny bare moon/sun glyph closer to wordmark.
- Global tap highlight disabled, input focus redesigned as thin internal Liquid Glass treatment; typed disallowed name characters filtered and explained via inline accessible hint.
- Geo and audience steps compacted. Interest categories fixed in the content area while only interests scroll; selection has small scale, gradient tick and clear elevation. Language area shows three compact columns and flag-only selected chips. Bio textarea reduced.
- Photo reordering left intact with touch hold and FLIP; obsolete overlay arrow controls removed; accessible Alt+arrow fallback on focused slots. Photo FileReader progress is **local processing only** (not server upload), completion checkmark brief; first photo still Main.
- Profile languages are flags only with accessible language titles; dating goal badge stronger.
- Fixed restart-from-zero by local per-account draft (localStorage) + private local photo File storage (IndexedDB). Users can clear it from step 1. Does not upload user files or replace future encrypted server drafts.
- Mobile visual approval, keyboard/fps testing still pending. No main, Supabase, VEYRA or blotX updates.


## 2026-10-20 · Stage 03D.1 approved
- Owner accepted finger-following flicker-free tabs, fixed centered logo in public profiles, natural vertical pan on For You cards, adaptive performance without visible downgrade. Photo shared-element transition deferred.
- Work isolated in feat/stage03d1-smoothness from staging 1ae4d9f. Feed Polish 2, distance radius and Stage 03E remain locked. Device QA pending.


## Stage 03E · Nearby · 2026-10-20
- Owner approved two-column 4:5 portrait grid, compact geography glass panel, name/age/city on photo, one truly shared interest below, bookmark-only action, no map/radar. Current radius 1–5000 km locked.
- Feature branch feat/stage03e-nearby based on staging 1eb930b; cross-shared saves & DemoProfile, honest city/country/world fixture filtering, no fake distances or actual GPS. Production, database and other projects untouched. CI and post-deploy Galaxy A55 review are separate gates.
